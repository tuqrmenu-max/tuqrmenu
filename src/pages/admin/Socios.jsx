import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '@/lib/i18n'
import { supabase, createIsolatedClient } from '@/lib/supabase'
import toast from 'react-hot-toast'

const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()

export default function Socios() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [socios, setSocios] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [showCrearModal, setShowCrearModal] = useState(false)
  const [creando, setCreando] = useState(false)
  const [nuevoSocio, setNuevoSocio] = useState({ nombre_restaurante: '', email: '', password: '', whatsapp: '', direccion: '' })
  const [credencialesCreadas, setCredencialesCreadas] = useState(null)

  useEffect(() => {
    fetchSocios()
  }, [])

  const fetchSocios = async () => {
    const { data, error } = await supabase
      .from('clientes')
      .select('id,user_id,nombre_restaurante,whatsapp,direccion,horario,menu_url,created_at')
      .order('created_at', { ascending: false })

    if (!error) setSocios(data)
    setLoading(false)
  }

  const filteredSocios = socios.filter(s =>
    norm(s.nombre_restaurante).includes(norm(search)) ||
    norm(s.whatsapp).includes(norm(search)) ||
    norm(s.direccion).includes(norm(search))
  )

  // TODO: Agregar columna 'activo' a tabla clientes
  // const toggleActivo = async (socio) => {
  //   const { error } = await supabase
  //     .from('clientes')
  //     .update({ activo: !socio.activo })
  //     .eq('id', socio.id)
  //   if (!error) {
  //     toast.success(socio.activo ? 'Socio desactivado' : 'Socio activado')
  //     fetchSocios()
  //   }
  // }

  const eliminarSocio = async (socio) => {
    if (!confirm(`¿Eliminar "${socio.nombre_restaurante}"? Se borrará también el usuario de auth.`)) return

    try {
      toast.loading('Eliminando...', { id: 'eliminar' })

      if (socio.user_id) {
        const { error: authError } = await supabase.auth.admin.deleteUser(socio.user_id)
        if (authError) console.warn('No se pudo borrar auth user:', authError.message)
      }

      await supabase.from('mesas').delete().eq('cliente_id', socio.id)

      const { error } = await supabase
        .from('clientes')
        .delete()
        .eq('id', socio.id)

      if (error) throw error

      toast.dismiss('eliminar')
      toast.success('Socio eliminado')
      fetchSocios()
    } catch (error) {
      toast.dismiss('eliminar')
      toast.error('Error: ' + error.message)
    }
  }

  const openBuilder = (socio) => {
    navigate(`/admin/builder/${socio.id}`)
  }

  const generarPassword = () => Math.random().toString(36).slice(-8) + Math.floor(Math.random() * 10)

  const crearSocio = async () => {
    if (!nuevoSocio.nombre_restaurante.trim()) {
      toast.error('Poné el nombre del restaurante')
      return
    }
    if (!nuevoSocio.email.trim()) {
      toast.error('Poné un email para el login')
      return
    }
    // Misma validación que "Aprobar y Crear Cliente" (Nuevos Clientes):
    // contraseña obligatoria de al menos 6 caracteres.
    if (!nuevoSocio.password.trim() || nuevoSocio.password.trim().length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres')
      return
    }
    const password = nuevoSocio.password.trim()

    setCreando(true)
    try {
      toast.loading('Creando socio...', { id: 'crear-socio' })

      // Mismo patrón que "Nuevos Clientes" al aprobar una solicitud:
      // 1) usuario de auth, 2) fila en clientes, 3) Mesa 0 por defecto.
      // Cliente aislado: si usáramos el `supabase` normal, este signUp()
      // reemplazaría la sesión del superadmin logueado por la del socio
      // recién creado (por eso, aunque la cuenta se creaba bien, después
      // fallaba todo lo que dependía de estar logueado como superadmin).
      const isolated = createIsolatedClient()
      const { data: authData, error: authError } = await isolated.auth.signUp({
        email: nuevoSocio.email.trim(),
        password,
        options: {
          data: { rol: 'cliente', nombre: nuevoSocio.nombre_restaurante }
        }
      })
      if (authError) throw new Error(`Error al crear usuario: ${authError.message}`)

      const { data: clienteData, error: clienteError } = await supabase
        .from('clientes')
        .insert({
          user_id: authData.user.id,
          nombre_restaurante: nuevoSocio.nombre_restaurante.trim(),
          whatsapp: nuevoSocio.whatsapp.trim() || null,
          direccion: nuevoSocio.direccion.trim() || null,
          bienvenido: `¡Bienvenidos a ${nuevoSocio.nombre_restaurante.trim()}!`
        })
        .select()
        .single()
      if (clienteError) throw new Error(`Error al crear registro: ${clienteError.message}`)

      await supabase.from('mesas').insert({
        cliente_id: clienteData.id,
        numero: 0,
        activa: true
      })

      toast.dismiss('crear-socio')
      toast.success('Socio creado exitosamente')

      setCredencialesCreadas({ nombre: nuevoSocio.nombre_restaurante, email: nuevoSocio.email.trim(), password })
      setShowCrearModal(false)
      setNuevoSocio({ nombre_restaurante: '', email: '', password: '', whatsapp: '', direccion: '' })
      fetchSocios()
    } catch (error) {
      toast.dismiss('crear-socio')
      toast.error(error.message)
    } finally {
      setCreando(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <h1 className="text-2xl font-bold text-white">{t('crearSocios') || 'Crear Socios'}</h1>
        <button
          onClick={() => setShowCrearModal(true)}
          className="bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-xl font-medium transition"
        >
          ➕ Crear socio
        </button>
      </div>

      {/* Barra de búsqueda */}
      <div className="mb-6">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('buscarSocio') || 'Buscar socio...'}
            className="w-full pl-10 pr-4 py-3 bg-dark-800 border border-dark-700 rounded-xl text-white placeholder-dark-400 focus:outline-none focus:border-primary-500 transition"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto"></div>
        </div>
      ) : filteredSocios.length === 0 ? (
        <div className="bg-dark-800 rounded-2xl p-12 border border-dark-700 text-center">
          <p className="text-dark-400">
            {search ? 'No se encontraron socios con esa búsqueda' : 'No hay socios registrados'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredSocios.map((socio) => (
            <div
              key={socio.id}
              className={`bg-dark-800 rounded-2xl border p-5 transition cursor-pointer hover:border-primary-500 ${
                selectedId === socio.id ? 'border-primary-500 ring-1 ring-primary-500/30' : 'border-dark-700'
              }`}
              onClick={() => setSelectedId(socio.id === selectedId ? null : socio.id)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    checked={selectedId === socio.id}
                    onChange={() => setSelectedId(socio.id)}
                    onClick={e => e.stopPropagation()}
                    className="w-4 h-4 accent-primary-500"
                  />
                  <div>
                    <h3 className="text-lg font-semibold text-white">{socio.nombre_restaurante}</h3>
                    <p className="text-dark-400 text-sm">{socio.whatsapp || 'Sin WhatsApp'}</p>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-accent-500/20 text-accent-400">
                  Activo
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                <div>
                  <p className="text-dark-500">Dirección</p>
                  <p className="text-dark-300">{socio.direccion || '-'}</p>
                </div>
                <div>
                  <p className="text-dark-500">Horario</p>
                  <p className="text-dark-300">{socio.horario || '-'}</p>
                </div>
                <div>
                  <p className="text-dark-500">Creado</p>
                  <p className="text-dark-300">{new Date(socio.created_at).toLocaleDateString('es-AR')}</p>
                </div>
                <div>
                  <p className="text-dark-500">Menú</p>
                  <p className="text-dark-300">{socio.menu_url ? '✓ Exportado' : 'Pendiente'}</p>
                </div>
              </div>

              {/* Acciones */}
              <div className="flex gap-3">
                <button
                  onClick={(e) => { e.stopPropagation(); openBuilder(socio) }}
                  className="flex-1 py-2 bg-primary-500/20 text-primary-400 hover:bg-primary-500/30 rounded-xl text-sm font-medium transition"
                >
                  🛠️ {t('abrirBuilder') || 'Abrir Builder'}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); eliminarSocio(socio) }}
                  className="py-2 px-4 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-xl text-sm font-medium transition"
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: crear socio */}
      {showCrearModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 rounded-2xl p-6 max-w-md w-full border border-dark-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bold text-xl">➕ Crear socio</h3>
              <button onClick={() => setShowCrearModal(false)} className="text-dark-400 hover:text-white text-2xl">×</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-dark-400 mb-1 block">Nombre del restaurante *</label>
                <input
                  type="text" value={nuevoSocio.nombre_restaurante}
                  onChange={e => {
                    const nombre = e.target.value
                    setNuevoSocio(prev => {
                      // Mismo auto-completado de email que usa "Aprobar y Crear
                      // Cliente" en Nuevos Clientes, para que sea igual en los
                      // dos lugares. Solo autocompleta si el email todavía no
                      // fue tocado a mano.
                      const emailSugerido = `${nombre.toLowerCase().replace(/\s+/g, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '').slice(0, 20) || 'restaurante'}@socio.qrmenu.com`
                      const emailActualEsSugerido = !prev.email || prev.email.endsWith('@socio.qrmenu.com')
                      return {
                        ...prev,
                        nombre_restaurante: nombre,
                        email: emailActualEsSugerido ? emailSugerido : prev.email
                      }
                    })
                  }}
                  placeholder="Ej: Bar1"
                  className="w-full bg-dark-900 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-dark-400 mb-1 block">Email (para iniciar sesión) *</label>
                <input
                  type="email" value={nuevoSocio.email}
                  onChange={e => setNuevoSocio(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="restaurante@socio.qrmenu.com"
                  className="w-full bg-dark-900 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-dark-400 mb-1 block">Contraseña (mínimo 6 caracteres) *</label>
                <div className="flex gap-2">
                  <input
                    type="text" value={nuevoSocio.password}
                    onChange={e => setNuevoSocio(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="Mínimo 6 caracteres"
                    className="flex-1 bg-dark-900 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setNuevoSocio(prev => ({ ...prev, password: generarPassword() }))}
                    title="Generar contraseña"
                    className="px-3 bg-dark-700 hover:bg-dark-600 text-white rounded-lg text-sm flex-shrink-0"
                  >
                    🎲
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs text-dark-400 mb-1 block">WhatsApp</label>
                <input
                  type="text" value={nuevoSocio.whatsapp}
                  onChange={e => setNuevoSocio(prev => ({ ...prev, whatsapp: e.target.value }))}
                  placeholder="Ej: 5493511234567"
                  className="w-full bg-dark-900 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-dark-400 mb-1 block">Dirección</label>
                <input
                  type="text" value={nuevoSocio.direccion}
                  onChange={e => setNuevoSocio(prev => ({ ...prev, direccion: e.target.value }))}
                  placeholder="Calle 123, Ciudad"
                  className="w-full bg-dark-900 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={crearSocio}
                disabled={creando}
                className="flex-1 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white px-4 py-3 rounded-xl font-bold transition"
              >
                {creando ? 'Creando...' : '✅ Crear socio'}
              </button>
              <button
                onClick={() => setShowCrearModal(false)}
                className="px-4 py-3 bg-dark-700 hover:bg-dark-600 text-white rounded-xl transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: credenciales del socio recién creado */}
      {credencialesCreadas && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 rounded-2xl p-6 max-w-md w-full border border-dark-700">
            <h3 className="text-white font-bold text-xl mb-4">✅ Socio creado</h3>
            <p className="text-dark-300 text-sm mb-3">Guardá estos datos, no se van a volver a mostrar:</p>
            <div className="bg-dark-900 rounded-xl p-4 space-y-2 text-sm">
              <p><span className="text-dark-500">Restaurante:</span> <span className="text-white">{credencialesCreadas.nombre}</span></p>
              <p><span className="text-dark-500">Email:</span> <span className="text-white">{credencialesCreadas.email}</span></p>
              <p><span className="text-dark-500">Contraseña:</span> <span className="text-white font-mono">{credencialesCreadas.password}</span></p>
            </div>
            <button
              onClick={() => setCredencialesCreadas(null)}
              className="w-full mt-6 bg-primary-500 hover:bg-primary-600 text-white px-4 py-3 rounded-xl font-bold transition"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
