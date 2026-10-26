import { loadVersionedCatalog } from '@/lib/catalogCache'
import { useState, useEffect, useRef } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { aplicarModoMesa00 } from '@/lib/mesa00Menu'

export default function MenuView() {
  const { token } = useParams()
  const [searchParams] = useSearchParams()
  const rawMesa = searchParams.get('mesa') || '0'
  const mesaNumero = /^\d+$/.test(rawMesa) ? String(Number(rawMesa)) : '0'
  // ?mesa=00: mismo menú que Mesa 0, pero el pedido se guarda como Mesa 00 y no va por WhatsApp.
  const esMesa00 = rawMesa === '00'

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
  }, [token, mesaNumero, esMesa00])

  const fetchMenuData = async (generation) => {
    const { data, error: fetchError } = await supabase
      .from('clientes')
      .select('qr_catalog_version,id,menu_url,nombre_restaurante,whatsapp,horario_pedidos_activo,horario_pedidos,waIcon:builder_config->waIcon,igIcon:builder_config->igIcon,mapIcon:builder_config->mapIcon,promoIcon:builder_config->promoIcon,logoBar:builder_config->logoBar,topTransforms:builder_config->topTransforms,topBarFrameBorderColor:builder_config->topBarFrameBorderColor,topBarFrameBorderTransparent:builder_config->topBarFrameBorderTransparent,topBarFrameBgColor:builder_config->topBarFrameBgColor,topBarFrameBgTransparent:builder_config->topBarFrameBgTransparent')
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

      // Botón "Enviar mensaje" del logo: los menús exportados antes abrían wa.me con
      // location.href dentro del iframe, y WhatsApp bloquea ser cargado en un iframe.
      // Se reemplaza por window.open en pestaña nueva (igual que Instagram/Ubicación).
      const waHandler = "const waBtn=$('infoWa');if(waBtn)waBtn.onclick=()=>{let n=String(DATA.whatsapp||'').replace(/[^0-9]/g,'');if(n.length===10)n='54'+n;if(!n){showToast('WhatsApp no disponible');return}window.open('https://wa.me/'+n+'?text='+encodeURIComponent('Hola! Quisiera hacer una consulta.'),'_blank')};"
      html = html.replace(
        /const waBtn=\$\('infoWa'\);if\(waBtn\)waBtn\.onclick=\(\)=>\{location\.href=[^}]*\};/,
        () => waHandler
      )

      // Correcciones sobre menús exportados ANTES de estos arreglos (el HTML
      // guardado en Storage no cambia hasta volver a "Guardar proyecto").
      // Son idempotentes: si el HTML ya viene corregido, no matchean.
      // 1) Texto del descuento: "2x1 aplicado" (antes mostraba la cantidad, p. ej. "1x1").
      html = html.split("'+totalFree+'x1 aplicado").join('2x1 aplicado')
      // 2) Solo los productos de la promo se marcan es_promo (antes se marcaban
      //    también los del carrito normal y se cobraban a mitad de precio).
      html = html.split('es_promo:state.activePromo?1:0,').join('es_promo:0,')
      // 3) El mensaje de WhatsApp no listaba los productos de la promo.
      html = html.replace(
        "const sub=cartItems().reduce((s,i)=>s+price(i.precio)*i.qty,0);let promoSubtotal=0;let promoDiscount=0;",
        () => "const sub=cartItems().reduce((s,i)=>s+price(i.precio)*i.qty,0);if(state.activePromo){const es2x1=state.activePromo.tipo==='2x1_mismo'||state.activePromo.tipo==='2x1_categoria';const pg={};Object.keys(state.promoProducts).filter(idx=>state.promoProducts[idx]).forEach(idx=>{const r=DATA.rows[idx];if(!r||!r.producto)return;if(!pg[r.producto])pg[r.producto]={qty:0,price:price(r.precio)};pg[r.producto].qty+=es2x1?2:1});Object.keys(pg).forEach(n=>lines.push(pg[n].qty+' x '+n+' — '+money(pg[n].price*pg[n].qty)+(es2x1?' (promo 2x1)':'')))}let promoSubtotal=0;let promoDiscount=0;"
      )
      // 4) WhatsApp: la pestaña se abre en el mismo toque (antes se abría después
      //    de esperar a Supabase y el celular la bloqueaba, por eso no salía el pedido).
      html = html.replace(
        /if\(mesaNumero===0\|\|!supabaseClient\)\{(\s*)if\(state\.pickupEnabled\)/,
        (m, sp) => "if(mesaNumero===0||!supabaseClient){" + sp + "if(cartItems().length===0&&(typeof promoOrderItems!=='function'||promoOrderItems().length===0)){showToast('Elegí al menos un producto para el pedido');return}" + sp + "let waWin=null;try{waWin=window.open('','_blank')}catch(e){}" + sp + "if(state.pickupEnabled)"
      )
      html = html.split("window.open('https://wa.me/'+n+'?text='+encodeURIComponent(orderMessage()),'_blank');").join(
        "const waUrl='https://wa.me/'+n+'?text='+encodeURIComponent(orderMessage());if(typeof waWin!=='undefined'&&waWin&&!waWin.closed){waWin.location.href=waUrl}else{window.open(waUrl,'_blank')};"
      )

      // 5) Mesa 0: el "Estado del pedido" solo se muestra una vez enviado el pedido
      //    (antes aparecía al entrar, con el pedido anterior ya completo).
      if (!html.includes('mesa0Visto')) {
        const reemplazos = [["let lastItemsVersion=null;\nlet trackedComensal=null;", "let mesa0Visto=false;\nlet lastItemsVersion=null;\nlet trackedComensal=null;"], ["state.sentOrder=comensal;state.checklistVisible=!Boolean(comensal.ocultar_checklist);", "state.sentOrder=comensal;state.checklistVisible=!Boolean(comensal.ocultar_checklist);if(mesaNumero===0){const fin=comensal.estado_pedido==='entregado'||comensal.estado_pedido==='cerrado';if(!fin){mesa0Visto=true}else if(!mesa0Visto){try{localStorage.removeItem('mesa_0_sesion')}catch(e){}state.sentOrder=null;state.sentItems=[];lastItemsVersion=null;trackedComensal=null;orderTrackingDone=true;sentItemsListos=true;return}}"], ["  if(pr.error)return false;\n  await fetchSentItems();\n  return true;", "  if(pr.error)return false;\n  mesa0Visto=true;\n  await fetchSentItems();\n  return true;"], ["if(state.checklistVisible&&state.sentOrder){", "if(state.checklistVisible&&state.sentOrder&&!(mesaNumero===0&&(state.sentOrder.estado_pedido==='entregado'||state.sentOrder.estado_pedido==='cerrado')&&(cartItems().length>0||state.activePromo))){"]]
        if (reemplazos.every(([a]) => html.includes(a))) {
          reemplazos.forEach(([a, b]) => { html = html.split(a).join(b) })
        }
      }

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

            // Horario de pedidos: igual que los íconos de arriba, se toma
            // siempre el valor actual de `clientes` (no el que haya quedado
            // grabado en el HTML exportado), así el on/off y los horarios
            // cambian al instante sin tener que volver a exportar el menú.
            // WhatsApp de Carta > Datos de contacto y delivery: siempre el valor actual.
            if (config && config.whatsapp) {
              dataObj.whatsapp = config.whatsapp
              changed = true
            }

            if (config) {
              dataObj.horarioPedidosActivo = !!config.horario_pedidos_activo
              dataObj.horarioPedidos = config.horario_pedidos || {}
              changed = true
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

      if (esMesa00) html = aplicarModoMesa00(html)

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
