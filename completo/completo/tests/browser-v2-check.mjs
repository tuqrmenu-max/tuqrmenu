// Local, mocked browser smoke test. No credentials or live Supabase required.
import assert from 'node:assert/strict'
import { buildMenuFixture } from './menuFixture.mjs'
const { chromium }=await import(process.env.QRMENU_PLAYWRIGHT_MODULE || 'playwright')
const browser=await chromium.launch({headless:true})
try {
 for(const mesa of [0,1]){
  const page=await browser.newPage({viewport:{width:390,height:844}})
  const errors=[];page.on('pageerror',e=>errors.push(e.message))
  let rpc=0,detail=0
  let order={id:'order-1',estado_pedido:'nuevo',items_version:'1:1',metodo_entrega:'retiro',ocultar_checklist:false}
  await page.addInitScript(m=>localStorage.setItem('mesa_'+m+'_sesion','session'),mesa)
  await page.route('https://qr-test.invalid/**',async route=>{
   const url=new URL(route.request().url());let data=[]
   if(url.pathname.endsWith('/rpc/qr_pedido_estado_v2')){rpc++;data=order}
   else if(url.pathname.endsWith('/pedidos_qr')){
    if(route.request().method()==='GET'){detail++;data=[{producto_id:'p1',cantidad:1,productos:{nombre:'Cortado',precio:100}}]}
    else data=[{id:'line-2'}]
   }else if(url.pathname.endsWith('/mesas_operacion'))data=[{estado:'Libre'}]
   else if(url.pathname.endsWith('/productos'))data=[{id:'p1',nombre:'Cortado'}]
   else if(url.pathname.endsWith('/comensales'))data=[{id:'order-2'}]
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)})
  })
  await page.route('https://qrmenu.local.test/**',route=>route.fulfill({contentType:'text/html',body:buildMenuFixture()}))
  await page.clock.install()
  await page.goto('https://qrmenu.local.test/?mesa='+mesa)
  await page.waitForFunction(()=>state.sentItems.length===1)
  await page.locator('#menuBtn').click()
  await page.locator('#categoriesCart').click()
  await page.waitForFunction(()=>state.screen==='cart')
  const before=detail
  await page.clock.fastForward(6000)
  await page.waitForFunction(()=>sentItemsFlight===null)
  assert.equal(detail,before,'unchanged order must not refetch products')
  order={...order,estado_pedido:'entregado'}
  await page.clock.fastForward(6000)
  await page.waitForFunction(()=>state.sentOrder?.estado_pedido==='entregado')
  assert.equal(await page.evaluate(()=>state.sentItems.length),1,'delivery must not clear unpaid order')
  order={...order,estado_pedido:'cerrado',items_version:'2:1'}
  await page.clock.fastForward(6000)
  await page.waitForFunction(()=>state.sentItems.length===0)
  const finalCalls=rpc
  await page.clock.fastForward(18000)
  assert.equal(rpc,finalCalls,'closed order stops requests')
  if(mesa===0){
   order={...order,id:'order-2',estado_pedido:'nuevo',items_version:'0:1'}
   const sent=await page.evaluate(async()=>{state.cart={'0':1};state.customerName='Cliente';state.customerPhone='1234';return enviarPedidoDelivery()})
   assert.equal(sent,true)
   assert.equal(await page.evaluate(()=>state.sentOrder.id),'order-2','new Mesa 0 order restarts tracking')
  }
  assert.deepEqual(errors,[])
  await page.close()
 }
 console.log('Browser QR OK: Mesa 0/1, navegación, estado, entrega, cobro y nuevo pedido; sin errores JS.')
} finally { await browser.close() }
