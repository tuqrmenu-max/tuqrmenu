import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

// Opiniones: cuando alguien intenta hacer un pedido fuera del horario
// configurado (Carta > Horario para recibir pedidos), el menú público le
// muestra el horario y le permite dejar una opinión/consulta. Ese mensaje
// llega acá (y también se manda por WhatsApp en el momento), identificado
// por el número de WhatsApp de quien escribió, para poder responderle.
export default function OpinionesAdmin({ clienteId }) {
  const [opiniones, setOpiniones] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('pendientes') // 'pendientes' | 'todas'
  const [replyTarget, setReplyTarget] = useState(null)
  const [respuesta, setRespuesta] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (clienteId) fetchOpiniones()
  }, [clienteId])

  const fetchOpiniones = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('opiniones')
      .select('*')
      .eq('cliente_id', clienteId)
      .order('created_at', { ascending: false })
    if (!error) setOpiniones(data || [])
    setLoading(false)
  }

  const pendientes = opiniones.filter(o => !o.respondida)
  const listaFiltrada = filtro === 'pendientes' ? pendientes : opiniones

  const abrirResponder = (opinion) => {
    setReplyTarget(opinion)
    setRespuesta(opinion.respuesta || '')
  }

  const cerrarResponder = () => {
    setReplyTarget(null)
    setRespuesta('')
  }

  const enviarRespuesta = async () => {
    if (!respuesta.trim()) {
      toast.error('Escribí una respuesta')
      return
    }
    const numero = (replyTarget.whatsapp || '').replace(/\D/g, '')
    if (!numero) {
      toast.error('Este mensaje no tiene un número de WhatsApp válido')
      return
    }
    setSending(true)
    try {
      const { error } = await supabase
        .from('opiniones')
        .update({
          respondida: true,
          respuesta: respuesta.trim(),
          respondida_en: new Date().toISOString()
        })
        .eq('id', replyTarget.id)
      if (error) throw error

      window.open(`https://wa.me/${numero}?text=${encodeURIComponent(respuesta.trim())}`, '_blank')
      toast.success('Respuesta guardada, se abrió WhatsApp para enviarla')
      cerrarResponder()
      fetchOpiniones()
    } catch (err) {
      toast.error('Error al guardar la respuesta: ' + (err.message || ''))
    } finally {
      setSending(false)
    }
  }

  const eliminarOpinion = async (id) => {
    if (!confirm('¿Eliminar esta opinión?')) return
    const { error } = await supabase.from('opiniones').delete().eq('id', id)
    if (!error) {
      toast.success('Opinión eliminada')
      fetchOpiniones()
    }
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
      <div className="bg-dark-800 rounded-xl p-4 mb-6 border border-dark-700">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-white font-bold text-lg">
            💬 Opiniones {pendientes.length > 0 && (
              <span className="bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded text-xs align-middle ml-1">
                {pendientes.length} pendiente{pendientes.length !== 1 ? 's' : ''}
              </span>
            )}
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => setFiltro('pendientes')}
              className={`px-3 py-2 rounded-lg text-sm transition ${filtro === 'pendientes' ? 'bg-primary-500 text-white' : 'bg-dark-700 text-dark-300 hover:bg-dark-600'}`}
            >
              Pendientes
            </button>
            <button
              onClick={() => setFiltro('todas')}
              className={`px-3 py-2 rounded-lg text-sm transition ${filtro === 'todas' ? 'bg-primary-500 text-white' : 'bg-dark-700 text-dark-300 hover:bg-dark-600'}`}
            >
              Todas ({opiniones.length})
            </button>
          </div>
        </div>
        <p className="text-dark-400 text-xs mt-2">
          Mensajes que dejaron clientes que intentaron hacer un pedido fuera del horario configurado en Carta.
        </p>
      </div>

      {listaFiltrada.length === 0 ? (
        <div className="bg-dark-800 rounded-xl p-12 border border-dark-700 text-center">
          <p className="text-dark-400">
            {filtro === 'pendientes' ? 'No hay opiniones pendientes' : 'Todavía no hay opiniones'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {listaFiltrada.map(op => (
            <div
              key={op.id}
              className="bg-dark-800 rounded-xl border border-dark-700 p-4 hover:border-primary-500/50 transition"
            >
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-white font-semibold">📱 {op.whatsapp || 'Sin WhatsApp'}</h3>
                    {op.mesa && (
                      <span className="bg-dark-700 text-dark-300 px-2 py-0.5 rounded text-xs">Mesa {op.mesa}</span>
                    )}
                    <span className={`px-2 py-0.5 rounded text-xs ${op.respondida ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                      {op.respondida ? 'Respondida' : 'Pendiente'}
                    </span>
                  </div>
                  <p className="text-dark-200 text-sm mt-2 whitespace-pre-wrap break-words">{op.mensaje}</p>
                  <p className="text-dark-500 text-xs mt-1">
                    {new Date(op.created_at).toLocaleString('es-AR')}
                  </p>
                  {op.respondida && op.respuesta && (
                    <div className="mt-2 bg-dark-900 border border-dark-700 rounded-lg p-2">
                      <p className="text-dark-400 text-xs mb-1">Tu respuesta:</p>
                      <p className="text-dark-200 text-sm whitespace-pre-wrap break-words">{op.respuesta}</p>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => abrirResponder(op)}
                    className="bg-green-600/20 text-green-400 hover:bg-green-600/30 px-3 py-2 rounded-lg text-sm transition whitespace-nowrap"
                  >
                    Responder
                  </button>
                  <button
                    onClick={() => eliminarOpinion(op.id)}
                    className="bg-red-500/20 text-red-400 hover:bg-red-500/30 px-3 py-2 rounded-lg text-sm transition"
                    title="Eliminar"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal responder */}
      {replyTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 rounded-2xl p-6 w-full max-w-md border border-dark-700">
            <h3 className="text-xl font-semibold text-white mb-1">Responder</h3>
            <p className="text-dark-400 text-sm mb-4">
              Para: <span className="text-white">{replyTarget.whatsapp}</span>
            </p>
            <div className="bg-dark-900 border border-dark-700 rounded-lg p-2 mb-3">
              <p className="text-dark-400 text-xs mb-1">Su mensaje:</p>
              <p className="text-dark-200 text-sm whitespace-pre-wrap break-words">{replyTarget.mensaje}</p>
            </div>
            <textarea
              autoFocus
              rows={4}
              value={respuesta}
              onChange={e => setRespuesta(e.target.value)}
              placeholder="Escribí tu respuesta..."
              className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-xl text-white placeholder-dark-400 focus:outline-none focus:border-primary-500 resize-none"
            />
            <p className="text-dark-500 text-xs mt-1 mb-3">
              Se guarda la respuesta acá y se abre WhatsApp para enviarla a este número.
            </p>
            <div className="flex gap-3">
              <button
                onClick={cerrarResponder}
                disabled={sending}
                className="flex-1 bg-dark-700 hover:bg-dark-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
              >
                Cancelar
              </button>
              <button
                onClick={enviarRespuesta}
                disabled={sending}
                className="flex-1 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
              >
                {sending ? 'Enviando...' : '📱 Enviar por WhatsApp'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
