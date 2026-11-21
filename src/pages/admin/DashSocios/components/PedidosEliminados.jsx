// Pedidos eliminados desde Mesas (Mesa 0 / Mesa 00). Solo para control: vienen de la tabla
// pedidos_eliminados, NO de tickets_caja, así que nunca entran en los totales de Caja.
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { applyDateBounds } from '@/lib/readPages'
import { etiquetaMesa, mesaDesdeTexto } from '@/lib/mesa00'

const money = n => `$${Number(n || 0).toFixed(2)}`

// filtrosFecha: { fecha_desde, fecha_hasta } (mismo período que la lista de tickets); mesaNum: texto del filtro Mesa.
export default function PedidosEliminados({ clienteId, filtrosFecha, mesaNum, rangoCaja }) {
  const [filas, setFilas] = useState([])
  const [error, setError] = useState('')
  const [abierto, setAbierto] = useState(true)

  useEffect(() => {
    if (!clienteId) return
    let alive = true
    ;(async () => {
      let q = supabase
        .from('pedidos_eliminados')
        .select('id,mesa,codigo_pedido,comensal_nombre,items,total,eliminado_por,eliminado_at,estado_pedido')
        .eq('cliente_id', clienteId)
      q = applyDateBounds(q, 'eliminado_at', rangoCaja ? { fecha_desde: '', fecha_hasta: '' } : filtrosFecha, rangoCaja)
      if (mesaNum !== '') q = q.eq('mesa', mesaDesdeTexto(mesaNum))
      const { data, error: e } = await q.order('eliminado_at', { ascending: false }).limit(200)
      if (!alive) return
      if (e) { setError('No se pudieron cargar los pedidos eliminados: ' + e.message); setFilas([]); return }
      setError('')
      setFilas(data || [])
    })()
    return () => { alive = false }
  }, [clienteId, filtrosFecha.fecha_desde, filtrosFecha.fecha_hasta, mesaNum, rangoCaja])

  return (
    <div className="bg-dark-800 rounded-xl border border-red-500/30 overflow-hidden mb-6">
      <button type="button" onClick={() => setAbierto(v => !v)} className="w-full p-4 flex items-center justify-between gap-3 text-left">
        <span className="text-white font-bold">🗑️ Pedidos eliminados <span className="text-dark-400 text-xs font-normal">· solo control, no suman a la caja</span></span>
        <span className="text-red-400 text-sm font-bold shrink-0">{filas.length} {abierto ? '▲' : '▼'}</span>
      </button>
      {abierto && (error
        ? <p role="alert" className="p-4 text-red-400 text-sm border-t border-dark-700">{error}</p>
        : filas.length === 0
          ? <p className="p-4 text-dark-400 text-sm text-center border-t border-dark-700">No hay pedidos eliminados en este período.</p>
          : <div className="divide-y divide-dark-700 border-t border-dark-700">
              {filas.map(f => {
                const fecha = new Date(f.eliminado_at)
                const items = Array.isArray(f.items) ? f.items : []
                const por = f.eliminado_por
                return (
                  <div key={f.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-red-300 font-mono font-bold">#{f.codigo_pedido || '—'} <span className="text-xs font-sans font-normal text-red-400">ELIMINADO</span></p>
                        <p className="text-white text-sm">Mesa {etiquetaMesa(f.mesa)}{f.comensal_nombre ? ` · ${f.comensal_nombre}` : ''}</p>
                        <p className="text-dark-300 text-xs">{fecha.toLocaleDateString('es-AR')} · {fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} · Eliminó: {por?.nombre || por?.usuario || 'Sin registrar'}</p>
                      </div>
                      <p className="text-dark-400 font-bold line-through shrink-0">{money(f.total)}</p>
                    </div>
                    <ul className="bg-dark-900/50 rounded-lg p-3 space-y-1">
                      {items.length === 0 && <li className="text-dark-400 text-sm">Sin productos</li>}
                      {items.map((i, idx) => (
                        <li key={idx} className="text-sm flex items-start justify-between gap-3 text-dark-300">
                          <span className="min-w-0 break-words"><span className="text-cyan-300">{i.cantidad || 0}x</span> {i.nombre || 'Producto'}
                            {i.sin?.length > 0 && <span className="block text-xs text-yellow-400">sin {i.sin.join(', ')}</span>}
                            {i.comentario && <span className="block text-xs text-dark-400">“{i.comentario}”</span>}
                          </span>
                          <span className="shrink-0">{money(i.subtotal)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </div>
      )}
    </div>
  )
}
