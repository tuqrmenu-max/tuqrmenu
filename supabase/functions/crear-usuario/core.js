// Logica de la funcion "crear-usuario" (sin dependencias, para poder probarla).
// `admin` es un cliente de Supabase con service role; `callerId` es el usuario
// autenticado que hace el pedido (ya validado con su JWT).

const ROLES_STAFF = ['mozo', 'cajero', 'cocina', 'socio']
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Email interno del personal de un local: usuario@<slug>.staff.tuqrmenu.app.
// Dominios anteriores (sin slug), que siguen aceptándose mientras haya
// pantallas que todavía los generan. Se puede quitar cuando ya no hagan falta.
const DOMINIOS_STAFF_ANTERIORES = [
  'mozo.tuqrmenu.app', 'caja.tuqrmenu.app', 'cocina.tuqrmenu.app',
  'delivery.tuqrmenu.app', 'staff.tuqrmenu.app',
]
const USUARIO_STAFF_RE = /^[a-z0-9._-]{1,60}$/

// El email del personal tiene que ser el que corresponde al local de quien lo
// crea (no se puede crear personal con el identificador de otro local, ni con
// un email cualquiera).
function emailStaffValido(email, slug) {
  const [local, dominio] = email.split('@')
  if (!USUARIO_STAFF_RE.test(local || '')) return false
  if (slug && dominio === `${slug}.staff.tuqrmenu.app`) return true
  return DOMINIOS_STAFF_ANTERIORES.includes(dominio)
}

const resp = (status, body) => ({ status, body })

async function esSuperadmin(admin, uid) {
  const { data } = await admin.from('superadmins').select('user_id').eq('user_id', uid).maybeSingle()
  return !!data
}

export async function procesar(body, callerId, admin) {
  if (!callerId) return resp(401, { error: 'No autenticado' })
  const accion = body?.accion || 'crear'
  const superadmin = await esSuperadmin(admin, callerId)

  if (accion === 'eliminar') {
    if (!superadmin) return resp(403, { error: 'No autorizado' })
    const id = String(body?.user_id || '')
    if (!/^[0-9a-f-]{36}$/i.test(id)) return resp(400, { error: 'user_id invalido' })
    if (id === callerId || (await esSuperadmin(admin, id))) return resp(403, { error: 'No se puede eliminar ese usuario' })
    const { error } = await admin.auth.admin.deleteUser(id)
    return error ? resp(400, { error: error.message }) : resp(200, { ok: true })
  }

  if (accion !== 'crear') return resp(400, { error: 'Accion invalida' })

  const tipo = body?.tipo
  const email = String(body?.email || '').trim().toLowerCase()
  const password = String(body?.password || '')
  if (!EMAIL_RE.test(email) || email.length > 200) return resp(400, { error: 'Email invalido' })
  if (password.length < 8 || password.length > 200) return resp(400, { error: 'La contraseña debe tener al menos 8 caracteres' })

  let metadata
  if (tipo === 'cliente' || tipo === 'vendedor') {
    if (!superadmin) return resp(403, { error: 'No autorizado' })
    metadata = { rol: tipo }
    if (body?.nombre) metadata.nombre = String(body.nombre).slice(0, 200)
  } else if (tipo === 'staff') {
    const clienteId = String(body?.cliente_id || '')
    if (!/^[0-9a-f-]{36}$/i.test(clienteId)) return resp(400, { error: 'cliente_id invalido' })
    const { data: c } = await admin.from('clientes').select('id,slug,user_id').eq('id', clienteId).maybeSingle()
    if (!c) return resp(superadmin ? 400 : 403, { error: superadmin ? 'cliente_id invalido' : 'No autorizado' })
    if (!superadmin && c.user_id !== callerId) return resp(403, { error: 'No autorizado' })
    if (!emailStaffValido(email, c.slug)) return resp(400, { error: 'Email de personal invalido para este local' })
    metadata = {}
    if (body?.rol != null) {
      if (!ROLES_STAFF.includes(body.rol)) return resp(400, { error: 'Rol invalido' })
      metadata.rol = body.rol
    }
  } else {
    return resp(400, { error: 'Tipo invalido' })
  }

  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: metadata
  })
  if (error) {
    const yaExiste = /already (been )?registered|already exists/i.test(error.message || '')
    return resp(yaExiste ? 409 : 400, { error: yaExiste ? 'User already registered' : error.message })
  }
  return resp(200, { user_id: data.user.id })
}
