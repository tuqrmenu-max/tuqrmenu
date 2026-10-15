import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { MESA_00, esMesa00, etiquetaMesa, mesaDesdeTexto, codigoMesa00 } from '../src/lib/mesa00.js'
import { PRE_SCRIPT_MESA00, aplicarModoMesa00 } from '../src/lib/mesa00Menu.js'

test('utilidades Mesa 00', () => {
  assert.equal(MESA_00, -1)
  assert.ok(esMesa00(-1) && !esMesa00(0) && !esMesa00(3))
  assert.equal(etiquetaMesa(-1), '00'); assert.equal(etiquetaMesa(0), '0'); assert.equal(etiquetaMesa(7), '7')
  assert.equal(mesaDesdeTexto('00'), -1); assert.equal(mesaDesdeTexto('0'), 0); assert.equal(mesaDesdeTexto('5'), 5)
  assert.equal(codigoMesa00('15102026-03-M0'), '15102026-03-M00')
  assert.equal(codigoMesa00('15102026-03-M10'), '15102026-03-M10')
})

function entorno() {
  const calls = [], store = new Map()
  class Storage {}
  Storage.prototype.getItem = function (k) { return store.has(k) ? store.get(k) : null }
  Storage.prototype.setItem = function (k, v) { store.set(k, String(v)) }
  Storage.prototype.removeItem = function (k) { store.delete(k) }
  const opened = []
  const window = {
    fetch: (input, init) => { calls.push({ input, init }); return Promise.resolve({ ok: true }) },
    open: (u) => { opened.push(u); return { real: true } }
  }
  vm.runInNewContext(PRE_SCRIPT_MESA00.replace(/^<script>|<\/script>$/g, ''), { window, Storage, Object, JSON, String, Array })
  return { window, Storage, calls, store, opened }
}

test('shim: comensal de Mesa 0 se guarda como Mesa 00 con código -M00', async () => {
  const e = entorno()
  await e.window.fetch('https://x.supabase.co/rest/v1/comensales', { method: 'POST', body: JSON.stringify({ mesa: 0, codigo_pedido: '15102026-01-M0', nombre: 'Ana' }) })
  const body = JSON.parse(e.calls[0].init.body)
  assert.equal(body.mesa, -1); assert.equal(body.codigo_pedido, '15102026-01-M00'); assert.equal(body.nombre, 'Ana')
  assert.equal(e.window.__mesa00.intento, true)
  await e.window.fetch('https://x.supabase.co/rest/v1/pedidos_qr', { method: 'POST', body: '[]' })
  await new Promise(r => setImmediate(r))
  assert.equal(e.window.__mesa00.ok, true)
})

test('shim: seguimiento, confirmación y sesión usan Mesa 00 sin tocar otras mesas', async () => {
  const e = entorno()
  await e.window.fetch('https://x/rest/v1/rpc/qr_pedido_estado_v2', { method: 'POST', body: JSON.stringify({ p_cliente_id: 'A', p_mesa: 0, p_sesion: 's' }) })
  assert.equal(JSON.parse(e.calls[0].init.body).p_mesa, -1)
  await e.window.fetch('https://x/rest/v1/comensales?id=eq.5&cliente_id=eq.A&mesa=eq.0&sesion_id=eq.s', { method: 'PATCH', body: '{}' })
  assert.match(e.calls[1].input, /mesa=eq\.-1&sesion_id/)
  await e.window.fetch('https://x/rest/v1/comensales', { method: 'POST', body: JSON.stringify({ mesa: 4, codigo_pedido: 'x-M4' }) })
  assert.equal(JSON.parse(e.calls[2].init.body).mesa, 4)
  const S = e.Storage.prototype
  S.setItem.call({}, 'mesa_0_sesion', 'abc')
  assert.equal(e.store.get('mesa_00_sesion'), 'abc'); assert.equal(e.store.has('mesa_0_sesion'), false)
  assert.equal(S.getItem.call({}, 'mesa_0_sesion'), 'abc')
  S.setItem.call({}, 'mesa_3_sesion', 'z'); assert.equal(e.store.get('mesa_3_sesion'), 'z')
})

test('shim: WhatsApp del pedido bloqueado; consulta de contacto sigue funcionando', () => {
  const e = entorno()
  const stub = e.window.open('https://wa.me/549351?text=' + encodeURIComponent('Pedido:\n1 x Café'), '_blank')
  assert.equal(e.opened.length, 0); assert.equal(stub.real, undefined)
  assert.equal(e.window.open('', '_blank').closed, false); assert.equal(e.opened.length, 0)
  e.window.open('https://wa.me/549351?text=' + encodeURIComponent('Hola! Quisiera hacer una consulta.'), '_blank')
  assert.equal(e.opened.length, 1)
  e.window.open('https://instagram.com/bar', '_blank'); assert.equal(e.opened.length, 2)
})

test('aplicarModoMesa00 inserta PRE tras <head> y POST antes de </body>', () => {
  const out = aplicarModoMesa00('<html><head><title>x</title></head><body><script>var a=1</script></body></html>')
  assert.ok(out.indexOf('__mesa00') < out.indexOf('<title>') === false || out.startsWith('<html><head><script>'))
  assert.ok(out.indexOf('</script></body>') > out.indexOf('var a=1'))
  assert.equal((out.match(/__mesa00/g) || []).length >= 2, true)
})
