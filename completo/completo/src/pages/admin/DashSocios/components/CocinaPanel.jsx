import { createRevisionRefresh } from '@/lib/revisionRefresh'
import { startVisiblePolling } from '@/lib/visiblePolling'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import ChecklistEstados from './ChecklistEstados'
import ChatEquipo from './ChatEquipo'

// Pantalla de cocina (KDS): muestra los pedidos que caja/admin derivó a
// "cocina" desde el panel de Delivery/Retiro (Mesa 0). El cocinero los
// prepara y marca el check azul; cuando lo hace el pedido vuelve a
// aparecer en Mesas (estado=preparado) para que caja lo despache.
//
// Tambien muestra pedidos ya en estado 'preparado' (cocinero termino)
// para que el rol cocina vea el avance de su propio trabajo.
export default function CocinaPanel({ clienteId }) {
  const [pedidos, setPedidos] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorLectura, setErrorLectura] = useState('')
  const [showChat, setShowChat] = useState(false)

  useEffect(() => {
    if (!clienteId) return
    let active = true
    const check = createRevisionRefresh(async () => {
      const { data, error } = await supabase.from('clientes').select('qr_operations_version').eq('id', clienteId).single()
      if (error) throw error
      return data?.qr_operations_version
    }, fetchPedidos)
    const stop = startVisiblePolling(async () => {
      try { await check(); if (active) setErrorLectura('') }
      catch (e) { if (active) setErrorLectura('No se pudo actualizar Cocina: ' + e.message) }
      finally { if (active) setLoading(false) }
    }, 4000)
    return () => { active = false; stop() }
  }, [clienteId])

  const fetchPedidos = async () => {
    const { data: comensales, error: comensalesError } = await supabase
      .from('comensales')
      .select('id, nombre, telefono, codigo_pedido, metodo_entrega, derivado_area, estado_pedido')
      .eq('cliente_id', clienteId)
      .eq('mesa', 0)
      .eq('derivado_area', 'cocina')
      .in('estado_pedido', ['en_preparacion', 'preparado'])
      .order('id', { ascending: true })

    if (comensalesError) throw comensalesError
    if (!comensales || comensales.length === 0) { setPedidos([]); return }

    const comensalIds = comensales.map(c => c.id)
    const { data: items, error: itemsError } = await supabase
      .from('pedidos_qr')
      .select('comensal_id, cantidad, productos!inner(nombre)')
      .in('comensal_id', comensalIds)
      .eq('pagado', 0)

    if (itemsError) throw itemsError
    const itemsPorComensal = {}
    ;(items || []).forEach(i => {
      if (!itemsPorComensal[i.comensal_id]) itemsPorComensal[i.comensal_id] = []
      itemsPorComensal[i.comensal_id].push({ nombre: i.productos?.nombre, cantidad: i.cantidad })
    })

    setPedidos(comensales.map(c => ({ ...c, items: itemsPorComensal[c.id] || [] })))
  }

  const cerrarPedidoCocina = async (comensalId, comentario) => {
    // Cocina no suele cerrar pedidos (eso es del cajero), pero si llega
    // a llegar el click verde, hacemos el update para no bloquear UX.
    const { error: e1 } = await supabase
      .from('pedidos_qr')
      .update({ pagado: 1 })
      .eq('comensal_id', comensalId)
      .eq('pagado', 0)
    if (e1) { toast.error('Error cerrando pedidos: ' + e1.message); return }
    const { error: e2 } = await supabase
      .from('comensales')
      .update({
        estado_pedido: 'cerrado',
        cerrado_at: new Date().toISOString(),
        comentario_cliente: comentario || null
      })
      .eq('id', comensalId)
    if (e2) { toast.error('Error cerrando comensal: ' + e2.message); return }
    toast.success('Pedido cerrado y archivado')
    fetchPedidos().catch(e => setErrorLectura(e.message))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  return (
    <div>
      {errorLectura && <p role="alert" className="text-red-400 p-3">{errorLectura}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-white">👨‍🍳 Cocina</h1>
        <button
          onClick={() => setShowChat(prev => !prev)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${showChat ? 'bg-primary-500 text-white' : 'bg-dark-700 hover:bg-dark-600 text-white'}`}
        >
          💬 Chat del equipo
        </button>
      </div>

      <ChatEquipo clienteId={clienteId} open={showChat} onClose={() => setShowChat(false)} />

      {pedidos.length === 0 ? (
        <div className="bg-dark-800 rounded-2xl p-8 border border-dark-700 text-center">
          <p className="text-dark-400">No hay pedidos en cocina por ahora.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {pedidos.map(p => (
            <div key={p.id} className={`bg-dark-800 border-2 rounded-xl p-4 ${
              p.estado_pedido === 'preparado' ? 'border-blue-500/40' : 'border-purple-500/40'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-purple-400 font-mono font-bold text-sm">#{p.codigo_pedido || '—'}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  p.estado_pedido === 'preparado'
                    ? 'bg-blue-500/20 text-blue-400'
                    : 'bg-yellow-500/20 text-yellow-400'
                }`}>
                  {p.estado_pedido === 'preparado' ? 'Preparado' : 'En cocina'}
                </span>
              </div>
              <p className="text-white text-sm font-medium mb-1">{p.nombre || 'Sin nombre'}</p>
              <p className="text-dark-400 text-xs mb-3">
                {p.metodo_entrega === 'delivery' ? '🛵 Delivery' : '🏠 Retira en el local'}
              </p>
              <div className="border-t border-b border-dark-700 py-2 mb-3 min-h-[50px]">
                {p.items.length > 0 ? p.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-sm text-dark-200 py-1">
                    <span className="text-cyan-400 font-bold mr-2">{item.cantidad}x</span>
                    <span className="flex-1">{item.nombre}</span>
                  </div>
                )) : <p className="text-dark-500 text-xs italic text-center">Sin items</p>}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-dark-400">Checklist:</span>
                <ChecklistEstados
                  comensal={p}
                  onUpdate={fetchPedidos}
                  onCerrar={cerrarPedidoCocina}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
