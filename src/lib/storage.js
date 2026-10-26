import { externalizeImages } from './menuImages'
import { supabase } from './supabase'

const BUCKET_NAME = 'menus'

export async function uploadMenuHtml(socioId, htmlContent) {
  const filename = `${socioId}-${Date.now()}-${crypto.randomUUID()}.html`
  const match = htmlContent.match(/const DATA=(\{[\s\S]*?\});/)
  if (match) {
    const data = await externalizeImages(socioId, JSON.parse(match[1]))
    const encoded = JSON.stringify(data).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
    htmlContent = htmlContent.replace(match[0], () => 'const DATA=' + encoded + ';')
  }
  const blob = new Blob([htmlContent], { type: 'text/html' })

  console.log(`[Storage] Subiendo ${filename}, tamaño: ${(blob.size / 1024).toFixed(1)} KB`)

  const { data, error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filename, blob, {
      contentType: 'text/html',
      cacheControl: '31536000',
      upsert: true
    })

  if (uploadError) {
    console.error('[Storage] Error upload:', uploadError)
    if (uploadError.message?.includes('bucket')) {
      throw new Error(`Bucket "${BUCKET_NAME}" no existe. Ejecutá storage_menus.sql en Supabase SQL Editor.`)
    }
    throw new Error(`Error subiendo menú: ${uploadError.message}`)
  }

  const { data: urlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(filename)

  console.log('[Storage] URL:', urlData.publicUrl)
  return urlData.publicUrl
}

export async function getMenuUrl(socioId) {
  const { data, error } = await supabase.from('clientes').select('menu_url').eq('id', socioId).single()
  if (error) throw error
  return data?.menu_url || null
}

export async function deleteMenuHtml(socioId) {
  const url = await getMenuUrl(socioId)
  if (!url) return
  const prefix = '/storage/v1/object/public/' + BUCKET_NAME + '/'
  const parsed = new URL(url)
  if (!parsed.pathname.includes(prefix)) throw new Error('URL de menú no reconocida')
  const path = decodeURIComponent(parsed.pathname.split(prefix)[1])
  const { error } = await supabase.storage.from(BUCKET_NAME).remove([path])
  if (error) throw error
}

export async function saveMenuUrlToCliente(socioId, menuUrl) {
  const { error } = await supabase
    .from('clientes')
    .update({ menu_url: menuUrl })
    .eq('id', socioId)
  if (error) throw error
}

export async function saveBuilderFieldsToCliente(socioId, fields) {
  fields = await externalizeImages(socioId, fields)
  const { error } = await supabase
    .from('clientes')
    .update(fields)
    .eq('id', socioId)
  if (error) {
    // Mensaje completo (code + details + hint), no solo error.message, para
    // poder ver la causa real directo en el toast sin tener que abrir la
    // consola del navegador.
    const detalle = [error.message, error.details, error.hint, error.code ? `código: ${error.code}` : null]
      .filter(Boolean).join(' — ')
    console.error('[Storage] Error guardando campos en clientes:', error)
    throw new Error('No se pudieron guardar los datos del restaurante (' + detalle + ')')
  }
}

let hasBuilderColumns = null

async function checkBuilderColumns() {
  if (hasBuilderColumns !== null) return hasBuilderColumns
  const { error } = await supabase
    .from('clientes')
    .select('id')
    .limit(1)
  hasBuilderColumns = !error
  return hasBuilderColumns
}

function getLocalStorageKey(socioId, suffix = '') {
  return `builder_${socioId}${suffix ? '_' + suffix : ''}`
}

function slug(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

export function buildBuilderProductsFromTables(productos = [], categorias = [], existing = {}) {
  const catNameById = {}
  categorias.forEach(c => { catNameById[c.id] = c.nombre })

  const preservedProductImages = {}
  if (existing?.productImages) {
    Object.entries(existing.productImages).forEach(([key, value]) => {
      if (!key.startsWith('__row_')) preservedProductImages[key] = value
    })
  }

  const productImages = { ...preservedProductImages }
  const rows = productos.map((p, index) => {
    if (p.imagen) productImages['__row_' + index] = p.imagen
    return {
      id: p.id || '',
      categoria: catNameById[p.categoria_id] || 'Sin categoría',
      producto: p.nombre || '',
      precio: String(p.precio ?? ''),
      detalle: p.detalle || p.descripcion || '',
      imagen: p.imagen || ''
    }
  })

  const categoryImages = { ...(existing?.categoryImages || {}) }
  categorias.forEach(c => {
    const key = '__cat_' + slug(c.nombre)
    if (c.imagen) {
      categoryImages[key] = c.imagen
    } else {
      delete categoryImages[key]
    }
  })

  return {
    rows,
    productImages,
    categoryImages,
    categoryTransforms: existing?.categoryTransforms || {}
  }
}

export async function loadCatalogAsBuilderProducts(socioId) {
  const [{ data: productos, error: prodError }, { data: categorias, error: catError }, existing] = await Promise.all([
    supabase
      .from('productos')
      // Algunas instalaciones usan `descripcion` y otras `detalle`.
      // Leer la fila completa evita que PostgREST rechace el guardado cuando
      // una de esas dos columnas no existe.
      .select('*')
      .eq('cliente_id', socioId)
      .order('categoria_id')
      .order('nombre'),
    supabase
      .from('categorias')
      .select('id, nombre, imagen, orden')
      .eq('cliente_id', socioId)
      .order('orden'),
    loadBuilderProducts(socioId)
  ])

  if (prodError) throw prodError
  if (catError) throw catError

  return buildBuilderProductsFromTables(productos || [], categorias || [], existing || {})
}

export async function saveBuilderConfig(socioId, config) {
  config = await externalizeImages(socioId, config)
  try {
    localStorage.setItem(getLocalStorageKey(socioId, 'config'), JSON.stringify(config))
  } catch (e) {
    console.warn('[Storage] No se pudo guardar config en localStorage:', e)
  }

  const hasColumn = await checkBuilderColumns()
  if (hasColumn) {
    const { error } = await supabase
      .from('clientes')
      .update({ builder_config: config })
      .eq('id', socioId)
    if (error) {
      const detalle = [error.message, error.details, error.hint, error.code ? `código: ${error.code}` : null]
        .filter(Boolean).join(' — ')
      console.error('[Storage] Error guardando builder_config en Supabase:', error)
      // El respaldo en localStorage ya se guardó arriba, pero avisamos igual:
      // si esto falla seguido (ej: por el peso de las imágenes cargadas), el
      // usuario tiene que enterarse en vez de asumir que quedó todo guardado.
      throw new Error('No se pudo guardar el diseño en el servidor (' + detalle + '). Se guardó una copia local en este navegador.')
    }
  }
}

export async function loadBuilderConfig(socioId) {
  const hasColumn = await checkBuilderColumns()
  if (hasColumn) {
    const { data, error } = await supabase
      .from('clientes')
      .select('builder_config')
      .eq('id', socioId)
      .single()
    if (!error && data?.builder_config) {
      try {
        localStorage.setItem(getLocalStorageKey(socioId, 'config'), JSON.stringify(data.builder_config))
      } catch (e) { /* ignore */ }
      return data.builder_config
    }
  }

  try {
    const raw = localStorage.getItem(getLocalStorageKey(socioId, 'config'))
    if (raw) {
      console.log('[Storage] Cargando builder_config desde localStorage')
      return JSON.parse(raw)
    }
  } catch (e) {
    console.warn('[Storage] Error leyendo localStorage:', e)
  }

  return null
}

export async function saveBuilderProducts(socioId, productsData) {
  productsData = await externalizeImages(socioId, productsData)
  try {
    localStorage.setItem(getLocalStorageKey(socioId, 'products'), JSON.stringify(productsData))
  } catch (e) {
    console.warn('[Storage] No se pudo guardar products en localStorage:', e)
  }

  const hasColumn = await checkBuilderColumns()
  if (hasColumn) {
    const { error } = await supabase
      .from('clientes')
      .update({ builder_products: productsData })
      .eq('id', socioId)
    if (error) {
      const detalle = [error.message, error.details, error.hint, error.code ? `código: ${error.code}` : null]
        .filter(Boolean).join(' — ')
      console.error('[Storage] Error guardando builder_products en Supabase:', error)
      throw new Error('No se pudieron guardar los productos/categorías en el servidor (' + detalle + '). Se guardó una copia local en este navegador.')
    }
  }

  // Sync rows a tablas categorías/productos (fire-and-forget, no bloquea el guardado)
  const rows = productsData?.rows
  if (rows && rows.length > 0) {
    await syncBuilderToTables(socioId, rows, productsData)
  }
}

/**
 * Sincroniza las rows del Builder a las tablas categorías y productos de Supabase.
 * Replica el patrón de CartaAdmin: insertar solo campos core, luego UPDATE el resto.
 * Solo UPSERT (no DELETE) — cero riesgo de romper pedidos existentes.
 */
async function syncBuilderToTables(clienteId, rows, productsData) {
  const categoryImages = productsData?.categoryImages || {}

  function slugCat(name) {
    return (name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  }

  // 1. Categorías únicas (preservando orden de aparición)
  const seen = new Set()
  const uniqueCats = []
  for (const r of rows) {
    const name = (r.categoria || '').trim()
    if (name && !seen.has(name.toLowerCase())) {
      seen.add(name.toLowerCase())
      uniqueCats.push(name)
    }
  }

  // 2. Leer categorías existentes
  const { data: existingCats, error: catsErr } = await supabase
    .from('categorias')
    .select('id, nombre')
    .eq('cliente_id', clienteId)

  if (catsErr) {
    console.error('[Storage] Error leyendo categorías:', catsErr)
    return
  }

  const catMap = {}
  ;(existingCats || []).forEach(c => { catMap[c.nombre.toLowerCase()] = c.id })

  // 3. Upsert categorías (solo crear las que faltan)
  let orden = (existingCats || []).length
  for (const catName of uniqueCats) {
    const key = catName.toLowerCase()
    if (catMap[key]) continue

    const imgKey = '__cat_' + slugCat(catName)
    const imagen = categoryImages[imgKey] || null

    const { data: ins, error: insErr } = await supabase
      .from('categorias')
      .insert({ cliente_id: clienteId, nombre: catName, orden, imagen })
      .select('id')
      .single()

    if (insErr) {
      console.error('[Storage] Error insertando categoría "' + catName + '":', insErr)
      continue
    }
    if (ins?.id) {
      catMap[key] = ins.id
      orden++
    }
  }

  // 4. Leer productos existentes
  const { data: existingProds, error: prodsErr } = await supabase
    .from('productos')
    .select('id, nombre, categoria_id, precio')
    .eq('cliente_id', clienteId)

  if (prodsErr) {
    console.error('[Storage] Error leyendo productos:', prodsErr)
    return
  }

  // Mapa para detectar duplicados
  const prodMap = {}
  ;(existingProds || []).forEach(p => {
    const key = `${p.nombre.toLowerCase()}|${p.categoria_id}`
    prodMap[key] = p
  })

  // 5. Insertar/actualizar productos — mismatch simple
  let inserted = 0
  let updated = 0
  let skipped = 0

  for (const r of rows) {
    const nombre = (r.producto || '').trim()
    if (!nombre) { skipped++; continue }

    const catId = catMap[(r.categoria || '').toLowerCase()]
    if (!catId) { skipped++; continue }

    const precio = parseFloat(r.precio) || 0
    const key = `${nombre.toLowerCase()}|${catId}`

    if (prodMap[key]) {
      // No escribir un precio que no cambió.
      if (Number(prodMap[key].precio) === precio) { skipped++; continue }
      const { error: updErr } = await supabase
        .from('productos')
        .update({ precio })
        .eq('id', prodMap[key].id)
      if (updErr) {
        console.error('[Storage] Update producto "' + nombre + '":', updErr)
      } else {
        updated++
      }
    } else {
      // Nuevo — insertar solo campos core (igual que CartaAdmin)
      const { data: ins, error: insErr } = await supabase
        .from('productos')
        .insert({
          cliente_id: clienteId,
          categoria_id: catId,
          nombre,
          precio
        })
        .select('id')
        .single()

      if (insErr) {
        console.error('[Storage] Insert producto "' + nombre + '":', insErr)
      } else if (ins?.id) {
        prodMap[key] = { id: ins.id, precio }
        inserted++
      }
    }
  }

  console.log('[Storage] Sync:', inserted, 'insertados,', updated, 'actualizados,', skipped, 'skipped,', Object.keys(catMap).length, 'categorías')
}

export async function loadBuilderProducts(socioId) {
  const hasColumn = await checkBuilderColumns()
  if (hasColumn) {
    const { data, error } = await supabase
      .from('clientes')
      .select('builder_products')
      .eq('id', socioId)
      .single()
    if (!error && data?.builder_products) {
      try {
        localStorage.setItem(getLocalStorageKey(socioId, 'products'), JSON.stringify(data.builder_products))
      } catch (e) { /* ignore */ }
      return data.builder_products
    }
  }

  try {
    const raw = localStorage.getItem(getLocalStorageKey(socioId, 'products'))
    if (raw) {
      console.log('[Storage] Cargando builder_products desde localStorage')
      return JSON.parse(raw)
    }
  } catch (e) {
    console.warn('[Storage] Error leyendo localStorage:', e)
  }

  return null
}
