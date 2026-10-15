// Run with: QRMENU_PGLITE_MODULE=/absolute/path/to/pglite/dist/index.js node tests/sql-v2-check.mjs
// PGlite is used only in a disposable local database, never against production.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const { PGlite } = await import(process.env.QRMENU_PGLITE_MODULE || '@electric-sql/pglite')
const db = new PGlite()
const A='10000000-0000-0000-0000-000000000001', B='10000000-0000-0000-0000-000000000002'
const U='20000000-0000-0000-0000-000000000001', C='30000000-0000-0000-0000-000000000001', P='40000000-0000-0000-0000-000000000001', K='50000000-0000-0000-0000-000000000001'
await db.exec(`
create role anon; create role authenticated;
create table clientes(id uuid primary key,user_id uuid);
create table productos(id uuid primary key,cliente_id uuid,categoria_id uuid,nombre text,precio numeric,imagen text,descripcion text);
create table categorias(id uuid primary key,cliente_id uuid,nombre text,imagen text,orden integer);
create table comensales(id uuid primary key,cliente_id uuid,mesa integer,sesion_id text,estado_pedido text,derivado_area text,metodo_entrega text,ocultar_checklist boolean);
create table mesas_operacion(id uuid primary key,cliente_id uuid,numero integer,estado text);
create table pedidos_qr(id uuid primary key,comensal_id uuid,producto_id uuid,pagado integer,cantidad integer,es_promo integer,fecha_hora timestamptz);
create table horario_usuarios(id uuid primary key,cliente_id uuid,user_id uuid,nombre text,usuario text,entrada_at timestamptz,salida_at timestamptz,ultima_actividad_at timestamptz);
create table cliente_usuarios(id uuid primary key,cliente_id uuid,user_id uuid);
create table tickets_caja(id uuid primary key,cliente_id uuid,mesa integer,total numeric,cobrado_at timestamptz);
create table chat_mensajes(id uuid primary key,cliente_id uuid,created_at timestamptz);
insert into clientes values('${A}','${U}'),('${B}',null);
`)
const sql=readFileSync(new URL('../supabase/optimizar_trafico_v2.sql',import.meta.url),'utf8')
await db.exec(sql)
await db.exec(sql) // safe to rerun
const row=async(sql)=> (await db.query(sql)).rows[0]
await db.exec(`insert into categorias values('${K}','${A}','Café',null,1); insert into productos values('${P}','${A}','${K}','Cortado',100,null,'Descripción compatible');`)
assert.equal((await row(`select qr_catalog_version from clientes where id='${A}'`)).qr_catalog_version,2)
assert.equal((await row(`select qr_catalog_version from clientes where id='${B}'`)).qr_catalog_version,0)
let cat=(await row(`select qr_catalogo_v2('${A}') result`)).result
assert.equal(cat.products[0].detalle,'Descripción compatible')
await db.exec(`insert into comensales values('${C}','${A}',0,'session','nuevo','cocina','retiro',false,0);
insert into pedidos_qr values(gen_random_uuid(),'${C}','${P}',0,2,0,'2026-09-15T20:00Z');`)
let state=(await row(`select qr_pedido_estado_v2('${A}',0,'session') result`)).result
assert.equal(state.items_version,'1:2')
assert.equal((await row(`select qr_pedido_estado_v2('${B}',0,'session') result`)).result,null)
await db.exec(`update pedidos_qr set cantidad=3 where comensal_id='${C}';`)
state=(await row(`select qr_pedido_estado_v2('${A}',0,'session') result`)).result
assert.equal(state.items_version,'2:2')
await db.exec(`update comensales set estado_pedido='entregado' where id='${C}';`)
state=(await row(`select qr_pedido_estado_v2('${A}',0,'session') result`)).result
assert.equal(state.estado_pedido,'entregado');assert.equal(state.items_version,'2:2')
await db.exec(`insert into pedidos_qr values(gen_random_uuid(),'${C}','${P}',1,2,1,'2026-09-16T03:00Z');
insert into tickets_caja select gen_random_uuid(),'${A}',0,100,'2026-09-15T22:00Z' from generate_series(1,70);
insert into horario_usuarios values(gen_random_uuid(),'${A}','${U}','Ana','ana','2026-09-14T12:00Z',null,null),
(gen_random_uuid(),'${A}','${U}','Ana','ana','2026-09-15T20:00Z','2026-09-16T02:00Z',null);`)
let summary=(await row(`select qr_caja_resumen_v2('${A}',null,null,0,true,'[["2026-09-15T19:00Z","2026-09-16T00:00Z"],["2026-09-16T02:00Z","2026-09-16T04:00Z"]]') result`)).result
assert.equal(summary.tickets_count,70);assert.equal(summary.tickets_total,7000)
assert.equal(summary.totales.items_vendidos,5);assert.equal(summary.totales.total_facturado,300)
assert.equal(summary.totales.descuento_promo,200);assert.equal(summary.categorias['Café'].cantidad,5)
summary=(await row(`select qr_caja_resumen_v2('${A}',null,null,0,false) result`)).result
assert.equal(summary.totales.items_vendidos,3)
let hours=(await row(`select qr_horario_resumen_v2('${A}','2026-09-15T00:00Z','2026-09-16T00:00Z') result`)).result
assert.equal(hours[0].total_ms,21600000);assert.equal(hours[0].registros,1);assert.equal(hours[0].conectado,true)
await db.exec(`insert into chat_mensajes(id,cliente_id,created_at) values(gen_random_uuid(),'${A}','2026-09-15'),(gen_random_uuid(),'${A}','2026-09-14');`)
assert.deepEqual((await db.query('select qr_sequence from chat_mensajes order by qr_sequence')).rows.map(r=>r.qr_sequence),[1,2])
await db.exec(`begin; update productos set precio=120 where id='${P}'; rollback;`)
assert.equal((await row(`select qr_catalog_version from clientes where id='${A}'`)).qr_catalog_version,2)
await db.exec(`update pedidos_qr set pagado=1;`)
assert.notEqual((await row(`select qr_pedido_estado_v2('${A}',0,'session') result`)).result.items_version,'3:2')
// Invoker RPCs must retain the calling role's RLS, including aggregate results.
await db.exec(`grant usage on schema public to authenticated,anon; grant select on all tables in schema public to authenticated,anon;
alter table clientes enable row level security; create policy test_client on clientes for select using(id='${A}');
alter table comensales enable row level security; create policy test_comensal on comensales for select using(cliente_id='${A}');
alter table tickets_caja enable row level security; create policy test_ticket on tickets_caja for select using(cliente_id='${A}');
alter table horario_usuarios enable row level security; create policy test_hours on horario_usuarios for select using(cliente_id='${A}');
insert into tickets_caja values(gen_random_uuid(),'${B}',0,9999,now());
set role authenticated;`)
assert.equal((await row(`select qr_catalogo_v2('${B}') result`)).result,null)
assert.equal((await row(`select qr_caja_resumen_v2('${B}') result`)).result.tickets_total,0)
assert.deepEqual((await row(`select qr_horario_resumen_v2('${B}') result`)).result,[])
await db.exec('reset role; set role anon;')
await assert.rejects(db.query(`select qr_caja_resumen_v2('${A}')`),/permission denied/)
await db.exec('reset role;')
// Both schemas supported: descripcion only above, detalle only here.
await db.exec('alter table productos rename column descripcion to detalle;')
assert.equal((await row(`select qr_catalogo_v2('${A}') result`)).result.products[0].detalle,'Descripción compatible')
await db.close()
console.log('SQL v2 OK: reejecución, versiones/rollback, catálogo, pedido, cobro, totales, turnos, presencia y RLS.')
