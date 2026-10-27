import { useState } from 'react'
import { useBuilderState } from './useBuilderState'
import { useI18n } from '@/lib/i18n'
import * as XLSX from 'xlsx'

function TransformControls({ label, transformField, maxW = 1080, maxH = 1920 }) {
  const state = useBuilderState()
  const { t } = useI18n()
  const transform = state.topTransforms?.[transformField] || { x: 0, y: 0, scale: 1, rotation: 0 }

  const update = (prop, value) => {
    state.setTopTransform(transformField, { [prop]: value })
  }

  const effectiveMaxW = typeof maxW === 'function' ? maxW() : maxW
  const dynamicMaxX = Math.round(1080 - effectiveMaxW * (transform.scale || 1))
  const dynamicMaxY = Math.round(1920 - maxH * (transform.scale || 1))

  return (
    <div className="bg-dark-700/50 rounded-xl p-3 border border-dark-600">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-white">{label}</span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        <div>
          <label className="text-[10px] text-dark-400">X (0-{dynamicMaxX})</label>
          <input type="range" min="0" max={dynamicMaxX} value={Math.round(transform.x)} onChange={e => update('x', Math.min(dynamicMaxX, Math.max(0, Number(e.target.value))))} className="w-full h-1 accent-primary-500" />
          <input type="number" min="0" max={dynamicMaxX} value={Math.round(transform.x)} onChange={e => update('x', Math.min(dynamicMaxX, Math.max(0, Number(e.target.value))))} className="w-full bg-dark-800 text-[10px] text-white rounded px-1 py-0.5 mt-0.5" />
        </div>
        <div>
          <label className="text-[10px] text-dark-400">Y (0-{dynamicMaxY})</label>
          <input type="range" min="0" max={dynamicMaxY} value={Math.round(transform.y)} onChange={e => update('y', Math.min(dynamicMaxY, Math.max(0, Number(e.target.value))))} className="w-full h-1 accent-primary-500" />
          <input type="number" min="0" max={dynamicMaxY} value={Math.round(transform.y)} onChange={e => update('y', Math.min(dynamicMaxY, Math.max(0, Number(e.target.value))))} className="w-full bg-dark-800 text-[10px] text-white rounded px-1 py-0.5 mt-0.5" />
        </div>
        <div>
          <label className="text-[10px] text-dark-400">{t('tamLetra')} (30-300%)</label>
          <input type="range" min="30" max="300" value={Math.round((transform.scale || 1) * 100)} onChange={e => { const s = Number(e.target.value) / 100; update('scale', s); update('x', Math.min(transform.x, Math.round(1080 - effectiveMaxW * s))); update('y', Math.min(transform.y, Math.round(1920 - maxH * s))) }} className="w-full h-1 accent-primary-500" />
          <input type="number" min="30" max="300" value={Math.round((transform.scale || 1) * 100)} onChange={e => { const s = Math.min(300, Math.max(30, Number(e.target.value))) / 100; update('scale', s); update('x', Math.min(transform.x, Math.round(1080 - effectiveMaxW * s))); update('y', Math.min(transform.y, Math.round(1920 - maxH * s))) }} className="w-full bg-dark-800 text-[10px] text-white rounded px-1 py-0.5 mt-0.5" />
        </div>
        <div>
          <label className="text-[10px] text-dark-400">Rotar (-180° a 180°)</label>
          <input type="range" min="-180" max="180" value={Math.round(transform.rotation || 0)} onChange={e => update('rotation', Number(e.target.value))} className="w-full h-1 accent-primary-500" />
          <input type="number" min="-180" max="180" value={Math.round(transform.rotation || 0)} onChange={e => update('rotation', Math.min(180, Math.max(-180, Number(e.target.value))))} className="w-full bg-dark-800 text-[10px] text-white rounded px-1 py-0.5 mt-0.5" />
        </div>
      </div>
    </div>
  )
}

export default function CategoriesEditor() {
  const state = useBuilderState()
  const { t } = useI18n()
  const [copiedIdx, setCopiedIdx] = useState(null)
  const [loadingImages, setLoadingImages] = useState(false)

  let categories = []
  let missing = []
  try {
    categories = state.categories() || []
    missing = state.missingProductImages() || []
  } catch (err) {
    console.error('Error computing categories/missing:', err)
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
          // Convert file path to fetchable URL - use the image data
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

  const handleExcelUpload = (file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const json = XLSX.utils.sheet_to_json(ws, { defval: '' })
        state.loadExcel(json)
      } catch (err) {
        alert('Error al leer el Excel: ' + err.message)
      }
    }
    reader.readAsArrayBuffer(file)
  }

  // Carga masiva de imágenes de categorías: intenta matchear cada archivo
  // con el nombre real de una categoría (mismo criterio "tolerante" que ya
  // usa el bulk de productos en ProductsEditor: coincidencia exacta o que
  // una key contenga a la otra, así no importa si el nombre de archivo
  // trae la extensión pegada o alguna palabra de más) y sincroniza esa
  // imagen a la base de datos (tabla `categorias`) para que se vea igual
  // en Carta y en el Builder.
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

  const handleBulkImages = async (files, type) => {
    for (const file of files) {
      const size = type === 'products' ? 300 : 400
      const dataUrl = await state.normalizeSquareImage(file, size)
      const key = file.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')
      if (type === 'products') {
        state.setProductImage(key, dataUrl)
      } else {
        state.setCategoryImage('__cat_' + key, dataUrl)
      }
    }
  }

  const copyPrompt = async (text, idx) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedIdx(idx)
      setTimeout(() => setCopiedIdx(null), 1500)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      ta.remove()
      setCopiedIdx(idx)
      setTimeout(() => setCopiedIdx(null), 1500)
    }
  }

  const copyAllPrompts = async () => {
    const text = missing.map(({ r }, n) => `${n + 1}. ${r.producto || 'Producto'}\n${state.productAiPrompt(r)}`).join('\n\n--------------------\n\n')
    await copyPrompt(text, 'all')
  }

  return (
    <div className="space-y-4">
      {/* Forma de mostrar las categorías al cliente: Fijo (posiciones del Builder) o Anillo 3D */}
      <div className="bg-dark-700/50 rounded-xl p-3 border border-dark-600">
        <h4 className="text-sm font-semibold text-white mb-1">🎡 Forma de las categorías</h4>
        <p className="text-[10px] text-dark-400 mb-3">Elegí cómo ve el cliente las categorías en el menú (mesa 0, 00 y mesas 1 en adelante).</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { id: 'fijo', label: 'Fijo', desc: 'Cada categoría en la posición que le diste' },
            { id: 'anillo', label: 'Anillo', desc: 'Anillo 3D: se desliza y se entra a la del centro' }
          ].map(op => {
            const activo = (state.categoriesLayout === 'anillo' ? 'anillo' : 'fijo') === op.id
            return (
              <label
                key={op.id}
                className={`flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer transition ${activo ? 'border-primary-500 bg-primary-500/10' : 'border-dark-600 hover:border-dark-500'}`}
              >
                <input
                  type="checkbox"
                  checked={activo}
                  onChange={() => state.setField('categoriesLayout', op.id)}
                  className="mt-0.5 accent-primary-500 w-4 h-4"
                />
                <span>
                  <span className="block text-sm font-medium text-white">{op.label}</span>
                  <span className="block text-[10px] text-dark-400">{op.desc}</span>
                </span>
              </label>
            )
          })}
        </div>
        {state.categoriesLayout === 'anillo' && (
          <p className="text-[10px] text-dark-400 mt-2">
            En modo Anillo se usan las imágenes y categorías cargadas (con fondo transparente se ven mejor). Las posiciones de cada categoría solo se usan en modo Fijo. Para verlo en un menú ya publicado, guardá/publicá de nuevo el diseño.
          </p>
        )}
      </div>

      {/* Iconos superiores - Posición */}
      <div className="bg-dark-700/50 rounded-xl p-3 border border-dark-600">
        <h4 className="text-sm font-semibold text-white mb-2">📍 Posición iconos superiores</h4>
        <p className="text-[10px] text-dark-400 mb-3">Ajustá la posición de cada icono en la barra superior</p>
        <div className="space-y-3">
          <TransformControls label="ℹ️ Logo (info: horario, WhatsApp, Instagram, ubicación)" transformField="logo" maxW={38} maxH={38} />
        </div>
      </div>

      {/* Fondos */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm text-dark-400 mb-1 block">{t('fondCategorias')}</label>
          <label className="flex flex-col items-center justify-center w-full h-16 bg-dark-700 border border-dashed border-dark-500 rounded-xl cursor-pointer hover:border-primary-500 transition">
            <span className="text-xs text-dark-400">1080×1920</span>
            <input type="file" accept="image/*" className="hidden" onChange={e => {
              if (e.target.files[0]) {
                const reader = new FileReader()
                reader.onload = ev => state.setField('categoriesBg', ev.target.result)
                reader.readAsDataURL(e.target.files[0])
              }
            }} />
          </label>
          <label className="text-[10px] text-dark-400 mt-1 block">Desenfoque: <b className="text-white">{state.categoriesBlur}%</b></label>
          <input
            type="range" min="0" max="100"
            value={state.categoriesBlur}
            onChange={e => state.setField('categoriesBlur', Number(e.target.value))}
            className="w-full h-1.5 accent-primary-500"
          />
        </div>
        <div>
          <label className="text-sm text-dark-400 mb-1 block">{t('fondProductos')}</label>
          <label className="flex flex-col items-center justify-center w-full h-16 bg-dark-700 border border-dashed border-dark-500 rounded-xl cursor-pointer hover:border-primary-500 transition">
            <span className="text-xs text-dark-400">1080×1920</span>
            <input type="file" accept="image/*" className="hidden" onChange={e => {
              if (e.target.files[0]) {
                const reader = new FileReader()
                reader.onload = ev => state.setField('productsBg', ev.target.result)
                reader.readAsDataURL(e.target.files[0])
              }
            }} />
          </label>
          <label className="text-[10px] text-dark-400 mt-1 block">Desenfoque: <b className="text-white">{state.productsBlur}%</b></label>
          <input
            type="range" min="0" max="100"
            value={state.productsBlur}
            onChange={e => state.setField('productsBlur', Number(e.target.value))}
            className="w-full h-1.5 accent-primary-500"
          />
        </div>
      </div>

      <div>
        <label className="text-sm text-dark-400 mb-1 block">{t('fondCarrito')}</label>
        <label className="flex flex-col items-center justify-center w-full h-16 bg-dark-700 border border-dashed border-dark-500 rounded-xl cursor-pointer hover:border-primary-500 transition">
          <span className="text-xs text-dark-400">Subir fondo carrito</span>
          <input type="file" accept="image/*" className="hidden" onChange={e => {
            if (e.target.files[0]) {
              const reader = new FileReader()
              reader.onload = ev => state.setField('cartBg', ev.target.result)
              reader.readAsDataURL(e.target.files[0])
            }
          }} />
        </label>
        <label className="text-[10px] text-dark-400 mt-1 block">Desenfoque: <b className="text-white">{state.cartBlur}%</b></label>
        <input
          type="range" min="0" max="100"
          value={state.cartBlur}
          onChange={e => state.setField('cartBlur', Number(e.target.value))}
          className="w-full h-1.5 accent-primary-500"
        />
      </div>

      {/* Excel */}
      <div>
        <label className="text-sm text-dark-400 mb-1 block">{t('subirExcel')}</label>
        <label className="flex flex-col items-center justify-center w-full h-16 bg-dark-700 border border-dashed border-dark-500 rounded-xl cursor-pointer hover:border-primary-500 transition">
          <span className="text-xs text-dark-400">.xlsx / .csv</span>
          <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => handleExcelUpload(e.target.files[0])} />
        </label>
        {state.rows.length > 0 && (
          <p className="text-xs text-accent-400 mt-1">✓ {state.rows.length} filas cargadas</p>
        )}
      </div>

      {/* Imágenes masivas de categorías (el de productos en lote se movió
          a la solapa Productos, donde ya vive y funciona bien, para no
          duplicarlo acá) */}
      <div>
        <label className="text-sm text-dark-400 mb-1 block">{t('imagenesCategorias')}</label>
        <label className="flex flex-col items-center justify-center w-full h-16 bg-dark-700 border border-dashed border-dark-500 rounded-xl cursor-pointer hover:border-primary-500 transition">
          <span className="text-xs text-dark-400">Múltiples imágenes · 500×500 px</span>
          <input type="file" accept="image/*" multiple className="hidden" onChange={e => handleBulkCategoryImages(e.target.files)} />
        </label>
        <p className="text-[10px] text-dark-500 mt-1">El nombre de cada archivo tiene que parecerse al nombre de la categoría (ej: "bebidas.jpg" para "Bebidas").</p>
      </div>

      {/* Asistente IA */}
      <div className="bg-dark-700/50 rounded-xl p-3 border border-dark-600">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h4 className="text-sm font-semibold text-white">✨ {t('asistenteIa')}</h4>
            <p className="text-[10px] text-dark-400">
              {missing.length > 0
                ? `${missing.length} ${t('productosSinImagen')}`
                : t('todosConImagen')}
            </p>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => window.open('https://qwen.ai/', '_blank')}
              className="text-[10px] px-2 py-1 bg-accent-500/20 text-accent-400 rounded-lg hover:bg-accent-500/30"
            >
              🌐 Abrir Qwen
            </button>
            <button
              onClick={copyAllPrompts}
              disabled={missing.length === 0}
              className="text-[10px] px-2 py-1 bg-primary-500/20 text-primary-400 rounded-lg hover:bg-primary-500/30 disabled:opacity-50"
            >
              📋 {t('copiarPrompts')}
            </button>
          </div>
        </div>

        {/* Barra de progreso */}
        {state.rows.length > 0 && (
          <div className="mb-3">
            <div className="flex justify-between text-[10px] text-dark-400 mb-1">
              <span>Imágenes generadas</span>
              <span>{state.rows.length - missing.length} / {state.rows.length}</span>
            </div>
            <div className="w-full h-2 bg-dark-900 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-accent-500 to-primary-500 transition-all duration-500"
                style={{ width: `${state.rows.length > 0 ? ((state.rows.length - missing.length) / state.rows.length * 100) : 0}%` }}
              />
            </div>
          </div>
        )}

        {/* Instrucciones */}
        {missing.length > 0 && (
          <div className="bg-dark-900/50 rounded-lg p-2 mb-3 text-[10px] text-dark-300 space-y-1">
            <p><b>Automático:</b> Ejecutá `node scripts/generar-imagenes.js` y después hacé clic en "Cargar imágenes generadas"</p>
            <p><b>Manual:</b></p>
            <p><b>1.</b> Hacé clic en "Copiar prompt" del producto</p>
            <p><b>2.</b> Abrí Qwen con el botón de arriba y pegá el prompt</p>
            <p><b>3.</b> Descargá la imagen generada</p>
            <p><b>4.</b> Volvé acá y hacé clic en "Cargar imagen"</p>
          </div>
        )}

        <button
          onClick={handleLoadGeneratedImages}
          disabled={loadingImages || missing.length === 0}
          className="w-full mb-3 py-2 bg-accent-500/20 text-accent-400 rounded-lg text-xs font-medium hover:bg-accent-500/30 disabled:opacity-50"
        >
          {loadingImages ? '⏳ Cargando...' : '📥 Cargar imágenes generadas (del script)'}
        </button>

        <div className="space-y-2 max-h-60 overflow-auto">
          {missing.map(({ r, i }) => {
            const prompt = state.productAiPrompt(r)
            return (
              <div key={i} className="bg-dark-800 rounded-lg p-2">
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <span className="text-xs font-bold text-white">{r.producto || 'Producto'}</span>
                    <span className="text-[10px] text-dark-400 ml-2">{r.categoria}</span>
                  </div>
                  <span className="text-[9px] px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded">{t('sinImagen')}</span>
                </div>
                <textarea
                  readOnly
                  value={prompt}
                  className="w-full bg-dark-900 text-[9px] text-dark-300 rounded p-1.5 h-16 resize-none mb-1"
                />
                <div className="flex gap-1">
                  <button
                    onClick={async () => {
                      await copyPrompt(prompt, i)
                      window.open('https://qwen.ai/', '_blank')
                    }}
                    className="flex-1 text-[10px] px-2 py-1 bg-accent-500/20 text-accent-400 rounded hover:bg-accent-500/30"
                  >
                    📋🌐 Copiar + Abrir Qwen
                  </button>
                  <label className="flex-1 text-[10px] px-2 py-1 bg-primary-500/20 text-primary-400 rounded cursor-pointer hover:bg-primary-500/30 text-center">
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
      </div>

      {/* Gestor de categorías */}
      {categories.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-white">Categorías ({categories.length})</h4>
            <button
              onClick={() => {
                categories.forEach(([cat], i) => {
                  state.setCategoryTransform(cat, {
                    x: 60 + (i % 3) * 350,
                    y: 350 + Math.floor(i / 3) * 420
                  })
                })
              }}
              className="text-xs px-2 py-1 bg-dark-600 text-dark-300 rounded-lg hover:bg-dark-500"
            >
              {t('traerTodas')}
            </button>
          </div>

          {categories.map(([cat, count], idx) => {
            const img = state.findCategoryImage(cat)
            const catTransform = state.getCategoryTransform(cat, idx)
            const key = state.categoryKey(cat)
            const sizePct = Math.round((catTransform.scale || 1) * 100)

            return (
              <div key={cat} className="bg-dark-700/50 rounded-xl p-3 border border-dark-600">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-dark-600 flex items-center justify-center overflow-hidden">
                    {img ? <img className="w-full h-full object-cover" src={img} alt="" /> : <span>🍽️</span>}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-bold text-white">{cat}</div>
                    <div className="text-[10px] text-dark-400">{count} productos</div>
                  </div>
                  <label className="text-[10px] px-2 py-1 bg-dark-600 text-dark-300 rounded cursor-pointer hover:bg-dark-500">
                    Cargar imagen
                    <input
                      type="file" accept="image/*" className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files[0]
                        if (!file) return
                        const dataUrl = await state.normalizeSquareImage(file, 400)
                        state.setCategoryImage('__cat_' + key, dataUrl)
                        state.syncCategoryImageToDB(cat, dataUrl)
                      }}
                    />
                  </label>
                  <button
                    onClick={() => {
                      const catSize = 350 * (catTransform.scale || 1)
                      const maxX = Math.max(0, 1080 - catSize)
                      const maxY = Math.max(0, 1920 - catSize)
                      state.setCategoryTransform(cat, {
                        x: Math.round(maxX / 2),
                        y: Math.round(maxY / 2)
                      })
                    }}
                    className="text-[10px] px-2 py-1 bg-dark-600 text-dark-300 rounded hover:bg-dark-500"
                  >
                    {t('traerCentro')}
                  </button>
                </div>

                {(() => {
                  const imgSize = 96 * (catTransform.scale || 1)
                  const catMaxX = Math.round(1080 - imgSize)
                  const catMaxY = Math.round(1920 - imgSize)
                  return (
                    <div className="grid grid-cols-4 gap-2">
                      <div>
                        <label className="text-[10px] text-dark-400">X (0-{catMaxX})</label>
                        <input
                          type="range" min="0" max={catMaxX}
                          value={Math.round(catTransform.x)}
                          onChange={e => state.setCategoryTransform(cat, { x: Math.min(catMaxX, Math.max(0, Number(e.target.value))) })}
                          className="w-full h-1 accent-primary-500"
                        />
                        <input
                          type="number" min="0" max={catMaxX}
                          value={Math.round(catTransform.x)}
                          onChange={e => state.setCategoryTransform(cat, { x: Math.min(catMaxX, Math.max(0, Number(e.target.value))) })}
                          className="w-full bg-dark-800 text-[10px] text-white rounded px-1 py-0.5 mt-0.5"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-dark-400">Y (0-{catMaxY})</label>
                        <input
                          type="range" min="0" max={catMaxY}
                          value={Math.round(catTransform.y)}
                          onChange={e => state.setCategoryTransform(cat, { y: Math.min(catMaxY, Math.max(0, Number(e.target.value))) })}
                          className="w-full h-1 accent-primary-500"
                        />
                        <input
                          type="number" min="0" max={catMaxY}
                          value={Math.round(catTransform.y)}
                          onChange={e => state.setCategoryTransform(cat, { y: Math.min(catMaxY, Math.max(0, Number(e.target.value))) })}
                          className="w-full bg-dark-800 text-[10px] text-white rounded px-1 py-0.5 mt-0.5"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-dark-400">Tamaño (25-220%)</label>
                        <input
                          type="range" min="25" max="220"
                          value={sizePct}
                          onChange={e => {
                            const newScale = Number(e.target.value) / 100
                            const newSize = 96 * newScale
                            const newMaxX = Math.round(1080 - newSize)
                            const newMaxY = Math.round(1920 - newSize)
                            state.setCategoryTransform(cat, {
                              scale: newScale,
                              x: Math.min(catTransform.x, newMaxX),
                              y: Math.min(catTransform.y, newMaxY)
                            })
                          }}
                          className="w-full h-1 accent-primary-500"
                        />
                        <input
                          type="number" min="25" max="220"
                          value={sizePct}
                          onChange={e => {
                            const newScale = Math.min(220, Math.max(25, Number(e.target.value))) / 100
                            const newSize = 96 * newScale
                            const newMaxX = Math.round(1080 - newSize)
                            const newMaxY = Math.round(1920 - newSize)
                            state.setCategoryTransform(cat, {
                              scale: newScale,
                              x: Math.min(catTransform.x, newMaxX),
                              y: Math.min(catTransform.y, newMaxY)
                            })
                          }}
                          className="w-full bg-dark-800 text-[10px] text-white rounded px-1 py-0.5 mt-0.5"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-dark-400">Rotar (-180° a 180°)</label>
                        <input
                          type="range" min="-180" max="180"
                          value={Math.round(catTransform.rotation || 0)}
                          onChange={e => state.setCategoryTransform(cat, { rotation: Number(e.target.value) })}
                          className="w-full h-1 accent-primary-500"
                        />
                        <input
                          type="number" min="-180" max="180"
                          value={Math.round(catTransform.rotation || 0)}
                          onChange={e => state.setCategoryTransform(cat, { rotation: Math.min(180, Math.max(-180, Number(e.target.value))) })}
                          className="w-full bg-dark-800 text-[10px] text-white rounded px-1 py-0.5 mt-0.5"
                        />
                      </div>
                    </div>
                  )
                })()}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
