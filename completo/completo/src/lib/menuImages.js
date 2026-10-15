import { supabase } from './supabase'
import { readPages } from './readPages'
const pending = new Map()
export async function storeMenuImage(clienteId, value) {
  if (typeof value !== 'string' || !/^data:image\/[^;,]+;base64,/.test(value)) return value
  const blob = await (await fetch(value)).blob()
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
  const hash = Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, '0')).join('')
  const key = `${clienteId}/${hash}`
  if (pending.has(key)) return pending.get(key)
  const work = (async () => {
    const ext = blob.type.split('/')[1].replace(/[^a-z0-9]/gi, '') || 'img'
    const path = `${key}.${ext}`
    const bucket = supabase.storage.from('productos')
    const { error } = await bucket.upload(path, blob, { upsert: false, contentType: blob.type, cacheControl: '31536000' })
    if (error && !['409', 'Duplicate'].includes(String(error.statusCode || error.code))) throw new Error('No se pudo guardar la imagen en Storage. Se conserva la anterior. ' + error.message)
    const { data } = bucket.getPublicUrl(path)
    // Public QR needs a publicly readable file, not just a successful upload.
    const check = await fetch(data.publicUrl, { method: 'HEAD' })
    if (!check.ok) throw new Error('La imagen no es pública; se conserva la referencia anterior.')
    return data.publicUrl
  })()
  pending.set(key, work)
  try { return await work } catch (error) { pending.delete(key); throw error }
}
export async function externalizeImages(clienteId, value) {
  if (typeof value === 'string') return storeMenuImage(clienteId, value)
  if (Array.isArray(value)) {
    const result = []
    for (const item of value) result.push(await externalizeImages(clienteId, item))
    return result
  }
  if (value && typeof value === 'object') {
    const result = {}
    for (const [key, item] of Object.entries(value)) result[key] = await externalizeImages(clienteId, item)
    return result
  }
  return value
}
export async function optimizeRestaurantImages(clienteId) {
  let changed = 0
  for (const table of ['productos', 'categorias']) {
    const rows = await readPages(() => supabase.from(table).select('id,imagen').eq('cliente_id', clienteId).order('id'))
    for (const row of rows) {
      const image = await storeMenuImage(clienteId, row.imagen)
      if (image === row.imagen) continue
      const { error } = await supabase.from(table).update({ imagen: image }).eq('cliente_id', clienteId).eq('id', row.id)
      if (error) throw error
      changed++
    }
  }
  const { data, error } = await supabase.from('clientes').select('builder_config,builder_products,logo_url,fondo_menu').eq('id', clienteId).single()
  if (error) throw error
  // Optimize each JSON independently. Existing files and records are never deleted.
  for (const [key, value] of Object.entries(data)) {
    const optimized = await externalizeImages(clienteId, value)
    if (JSON.stringify(value) === JSON.stringify(optimized)) continue
    let query = supabase.from('clientes').update({ [key]: optimized }).eq('id', clienteId)
    const { error: updateError } = await query
    if (updateError) throw updateError
    changed++
  }
  return changed
}
