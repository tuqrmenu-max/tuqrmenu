import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { buildMenuFixture } from './menuFixture.mjs'
test('HTML generado: todos los scripts son JavaScript válido y mantienen el flujo QR',()=>{
 const html=buildMenuFixture()
 const scripts=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1])
 assert.ok(scripts.length)
 scripts.forEach(script=>assert.doesNotThrow(()=>new vm.Script(script)))
 assert.match(html,/qr_pedido_estado_v2/)
 assert.match(html,/loading="lazy"/)
 assert.match(html,/if\(pr.error\)return false;\s*await fetchSentItems\(\);/)
})
