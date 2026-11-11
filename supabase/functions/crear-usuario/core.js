// Logica de la funcion "crear-usuario" (sin dependencias, para poder probarla).
// `admin` es un cliente de Supabase con service role; `callerId` es el usuario
// autenticado que hace el pedido (ya validado con su JWT).

const ROLES_STAFF = ['mozo', 'cajero', 'cocina', 'socio']
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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
    if (!superadmin) {
      const { data: c } = await admin.from('clientes').select('id').eq('id', clienteId).eq('user_id', callerId).maybeSingle()
      if (!c) return resp(403, { error: 'No autorizado' })
    }
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
