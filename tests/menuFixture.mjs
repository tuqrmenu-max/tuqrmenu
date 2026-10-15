import vm from 'node:vm'
import { readFileSync } from 'node:fs'
export function buildMenuFixture() {
 let store
 const source=readFileSync(new URL('../src/components/Builder/useBuilderState.js',import.meta.url),'utf8')
   .replace(/^import .*\n/gm,'').replace('export const useBuilderState','const useBuilderState')
   .replaceAll('import.meta.env.VITE_SUPABASE_URL',"'https://qr-test.invalid'")
   .replaceAll('import.meta.env.VITE_SUPABASE_ANON_KEY',"'public-test-key'")
 const context={console,create:fn=>{store=fn(patch=>Object.assign(store,typeof patch==='function'?patch(store):patch),()=>store);return store}}
 vm.createContext(context);vm.runInContext(source,context)
 store.setField('socioId','10000000-0000-0000-0000-000000000001')
 store.setField('clientName','Restaurante de prueba')
 store.setField('rows',[{id:'p1',categoria:'Café',producto:'Cortado',precio:'100',detalle:'Con leche'}])
 return store.exportHtml().html
}
