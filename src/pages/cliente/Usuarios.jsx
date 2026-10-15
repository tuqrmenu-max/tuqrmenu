import { useState, useEffect } from 'react'
import { useI18n } from '@/lib/i18n'
import { useAuth } from '@/hooks/useAuth'
import { supabase, createIsolatedClient } from '@/lib/supabase'
import toast from 'react-hot-toast'

export default function Usuarios() {
  const { t } = useI18n()
  const { profile } = useAuth()
  const [usuarios, setUsuarios] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ nombre: '', email: '', password: '', rol: 'mozo' })

  useEffect(() => {
    if (profile?.id) fetchUsuarios()
  }, [profile])

  const fetchUsuarios = async () => {
    const { data } = await supabase
      .from('cliente_usuarios')
      .select('*')
      .eq('cliente_id', profile.id)
    if (data) setUsuarios(data)
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    
    // Cliente aislado: evita que este signUp() reemplace la sesión del
    // dueño del restaurante logueado por la del empleado recién creado.
    const isolated = createIsolatedClient()
    const { data: authData, error: authError } = await isolated.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { rol: form.rol } }
    })
    if (authError) return toast.error(authError.message)
    
    const { error } = await supabase
      .from('cliente_usuarios')
      .insert({
        cliente_id: profile.id,
        user_id: authData.user.id,
        nombre: form.nombre,
        email: form.email,
        rol: form.rol
      })
    if (error) return toast.error(error.message)
    
    toast.success('Usuario creado')
    setShowModal(false)
    setForm({ nombre: '', email: '', password: '', rol: 'mozo' })
    fetchUsuarios()
  }

  // TODO: Agregar columna 'activo' a tabla cliente_usuarios
  // const toggleActivo = async (id, activo) => {
  //   await supabase.from('cliente_usuarios').update({ activo: !activo }).eq('id', id)
  //   fetchUsuarios()
  // }

  const getRolBadge = (rol) => {
    const colors = {
      mozo: 'bg-blue-500/20 text-blue-400',
      cajero: 'bg-purple-500/20 text-purple-400',
      socio: 'bg-accent-500/20 text-accent-400',
    }
    return colors[rol] || 'bg-dark-600 text-dark-400'
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">{t('usuarios')}</h1>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-xl transition"
        >
          + Nuevo Usuario
        </button>
      </div>
      
      <div className="bg-dark-800 rounded-2xl border border-dark-700 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-dark-700">
              <th className="text-left px-6 py-4 text-dark-400 font-medium">Nombre</th>
              <th className="text-left px-6 py-4 text-dark-400 font-medium">Email</th>
              <th className="text-left px-6 py-4 text-dark-400 font-medium">Rol</th>
              <th className="text-left px-6 py-4 text-dark-400 font-medium">Estado</th>
              <th className="text-left px-6 py-4 text-dark-400 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id} className="border-b border-dark-700 last:border-0">
                <td className="px-6 py-4 text-white">{u.nombre}</td>
                <td className="px-6 py-4 text-dark-300">{u.email}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRolBadge(u.rol)}`}>
                    {u.rol}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-accent-500/20 text-accent-400">
                    Activo
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-dark-500 text-sm">-</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-dark-800 rounded-2xl p-6 w-full max-w-md border border-dark-700">
            <h3 className="text-xl font-semibold text-white mb-4">Nuevo Usuario</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <select
                value={form.rol}
                onChange={(e) => setForm({...form, rol: e.target.value})}
                className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-xl text-white"
              >
                <option value="mozo">Mozo</option>
                <option value="cajero">Cajero</option>
                <option value="socio">Socio</option>
              </select>
              <input type="text" placeholder="Nombre" value={form.nombre} onChange={(e) => setForm({...form, nombre: e.target.value})} className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-xl text-white" required />
              <input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-xl text-white" required />
              <input type="password" placeholder="Contraseña" value={form.password} onChange={(e) => setForm({...form, password: e.target.value})} className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-xl text-white" required minLength={6} />
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 bg-dark-700 text-white rounded-xl">Cancelar</button>
                <button type="submit" className="flex-1 py-3 bg-primary-500 text-white rounded-xl">Crear</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
