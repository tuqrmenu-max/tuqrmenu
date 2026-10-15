import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import { webcrypto } from 'node:crypto'
import { saveIfChanged } from '../src/lib/saveQueue.js'
import { readPages, applyDateBounds } from '../src/lib/readPages.js'

test('autosave serializa, omite duplicados y permite reintentar errores', async () => {
  const values=[]
  const action=async v=>{values.push(v);await new Promise(r=>setTimeout(r,3))}
  await Promise.all([saveIfChanged('test',1,action),saveIfChanged('test',1,action),saveIfChanged('test',2,action)])
  assert.deepEqual(values,[1,2])
  await assert.rejects(saveIfChanged('retry',1,async()=>{throw Error('offline')}))
  let retried=false;await saveIfChanged('retry',1,async()=>{retried=true});assert.equal(retried,true)
})
test('reportes no truncan ante un límite del servidor menor al solicitado', async()=>{
  const source=Array.from({length:1203},(_,id)=>({id}))
  const rows=await readPages(()=>({range:async start=>({data:source.slice(start,start+200)})}))
  assert.equal(rows.length,1203)
  assert.equal(rows.at(-1).id,1202)
  await assert.rejects(readPages(()=>({range:async()=>({error:Error('offline')})})))
  assert.equal(await readPages(()=>{throw Error('should not run')},()=>false),null)
})
test('fecha final exclusiva y turnos partidos se aplican en consulta',()=>{
  const calls=[];const query={gte(...a){calls.push(['gte',...a]);return this},lt(...a){calls.push(['lt',...a]);return this},or(...a){calls.push(['or',...a]);return this}}
  applyDateBounds(query,'cobrado_at',{fecha_desde:'2026-09-14',fecha_hasta:'2026-09-14'},{rangos:[['2026-09-14T20:00:00Z','2026-09-15T02:00:00Z'],['2026-09-15T03:00:00Z','2026-09-15T05:00:00Z']]})
  assert.equal(calls[1][2],new Date('2026-09-15T00:00:00').toISOString())
  assert.match(calls[2][1],/and\(cobrado_at.gte.*\),and\(/)
})
test('polling pausa oculto, reanuda y no superpone peticiones',async()=>{
  const handlers={};let timer;let count=0;let release
  const context={console,document:{hidden:true,addEventListener:(e,f)=>handlers[e]=f,removeEventListener:()=>{}},window:{addEventListener:(e,f)=>handlers[e]=f,removeEventListener:()=>{}},setTimeout:f=>{timer=f;return 1},clearTimeout:()=>{timer=null}}
  vm.createContext(context)
  vm.runInContext(readFileSync(new URL('../src/lib/visiblePolling.js',import.meta.url),'utf8').replace('export function','function')+';this.start=startVisiblePolling',context)
  const stop=context.start(async()=>{count++;await new Promise(r=>release=r)},5)
  assert.equal(count,0)
  context.document.hidden=false;handlers.visibilitychange();handlers.online()
  assert.equal(count,1)
  release();await new Promise(r=>setImmediate(r));assert.equal(typeof timer,'function')
  context.document.hidden=true;handlers.visibilitychange();assert.equal(timer,null)
  stop()
})
test('imágenes: una carga por contenido, URLs conservadas y errores sin actualizar DB',async()=>{
  let uploads=0,fail=false
  const context={crypto:webcrypto,console,Map,Blob,Uint8Array,Array,fetch:async(url,opts)=>opts?.method==='HEAD'?{ok:true}:fetch(url),supabase:{storage:{from:()=>({upload:async()=>{uploads++;return {error:fail?{message:'denied',statusCode:403}:null}},getPublicUrl:p=>({data:{publicUrl:'https://example.test/'+p}})})}}}
  vm.createContext(context)
  const source=readFileSync(new URL('../src/lib/menuImages.js',import.meta.url),'utf8').replace(/^import .*\n/gm,'').replaceAll('export async function','async function')
  vm.runInContext(source+';this.convert=externalizeImages;this.store=storeMenuImage',context)
  const data='data:image/png;base64,aGVsbG8='
  const result=await context.convert('restaurant',{a:data,b:[data,'https://existing.test/image']})
  assert.equal(uploads,1);assert.equal(result.a,result.b[0]);assert.equal(result.b[1],'https://existing.test/image')
  fail=true;await assert.rejects(context.store('other',data),/conserva/)
})

test('auth: único observador, perfil ligero y una respuesta vieja no cambia usuario',async()=>{
  let callback, subscriptions=0;const jobs=[];const calls=[];let finishOld
  const state={};const store={setState:patch=>Object.assign(state,patch)}
  const supabase={auth:{onAuthStateChange:cb=>{callback=cb;subscriptions++;return {data:{subscription:{unsubscribe(){}}}}},signOut:async()=>callback('SIGNED_OUT',null)},from:table=>({select:columns=>({eq:(_,id)=>({maybeSingle:async()=>{
    calls.push({table,columns,id})
    if(table==='vendedores')return {data:null}
    if(table==='clientes') {
      if(id==='old')await new Promise(r=>finishOld=r)
      return {data:{id:'restaurant-'+id,user_id:id,nombre_restaurante:id}}
    }
    return {data:null}
  }})})})}
  const context={supabase,useAuthStore:store,toast:{error(){}},setTimeout:fn=>jobs.push(fn),console}
  vm.createContext(context)
  let code=readFileSync(new URL('../src/hooks/useAuth.js',import.meta.url),'utf8')
  code=code.slice(code.indexOf('let authStarted'),code.indexOf('export function useAuth')).replaceAll('import.meta.hot','false')
  vm.runInContext(code+';this.start=startAuth',context)
  context.start();context.start();assert.equal(subscriptions,1)
  callback('INITIAL_SESSION',{user:{id:'old'}});const old=jobs.shift()()
  await new Promise(r=>setImmediate(r))
  callback('SIGNED_IN',{user:{id:'new'}});await jobs.shift()()
  finishOld();await old
  assert.equal(state.profile.user_id,'new')
  assert.equal(calls.find(c=>c.table==='clientes').columns,'id,user_id,nombre_restaurante')
  const n=jobs.length;callback('SIGNED_IN',{user:{id:'new'}});assert.equal(jobs.length,n)
  callback('SIGNED_OUT',null);assert.equal(state.profile,null);assert.equal(state.rol,null)
})
