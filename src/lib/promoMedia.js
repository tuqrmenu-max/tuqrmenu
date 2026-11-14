import { supabase } from '@/lib/supabase'

export const LIMITE_IMAGENES = 6
export const MAX_IMAGEN_BYTES = 2 * 1024 * 1024
export const MAX_VIDEO_BYTES = 8 * 1024 * 1024
export const MAX_VIDEO_SEG = 15

export const ANIMACIONES = [
  { id: 'ninguna', label: 'Ninguna' },
  { id: 'fundido', label: 'Fundido' },
  { id: 'zoom', label: 'Zoom suave' },
  { id: 'deslizar', label: 'Deslizar' },
  { id: 'resaltar', label: 'Resaltar texto' }
]
export const POSICIONES = [
  { id: 'arriba', label: 'Arriba' },
  { id: 'centro', label: 'Centro' },
  { id: 'abajo', label: 'Abajo' }
]
export const CONFIG_VACIA = { texto1: '', texto2: '', animacion: 'fundido', posicion: 'abajo', duracion: 4 }

// Normaliza lo que viene de la base (o de un form) a una config válida.
export function normalizarConfig(c) {
  const x = { ...CONFIG_VACIA, ...(c || {}) }
  if (!ANIMACIONES.some(a => a.id === x.animacion)) x.animacion = CONFIG_VACIA.animacion
  if (!POSICIONES.some(p => p.id === x.posicion)) x.posicion = CONFIG_VACIA.posicion
  const d = Number(x.duracion)
  x.duracion = Number.isFinite(d) ? Math.min(8, Math.max(2, Math.round(d))) : CONFIG_VACIA.duracion
  x.texto1 = String(x.texto1 || '').slice(0, 60)
  x.texto2 = String(x.texto2 || '').slice(0, 120)
  return x
}

// Valida el archivo antes de subirlo. Devuelve texto de error o null.
export function validarArchivo(file) {
  if (!file) return 'Archivo inválido'
  if (/^image\/(jpeg|png|webp)$/.test(file.type)) return null
  if (/^video\/(mp4|webm)$/.test(file.type)) {
    return file.size > MAX_VIDEO_BYTES ? `El video pesa más de ${MAX_VIDEO_BYTES / 1048576} MB` : null
  }
  return 'Formato no permitido (usá JPG, PNG, WebP, MP4 o WebM)'
}

// Reduce la imagen a 1280 px de lado mayor y la pasa a WebP hasta que pese ≤ 2 MB.
export async function comprimirImagen(file) {
  const bmp = await createImageBitmap(file)
  const escala = Math.min(1, 1280 / Math.max(bmp.width, bmp.height))
  const w = Math.round(bmp.width * escala), h = Math.round(bmp.height * escala)
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  canvas.getContext('2d').drawImage(bmp, 0, 0, w, h)
  let calidad = 0.82, blob
  do {
    blob = await new Promise(r => canvas.toBlob(r, 'image/webp', calidad))
    calidad -= 0.12
  } while (blob && blob.size > MAX_IMAGEN_BYTES && calidad > 0.3)
  if (!blob) throw new Error('No se pudo procesar la imagen')
  return blob
}

// Duración del video en segundos (para respetar el máximo).
export function duracionVideo(file) {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video')
    const url = URL.createObjectURL(file)
    v.preload = 'metadata'
    v.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(v.duration) }
    v.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer el video')) }
    v.src = url
  })
}

// Sube un archivo a promos/<cliente_id>/... y devuelve { tipo, url, path }.
export async function subirArchivoPromo(clienteId, file) {
  const err = validarArchivo(file)
  if (err) throw new Error(err)
  const esVideo = file.type.startsWith('video/')
  let cuerpo = file, ext, contentType = file.type
  if (esVideo) {
    const seg = await duracionVideo(file)
    if (seg > MAX_VIDEO_SEG + 0.5) throw new Error(`El video dura más de ${MAX_VIDEO_SEG} segundos`)
    ext = file.type === 'video/webm' ? 'webm' : 'mp4'
  } else {
    cuerpo = await comprimirImagen(file); ext = 'webp'; contentType = 'image/webp'
  }
  const path = `${clienteId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { error } = await supabase.storage.from('promos').upload(path, cuerpo, { contentType, cacheControl: '31536000' })
  if (error) throw error
  const { data } = supabase.storage.from('promos').getPublicUrl(path)
  return { tipo: esVideo ? 'video' : 'imagen', url: data.publicUrl, path }
}

// Guarda en la base los archivos ya subidos de una promo (reemplaza los anteriores).
export async function guardarMediaPromo(promoId, clienteId, items) {
  await supabase.from('promocion_media').delete().eq('promocion_id', promoId)
  if (!items.length) return
  const filas = items.map((m, i) => ({ promocion_id: promoId, cliente_id: clienteId, orden: i, tipo: m.tipo, url: m.url, path: m.path }))
  const { error } = await supabase.from('promocion_media').insert(filas)
  if (error) throw error
}

export async function borrarArchivosPromo(paths) {
  if (paths?.length) await supabase.storage.from('promos').remove(paths)
}
