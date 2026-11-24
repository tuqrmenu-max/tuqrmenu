import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useBuilderState } from './useBuilderState'
import { useI18n } from '@/lib/i18n'

// Nombre para guardar el archivo: es el nombre completo del producto, sacando
// solo los caracteres que Windows/macOS no dejan usar en un nombre de archivo
// (/ \ : * ? " < > |). El Builder ignora signos y espacios al emparejar la
// imagen con el producto, así que al subir varias juntas se asignan solas.
export function nombreArchivoProducto(producto) {
  return String(producto || '')
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function copiarTexto(text) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    ta.remove()
  }
}

// Asistente de imágenes con IA: pantalla completa para ver bien todas las
// imágenes que faltan. Antes vivía dentro de la solapa Categorías.
export default function AsistenteImagenesIA({ onClose }) {
  const state = useBuilderState()
  const { t } = useI18n()
  const [copiedKey, setCopiedKey] = useState(null)
  const [loadingImages, setLoadingImages] = useState(false)

  let missing = []
  try {
    missing = state.missingProductImages() || []
  } catch (err) {
    console.error('Error computing missing images:', err)
  }

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose])

  const marcarCopiado = (key) => {
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(k => (k === key ? null : k)), 1500)
  }

  const copiar = async (text, key) => {
    await copiarTexto(text)
    marcarCopiado(key)
  }

  const copyAllPrompts = () => {
    const text = missing.map(({ r }, n) => `${n + 1}. ${r.producto || 'Producto'}\n${state.productAiPrompt(r)}`).join('\n\n--------------------\n\n')
    return copiar(text, 'all')
  }

  const copyAllNames = () => {
    const text = missing.map(({ r }) => nombreArchivoProducto(r.producto)).join('\n')
    return copiar(text, 'all-names')
  }

  const handleLoadGeneratedImages = async () => {
    setLoadingImages(true)
    try {
      const resp = await fetch('/images-map.json')
      if (!resp.ok) throw new Error('No se encontró images-map.json. Ejecutá primero el script generar-imagenes.js')
      const mapping = await resp.json()
      let loaded = 0
      state.rows.forEach((r, i) => {
        const imgPath = mapping[r.producto]
        if (imgPath) {
          state.setProductImage('__row_' + i, imgPath)
          loaded++
        }
      })
      alert(`${loaded} imágenes cargadas desde images-map.json`)
    } catch (err) {
      alert('Error: ' + err.message)
    } finally {
      setLoadingImages(false)
    }
  }

  // Carga masiva de imágenes de categorías: intenta matchear cada archivo
  // con el nombre real de una categoría (coincidencia exacta o que una key
  // contenga a la otra, así no importa si el nombre de archivo trae la
  // extensión pegada o alguna palabra de más) y sincroniza esa imagen a la
  // base de datos (tabla `categorias`) para que se vea igual en Carta y en
  // el Builder.
  const handleBulkCategoryImages = async (files) => {
    const cats = state.categories()
    let matched = 0
    for (const file of files) {
      const dataUrl = await state.normalizeSquareImage(file, 400)
      const key = file.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')
      const match = cats.find(([cat]) => {
        const catKey = state.categoryKey(cat)
        return catKey === key || key.includes(catKey) || catKey.includes(key)
      })
      if (match) {
        const [catName] = match
        state.setCategoryImage('__cat_' + state.categoryKey(catName), dataUrl)
        state.syncCategoryImageToDB(catName, dataUrl)
        matched++
      }
    }
    if (matched < files.length) {
      alert(`Se cargaron ${matched} de ${files.length} imágenes. Las que no coincidieron necesitan que el nombre del archivo se parezca al nombre de la categoría (ej: "bebidas.jpg" para la categoría "Bebidas").`)
    }
  }

  const total = state.rows.length
  const hechas = total - missing.length

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-dark-900 flex flex-col" role="dialog" aria-modal="true" aria-label={t('asistenteIa')}>
      {/* Encabezado */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-dark-700 bg-dark-800">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-white">✨ {t('asistenteIa')}</h2>
          <p className="text-xs text-dark-400">
            {state.clientName ? `${state.clientName} · ` : ''}
            {missing.length > 0 ? `${missing.length} ${t('productosSinImagen')}` : t('todosConImagen')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => window.open('https://qwen.ai/', '_blank', 'noopener,noreferrer')}
            className="text-xs px-3 py-2 bg-accent-500/20 text-accent-400 rounded-lg hover:bg-accent-500/30"
          >
            🌐 Abrir Qwen
          </button>
          <button
            onClick={copyAllNames}
            disabled={missing.length === 0}
            className="text-xs px-3 py-2 bg-accent-500/20 text-accent-400 rounded-lg hover:bg-accent-500/30 disabled:opacity-50"
          >
            {copiedKey === 'all-names' ? '✓ Copiado' : '📋 Copiar todos los nombres'}
          </button>
          <button
            onClick={copyAllPrompts}
            disabled={missing.length === 0}
            className="text-xs px-3 py-2 bg-primary-500/20 text-primary-400 rounded-lg hover:bg-primary-500/30 disabled:opacity-50"
          >
            {copiedKey === 'all' ? '✓ Copiado' : `📋 ${t('copiarPrompts')}`}
          </button>
          <label
            className="text-xs px-3 py-2 bg-primary-500/20 text-primary-400 rounded-lg cursor-pointer hover:bg-primary-500/30"
            title='El nombre de cada archivo tiene que parecerse al nombre de la categoría (ej: "bebidas.jpg" para "Bebidas")'
          >
            🖼️ {t('imagenesCategorias')} · múltiples 500×500 px
            <input
              type="file" accept="image/*" multiple className="hidden"
              onChange={async e => { const files = Array.from(e.target.files || []); e.target.value = ''; if (files.length) await handleBulkCategoryImages(files) }}
            />
          </label>
          <button
            onClick={handleLoadGeneratedImages}
            disabled={loadingImages || missing.length === 0}
            className="text-xs px-3 py-2 bg-dark-700 text-dark-200 rounded-lg hover:bg-dark-600 disabled:opacity-50"
          >
            {loadingImages ? '⏳ Cargando...' : '📥 Cargar imágenes generadas (del script)'}
          </button>
          <button
            onClick={onClose}
            className="text-sm px-3 py-2 bg-dark-700 text-white rounded-lg hover:bg-dark-600"
            aria-label="Cerrar"
          >
            ✕ Cerrar
          </button>
        </div>
      </div>

      {/* Contenido */}
      <div className="flex-1 overflow-auto px-4 sm:px-6 py-4 space-y-4">
        {total > 0 && (
          <div>
            <div className="flex justify-between text-xs text-dark-400 mb-1">
              <span>Imágenes generadas</span>
              <span>{hechas} / {total}</span>
            </div>
            <div className="w-full h-2 bg-dark-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-accent-500 to-primary-500 transition-all duration-500"
                style={{ width: `${(hechas / total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {missing.length > 0 && (
          <div className="bg-dark-800 border border-dark-700 rounded-xl p-3 text-xs text-dark-300 space-y-1">
            <p><b>Para que se carguen solas:</b> descargá cada imagen con el <b>mismo nombre</b> del producto (botón "📋 Copiar nombre"), pegalo como nombre del archivo y después subí todas juntas desde Productos → carga múltiple.</p>
            <p><b>Pasos:</b> 1) "Copiar prompt" del producto · 2) pegalo en Qwen · 3) descargá la imagen y guardala con el nombre copiado · 4) subila acá con "Cargar imagen" o en lote desde Productos.</p>
            <p><b>Automático:</b> ejecutá <code>node scripts/generar-imagenes.js</code> y hacé clic en "Cargar imágenes generadas".</p>
          </div>
        )}

        {missing.length === 0 ? (
          <div className="text-center text-accent-400 py-16 text-lg">✓ {t('todosConImagen')}</div>
        ) : (
          <div className="grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            {missing.map(({ r, i }) => {
              const prompt = state.productAiPrompt(r)
              const nombre = nombreArchivoProducto(r.producto)
              return (
                <div key={i} className="bg-dark-800 border border-dark-700 rounded-xl p-3 flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-white break-words">{r.producto || 'Producto'}</div>
                      <div className="text-[11px] text-dark-400">{r.categoria}</div>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded flex-shrink-0">{t('sinImagen')}</span>
                  </div>

                  <button
                    onClick={() => copiar(nombre, 'n' + i)}
                    disabled={!nombre}
                    title="Copia el nombre completo para guardar la imagen con el mismo nombre"
                    className="text-xs px-2 py-1.5 bg-accent-500/20 text-accent-400 rounded-lg hover:bg-accent-500/30 disabled:opacity-50"
                  >
                    {copiedKey === 'n' + i ? '✓ Nombre copiado' : '📋 Copiar nombre'}
                  </button>

                  <textarea
                    readOnly
                    value={prompt}
                    className="w-full bg-dark-900 text-[11px] text-dark-300 rounded p-2 h-24 resize-none"
                  />
                  <div className="flex gap-1">
                    <button
                      onClick={async () => {
                        await copiar(prompt, 'p' + i)
                        window.open('https://qwen.ai/', '_blank', 'noopener,noreferrer')
                      }}
                      className="flex-1 text-[11px] px-2 py-1.5 bg-accent-500/20 text-accent-400 rounded hover:bg-accent-500/30"
                    >
                      {copiedKey === 'p' + i ? '✓ Copiado' : '📋🌐 Copiar prompt + Abrir Qwen'}
                    </button>
                    <label className="flex-1 text-[11px] px-2 py-1.5 bg-primary-500/20 text-primary-400 rounded cursor-pointer hover:bg-primary-500/30 text-center">
                      🖼️ {t('cargarGenerada')}
                      <input
                        type="file" accept="image/*" className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files[0]
                          if (!file) return
                          const dataUrl = await state.normalizeSquareImage(file, 300)
                          state.setProductImage('__row_' + i, dataUrl)
                          state.syncProductImageToDB(r.producto, dataUrl)
                        }}
                      />
                    </label>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
