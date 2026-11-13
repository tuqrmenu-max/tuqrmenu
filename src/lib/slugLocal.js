// Identificador corto de un local (solo a-z y 0-9, sin acentos). Es la misma
// regla que public.slugify_local() en la base (supabase/migrations). La base es
// la que lo asigna de verdad al crear el local; esto se usa para sugerencias.
export function slugLocal(nombre) {
  const s = String(nombre || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
  return s.slice(0, 30)
}

// Email sugerido para el dueño (admin) de un local: admin@<local>.tuqrmenu.app
export function emailAdminSugerido(nombreRestaurante) {
  return `admin@${slugLocal(nombreRestaurante) || 'restaurante'}.tuqrmenu.app`
}

// Dominio interno del personal (mozo, cajero, cocina, delivery) de un local.
export const DOMINIO_STAFF = 'staff.tuqrmenu.app'

// Email interno del personal nuevo: usuario@<local>.staff.tuqrmenu.app.
// Nadie lo escribe: el personal entra con "usuario@local".
export function emailStaff(usuario, slug) {
  return `${usuario}@${slug}.${DOMINIO_STAFF}`
}

// Si lo que se escribió en el login es "usuario@local" (sin punto después de la
// arroba) devuelve el email interno; si es un email real o un usuario viejo, null.
export function emailDesdeUsuarioLocal(texto) {
  const m = /^([^@\s]+)@([a-z0-9]+)$/i.exec(String(texto || '').trim())
  if (!m) return null
  return emailStaff(m[1].toLowerCase(), m[2].toLowerCase())
}
