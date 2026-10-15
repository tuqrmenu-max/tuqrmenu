import { loadVersionedCatalog } from '@/lib/catalogCache'
import { useState, useEffect, useRef } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

export default function MenuView() {
  const { token } = useParams()
  const [searchParams] = useSearchParams()
  const rawMesa = searchParams.get('mesa') || '0'
  const mesaNumero = /^\d+$/.test(rawMesa) ? String(Number(rawMesa)) : '0'

  const loadGeneration = useRef(0)
  const blobUrl = useRef(null)
  const [iframeSrc, setIframeSrc] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const generation = ++loadGeneration.current
    setLoading(true); setError(null); setIframeSrc(null)
    fetchMenuData(generation)
    return () => {
      loadGeneration.current++
      if (blobUrl.current) URL.revokeObjectURL(blobUrl.current)
      blobUrl.current = null
    }
  }, [token, mesaNumero])

  const fetchMenuData = async (generation) => {
    const { data, error: fetchError } = await supabase
      .from('clientes')
      .select('qr_catalog_version,id,menu_url,nombre_restaurante,whatsapp,waIcon:builder_config->waIcon,igIcon:builder_config->igIcon,mapIcon:builder_config->mapIcon,promoIcon:builder_config->promoIcon,logoBar:builder_config->logoBar,topTransforms:builder_config->topTransforms,topBarFrameBorderColor:builder_config->topBarFrameBorderColor,topBarFrameBorderTransparent:builder_config->topBarFrameBorderTransparent,topBarFrameBgColor:builder_config->topBarFrameBgColor,topBarFrameBgTransparent:builder_config->topBarFrameBgTransparent')
      .eq('user_id', token)
      .single()

    if (generation !== loadGeneration.current) return
    if (fetchError || !data) {
      setError('Menú no encontrado')
      setLoading(false)
      return
    }

    if (!data.menu_url) {
      setError('Este restaurante aún no tiene menú creado')
      setLoading(false)
      return
    }

    try {
      const res = await fetch(data.menu_url, { cache: 'default' })
      if (!res.ok) throw new Error('No se pudo descargar el menú')
      let html = await res.text()

      html = html.replace(
        /const mesaNumero=parseInt\(new URLSearchParams\(window\.location\.search\)\.get\('mesa'\)\|\|'0',10\)/,
        `const mesaNumero=${mesaNumero}`
      )

      // Mesa 0 = pedidos por WhatsApp, sin llamada al mozo: ocultar campanas con CSS
      if (mesaNumero === '0') {
        const hideMozoButtonsCss = '<style>#callMozo,#callMozoCats,.bellBtn{display:none!important;visibility:hidden!important;pointer-events:none!important}</style>'
        html = html.replace('</head>', hideMozoButtonsCss + '</head>')
      }

      // Las imágenes, descripciones, precios y productos nuevos se leen
      // con una versión transaccional de Carta al abrir el QR. Así, un producto creado
      // o editado en Carta aparece de inmediato en el menú del cliente aunque
      // el HTML exportado sea anterior a ese cambio (no depende de que el
      // dueño vuelva a tocar "Guardar proyecto" / "Exportar menú").
      const catalog = await loadVersionedCatalog({
        key: 'qrmenu:catalog:v2:' + import.meta.env.VITE_SUPABASE_URL + ':' + data.id,
        version: data.qr_catalog_version,
        fetchCatalog: async () => {
          const { data: result, error } = await supabase.rpc('qr_catalogo_v2', { p_cliente_id: data.id })
          if (error) throw error
          return result
        }
      })
      const liveCategories = catalog.categories
      const liveProducts = catalog.products

      const config = data
      if (config || liveCategories || liveProducts) {
        const iconFields = [
          'waIcon', 'igIcon', 'mapIcon', 'promoIcon', 'logoBar', 'topTransforms',
          'topBarFrameBorderColor', 'topBarFrameBorderTransparent',
          'topBarFrameBgColor', 'topBarFrameBgTransparent'
        ]
        const dataMatch = html.match(/const DATA=(\{[\s\S]*?\});/)
        if (!dataMatch) throw new Error('El menú publicado debe regenerarse desde Diseño.')
        if (dataMatch) {
          try {
            const dataObj = JSON.parse(dataMatch[1])
            let changed = false
            for (const f of iconFields) {
              if (config && config[f] !== undefined && config[f] !== null) {
                dataObj[f] = config[f]
                changed = true
              }
            }

            const normalize = value => String(value || '')
              .toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .replace(/[^a-z0-9]/g, '')

            if (liveProducts && liveCategories) {
              const catNameById = new Map(liveCategories.map(cat => [cat.id, cat.nombre]))

              // Se conservan las imágenes cargadas a mano desde el Builder
              // que quedaron guardadas con una clave propia (por nombre de
              // archivo), no ligadas a una fila puntual.
              const preservedProductImages = {}
              Object.entries(dataObj.productImages || {}).forEach(([key, value]) => {
                if (!key.startsWith('__row_')) preservedProductImages[key] = value
              })

              const rows = liveProducts.map(p => ({
                id: p.id || '',
                categoria: catNameById.get(p.categoria_id) || 'Sin categoría',
                producto: p.nombre || '',
                precio: String(p.precio ?? ''),
                detalle: p.detalle || p.descripcion || '',
                imagen: p.imagen || ''
              }))

              const productImages = { ...preservedProductImages }
              rows.forEach((row, index) => {
                if (row.imagen) productImages['__row_' + index] = row.imagen
              })

              dataObj.rows = rows
              dataObj.productImages = productImages
              changed = true
            }

            dataObj.categoryImages = { ...(dataObj.categoryImages || {}) }
            ;(liveCategories || []).forEach(category => {
              const imageKey = `__cat_${normalize(category.nombre) || 'sin-categoria'}`
              if (category.imagen) dataObj.categoryImages[imageKey] = category.imagen
              else delete dataObj.categoryImages[imageKey]
              changed = true
            })

            if (changed) {
              const newDataStr = JSON.stringify(dataObj).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
              html = html.replace(dataMatch[0], () => `const DATA=${newDataStr};`)
            }
          } catch (e) {
            throw new Error('No se pudo incorporar Carta al menú: ' + e.message)
          }
        }
      }

      if (generation !== loadGeneration.current) return
      const blob = new Blob([html], { type: 'text/html' })
      blobUrl.current = URL.createObjectURL(blob)
      setIframeSrc(blobUrl.current)
    } catch (e) {
      if (generation !== loadGeneration.current) return
      setError('No se pudo cargar el menú actualizado: ' + e.message)
    }

    setLoading(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0d10] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#5fd8c4]"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0b0d10] flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-[#c7cbd1] text-lg mb-4">{error}</p>
          <button
            onClick={() => window.history.back()}
            className="px-6 py-2 bg-[#2f6fed] text-white rounded-xl"
          >
            Volver
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0b0d10] flex items-center justify-center p-0 sm:p-2 overscroll-none touch-pan-y">
      <div className="relative w-full max-w-[430px] overflow-hidden bg-[#111] rounded-none sm:rounded-[22px] shadow-[0_20px_70px_rgba(0,0,0,.5)] min-h-[100dvh] sm:min-h-0 sm:aspect-[9/16] sm:max-h-[932px] overscroll-none">
        {iframeSrc && (
          <iframe
            src={iframeSrc}
            className="absolute inset-0 w-full h-full border-0 overscroll-contain"
            style={{ minHeight: '100%', overscrollBehavior: 'contain' }}
            title="Menú"
          />
        )}
      </div>
    </div>
  )
}
