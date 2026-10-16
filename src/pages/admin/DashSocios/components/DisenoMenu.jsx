import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { uploadMenuHtml, saveMenuUrlToCliente, saveBuilderConfig, saveBuilderFieldsToCliente, saveBuilderProducts, loadBuilderConfig, loadCatalogAsBuilderProducts } from '@/lib/storage'
import { useAuth } from '@/hooks/useAuth'
import { useBuilderState } from '@/components/Builder/useBuilderState'

// Sección "Diseño": antes vivía adentro de Carta ("🎨 Diseño del menú").
// Se copió tal cual (mismo bloque, mismas funciones) a su propio ítem del
// menú. Carta conserva su propio botón "Guardar proyecto" con su propia
// copia de esta misma lógica, así que este archivo es independiente.
export default function DisenoMenu({ clienteId }) {
  const { rol } = useAuth()
  const [loading, setLoading] = useState(true)
  const [headerControls, setHeaderControls] = useState(null)
  const [logoBar, setLogoBar] = useState('')
  // Forma de las categorías en el menú del cliente: 'fijo' (como siempre) o 'anillo' (3D).
  const [categoriesLayout, setCategoriesLayout] = useState('fijo')
  const [uploadingLogoBar, setUploadingLogoBar] = useState(false)
  const [ocultarBuilder, setOcultarBuilder] = useState(false)
  const [contacto, setContacto] = useState({ whatsapp: '', instagram: '', direccion: '', horario: '', alias: '', delivery: '' })
  const [savingProject, setSavingProject] = useState(false)
  const [userIdParaUrl, setUserIdParaUrl] = useState(null)

  useEffect(() => {
    let active = true
    setHeaderControls(null)
    // Sin cliente todavía: no quedarse en el spinner para siempre.
    if (!clienteId) { setLoading(false); return }
    setLoading(true)

    // Cada carga es independiente: si una falla (columna faltante, red, etc.)
    // la pantalla igual se abre con valores por defecto.
    const cargaConfig = loadBuilderConfig(clienteId)
      .then(config => { if (active) { setHeaderControls(config?.headerControls || {}); setLogoBar(config?.logoBar || ''); setCategoriesLayout(config?.categoriesLayout === 'anillo' ? 'anillo' : 'fijo') } })
      .catch(err => {
        console.error('[DisenoMenu] loadBuilderConfig', err)
        if (active) setHeaderControls({})
      })

    // select('*'): si faltara alguna columna opcional (ocultar_builder, horario...)
    // una lista fija de columnas haría fallar toda la consulta y los datos de
    // contacto quedarían vacíos (y se pisarían al exportar).
    const cargaCliente = supabase
      .from('clientes')
      .select('*')
      .eq('id', clienteId)
      .single()
      .then(({ data, error }) => {
        if (error) console.error('[DisenoMenu] clientes', error)
        if (!active || !data) return
        setOcultarBuilder(!!data.ocultar_builder)
        setContacto({
          whatsapp: data.whatsapp || '',
          instagram: data.instagram || '',
          direccion: data.direccion || '',
          horario: data.horario || '',
          alias: data.alias || '',
          delivery: data.delivery ?? ''
        })
        // Misma URL que arma el Builder para "Mesa 0": usa el user_id del
        // restaurante y si no hay, cae al id del cliente.
        setUserIdParaUrl(data.user_id || clienteId)
      })
      .catch(err => {
        console.error('[DisenoMenu] clientes', err)
        toast.error('No se pudo cargar Diseño')
      })

    Promise.all([cargaConfig, cargaCliente]).finally(() => { if (active) setLoading(false) })

    return () => { active = false }
  }, [clienteId])

  const handleLogoBarUpload = async (file) => {
    if (!file) return
    setUploadingLogoBar(true)
    try {
      const dataUrl = await useBuilderState.getState().normalizeSquareImage(file, 700)
      setLogoBar(dataUrl)
    } catch (e) {
      toast.error('No se pudo procesar la imagen')
    } finally {
      setUploadingLogoBar(false)
    }
  }

  const toggleOcultarBuilder = async () => {
    const value = !ocultarBuilder
    setOcultarBuilder(value)
    const { error } = await supabase.from('clientes').update({ ocultar_builder: value }).eq('id', clienteId)
    if (error) {
      toast.error('Error: ' + error.message)
      setOcultarBuilder(!value)
    }
  }

  const syncFreshCatalogToBuilder = async () => {
    const builderProducts = await loadCatalogAsBuilderProducts(clienteId)
    await saveBuilderProducts(clienteId, builderProducts)
    return builderProducts
  }

  const guardarProyectoCarta = async () => {
    if (!clienteId) {
      toast.error('No se encontró el perfil del restaurante')
      return
    }

    setSavingProject(true)
    toast.loading('Guardando proyecto y actualizando menú...', { id: 'guardar-proyecto-diseno' })

    try {
      await saveBuilderFieldsToCliente(clienteId, {
        whatsapp: contacto.whatsapp || '',
        instagram: contacto.instagram || '',
        direccion: contacto.direccion || '',
        horario: contacto.horario || '',
        alias: contacto.alias || '',
        delivery: contacto.delivery === '' ? 0 : Number(contacto.delivery)
      })

      const builderProducts = await syncFreshCatalogToBuilder()

      const { data: cliente, error: clienteError } = await supabase
        .from('clientes')
        .select('*')
        .eq('id', clienteId)
        .single()
      if (clienteError) throw clienteError

      const builder = useBuilderState.getState()
      builder.loadSocioData({
        ...cliente,
        whatsapp: contacto.whatsapp || '',
        instagram: contacto.instagram || '',
        direccion: contacto.direccion || '',
        horario: contacto.horario || '',
        alias: contacto.alias || '',
        delivery: contacto.delivery === '' ? 0 : Number(contacto.delivery)
      })

      const config = await loadBuilderConfig(clienteId)
      if (config) builder.loadBuilderConfig(config)
      if (headerControls) builder.setField('headerControls', headerControls)
      builder.setField('logoBar', logoBar || '')
      builder.setField('categoriesLayout', categoriesLayout === 'anillo' ? 'anillo' : 'fijo')
      builder.setField('rows', builderProducts.rows || [])
      builder.setField('productImages', builderProducts.productImages || {})
      builder.setField('categoryImages', builderProducts.categoryImages || {})
      builder.setField('categoryTransforms', builderProducts.categoryTransforms || {})

      await saveBuilderConfig(clienteId, builder.getBuilderConfig())
      const { html } = builder.exportHtml()
      const storageUrl = await uploadMenuHtml(clienteId, html)
      await saveMenuUrlToCliente(clienteId, storageUrl)

      const idForUrl = cliente.user_id || clienteId
      setUserIdParaUrl(idForUrl)
      builder.setMenuUrl(`${window.location.origin}/menu/${idForUrl}?mesa=0`)

      toast.success('Proyecto guardado y menú actualizado', { id: 'guardar-proyecto-diseno' })
    } catch (err) {
      console.error('[DisenoMenu] Error guardando proyecto:', err)
      const detalle = [err.message, err.details, err.hint, err.code ? `código: ${err.code}` : null]
        .filter(Boolean).join(' — ')
      toast.error('Error guardando proyecto: ' + detalle, { id: 'guardar-proyecto-diseno', duration: 12000 })
    } finally {
      setSavingProject(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  const puedeVerBuilder = !['mozo', 'cajero', 'cocina', 'delivery'].includes(rol) && (rol === 'superadmin' || !ocultarBuilder)

  return (
    <div>
      {!puedeVerBuilder && rol !== 'superadmin' && (
        <div className="bg-dark-800 rounded-xl p-6 border border-dark-700 text-dark-300">
          {['mozo', 'cajero', 'cocina', 'delivery'].includes(rol)
            ? 'Esta sección es solo para el dueño del restaurante.'
            : 'El Diseño del menú está desactivado para este restaurante. Consultá con el administrador.'}
        </div>
      )}
      {/* Diseño del menú (Builder): guardar/exportar el diseño visual del menú.
          Nunca se lo mostramos a mozo/cajero/cocina, sea cual sea el check del superadmin. */}
      {puedeVerBuilder && (
        <div className="bg-dark-800 rounded-xl p-4 mb-4 border border-dark-700">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-white font-bold text-lg">🎨 Diseño del menú</h2>
              <p className="text-dark-400 text-xs mt-0.5">Portada, colores, posición de íconos y productos visuales del menú que ve el cliente.</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => window.open(`/socio/builder?clienteId=${clienteId}`, '_blank')}
                className="bg-dark-700 hover:bg-dark-600 text-white px-4 py-2 rounded-lg transition text-sm"
              >
                🎨 Builder
              </button>
              <button
                onClick={guardarProyectoCarta}
                disabled={savingProject}
                className="bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition text-sm font-medium"
              >
                {savingProject ? '⏳ Guardando...' : '🚀 Exportar menú'}
              </button>
            </div>
          </div>

          {/* Forma de las categorías que ve el cliente (mesa 0, 00 y mesas 1+) */}
          <div className="mt-4 border-t border-dark-700 pt-4">
            <h3 className="font-bold text-white">🎡 Forma de las categorías</h3>
            <p className="text-sm text-dark-300 my-2">Elegí cómo ve el cliente las categorías en el menú. Después tocá “🚀 Exportar menú” para que se aplique.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-xl">
              {[
                { id: 'fijo', label: 'Fijo', desc: 'Cada categoría en la posición que le diste en el Builder' },
                { id: 'anillo', label: 'Anillo', desc: 'Anillo 3D: se desliza y se entra a la categoría del centro' }
              ].map(op => (
                <label
                  key={op.id}
                  className={`flex items-start gap-2 p-3 rounded-lg border cursor-pointer transition ${categoriesLayout === op.id ? 'border-primary-500 bg-primary-500/10' : 'border-dark-600 hover:border-dark-500'}`}
                >
                  <input
                    type="checkbox"
                    checked={categoriesLayout === op.id}
                    onChange={() => setCategoriesLayout(op.id)}
                    className="mt-0.5 accent-primary-500 w-4 h-4"
                  />
                  <span>
                    <span className="block text-sm font-medium text-white">{op.label}</span>
                    <span className="block text-xs text-dark-400">{op.desc}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="mt-4 border-t border-dark-700 pt-4">
            <h3 className="font-bold text-white">Controles de iconos de la barra negra</h3>
            <p className="text-sm text-dark-300 my-2">X: izquierda/derecha. Y: arriba/abajo. Zoom: tamaño. Los movimientos se limitan al espacio de cada icono para que no se salgan ni se tapen. Se aplican a Categorías, Productos y Mi pedido.</p>
            {headerControls === null ? <p className="text-sm text-dark-300">Cargando controles…</p> : <>
              <div className="grid gap-3">
                {[['logo','Logo'],['promo','Promoción'],['cart','Carrito'],['exit','Salir'],['bell','Campana (mesas 1+)'],['mesa','Número de mesa (mesas 1+)']].map(([key,label]) => <div key={key} className="flex flex-wrap items-center gap-3">
                  <span className="text-white text-sm w-44">{label}</span>
                  {['x','y','zoom'].map(field => <label key={field} className="text-sm text-dark-300 flex items-center gap-2">
                    {field === 'zoom' ? 'Zoom %' : field.toUpperCase() + ' %'}
                    <input type="number" aria-label={label + ' ' + field} min={field === 'zoom' ? 25 : 0} max={field === 'zoom' ? 200 : 100} value={headerControls[key]?.[field] ?? (field === 'zoom' ? 100 : 50)}
                      onChange={e => { const value=Math.max(field === 'zoom' ? 25 : 0,Math.min(field === 'zoom' ? 200 : 100,Number(e.target.value))); setHeaderControls(prev => ({...prev,[key]:{...prev[key],[field]:value}})) }}
                      className="w-20 bg-dark-900 border border-dark-600 rounded px-2 py-1 text-white" />
                  </label>)}
                  {key === 'logo' && (
                    <label className="text-sm text-dark-300 flex items-center gap-2 cursor-pointer">
                      <span className="px-2 py-1 bg-dark-900 border border-dark-600 rounded hover:border-primary-500 transition">
                        {uploadingLogoBar ? 'Subiendo…' : (logoBar ? '✓ Imagen cargada (700×700)' : 'Ingresar imagen (700×700)')}
                      </span>
                      <input
                        type="file" accept="image/*" className="hidden"
                        onChange={e => handleLogoBarUpload(e.target.files[0])}
                      />
                      {logoBar && <img src={logoBar} alt="Logo barra" className="w-8 h-8 rounded object-cover border border-dark-600" />}
                    </label>
                  )}
                </div>)}
                <p className="text-xs text-dark-400 -mt-1">La imagen del Logo es independiente de la de portada: se usa solo en el botón de la barra negra en Categorías, Productos y Mi pedido. Si no se carga acá, se usa la de portada.</p>
              </div>
              <button disabled={savingProject} onClick={guardarProyectoCarta} className="mt-4 bg-primary-500 text-white px-4 py-2 rounded-lg disabled:opacity-50">{savingProject ? 'Guardando…' : 'Guardar y aplicar iconos al menú'}</button>
            </>}
          </div>

          {/* Mismo bloque de URL "Mesa 0" que se ve en el Builder, copiado
              tal cual: delivery / retiro / pedido por WhatsApp. */}
          {userIdParaUrl && (
            <div className="bg-accent-500/10 border border-accent-500/30 rounded-xl p-3 mt-3">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-accent-400 text-sm font-bold">✓ Mesa 0 · Delivery / Retiro / WhatsApp</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/menu/${userIdParaUrl}?mesa=0`)
                    toast.success('URL copiada')
                  }}
                  className="text-xs px-2 py-1 bg-dark-700 text-dark-300 rounded-lg hover:bg-dark-600 flex-shrink-0"
                >
                  📋 Copiar URL
                </button>
              </div>
              <a
                href={`${window.location.origin}/menu/${userIdParaUrl}?mesa=0`}
                target="_blank" rel="noopener noreferrer"
                className="text-xs text-primary-400 underline truncate block"
              >
                {`${window.location.origin}/menu/${userIdParaUrl}?mesa=0`}
              </a>
            </div>
          )}
        </div>
      )}

      {rol === 'superadmin' && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 mb-4 flex flex-wrap gap-6">
          <span className="text-yellow-400 text-xs font-bold uppercase self-center">Superadmin</span>
          <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
            <input type="checkbox" checked={ocultarBuilder} onChange={toggleOcultarBuilder} className="accent-primary-500" />
            Ocultar Builder (Guardar/Exportar) para este restaurante
          </label>
        </div>
      )}
    </div>
  )
}
