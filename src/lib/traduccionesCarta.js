// Estado de traducción de la carta (categorías y productos) por idioma.
//
// Cada fila de categorias/productos tiene una columna jsonb `traducciones`:
//   { "en": { "nombre": "...", "detalle": "...", "origen": { "nombre": "...", "detalle": "..." } } }
// `origen` guarda el texto en español que se tradujo. Si después el local cambia el
// español, `origen` deja de coincidir y esa traducción pasa a "desactualizada".
export const CAMPOS_CATEGORIA = ['nombre']
export const CAMPOS_PRODUCTO = ['nombre', 'detalle']

const norm = v => String(v ?? '').trim()

// 'ok' | 'falta' | 'desactualizada'
export function estadoTraduccion(item, lang, campos) {
  const t = item?.traducciones?.[lang]
  if (!t || typeof t !== 'object') return 'falta'
  for (const c of campos) {
    if (!norm(item[c])) continue // no hay texto en español que traducir
    if (!norm(t[c])) return 'falta'
  }
  if (t.origen && typeof t.origen === 'object') {
    for (const c of campos) {
      if (norm(t.origen[c]) !== norm(item[c])) return 'desactualizada'
    }
  }
  return 'ok'
}

// Devuelve, por idioma, qué categorías y productos faltan traducir o quedaron desactualizados.
export function resumenPendientes({ categorias, productos }, idiomas) {
  const out = {}
  for (const lang of idiomas) {
    if (lang === 'es') continue
    const r = {
      categorias: { falta: [], desactualizada: [] },
      productos: { falta: [], desactualizada: [] },
    }
    for (const c of categorias) {
      const e = estadoTraduccion(c, lang, CAMPOS_CATEGORIA)
      if (e !== 'ok') r.categorias[e].push(c)
    }
    for (const p of productos) {
      const e = estadoTraduccion(p, lang, CAMPOS_PRODUCTO)
      if (e !== 'ok') r.productos[e].push(p)
    }
    out[lang] = r
  }
  return out
}

export function totalPendientes(r) {
  return r.categorias.falta.length + r.categorias.desactualizada.length
    + r.productos.falta.length + r.productos.desactualizada.length
}
