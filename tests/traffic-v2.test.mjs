import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { createRevisionRefresh } from '../src/lib/revisionRefresh.js'
import { loadVersionedCatalog } from '../src/lib/catalogCache.js'
import { mergeMessages, afterMessage, beforeMessage } from '../src/lib/chatCursor.js'
import { reportBounds } from '../src/lib/reportBounds.js'

test('revisiones: 100 rondas sin cambios no recargan pedidos; errores se reintentan',async()=>{
 let revision=1,loads=0,fail=false,failRead=false
 const refresh=createRevisionRefresh(async()=>{if(failRead)throw Error('offline');return revision},async()=>{loads++;if(fail)throw Error('offline')})
 for(let i=0;i<100;i++)await refresh()
 assert.equal(loads,1)
 fail=true;revision=2;await assert.rejects(refresh());assert.equal(loads,2)
 fail=false;await refresh();assert.equal(loads,3)
 failRead=true;await assert.rejects(refresh());assert.equal(loads,3)
 failRead=false;await refresh();assert.equal(loads,3)
})
test('revisiones: carrera durante descarga y llamadas concurrentes no pierden cambio',async()=>{
 let revision=1,loads=0,release
 const refresh=createRevisionRefresh(async()=>revision,async()=>{loads++;if(loads===1)await new Promise(r=>release=r)})
 const first=refresh();const second=refresh();assert.equal(first,second)
 await new Promise(r=>setImmediate(r));revision=2;release();await first
 await refresh();assert.equal(loads,2)
})
test('catálogo: caché por restaurante/versión, error no reemplaza copia válida',async()=>{
 const data=new Map();const storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)}
 let loads=0
 const fetchCatalog=async()=>{loads++;return{version:'1',products:[{nombre:'Café'}],categories:[]}}
 const options={key:'backend:A',version:1,fetchCatalog,storage}
 await loadVersionedCatalog(options);await loadVersionedCatalog(options);assert.equal(loads,1)
 await loadVersionedCatalog({...options,key:'backend:B'});assert.equal(loads,2)
 await assert.rejects(loadVersionedCatalog({...options,version:2,fetchCatalog:async()=>{throw Error('offline')}}))
 assert.equal(JSON.parse(data.get(options.key)).version,'1')
 const fresh=await loadVersionedCatalog({...options,version:2,fetchCatalog:async()=>({version:2,products:[],categories:[]})})
 assert.equal(fresh.version,'2');assert.deepEqual(fresh.products,[])
 await loadVersionedCatalog({...options,storage:{getItem(){throw Error('denied')},setItem(){throw Error('full')}}})
})
test('chat: deduplicación y cursores preservan mensajes con igual fecha',()=>{
 const a={id:'a',created_at:'2026-09-15T12:00:00Z'},b={...a,id:'b'}
 assert.deepEqual(mergeMessages([b],[a,b]).map(x=>x.id),['a','b'])
 assert.equal(mergeMessages([b],[{...a,qr_sequence:1}]).at(-1).id,'a')
 assert.equal(afterMessage({...a,qr_sequence:12}),'qr_sequence.gt.12');assert.match(beforeMessage(b),/id.lt.b/)
})
test('fechas: día local incluye hasta medianoche siguiente, no corta turnos nocturnos',()=>{
 const bounds=reportBounds({fecha_desde:'2026-09-15',fecha_hasta:'2026-09-15'})
 assert.equal(bounds.desde,new Date('2026-09-15T00:00:00').toISOString())
 assert.equal(bounds.hasta,new Date('2026-09-16T00:00:00').toISOString())
 assert.deepEqual(reportBounds({}),{desde:null,hasta:null})
})
function qrContext(overrides={}){
 const source=readFileSync(new URL('../src/components/Builder/useBuilderState.js',import.meta.url),'utf8')
 const start=source.indexOf('let sentItemsFlight=null;'),end=source.indexOf('async function generarCodigoPedido',start)
 let calls=0,items=0,fail=false
 let row={id:'1',estado_pedido:'nuevo',items_version:'1:1'}
 const context={console,state:{sentItems:[],sentOrder:null},supabaseClient:{},DATA:{socioId:'A'},mesaNumero:0,
 localStorage:{getItem:()=> 'session'},sbRpc:async()=>{calls++;return fail?{error:'offline'}:{data:row}},
 sbSelect:async()=>{items++;return{data:[{producto_id:'P',cantidad:1,productos:{nombre:'Café',precio:100}}]}},...overrides}
 vm.createContext(context);vm.runInContext(source.slice(start,end)+';this.refresh=fetchSentItems',context)
 return {context,setRow:r=>row=r,setFail:v=>fail=v,counts:()=>({calls,items})}
}
test('QR: estado pequeño; detalle solo si cambia, entrega no cobra y cierre detiene consultas',async()=>{
 const qr=qrContext();const refresh=qr.context.refresh
 await refresh();assert.deepEqual(qr.counts(),{calls:1,items:1})
 for(let i=0;i<20;i++)await refresh(false)
 assert.deepEqual(qr.counts(),{calls:21,items:1})
 qr.setRow({id:'1',estado_pedido:'entregado',items_version:'1:1',ocultar_checklist:true});await refresh(false)
 assert.equal(qr.context.state.sentItems.length,1);assert.equal(qr.context.state.checklistVisible,false)
 qr.setRow({id:'1',estado_pedido:'entregado',items_version:'2:1'});await refresh(false);assert.equal(qr.counts().items,2)
 qr.setFail(true);await refresh(false);assert.equal(qr.context.state.sentItems.length,1)
 qr.setFail(false);qr.setRow({id:'1',estado_pedido:'cerrado',items_version:'3:1'});await refresh(false)
 assert.equal(qr.context.state.sentItems.length,0)
 const calls=qr.counts().calls;await refresh(false);assert.equal(qr.counts().calls,calls)
 qr.setRow({id:'2',estado_pedido:'nuevo',items_version:'0:1'});await refresh();assert.equal(qr.counts().items,3)
})
test('QR: envío durante consulta en vuelo fuerza una segunda lectura',async()=>{
 let release,calls=0
 const qr=qrContext({sbRpc:async()=>{calls++;if(calls===1)await new Promise(r=>release=r);return{data:{id:'1',estado_pedido:'nuevo',items_version:String(calls)}}}})
 const first=qr.context.refresh();await new Promise(r=>setImmediate(r))
 const second=qr.context.refresh();release();await Promise.all([first,second])
 assert.equal(calls,2)
})
