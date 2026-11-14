import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { IDIOMAS } from '@/lib/idiomas'
import { resumenPendientes, totalPendientes } from '@/lib/traduccionesCarta'
import toast from 'react-hot-toast'

const MAX_NOMBRES = 40

function Lista({ titulo, items, color }) {
  if (!items.length) return null
  const visibles = items.slice(0, MAX_NOMBRES)
  return (
    <div className="mt-3">
      <p className={`text-xs font-semibold uppercase tracking-wide ${color}`}>{titulo} ({items.length})</p>
      <ul className="mt-1 text-sm text-dark-300 space-y-0.5">
        {visibles.map(i => <li key={i.id}>• {i.nombre || '(sin nombre)'}</li>)}
        {items.length > visibles.length && (
          <li className="text-dark-500">… y {items.length - visibles.length} más</li>
        )}
      </ul>
    </div>
  )
}

// Recordatorio dentro de Idiomas: qué categorías y productos todavía no están traducidos
// (o cambiaron desde que se tradujeron) en cada idioma habilitado para el menú del cliente.
export default function TraduccionesPendientes({ clienteId, idiomas }) {
  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [abierto, setAbierto] = useState({})
  const [error, setError] = useState(null)

  const lista = idiomas.filter(c => c !== 'es')
  const claveIdiomas = lista.join(',')

  const cargar = useCallback(async (manual) => {
    if (!clienteId) return
    setCargando(true)
    setError(null)
    const [cats, prods] = await Promise.all([
      supabase.from('categorias').select('id,nombre,traducciones').eq('cliente_id', clienteId).order('orden', { ascending: true }),
      supabase.from('productos').select('id,nombre,detalle,traducciones').eq('cliente_id', clienteId).order('nombre', { ascending: true }),
    ])
    setCargando(false)
    const err = cats.error || prods.error
    if (err) {
      setError(err.message)
      if (manual) toast.error('No se pudo revisar: ' + err.message)
      return
    }
    setDatos({ categorias: cats.data || [], productos: prods.data || [] })
    if (manual) setAbierto(Object.fromEntries(lista.map(c => [c, true])))
  }, [clienteId, claveIdiomas])

  useEffect(() => { cargar(false) }, [cargar])

  const resumen = datos ? resumenPendientes(datos, lista) : {}
  const hayPendientes = lista.some(c => resumen[c] && totalPendientes(resumen[c]) > 0)

  return (
    <div className="bg-dark-800 rounded-2xl p-6 border border-dark-700">
      <div className="flex items-start justify-between gap-4 mb-2">
        <div>
          <h2 className="text-lg font-semibold text-white">Traducción de la carta</h2>
          <p className="text-dark-400 text-sm mt-1">
            Traducí categorías y productos una vez que la carta del cliente esté armada. Después,
            solo lo que se agregue o se cambie. Acá ves qué falta.
          </p>
        </div>
        <button
          type="button"
          onClick={() => cargar(true)}
          disabled={cargando || lista.length === 0}
          className="bg-dark-700 hover:bg-dark-600 disabled:opacity-50 text-white px-3 py-2 rounded-lg text-sm transition whitespace-nowrap"
        >
          {cargando ? 'Revisando...' : '🔔 Revisar qué falta traducir'}
        </button>
      </div>

      {lista.length === 0 && (
        <p className="text-dark-400 text-sm mt-3">
          Marcá idiomas para el menú del cliente y guardá: acá vas a ver qué falta traducir en cada uno.
        </p>
      )}

      {error && (
        <p className="text-red-400 text-sm mt-3">
          No se pudo leer la carta: {error}. Si dice que falta la columna "traducciones", corré la migración de idiomas.
        </p>
      )}

      {datos && lista.length > 0 && (
        <>
          <div className={`mt-4 rounded-xl px-4 py-3 text-sm ${hayPendientes ? 'bg-amber-500/10 border border-amber-500/40 text-amber-300' : 'bg-green-500/10 border border-green-500/40 text-green-300'}`}>
            {hayPendientes
              ? `⚠️ Hay traducciones pendientes. La carta tiene ${datos.categorias.length} categorías y ${datos.productos.length} productos.`
              : '✓ Todo traducido en los idiomas habilitados.'}
          </div>

          <div className="mt-4 space-y-3">
            {lista.map(code => {
              const info = IDIOMAS.find(i => i.code === code)
              const r = resumen[code]
              const total = totalPendientes(r)
              return (
                <div key={code} className="border border-dark-600 rounded-xl p-4">
                  <button
                    type="button"
                    onClick={() => setAbierto(a => ({ ...a, [code]: !a[code] }))}
                    className="w-full flex items-center justify-between gap-3 text-left"
                  >
                    <span className="text-white font-medium">
                      {info?.bandera} {info?.nombre}
                    </span>
                    <span className={`text-sm ${total ? 'text-amber-300' : 'text-green-400'}`}>
                      {total
                        ? `${r.categorias.falta.length + r.categorias.desactualizada.length} categorías · ${r.productos.falta.length + r.productos.desactualizada.length} productos pendientes`
                        : 'Al día ✓'}
                      <span className="ml-2 text-dark-500">{abierto[code] ? '▲' : '▼'}</span>
                    </span>
                  </button>
                  {abierto[code] && total > 0 && (
                    <div>
                      <Lista titulo="Categorías sin traducir" items={r.categorias.falta} color="text-amber-400" />
                      <Lista titulo="Categorías cambiadas desde que se tradujeron" items={r.categorias.desactualizada} color="text-orange-400" />
                      <Lista titulo="Productos sin traducir" items={r.productos.falta} color="text-amber-400" />
                      <Lista titulo="Productos cambiados desde que se tradujeron" items={r.productos.desactualizada} color="text-orange-400" />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
