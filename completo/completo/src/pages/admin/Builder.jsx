import { saveIfChanged } from '@/lib/saveQueue'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useBuilderState } from '@/components/Builder/useBuilderState'
import { supabase } from '@/lib/supabase'
import { uploadMenuHtml, saveMenuUrlToCliente, saveBuilderConfig, saveBuilderFieldsToCliente, loadBuilderConfig, saveBuilderProducts, loadCatalogAsBuilderProducts } from '@/lib/storage'
import { useI18n } from '@/lib/i18n'
import { useAuth } from '@/hooks/useAuth'
import toast from 'react-hot-toast'
import CoverEditor from '@/components/Builder/CoverEditor'
import CategoriesEditor from '@/components/Builder/CategoriesEditor'
import ProductsEditor from '@/components/Builder/ProductsEditor'
import PhonePreview from '@/components/Builder/PhonePreview'

// Builder unico (reemplaza el Admin Builder y el Socio Builder que existian antes).
// Al guardar/exportar genera UN SOLO menu (HTML) que se adapta en tiempo real
// segun el numero de mesa leido de la URL (?mesa=0, ?mesa=1, ?mesa=2, ...):
//   - Mesa 0: seccion de delivery + "Retirar en el local" + pedido enviado por WhatsApp
//   - Mesa 1 en adelante: pedido enviado directo a la mesa (Supabase) + campana para llamar al mozo
// Por eso el mismo menu_url sirve para las dos URLs finales: .../menu/{userId}?mesa=0 y .../menu/{userId}?mesa=1
export default function Builder() {
  const { socioId: routeSocioId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { t } = useI18n()
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('cover')
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [socioId, setSocioId] = useState(routeSocioId || null)
  const [cameFromQuery, setCameFromQuery] = useState(false)
  const autoSaveTimer = useRef(null)
  const loadedRef = useRef(false)

  const state = useBuilderState()

  // Resolver socioId: 1) parametro de ruta (/admin/builder/:socioId) 2) query ?clienteId= (desde DashSocios)
  // 3) usuario logueado directamente como socio
  useEffect(() => {
    if (routeSocioId) {
      setSocioId(routeSocioId)
      return
    }
    setCameFromQuery(true)
    const urlClienteId = searchParams.get('clienteId')
    if (urlClienteId) {
      setSocioId(urlClienteId)
      return
    }
    if (user) fetchSocioIdFromAuth()
  }, [routeSocioId, user])

  const fetchSocioIdFromAuth = async () => {
    const { data, error } = await supabase
      .from('clientes')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (error || !data) {
      toast.error('No se encontró tu restaurante')
      setLoading(false)
      return
    }
    setSocioId(data.id)
  }

  const scheduleAutoSave = useCallback(() => {
    if (!loadedRef.current || !socioId) return
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(async () => {
      try {
        const st = useBuilderState.getState()
        const config = st.getBuilderConfig()
        await saveIfChanged(socioId + ":config", config, value => saveBuilderConfig(socioId, value))
        await saveIfChanged(socioId + ":fields", {
          fondo_menu: st.coverBg || '',
          logo_url: st.logo || '',
          bienvenido: st.welcomeText || '',
          whatsapp: st.whatsapp || '',
          instagram: st.instagram || '',
          direccion: st.address || '',
          horario: st.hours || '',
          promociones: st.promo || '',
          alias: st.alias || '',
          delivery: Number(st.delivery) || 0
        }, value => saveBuilderFieldsToCliente(socioId, value))
        await saveIfChanged(socioId + ":products", {
          rows: st.rows,
          productImages: st.productImages,
          categoryImages: st.categoryImages,
          categoryTransforms: st.categoryTransforms
        }, value => saveBuilderProducts(socioId, value))
      } catch (err) {
        console.error('[Builder] Auto-save error:', err)
        // Antes esto solo quedaba en la consola: el usuario seguía editando
        // pensando que se estaba guardando todo, y en realidad no. Ahora se
        // avisa explícitamente para que sepa que tiene que reintentar o usar
        // "💾 Guardar proyecto" a mano.
        toast.error('⚠️ No se pudo autoguardar: ' + err.message, { id: 'autosave-error', duration: 15000 })
      }
    }, 2000)
  }, [socioId])

  useEffect(() => {
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    }
  }, [])

  // Autoguardado disparado por CUALQUIER cambio en el store del Builder
  // (logo, portada, productos, imágenes de categorías/productos, colores,
  // textos, posiciones de íconos, etc.) usando el subscribe de zustand, en
  // vez de una lista fija de campos "escuchados" a mano: esa lista se iba
  // quedando corta cada vez que se agregaba un campo nuevo (por ejemplo,
  // antes no incluía ni el logo ni los productos/imágenes — que es
  // justamente lo que más se edita — por eso esos cambios no se guardaban).
  useEffect(() => {
    const unsubscribe = useBuilderState.subscribe(() => {
      scheduleAutoSave()
    })
    return unsubscribe
  }, [scheduleAutoSave])

  useEffect(() => {
    if (socioId) loadSocio()
  }, [socioId])

  const buildMesaUrls = (userIdOrSocioId) => ({
    mesa0: `${window.location.origin}/menu/${userIdOrSocioId}?mesa=0`,
    mesa1: `${window.location.origin}/menu/${userIdOrSocioId}?mesa=1`
  })

  const loadSocio = async () => {
    setLoading(true)
    loadedRef.current = false

    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .eq('id', socioId)
      .single()

    if (error) {
      toast.error('Error cargando restaurante: ' + error.message)
      setLoading(false)
      return
    }

    state.loadSocioData(data)

    // El menuUrl guardado en state se usa como base "mesa=0" para no romper compatibilidad;
    // en pantalla se muestran ambas URLs (mesa 0 y mesa 1) calculadas a partir del mismo userId.
    const idForUrl = data.user_id || socioId
    if (data.menu_url && data.user_id) {
      const correctUrl = `${window.location.origin}/menu/${data.user_id}?mesa=0`
      if (state.menuUrl !== correctUrl) {
        state.setMenuUrl(correctUrl)
      }
    } else if (!state.menuUrl) {
      state.setMenuUrl(`${window.location.origin}/menu/${idForUrl}?mesa=0`)
    }

    await state.loadFromSupabase(socioId)

    const config = await loadBuilderConfig(socioId)
    if (config) {
      state.loadBuilderConfig(config)
    }

    // Carta es la fuente de verdad del catálogo. Se arma el estado final del
    // Builder con las tablas actuales (incluidas imágenes de categorías Y de
    // productos) y se conservan únicamente los ajustes visuales propios del
    // Builder. Así una copia vieja de builder_products nunca vuelve a tapar
    // las imágenes recién cargadas desde Carta.
    try {
      const productsData = await loadCatalogAsBuilderProducts(socioId)
      state.setField('rows', productsData.rows || [])
      state.setField('productImages', productsData.productImages || {})
      state.setField('categoryImages', productsData.categoryImages || {})
      state.setField('categoryTransforms', productsData.categoryTransforms || {})
    } catch (catalogError) {
      console.error('[Builder] No se pudo cargar el catálogo actual de Carta:', catalogError)
      toast.error('No se pudo actualizar el catálogo desde Carta: ' + catalogError.message)
    }

    loadedRef.current = true
    setLoading(false)
  }

  const handleExport = async () => {
    if (!socioId) {
      toast.error('No se pudo identificar el restaurante')
      return
    }
    if (!state.clientName) {
      toast.error('Ingresá el nombre del cliente primero')
      return
    }

    setExporting(true)
    toast.loading('Exportando menú...', { id: 'export' })

    try {
      // Un solo export: el HTML generado ya se adapta solo segun ?mesa=0 o ?mesa=1+ en tiempo real
      const { html, filename } = state.exportHtml()

      const storageUrl = await uploadMenuHtml(socioId, html)
      await saveMenuUrlToCliente(socioId, storageUrl)

      const config = state.getBuilderConfig()
      await saveBuilderConfig(socioId, config)

      await saveBuilderFieldsToCliente(socioId, {
        fondo_menu: state.coverBg || '',
        logo_url: state.logo || '',
        bienvenido: state.welcomeText || '',
        whatsapp: state.whatsapp || '',
        instagram: state.instagram || '',
        direccion: state.address || '',
        horario: state.hours || '',
        promociones: state.promo || '',
        alias: state.alias || '',
        delivery: Number(state.delivery) || 0
      })

      await saveBuilderProducts(socioId, {
        rows: state.rows,
        productImages: state.productImages,
        categoryImages: state.categoryImages,
        categoryTransforms: state.categoryTransforms
      })

      const idForUrl = state.userId || socioId
      state.setMenuUrl(buildMesaUrls(idForUrl).mesa0)

      // Also download locally
      const blob = new Blob([html], { type: 'text/html' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = filename
      a.click()

      toast.dismiss('export')
      toast.success('Menú exportado correctamente')
    } catch (err) {
      toast.dismiss('export')
      toast.error('Error: ' + err.message, { duration: 15000 })
    } finally {
      setExporting(false)
    }
  }

  const handleSave = async () => {
    if (!socioId) {
      toast.error('No se pudo identificar el restaurante')
      return
    }
    setSaving(true)
    try {
      const config = state.getBuilderConfig()
      await saveBuilderConfig(socioId, config)
      await saveBuilderFieldsToCliente(socioId, {
        fondo_menu: state.coverBg || '',
        logo_url: state.logo || '',
        bienvenido: state.welcomeText || '',
        whatsapp: state.whatsapp || '',
        instagram: state.instagram || '',
        direccion: state.address || '',
        horario: state.hours || '',
        promociones: state.promo || '',
        alias: state.alias || '',
        delivery: Number(state.delivery) || 0
      })
      await saveBuilderProducts(socioId, {
        rows: state.rows,
        productImages: state.productImages,
        categoryImages: state.categoryImages,
        categoryTransforms: state.categoryTransforms
      })
      const { html } = state.exportHtml()
      const storageUrl = await uploadMenuHtml(socioId, html)
      await saveMenuUrlToCliente(socioId, storageUrl)
      toast.success('Proyecto guardado y menú actualizado')
    } catch (err) {
      toast.error('Error guardando: ' + err.message, { duration: 15000 })
    } finally {
      setSaving(false)
    }
  }

  const handleDownloadJson = () => {
    const data = JSON.stringify({
      clientName: state.clientName,
      coverBg: state.coverBg,
      categoriesBg: state.categoriesBg,
      productsBg: state.productsBg,
      cartBg: state.cartBg,
      logo: state.logo,
      blur: state.blur,
      welcomeText: state.welcomeText,
      welcomeColor: state.welcomeColor,
      welcomeBg: state.welcomeBg,
      welcomeBgNone: state.welcomeBgNone,
      welcomeSize: state.welcomeSize,
      buttonText: state.buttonText,
      buttonBg: state.buttonBg,
      buttonBorder: state.buttonBorder,
      buttonColor: state.buttonColor,
      rows: state.rows,
      whatsapp: state.whatsapp,
      instagram: state.instagram,
      address: state.address,
      hours: state.hours,
      promo: state.promo,
      alias: state.alias,
      delivery: state.delivery,
      logoTransform: state.logoTransform,
      welcomeTransform: state.welcomeTransform,
      buttonTransform: state.buttonTransform,
      categoryTransforms: state.categoryTransforms
    }, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = (state.clientName || 'menuqr') + '-proyecto.json'
    a.click()
  }

  const handleLoadJson = (file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const loaded = JSON.parse(e.target.result)
        Object.keys(loaded).forEach(key => {
          if (state[key] !== undefined) state.setField(key, loaded[key])
        })
        toast.success('Proyecto cargado')
      } catch (err) {
        toast.error('Error al cargar proyecto')
      }
    }
    reader.readAsText(file)
  }

  const tabs = [
    { id: 'cover', label: t('portada'), icon: '🖼️' },
    { id: 'categories', label: t('categorias'), icon: '📋' },
    { id: 'products', label: t('productos'), icon: '🛒' }
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  const idForUrl = state.userId || socioId
  const mesaUrls = idForUrl ? buildMesaUrls(idForUrl) : null

  // El toggle "Vista previa" solo cambia lo que se ve en el panel derecho (campana / delivery)
  // para poder revisar como queda cada mesa. No afecta el HTML exportado: ese ya se adapta solo.
  const previewingMesa1 = state.forceSupabaseOrders

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(cameFromQuery ? '/admin/dash-socios' : '/admin/socios')}
            className="p-2 rounded-xl bg-dark-700 text-dark-300 hover:bg-dark-600 transition"
          >
            ← Volver
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">{t('builder')}</h1>
            <p className="text-sm text-dark-400">{state.clientName || 'Sin nombre'}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-2 bg-dark-700 text-dark-300 rounded-xl text-sm hover:bg-dark-600 transition disabled:opacity-50"
          >
            {saving ? '⏳ Guardando...' : '💾 ' + t('guardarProyecto')}
          </button>
          <label className="px-3 py-2 bg-dark-700 text-dark-300 rounded-xl text-sm cursor-pointer hover:bg-dark-600 transition">
            📂 {t('cargarProyecto')}
            <input type="file" accept=".json" className="hidden" onChange={e => handleLoadJson(e.target.files[0])} />
          </label>
          <button
            onClick={handleDownloadJson}
            className="px-3 py-2 bg-dark-700 text-dark-300 rounded-xl text-sm hover:bg-dark-600 transition"
          >
            📥 Descargar JSON
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="px-4 py-2 bg-primary-500 text-white rounded-xl text-sm font-bold hover:bg-primary-600 transition disabled:opacity-50"
          >
            🚀 {t('exportarMenu')}
          </button>
        </div>
      </div>

      {/* Menu URLs: Mesa 0 (delivery/retiro/WhatsApp) y Mesa 1+ (campana/pedido a mesa) */}
      {mesaUrls && (
        <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="bg-accent-500/10 border border-accent-500/30 rounded-xl p-3">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-accent-400 text-sm font-bold">✓ Mesa 0 · Delivery / Retiro / WhatsApp</span>
              <button
                onClick={() => { navigator.clipboard.writeText(mesaUrls.mesa0); toast.success('URL copiada') }}
                className="text-xs px-2 py-1 bg-dark-700 text-dark-300 rounded-lg hover:bg-dark-600 flex-shrink-0"
              >
                📋 {t('copiarUrl')}
              </button>
            </div>
            <a href={mesaUrls.mesa0} target="_blank" rel="noopener noreferrer" className="text-xs text-primary-400 underline truncate block">
              {mesaUrls.mesa0}
            </a>
          </div>
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-blue-400 text-sm font-bold">🔔 Mesa 1+ · Pedido a la mesa</span>
              <button
                onClick={() => { navigator.clipboard.writeText(mesaUrls.mesa1); toast.success('URL copiada') }}
                className="text-xs px-2 py-1 bg-dark-700 text-dark-300 rounded-lg hover:bg-dark-600 flex-shrink-0"
              >
                📋 {t('copiarUrl')}
              </button>
            </div>
            <a href={mesaUrls.mesa1} target="_blank" rel="noopener noreferrer" className="text-xs text-primary-400 underline truncate block">
              {mesaUrls.mesa1}
            </a>
          </div>
        </div>
      )}

      <div className="mb-4 bg-blue-500/10 border border-blue-500/30 rounded-xl p-3 text-blue-300 text-xs">
        ℹ️ Este es el único Builder: el menú que exportás/guardás sirve para todas las mesas. La mesa 0 usa delivery, retiro en el local y pedidos por WhatsApp. Las mesas 1 en adelante mandan el pedido directo al sistema y muestran la campana para llamar al mozo. Los QR de cada mesa (pestaña "Mesas") ya generan la URL correcta automáticamente.
      </div>

      {/* Layout */}
      <div className="flex gap-6">
        {/* Left panel - Controls */}
        <div className="w-[420px] flex-shrink-0">
          {/* Tabs */}
          <div className="flex gap-1 mb-4 bg-dark-800 rounded-xl p-1 border border-dark-700">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition ${
                  activeTab === tab.id
                    ? 'bg-primary-500/20 text-primary-400'
                    : 'text-dark-400 hover:bg-dark-700'
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="bg-dark-800 rounded-2xl border border-dark-700 p-4 max-h-[calc(100vh-220px)] overflow-auto">
            {activeTab === 'cover' && <CoverEditor />}
            {activeTab === 'categories' && <CategoriesEditor />}
            {activeTab === 'products' && <ProductsEditor showDelivery={!previewingMesa1} />}
          </div>
        </div>

        {/* Right panel - Phone Preview */}
        <div className="flex-1 flex justify-center">
          <div className="sticky top-6">
            {/* Toggle de vista previa: Mesa 0 vs Mesa 1+ (solo afecta lo que se ve acá) */}
            <div className="flex gap-1 mb-3 justify-center bg-dark-800 rounded-xl p-1 border border-dark-700 w-fit mx-auto">
              <button
                onClick={() => state.setField('forceSupabaseOrders', false)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  !previewingMesa1 ? 'bg-accent-500/20 text-accent-400' : 'text-dark-400 hover:bg-dark-700'
                }`}
              >
                Vista previa: Mesa 0
              </button>
              <button
                onClick={() => state.setField('forceSupabaseOrders', true)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  previewingMesa1 ? 'bg-blue-500/20 text-blue-400' : 'text-dark-400 hover:bg-dark-700'
                }`}
              >
                Vista previa: Mesa 1+
              </button>
            </div>

            <PhonePreview />

            {/* Screen navigation */}
            <div className="flex gap-1 mt-4 justify-center">
              {['cover', 'categories', 'products', 'cart'].map(screen => (
                <button
                  key={screen}
                  onClick={() => state.setScreen(screen)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    state.screen === screen
                      ? 'bg-primary-500/20 text-primary-400'
                      : 'bg-dark-700 text-dark-400 hover:bg-dark-600'
                  }`}
                >
                  {screen === 'cover' ? 'Portada' : screen === 'categories' ? 'Categorías' : screen === 'products' ? 'Productos' : 'Carrito'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
