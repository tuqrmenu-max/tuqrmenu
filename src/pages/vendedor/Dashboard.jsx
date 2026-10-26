import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '@/lib/i18n'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

export default function VendedorDashboard() {
  const { t } = useI18n()
  const { profile } = useAuth()
  const [solicitudes, setSolicitudes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (profile?.id) {
      fetchSolicitudes()
    }
  }, [profile])

  const fetchSolicitudes = async () => {
    const { data, error } = await supabase
      .from('solicitudes_cliente')
      .select('*')
      .eq('vendedor_id', profile.id)
      .order('created_at', { ascending: false })

    if (!error) setSolicitudes(data)
    setLoading(false)
  }

  const pendientes = solicitudes.filter(s => s.estado === 'pendiente')
  const aprobadas = solicitudes.filter(s => s.estado === 'aprobada')
  const rechazadas = solicitudes.filter(s => s.estado === 'rechazada')

  return (
    <div className="px-4 py-6">
      <Link
        to="/vendedor/nuevo-cliente"
        className="block w-full py-4 bg-primary-500 hover:bg-primary-600 text-white rounded-2xl transition font-semibold text-center mb-6"
      >
        + Nuevo Cliente
      </Link>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-dark-800 rounded-2xl p-4 border border-dark-700 text-center">
          <p className="text-2xl font-bold text-white">{solicitudes.length}</p>
          <p className="text-dark-400 text-xs mt-1">Total</p>
        </div>
        <div className="bg-dark-800 rounded-2xl p-4 border border-dark-700 text-center">
          <p className="text-2xl font-bold text-yellow-400">{pendientes.length}</p>
          <p className="text-dark-400 text-xs mt-1">Pendientes</p>
        </div>
        <div className="bg-dark-800 rounded-2xl p-4 border border-dark-700 text-center">
          <p className="text-2xl font-bold text-accent-400">{aprobadas.length}</p>
          <p className="text-dark-400 text-xs mt-1">Aprobados</p>
        </div>
      </div>

      <h2 className="text-lg font-semibold text-white mb-3">Mis Solicitudes</h2>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto"></div>
        </div>
      ) : solicitudes.length === 0 ? (
        <div className="bg-dark-800 rounded-2xl p-8 border border-dark-700 text-center">
          <p className="text-dark-400">No tenés solicitudes todavía</p>
        </div>
      ) : (
        <div className="space-y-3">
          {solicitudes.map((s) => (
            <div key={s.id} className="bg-dark-800 rounded-2xl border border-dark-700 p-4">
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-white font-semibold">{s.nombre_restaurante}</h3>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  s.estado === 'pendiente' ? 'bg-yellow-500/20 text-yellow-400' :
                  s.estado === 'aprobada' ? 'bg-accent-500/20 text-accent-400' :
                  'bg-red-500/20 text-red-400'
                }`}>
                  {s.estado === 'pendiente' ? 'Pendiente' :
                   s.estado === 'aprobada' ? 'Aprobado' : 'Rechazado'}
                </span>
              </div>
              <p className="text-dark-400 text-sm">{s.whatsapp || 'Sin WhatsApp'}</p>
              <p className="text-dark-500 text-xs mt-1">
                {new Date(s.created_at).toLocaleDateString('es-AR')}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
