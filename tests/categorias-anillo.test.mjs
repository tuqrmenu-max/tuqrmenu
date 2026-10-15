import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'

function exportar(layout) {
  let store
  const source = readFileSync(new URL('../src/components/Builder/useBuilderState.js', import.meta.url), 'utf8')
    .replace(/^import .*\n/gm, '').replace('export const useBuilderState', 'const useBuilderState')
    .replaceAll('import.meta.env.VITE_SUPABASE_URL', "'https://qr-test.invalid'")
    .replaceAll('import.meta.env.VITE_SUPABASE_ANON_KEY', "'public-test-key'")
  const context = { console, create: fn => { store = fn(patch => Object.assign(store, typeof patch === 'function' ? patch(store) : patch), () => store); return store } }
  vm.createContext(context); vm.runInContext(source, context)
  store.setField('socioId', '10000000-0000-0000-0000-000000000001')
  store.setField('rows', [{ id: 'a', categoria: 'Tortas', producto: 'Oreo', precio: '10' }, { id: 'b', categoria: 'Cafetería', producto: 'Cortado', precio: '5' }])
  if (layout !== undefined) store.setField('categoriesLayout', layout)
  return { html: store.exportHtml().html, config: store.getBuilderConfig() }
}

test('categorías: por defecto es "fijo" y el HTML lo declara', () => {
  const { html, config } = exportar()
  assert.equal(config.categoriesLayout, 'fijo')
  assert.match(html, /"categoriesLayout":"fijo"/)
})

test('categorías: "anillo" viaja en la config y en el HTML; cualquier otro valor cae a "fijo"', () => {
  assert.equal(exportar('anillo').config.categoriesLayout, 'anillo')
  assert.match(exportar('anillo').html, /"categoriesLayout":"anillo"/)
  assert.match(exportar('raro').html, /"categoriesLayout":"fijo"/)
})

test('categorías: los scripts del HTML con anillo son JavaScript válido', () => {
  const { html } = exportar('anillo')
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1])
  assert.ok(scripts.length > 0)
  scripts.forEach(s => assert.doesNotThrow(() => new vm.Script(s)))
  assert.match(html, /function renderCategoriesRing\(\)/)
})
