import { useState, useEffect } from 'react'
import { useI18n } from '@/lib/i18n'
import { supabase, createIsolatedClient } from '@/lib/supabase'
import toast from 'react-hot-toast'

export default function NuevosClientes() {
  const { t } = useI18n()
  const [solicitudes, setSolicitudes] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedImage, setSelectedImage] = useState(null)
  const [credenciales, setCredenciales] = useState(null)
  const [solicitudAprobar, setSolicitudAprobar] = useState(null)
  const [nuevoEmail, setNuevoEmail] = useState('')
  const [nuevoPassword, setNuevoPassword] = useState('')

  useEffect(() => {
    fetchSolicitudes()
  }, [])

  const fetchSolicitudes = async () => {
    const { data, error } = await supabase
      .from('solicitudes_cliente')
      .select('*, vendedores(nombre, email)')
      .order('created_at', { ascending: false })
    
    if (!error) setSolicitudes(data)
    setLoading(false)
  }

  const aprobarSolicitud = async (solicitud, email, password) => {
    try {
      toast.loading('Creando cliente...', { id: 'aprobar' })
      
      // Cliente aislado: evita que este signUp() reemplace la sesión del
      // superadmin logueado por la del cliente recién aprobado.
      const isolated = createIsolatedClient()
      const { data: authData, error: authError } = await isolated.auth.signUp({
        email,
        password,
        options: {
          data: { rol: 'cliente', nombre: solicitud.nombre_restaurante }
        }
      })
      
      if (authError) throw new Error(`Error al crear usuario: ${authError.message}`)
      
      const { data: clienteData, error: clienteError } = await supabase
        .from('clientes')
        .insert({
          vendedor_id: solicitud.vendedor_id,
          user_id: authData.user.id,
          nombre_restaurante: solicitud.nombre_restaurante,
          whatsapp: solicitud.whatsapp,
          direccion: solicitud.direccion,
          bienvenido: `¡Bienvenidos a ${solicitud.nombre_restaurante}!`
        })
        .select()
        .single()
      
      if (clienteError) throw new Error(`Error al crear registro: ${clienteError.message}`)
      
      await supabase.from('mesas').insert({
        cliente_id: clienteData.id,
        numero: 0,
        activa: true
      })
      
      await supabase
        .from('solicitudes_cliente')
        .update({ estado: 'aprobada' })
        .eq('id', solicitud.id)
      
      toast.dismiss('aprobar')
      toast.success('Cliente creado exitosamente')
      
      setCredenciales({
        nombre: solicitud.nombre_restaurante,
        email,
        password
      })
      
      setSolicitudAprobar(null)
      setNuevoEmail('')
      setNuevoPassword('')
      fetchSolicitudes()
    } catch (error) {
      toast.dismiss('aprobar')
      toast.error(error.message)
    }
  }

  const rechazarSolicitud = async (id) => {
    const { error } = await supabase
      .from('solicitudes_cliente')
      .update({ estado: 'rechazada' })
      .eq('id', id)
    
    if (!error) {
      toast.success('Solicitud rechazada')
      fetchSolicitudes()
    }
  }

  const eliminarSolicitud = async (solicitud) => {
    if (!confirm(`¿Eliminar permanentemente "${solicitud.nombre_restaurante}"?`)) return

    try {
      toast.loading('Eliminando...', { id: 'eliminar' })

      if (solicitud.user_id) {
        const { error: authError } = await supabase.auth.admin.deleteUser(solicitud.user_id)
        if (authError) console.warn('No se pudo borrar auth user:', authError.message)
      }

      const { data, error } = await supabase
        .from('solicitudes_cliente')
        .delete()
        .eq('id', solicitud.id)
        .select()

      if (error) throw error

      if (!data || data.length === 0) {
        throw new Error('No se pudo eliminar. Verificá las permisos RLS en Supabase.')
      }

      toast.dismiss('eliminar')
      toast.success('Eliminado permanentemente')
      fetchSolicitudes()
    } catch (error) {
      toast.dismiss('eliminar')
      toast.error('Error al eliminar: ' + error.message)
    }
  }

  const getImagenes = (solicitud) => {
    const imagenes = []
    for (let i = 1; i <= 20; i++) {
      const img = solicitud[`imagen_${i}`]
      if (img) imagenes.push(img)
    }
    return imagenes
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">{t('nuevosClientes')}</h1>
      
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto"></div>
        </div>
      ) : solicitudes.length === 0 ? (
        <div className="bg-dark-800 rounded-2xl p-12 border border-dark-700 text-center">
          <p className="text-dark-400">No hay solicitudes pendientes</p>
        </div>
      ) : (
        <div className="space-y-6">
          {solicitudes.map((solicitud) => {
            const imagenes = getImagenes(solicitud)
            return (
              <div key={solicitud.id} className="bg-dark-800 rounded-2xl border border-dark-700 overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-dark-700">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-xl font-semibold text-white">{solicitud.nombre_restaurante}</h3>
                      <p className="text-dark-400 text-sm">
                        Vendedor: {solicitud.vendedores?.nombre} ({solicitud.vendedores?.email})
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      solicitud.estado === 'pendiente' ? 'bg-yellow-500/20 text-yellow-400' :
                      solicitud.estado === 'aprobada' ? 'bg-accent-500/20 text-accent-400' :
                      'bg-red-500/20 text-red-400'
                    }`}>
                      {solicitud.estado === 'pendiente' ? 'Pendiente' :
                       solicitud.estado === 'aprobada' ? 'Aprobada' : 'Rechazada'}
                    </span>
                  </div>
                </div>
                
                {/* Datos */}
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-dark-400 text-sm">WhatsApp</p>
                    <p className="text-white">{solicitud.whatsapp || 'No especificado'}</p>
                  </div>
                  <div>
                    <p className="text-dark-400 text-sm">Ubicación</p>
                    <p className="text-white">{solicitud.direccion || 'No especificada'}</p>
                  </div>
                  <div>
                    <p className="text-dark-400 text-sm">Horario</p>
                    <p className="text-white">{solicitud.horario || 'No especificado'}</p>
                  </div>
                  <div>
                    <p className="text-dark-400 text-sm">Fecha</p>
                    <p className="text-white">{new Date(solicitud.created_at).toLocaleDateString('es-AR')}</p>
                  </div>
                </div>
                
                {/* Observaciones */}
                {solicitud.observaciones && (
                  <div className="px-6 pb-4">
                    <p className="text-dark-400 text-sm">Observaciones</p>
                    <p className="text-white">{solicitud.observaciones}</p>
                  </div>
                )}
                
                {/* Fotos */}
                {imagenes.length > 0 && (
                  <div className="px-6 pb-4">
                    <p className="text-dark-400 text-sm mb-2">Fotos ({imagenes.length})</p>
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {imagenes.map((img, i) => (
                        <img
                          key={i}
                          src={img}
                          alt={`Foto ${i + 1}`}
                          className="w-20 h-20 object-cover rounded-lg cursor-pointer hover:opacity-80 flex-shrink-0"
                          onClick={() => setSelectedImage(img)}
                        />
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Acciones */}
                <div className="p-6 border-t border-dark-700 flex gap-4">
                  <button
                    onClick={() => eliminarSolicitud(solicitud)}
                    className="py-3 px-6 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl transition font-medium"
                  >
                    Eliminar
                  </button>
                  {solicitud.estado === 'pendiente' && (
                    <>
                      <button
                        onClick={() => rechazarSolicitud(solicitud.id)}
                        className="flex-1 py-3 bg-dark-600 hover:bg-dark-500 text-white rounded-xl transition font-medium"
                      >
                        Rechazar
                      </button>
                      <button
                        onClick={() => {
                          setSolicitudAprobar(solicitud)
                          setNuevoEmail(`${solicitud.nombre_restaurante?.toLowerCase().replace(/\s+/g, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '').slice(0, 20) || 'restaurante'}@socio.qrmenu.com`)
                          setNuevoPassword('')
                        }}
                        className="flex-1 py-3 bg-accent-500 hover:bg-accent-600 text-white rounded-xl transition font-medium"
                      >
                        Aprobar y Crear Cliente
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
      
      {/* Modal imagen */}
      {selectedImage && (
        <div 
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4 cursor-pointer"
          onClick={() => setSelectedImage(null)}
        >
          <img src={selectedImage} alt="Vista completa" className="max-w-full max-h-full object-contain" />
        </div>
      )}
      
      {/* Modal credenciales */}
      {credenciales && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 rounded-2xl p-6 w-full max-w-md border border-dark-700">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-accent-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-accent-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white">Cliente Creado</h3>
              <p className="text-dark-400">{credenciales.nombre}</p>
            </div>
            
            <div className="bg-dark-700 rounded-xl p-4 space-y-3 mb-6">
              <div>
                <p className="text-dark-400 text-sm">Email</p>
                <p className="text-white font-mono">{credenciales.email}</p>
              </div>
              <div>
                <p className="text-dark-400 text-sm">Contraseña</p>
                <p className="text-white font-mono">{credenciales.password}</p>
              </div>
            </div>
            
            <p className="text-dark-400 text-sm text-center mb-4">
              Copiá estos datos y compartilos con el cliente para que pueda loguearse.
            </p>
            
            <button
              onClick={() => {
                navigator.clipboard.writeText(`Email: ${credenciales.email}\nContraseña: ${credenciales.password}`)
                toast.success('Copiado al portapapeles')
              }}
              className="w-full py-3 bg-dark-700 hover:bg-dark-600 text-white rounded-xl transition mb-3"
            >
              Copiar credenciales
            </button>
            
            <button
              onClick={() => setCredenciales(null)}
              className="w-full py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-xl transition"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Modal datos del nuevo cliente */}
      {solicitudAprobar && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 rounded-2xl p-6 w-full max-w-md border border-dark-700">
            <h3 className="text-xl font-semibold text-white mb-2">Crear Cliente</h3>
            <p className="text-dark-400 text-sm mb-6">{solicitudAprobar.nombre_restaurante}</p>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="text-dark-400 text-sm block mb-1">Email del cliente</label>
                <input
                  type="email"
                  value={nuevoEmail}
                  onChange={(e) => setNuevoEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-xl text-white focus:outline-none focus:border-accent-500 transition"
                  placeholder="cliente@ejemplo.com"
                />
              </div>
              <div>
                <label className="text-dark-400 text-sm block mb-1">Contraseña</label>
                <input
                  type="text"
                  value={nuevoPassword}
                  onChange={(e) => setNuevoPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-xl text-white focus:outline-none focus:border-accent-500 transition"
                  placeholder="Mínimo 6 caracteres"
                />
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setSolicitudAprobar(null)
                  setNuevoEmail('')
                  setNuevoPassword('')
                }}
                className="flex-1 py-3 bg-dark-700 hover:bg-dark-600 text-white rounded-xl transition font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (!nuevoEmail || !nuevoPassword) {
                    toast.error('Completá email y contraseña')
                    return
                  }
                  if (nuevoPassword.length < 6) {
                    toast.error('La contraseña debe tener al menos 6 caracteres')
                    return
                  }
                  aprobarSolicitud(solicitudAprobar, nuevoEmail, nuevoPassword)
                }}
                className="flex-1 py-3 bg-accent-500 hover:bg-accent-600 text-white rounded-xl transition font-medium"
              >
                Crear Cliente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
