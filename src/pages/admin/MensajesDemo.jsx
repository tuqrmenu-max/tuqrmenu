import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

// Mensajes que llegan desde "Pedir una demo" en la landing (tabla mensajes_demo).
// Número para abrir WhatsApp: solo dígitos; si es un número local argentino de 10 dígitos
// (código de área + número) se le antepone 549.
function linkWhatsApp(numero, nombre) {
  let d = String(numero || '').replace(/\D/g, '').replace(/^0+/, '')
  if (d.length === 10) d = '549' + d
  const texto = `Hola ${nombre || ''}! Te escribo de TuQRMenu por tu pedido de demo.`
  return `https://wa.me/${d}?text=${encodeURIComponent(texto)}`
}

export default function MensajesDemo() {
  const [mensajes, setMensajes] = useState([])
  const [loading, setLoading] = useState(true)

  const cargar = useCallback(async () => {
    const { data, error } = await supabase
      .from('mensajes_demo')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) toast.error('No se pudieron cargar los mensajes')
    else setMensajes(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    cargar()
    const channel = supabase
      .channel('mensajes_demo_page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mensajes_demo' }, cargar)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [cargar])

  const marcarLeido = async (m, leido) => {
    const { error } = await supabase.from('mensajes_demo').update({ leido }).eq('id', m.id)
    if (error) toast.error('No se pudo actualizar')
    else cargar()
  }

  const eliminar = async (m) => {
    if (!confirm(`¿Eliminar el mensaje de "${m.nombre}"?`)) return
    const { error } = await supabase.from('mensajes_demo').delete().eq('id', m.id)
    if (error) toast.error('No se pudo eliminar')
    else {
      toast.success('Mensaje eliminado')
      cargar()
    }
  }

  const nuevos = mensajes.filter((m) => !m.leido).length

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Nuevos Mensajes</h1>
        <p className="text-dark-400 mt-1">
          Pedidos de demo que llegan desde la página de bienvenida
          {nuevos > 0 && <span className="text-red-400 font-medium"> · {nuevos} sin leer</span>}
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
        </div>
      ) : mensajes.length === 0 ? (
        <div className="bg-dark-800 rounded-2xl p-12 border border-dark-700 text-center">
          <p className="text-dark-400">Todavía no hay mensajes</p>
        </div>
      ) : (
        <div className="space-y-4">
          {mensajes.map((m) => (
            <div
              key={m.id}
              className={`bg-dark-800 rounded-2xl border p-6 ${
                m.leido ? 'border-dark-700' : 'border-primary-500/60'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <h3 className="text-xl font-semibold text-white break-words">{m.nombre}</h3>
                    {!m.leido && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-400">
                        Nuevo
                      </span>
                    )}
                  </div>
                  <p className="text-dark-400 text-sm mt-1">WhatsApp</p>
                  <p className="text-white break-all">{m.whatsapp}</p>
                  <p className="text-dark-400 text-sm mt-2">
                    {new Date(m.created_at).toLocaleString('es-AR')}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <a
                    href={linkWhatsApp(m.whatsapp, m.nombre)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => !m.leido && marcarLeido(m, true)}
                    className="py-2.5 px-5 bg-accent-500 hover:bg-accent-600 text-white rounded-xl transition font-medium"
                  >
                    Responder por WhatsApp
                  </a>
                  <button
                    onClick={() => marcarLeido(m, !m.leido)}
                    className="py-2.5 px-5 bg-dark-600 hover:bg-dark-500 text-white rounded-xl transition font-medium"
                  >
                    {m.leido ? 'Marcar como no leído' : 'Marcar como leído'}
                  </button>
                  <button
                    onClick={() => eliminar(m)}
                    className="py-2.5 px-5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl transition font-medium"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
