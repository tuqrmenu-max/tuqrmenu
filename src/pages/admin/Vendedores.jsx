import { useState, useEffect } from 'react'
import { useI18n } from '@/lib/i18n'
import { supabase, createIsolatedClient } from '@/lib/supabase'
import toast from 'react-hot-toast'

export default function Vendedores() {
  const { t } = useI18n()
  const [vendedores, setVendedores] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({
    nombre: '',
    emailPrefix: '',
    password: ''
  })

  useEffect(() => {
    fetchVendedores()
  }, [])

  const fetchVendedores = async () => {
    const { data, error } = await supabase
      .from('vendedores')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (!error) setVendedores(data)
    setLoading(false)
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      const email = `${form.emailPrefix}@ventas.qrmenu.com`
      
      // Crear usuario en auth
      // Cliente aislado: evita que este signUp() reemplace la sesión del
      // superadmin logueado por la del vendedor recién creado.
      const isolated = createIsolatedClient()
      const { data: authData, error: authError } = await isolated.auth.signUp({
        email,
        password: form.password,
        options: {
          data: { rol: 'vendedor', nombre: form.nombre }
        }
      })
      
      if (authError) throw authError
      
      // Crear registro en vendedores
      const { error: dbError } = await supabase
        .from('vendedores')
        .insert({
          user_id: authData.user.id,
          nombre: form.nombre,
          email
        })
      
      if (dbError) throw dbError
      
      toast.success(`Vendedor creado: ${email}`)
      setShowModal(false)
      setForm({ nombre: '', emailPrefix: '', password: '' })
      fetchVendedores()
    } catch (error) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  const toggleActivo = async (id, activo) => {
    const { data, error } = await supabase
      .from('vendedores')
      .update({ activo: !activo })
      .eq('id', id)
      .select()
    if (error) {
      toast.error('Error al cambiar estado: ' + error.message)
    } else if (!data || data.length === 0) {
      toast.error('No se pudo actualizar. Verificá las políticas RLS en Supabase.')
    } else {
      fetchVendedores()
      toast.success(activo ? 'Vendedor desactivado: ya no puede iniciar sesión' : 'Vendedor activado')
    }
  }

  const eliminarVendedor = async (vendedor) => {
    if (!confirm(`¿Eliminar al vendedor ${vendedor.nombre}? Esta acción no se puede deshacer.`)) {
      return
    }

    try {
      const { data, error: dbError } = await supabase
        .from('vendedores')
        .delete()
        .eq('id', vendedor.id)
        .select()
      
      if (dbError) throw dbError

      if (!data || data.length === 0) {
        toast.error('No se pudo eliminar. Verificá las políticas RLS en Supabase.')
        return
      }

      toast.success('Vendedor eliminado correctamente')
      fetchVendedores()
    } catch (error) {
      toast.error('Error al eliminar: ' + error.message)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">{t('vendedores')}</h1>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-xl transition flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          {t('crearVendedor')}
        </button>
      </div>
      
      {/* Lista de vendedores */}
      <div className="bg-dark-800 rounded-2xl border border-dark-700 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-dark-700">
              <th className="text-left px-6 py-4 text-dark-400 font-medium">Nombre</th>
              <th className="text-left px-6 py-4 text-dark-400 font-medium">Email</th>
              <th className="text-left px-6 py-4 text-dark-400 font-medium">Estado</th>
              <th className="text-left px-6 py-4 text-dark-400 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {vendedores.map((v) => (
              <tr key={v.id} className="border-b border-dark-700 last:border-0">
                <td className="px-6 py-4 text-white">{v.nombre}</td>
                <td className="px-6 py-4 text-dark-300">{v.email}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${v.activo === false ? 'bg-dark-600 text-dark-400' : 'bg-accent-500/20 text-accent-400'}`}>
                    {v.activo === false ? 'Desactivado' : 'Activo'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => toggleActivo(v.id, v.activo !== false)}
                      className={`px-3 py-1 rounded-lg text-sm transition ${v.activo === false ? 'bg-accent-500/20 text-accent-400 hover:bg-accent-500/30' : 'bg-dark-700 hover:bg-yellow-500/20 text-dark-300 hover:text-yellow-400'}`}
                    >
                      {v.activo === false ? 'Activar' : 'Desactivar'}
                    </button>
                    <button
                      onClick={() => eliminarVendedor(v)}
                      className="px-3 py-1 rounded-lg text-sm bg-dark-700 hover:bg-red-500/20 text-dark-300 hover:text-red-400 transition"
                    >
                      Eliminar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {vendedores.length === 0 && (
              <tr>
                <td colSpan="4" className="px-6 py-8 text-center text-dark-400">
                  No hay vendedores registrados
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      {/* Modal crear vendedor */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-dark-800 rounded-2xl p-6 w-full max-w-md border border-dark-700">
            <h3 className="text-xl font-semibold text-white mb-4">{t('crearVendedor')}</h3>
            
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm text-dark-400 mb-2">{t('nombreVendedor')}</label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={(e) => setForm({...form, nombre: e.target.value})}
                  className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm text-dark-400 mb-2">{t('emailVendedor')}</label>
                <div className="flex">
                  <input
                    type="text"
                    value={form.emailPrefix}
                    onChange={(e) => setForm({...form, emailPrefix: e.target.value})}
                    placeholder="vendedor1"
                    className="flex-1 px-4 py-3 bg-dark-700 border border-dark-600 rounded-l-xl text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  />
                  <span className="px-4 py-3 bg-dark-600 border border-dark-500 border-l-0 rounded-r-xl text-dark-300">
                    @ventas.qrmenu.com
                  </span>
                </div>
              </div>
              
              <div>
                <label className="block text-sm text-dark-400 mb-2">{t('passwordVendedor')}</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({...form, password: e.target.value})}
                  className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                  minLength={6}
                />
              </div>
              
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-3 bg-dark-700 hover:bg-dark-600 text-white rounded-xl transition"
                >
                  {t('cancelar')}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3 bg-primary-500 hover:bg-primary-600 disabled:bg-primary-800 text-white rounded-xl transition"
                >
                  {loading ? t('cargando') : t('crear')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
