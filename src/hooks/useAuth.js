import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { registrarEntradaHorarioConReintento } from '@/lib/horarioPresencia'
import toast from 'react-hot-toast'

let authStarted = false
let authGeneration = 0
let currentUserId = null
async function loadProfile(userId, generation) {
  const store = useAuthStore
  try {
    let lookupError = null
    for (const [table, columns, role] of [
      ['vendedores', '*', 'vendedor'],
      ['clientes', 'id,user_id,nombre_restaurante', 'admin'],
      ['cliente_usuarios', '*', null],
      ['superadmins', 'user_id', 'superadmin']
    ]) {
      const { data, error } = await supabase.from(table).select(columns).eq('user_id', userId).maybeSingle()
      if (generation !== authGeneration) return
      if (error) { lookupError = error; continue }
      if (!data) continue
      if (data.activo === false) {
        await supabase.auth.signOut()
        return
      }
      store.setState({ profile: data, rol: role || data.rol, loading: false })
      return
    }
    if (lookupError) throw lookupError
    if (generation === authGeneration) await supabase.auth.signOut()
  } catch (error) {
    if (generation !== authGeneration) return
    currentUserId = null // allow a later auth event to retry
    store.setState({ profile: null, rol: null, loading: false })
    toast.error('No se pudo cargar el perfil: ' + error.message)
  }
}
function startAuth() {
  if (authStarted) return
  authStarted = true
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    const id = session?.user?.id || null
    useAuthStore.setState({ user: session?.user || null })
    if (!id) {
      currentUserId = null
      authGeneration++
      useAuthStore.setState({ profile: null, rol: null, loading: false })
      return
    }
    if (currentUserId === id && event !== 'USER_UPDATED' && event !== 'TOKEN_REFRESHED') return
    currentUserId = id
    const generation = ++authGeneration
    useAuthStore.setState({ profile: null, rol: null, loading: true })
    // Leave the Auth callback before requesting data.
    setTimeout(() => loadProfile(id, generation), 0)
  })
  if (import.meta.hot) import.meta.hot.dispose(() => { subscription.unsubscribe(); authStarted = false; authGeneration++ })
}

export function useAuth() {
  const { user, profile, rol, loading, setUser, setProfile, setRol, setLoading, clearAuth } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => { startAuth() }, [])

  const login = async (emailOrUsuario, password) => {
    let email = (emailOrUsuario || '').trim()

    // Si no parece un email, puede ser el "usuario" de un mozo/cajero/cocina
    // creado desde el panel del dueño: resolvemos a su email interno primero.
    if (email && !email.includes('@')) {
      const { data: resolved } = await supabase.rpc('resolver_login_usuario', { p_usuario: email })
      if (resolved) email = resolved
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    
    if (error) throw error

    // Verificar si es vendedor
    const { data: vendedor } = await supabase
      .from('vendedores')
      .select('id')
      .eq('user_id', data.user.id)
      .maybeSingle()

    // TODO: Si se agrega columna 'activo' a vendedores, verificar aquí:
    // if (vendedor && !vendedor.activo) { await supabase.auth.signOut(); throw new Error(...) }

    try {
      // Reintenta ante PGRST303 (desfasaje de reloj momentáneo entre Auth y
      // PostgREST) antes de avisarle al usuario que falló el registro.
      const { error: horarioError } = await registrarEntradaHorarioConReintento()
      if (horarioError) throw horarioError
    } catch (error) {
      toast.error('Iniciaste sesión, pero no se pudo registrar la entrada en Horario: ' + error.message, { duration: 10000 })
    }
    return data
  }

  const logout = async () => {
    try {
      const { error } = await supabase.rpc('registrar_salida_horario')
      if (error) throw error
    } catch (error) {
      toast.error('No se pudo registrar la salida en Horario: ' + error.message, { duration: 10000 })
    }
    const { error } = await supabase.auth.signOut()
    if (error) {
      toast.error('No se pudo cerrar sesión: ' + error.message)
      return
    }
    clearAuth()
    navigate('/login')
  }

  const getRedirectPath = () => {
    switch (rol) {
      case 'superadmin':
      case 'admin':
        return '/admin'
      case 'mozo':
      case 'cajero':
      case 'cocina':
      case 'delivery':
        return '/admin/dash-socios'
      case 'vendedor':
        return '/vendedor'
      case 'socio':
        return '/cliente'
      default:
        return '/login'
    }
  }

  return {
    user,
    profile,
    rol,
    loading,
    login,
    logout,
    getRedirectPath,
    isAdmin: rol === 'superadmin' || rol === 'admin',
    isVendedor: rol === 'vendedor',
    isCliente: ['socio', 'mozo', 'cajero'].includes(rol),
    isMozo: rol === 'mozo',
    isCajero: rol === 'cajero',
  }
}
