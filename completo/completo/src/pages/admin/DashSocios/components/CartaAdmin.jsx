import { storeMenuImage, optimizeRestaurantImages } from '@/lib/menuImages'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'
import { uploadMenuHtml, saveMenuUrlToCliente, saveBuilderConfig, saveBuilderFieldsToCliente, saveBuilderProducts, loadBuilderConfig, loadBuilderProducts, buildBuilderProductsFromTables, loadCatalogAsBuilderProducts } from '@/lib/storage'
import { useAuth } from '@/hooks/useAuth'
import { useBuilderState } from '@/components/Builder/useBuilderState'

export default function CartaAdmin({ clienteId, socio }) {
  const { rol } = useAuth()
  const [headerControls, setHeaderControls] = useState(null)
  useEffect(() => {
    let active = true
    setHeaderControls(null)
    if (clienteId) loadBuilderConfig(clienteId).then(config => { if (active) setHeaderControls(config?.headerControls || {}) }).catch(() => toast.error('No se pudieron cargar los controles de la barra'))
    return () => { active = false }
  }, [clienteId])
  const [optimizing, setOptimizing] = useState(false)
  const optimizeImages = async () => {
    setOptimizing(true)
    try {
      await optimizeRestaurantImages(clienteId)
      await fetchData()
      toast.success('Imágenes optimizadas. Cerrá y reabrí Diseño antes de Guardar proyecto para publicar el menú actualizado.', { duration: 12000 })
    } catch (error) { toast.error('Optimización detenida: ' + error.message, { duration: 12000 }) }
    finally { setOptimizing(false) }
  }
  const [productos, setProductos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [editPrice, setEditPrice] = useState(null)
  const [newPrice, setNewPrice] = useState('')
  const [bulkOperation, setBulkOperation] = useState('aumentar')
  const [bulkValue, setBulkValue] = useState('')
  const [uploadingId, setUploadingId] = useState(null)
  const [uploadingCatId, setUploadingCatId] = useState(null)
  const [excelRowsCount, setExcelRowsCount] = useState(0)
  const [flags, setFlags] = useState({ ocultar_builder: false, ocultar_excel_imagenes: false })
  const [contacto, setContacto] = useState({ whatsapp: '', instagram: '', direccion: '', horario: '', alias: '', delivery: '' })
  const [savingContacto, setSavingContacto] = useState(false)
  const [savingProject, setSavingProject] = useState(false)
  const [userIdParaUrl, setUserIdParaUrl] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newProd, setNewProd] = useState({ nombre: '', precio: '', detalle: '', categoria_id: '', nuevaCategoria: '' })
  const [newProdImage, setNewProdImage] = useState(null)
  const [savingNewProd, setSavingNewProd] = useState(false)
  const fileInputRefs = useRef({})
  const catFileRefs = useRef({})
  // true cuando este restaurante NO puede importar Excel, descargar imágenes,
  // ni subir/cambiar/borrar imágenes de categorías o productos.
  // El superadmin siempre puede, sea cual sea el check.
  const imagenesExcelBloqueado = rol !== 'superadmin' && flags.ocultar_excel_imagenes

  useEffect(() => {
    if (clienteId) { fetchData(); fetchFlags() }
  }, [clienteId])

  const fetchFlags = async () => {
    const { data } = await supabase
      .from('clientes')
      .select('ocultar_builder, ocultar_excel_imagenes, whatsapp, instagram, direccion, horario, alias, delivery, user_id')
      .eq('id', clienteId)
      .single()
    if (data) {
      setFlags({
        ocultar_builder: !!data.ocultar_builder,
        ocultar_excel_imagenes: !!data.ocultar_excel_imagenes
      })
      setContacto({
        whatsapp: data.whatsapp || '',
        instagram: data.instagram || '',
        direccion: data.direccion || '',
        horario: data.horario || '',
        alias: data.alias || '',
        delivery: data.delivery ?? ''
      })
      // Misma URL que arma el Builder para "Mesa 0": usa el user_id del
      // restaurante y si no hay, cae al id del cliente (mismo fallback que
      // Builder.jsx).
      setUserIdParaUrl(data.user_id || clienteId)
    }
  }

  // Mismos campos y misma tabla que usa el Builder (saveBuilderFieldsToCliente),
  // así que da lo mismo editarlos desde acá o desde el Builder: quedan
  // sincronizados porque los dos leen/escriben clientes.whatsapp/instagram/etc.
  const guardarContacto = async () => {
    setSavingContacto(true)
    try {
      const { error } = await supabase.from('clientes').update({
        whatsapp: contacto.whatsapp || '',
        instagram: contacto.instagram || '',
        direccion: contacto.direccion || '',
        horario: contacto.horario || '',
        alias: contacto.alias || '',
        delivery: contacto.delivery === '' ? 0 : Number(contacto.delivery)
      }).eq('id', clienteId)
      if (error) throw error
      toast.success('Datos de contacto guardados')
    } catch (err) {
      // Mensaje detallado (code/details/hint de Postgres/Supabase, no solo
      // err.message) para poder ver la causa real sin abrir la consola.
      const detalle = [err.message, err.details, err.hint, err.code ? `código: ${err.code}` : null]
        .filter(Boolean).join(' — ')
      console.error('[CartaAdmin] Error guardando contacto:', err)
      toast.error('Error al guardar: ' + detalle, { duration: 8000 })
    } finally {
      setSavingContacto(false)
    }
  }

  const toggleFlag = async (field) => {
    const value = !flags[field]
    setFlags(prev => ({ ...prev, [field]: value }))
    const { error } = await supabase.from('clientes').update({ [field]: value }).eq('id', clienteId)
    if (error) {
      toast.error('Error: ' + error.message)
      setFlags(prev => ({ ...prev, [field]: !value }))
    }
  }

  const fetchData = async () => {
    try {
      const [prodsRes, catsRes] = await Promise.all([
        supabase
          .from('productos')
          .select('*')
          .eq('cliente_id', clienteId)
          .order('categoria_id')
          .order('nombre'),
        supabase
          .from('categorias')
          .select('*')
          .eq('cliente_id', clienteId)
          .order('orden')
      ])

      const nextProductos = prodsRes.error ? [] : (prodsRes.data || [])
      const nextCategorias = catsRes.error ? [] : (catsRes.data || [])
      if (!prodsRes.error) setProductos(nextProductos)
      if (!catsRes.error) setCategorias(nextCategorias)
      return { productos: nextProductos, categorias: nextCategorias }
    } catch (err) {
      console.error('Error en fetchData:', err)
      return { productos: [], categorias: [] }
    } finally {
      setLoading(false)
    }
  }

  const filteredProductos = productos.filter(p =>
    p.nombre?.toLowerCase().includes(search.toLowerCase()) ||
    p.detalle?.toLowerCase().includes(search.toLowerCase())
  )

  // Categoría actualmente seleccionada desde el grid de íconos (null = mostrar todas)
  const [selectedCat, setSelectedCat] = useState(null)
  const productosSectionRef = useRef(null)

  const goToCategoria = (catId) => {
    setSelectedCat(prev => prev === catId ? null : catId)
    // Pequeño delay para que el DOM ya haya filtrado antes de hacer scroll
    setTimeout(() => {
      productosSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }

  // Si el usuario busca por nombre, el dropdown de resultados busca en todas las
  // categorías igual; si además hay una categoría seleccionada, las tablas de abajo
  // quedan acotadas a esa categoría + la búsqueda combinadas.

  const categoriasVisibles = selectedCat
    ? categorias.filter(c => c.id === selectedCat)
    : categorias

  // Mismo mecanismo que usa el Builder (y que sí viene funcionando bien):
  // la imagen se redimensiona a cuadrado, se comprime a WebP y se guarda
  // como dataURL directo en la fila (categorias.imagen / productos.imagen),
  // sin pasar por Supabase Storage.
  const normalizeSquareImage = (file, size = 400) => new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = () => {
      const img = new Image()
      img.onerror = reject
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        ctx.clearRect(0, 0, size, size)
        const scale = Math.min(size / img.width, size / img.height)
        const w = img.width * scale, h = img.height * scale
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h)
        resolve(canvas.toDataURL('image/webp', 0.7))
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })

  const uploadImage = async (prodId, file) => {
    if (!file) return
    setUploadingId(prodId)
    toast.loading('Subiendo imagen...', { id: `img-${prodId}` })
    try {
      const dataUrl = await storeMenuImage(clienteId, await normalizeSquareImage(file, 300))
      const { error } = await supabase.from('productos').update({ imagen: dataUrl }).eq('id', prodId)
      if (error) throw error
      toast.success('Imagen subida', { id: `img-${prodId}` })
      const nextProductos = productos.map(p => p.id === prodId ? { ...p, imagen: dataUrl } : p)
      setProductos(nextProductos)
      await syncToBuilder(nextProductos, categorias)
    } catch (err) {
      console.error('Error guardando imagen:', err)
      toast.error('Error al subir imagen: ' + err.message, { id: `img-${prodId}` })
    } finally {
      setUploadingId(null)
    }
  }

  const deleteImage = async (prodId) => {
    const { error } = await supabase.from('productos').update({ imagen: null }).eq('id', prodId)
    if (error) { toast.error('Error al eliminar imagen: ' + error.message); return }
    const nextProductos = productos.map(p =>
      p.id === prodId ? { ...p, imagen: null } : p
    )
    setProductos(nextProductos)
    await syncToBuilder(nextProductos, categorias)
    toast.success('Imagen eliminada')
  }

  const uploadCategoryImage = async (catId, file) => {
    if (!file) return
    setUploadingCatId(catId)
    toast.loading('Subiendo imagen...', { id: `cat-${catId}` })
    try {
      const dataUrl = await storeMenuImage(clienteId, await normalizeSquareImage(file, 400))
      const { error } = await supabase.from('categorias').update({ imagen: dataUrl }).eq('id', catId)
      if (error) throw error
      toast.success('Imagen de categoría subida', { id: `cat-${catId}` })
      const nextCategorias = categorias.map(c => c.id === catId ? { ...c, imagen: dataUrl } : c)
      setCategorias(nextCategorias)
      await syncToBuilder(productos, nextCategorias)
    } catch (err) {
      console.error('Error guardando imagen de categoría:', err)
      toast.error('Error al subir imagen: ' + err.message, { id: `cat-${catId}` })
    } finally {
      setUploadingCatId(null)
    }
  }

  // Carga masiva de imágenes de categorías (mismo criterio "tolerante" que
  // usa el Builder: matchea cada archivo con el nombre real de la categoría,
  // exacto o que un nombre contenga al otro, así no importa si el archivo
  // trae la extensión pegada). Reutiliza uploadCategoryImage para que quede
  // guardado igual que subiéndolas una por una (storage + cache-buster).
  const normalizarKey = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')

  const handleBulkCategoryImages = async (files) => {
    let matched = 0
    for (const file of Array.from(files)) {
      const key = normalizarKey(file.name)
      const cat = categorias.find(c => {
        const catKey = normalizarKey(c.nombre)
        return catKey === key || key.includes(catKey) || catKey.includes(key)
      })
      if (cat) {
        await uploadCategoryImage(cat.id, file)
        matched++
      }
    }
    if (matched < files.length) {
      toast.error(`Se cargaron ${matched} de ${files.length} imágenes. El nombre del archivo tiene que parecerse al de la categoría (ej: "bebidas.jpg" para "Bebidas").`, { duration: 6000 })
    } else if (matched > 0) {
      toast.success(`✅ ${matched} imagen(es) de categoría cargadas`)
    }
    if (matched > 0) {
      const fresh = await fetchData()
      await syncToBuilder(fresh.productos, fresh.categorias)
    }
  }

  // Mismo criterio que handleBulkCategoryImages, pero matcheando contra el
  // nombre de cada producto (igual que handleBulkProductImages del Builder).
  // Reutiliza uploadImage, que ya quedó con el mismo mecanismo del Builder.
  const handleBulkProductImages = async (files) => {
    let matched = 0
    for (const file of Array.from(files)) {
      const key = normalizarKey(file.name)
      const prod = productos.find(p => {
        const pKey = normalizarKey(p.nombre)
        return pKey === key || key.includes(pKey) || pKey.includes(key)
      })
      if (prod) {
        await uploadImage(prod.id, file)
        matched++
      }
    }
    if (matched < files.length) {
      toast.error(`Se cargaron ${matched} de ${files.length} imágenes. El nombre del archivo tiene que parecerse al del producto (ej: "capuccino.jpg" para "Capuccino").`, { duration: 6000 })
    } else if (matched > 0) {
      toast.success(`✅ ${matched} imagen(es) de producto cargadas`)
    }
    if (matched > 0) {
      const fresh = await fetchData()
      await syncToBuilder(fresh.productos, fresh.categorias)
    }
  }

  const deleteCategoryImage = async (catId) => {
    const { error } = await supabase.from('categorias').update({ imagen: null }).eq('id', catId)
    if (error) { toast.error('Error al eliminar imagen: ' + error.message); return }
    const nextCategorias = categorias.map(c =>
      c.id === catId ? { ...c, imagen: null } : c
    )
    setCategorias(nextCategorias)
    await syncToBuilder(productos, nextCategorias)
    toast.success('Imagen de categoría eliminada')
  }

  const toggleSelect = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const selectAllInCategory = (catId) => {
    const catIds = productos.filter(p => p.categoria_id === catId).map(p => p.id)
    const allSelected = catIds.every(id => selectedIds.includes(id))
    
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !catIds.includes(id)))
    } else {
      setSelectedIds(prev => [...new Set([...prev, ...catIds])])
    }
  }

  const allIds = filteredProductos.map(p => p.id)
  const allSelectedGlobal = allIds.length > 0 && allIds.every(id => selectedIds.includes(id))

  const selectAllGlobal = () => {
    if (allSelectedGlobal) {
      setSelectedIds([])
    } else {
      setSelectedIds(allIds)
    }
  }

  const updatePrice = async (id) => {
    const precio = parseFloat(newPrice)
    if (isNaN(precio) || precio < 0) {
      toast.error('Precio inválido')
      return
    }

    const { error } = await supabase
      .from('productos')
      .update({ precio })
      .eq('id', id)

    if (!error) {
      toast.success('Precio actualizado')
      setEditPrice(null)
      const fresh = await fetchData()
      await syncToBuilder(fresh.productos, fresh.categorias)
    }
  }

  const applyBulkUpdate = async () => {
    if (selectedIds.length === 0) {
      toast.error('Seleccioná al menos un producto')
      return
    }

    const valor = parseFloat(bulkValue)
    if (isNaN(valor) || valor <= 0) {
      toast.error('Ingresá un valor válido')
      return
    }

    let updates = []
    for (const id of selectedIds) {
      const prod = productos.find(p => p.id === id)
      if (!prod) continue

      let nuevoPrecio
      if (bulkOperation === 'aumentar') {
        nuevoPrecio = prod.precio * (1 + valor / 100)
      } else if (bulkOperation === 'disminuir') {
        nuevoPrecio = prod.precio * (1 - valor / 100)
      } else {
        nuevoPrecio = valor
      }

      updates.push({ id, precio: Math.round(nuevoPrecio * 100) / 100 })
    }

    for (const update of updates) {
      await supabase
        .from('productos')
        .update({ precio: update.precio })
        .eq('id', update.id)
    }

    toast.success(`${updates.length} productos actualizados`)
    setSelectedIds([])
    const fresh = await fetchData()
    await syncToBuilder(fresh.productos, fresh.categorias)
  }

  // TODO: Agregar columna 'activo' a tabla productos para activar/desactivar
  // const toggleActivo = async (id) => {
  //   const prod = productos.find(p => p.id === id)
  //   const { error } = await supabase
  //     .from('productos')
  //     .update({ activo: !prod.activo })
  //     .eq('id', id)
  //   if (!error) { fetchData() }
  // }

  const eliminarProducto = async (id) => {
    if (!confirm('¿Eliminar este producto?')) return
    
    const { error } = await supabase
      .from('productos')
      .delete()
      .eq('id', id)

    if (!error) {
      toast.success('Producto eliminado')
      const fresh = await fetchData()
      await syncToBuilder(fresh.productos, fresh.categorias)
    }
  }

  const descargarImagenes = async () => {
    const JSZip = (await import('jszip')).default
    const zip = new JSZip()

    const { data: files, error } = await supabase.storage
      .from('productos')
      .list(clienteId)

    if (error || !files?.length) {
      toast.error('No hay imágenes para descargar')
      return
    }

    toast.loading('Preparando descarga...', { id: 'download-imgs' })

    const catsFolder = zip.folder('categorias')
    const prodsFolder = zip.folder('productos')

    const catIdMap = {}
    categorias.forEach(c => { catIdMap[c.id] = c.nombre })

    const prodIdMap = {}
    productos.forEach(p => { prodIdMap[p.id] = p.nombre })

    const usedCatNames = {}
    const usedProdNames = {}

    for (const file of files) {
      if (file.name === '.emptyFolderPlaceholder') continue

      const { data } = await supabase.storage
        .from('productos')
        .download(`${clienteId}/${file.name}`)

      if (!data) continue

      const ext = file.name.split('.').pop()

      if (file.name.startsWith('cat_')) {
        const catId = file.name.replace('cat_', '').replace(/\.[^.]+$/, '')
        let nombre = catIdMap[catId] || catId
        if (usedCatNames[nombre]) {
          usedCatNames[nombre]++
          nombre = `${nombre} ${usedCatNames[nombre]}`
        } else {
          usedCatNames[nombre] = 1
        }
        catsFolder.file(`${nombre}.${ext}`, data)
      } else {
        const prodId = file.name.replace(/\.[^.]+$/, '')
        let nombre = prodIdMap[prodId] || prodId
        if (usedProdNames[nombre]) {
          usedProdNames[nombre]++
          nombre = `${nombre} ${usedProdNames[nombre]}`
        } else {
          usedProdNames[nombre] = 1
        }
        prodsFolder.file(`${nombre}.${ext}`, data)
      }
    }

    const mapeo = {
      categorias: categorias.map(c => ({ id: c.id, nombre: c.nombre })),
      productos: productos.map(p => ({ id: p.id, nombre: p.nombre, categoria_id: p.categoria_id }))
    }
    zip.file('mapeo.json', JSON.stringify(mapeo, null, 2))

    const blob = await zip.generateAsync({ type: 'blob' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `imagenes-${socio?.nombre_restaurante || clienteId.slice(0, 8)}.zip`
    a.click()
    URL.revokeObjectURL(a.href)

    toast.success('Imágenes descargadas', { id: 'download-imgs' })
  }

  // Vuelca la carta (productos/categorías) actual hacia el Builder, para que
  // admin y socio Builder reflejen lo que se maneja acá en Carta.
  const syncToBuilder = async (prods, cats) => {
    try {
      const existing = await loadBuilderProducts(clienteId)
      await saveBuilderProducts(clienteId, buildBuilderProductsFromTables(prods, cats, existing || {}))
    } catch (err) {
      console.warn('No se pudo sincronizar con el Builder:', err)
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
    toast.loading('Guardando proyecto y actualizando menú...', { id: 'guardar-proyecto-carta' })

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

      toast.success('Proyecto guardado y menú actualizado', { id: 'guardar-proyecto-carta' })
    } catch (err) {
      console.error('[CartaAdmin] Error guardando proyecto:', err)
      const detalle = [err.message, err.details, err.hint, err.code ? `código: ${err.code}` : null]
        .filter(Boolean).join(' — ')
      toast.error('Error guardando proyecto: ' + detalle, { id: 'guardar-proyecto-carta', duration: 12000 })
    } finally {
      setSavingProject(false)
    }
  }

  const crearProducto = async () => {
    if (!newProd.nombre.trim() || !newProd.precio) {
      toast.error('Nombre y precio son obligatorios')
      return
    }
    if (!newProd.categoria_id && !newProd.nuevaCategoria.trim()) {
      toast.error('Elegí una categoría o creá una nueva')
      return
    }
    if (newProdImage) {
      const isWebp = newProdImage.type === 'image/webp' || newProdImage.name.toLowerCase().endsWith('.webp')
      if (!isWebp) {
        toast.error('La imagen debe ser formato .webp')
        return
      }
    }

    setSavingNewProd(true)
    try {
      let categoriaId = newProd.categoria_id

      if (newProd.nuevaCategoria.trim()) {
        const { data: newCat, error: catError } = await supabase
          .from('categorias')
          .insert({ cliente_id: clienteId, nombre: newProd.nuevaCategoria.trim(), orden: categorias.length })
          .select()
          .single()
        if (catError) {
          toast.error(`Error creando categoría: ${catError.message}`)
          return
        }
        categoriaId = newCat.id
      }

      const productoPayload = {
        cliente_id: clienteId,
        categoria_id: categoriaId,
        nombre: newProd.nombre.trim(),
        precio: parseFloat(newProd.precio) || 0,
        detalle: newProd.detalle.trim() || null
      }
      let { data: inserted, error: insError } = await supabase
        .from('productos')
        .insert(productoPayload)
        .select()
        .single()

      // Reintentar solo si PostgREST rechazó el INSERT por la columna detalle.
      // Ese rechazo ocurre antes de insertar: no duplica el producto.
      if (insError?.code === 'PGRST204' &&
          /Could not find the 'detalle' column of 'productos'/.test(insError.message || '')) {
        const { detalle, ...productoSinDetalle } = productoPayload
        const retry = await supabase
          .from('productos')
          .insert({ ...productoSinDetalle, descripcion: detalle })
          .select()
          .single()
        inserted = retry.data
        insError = retry.error
      }

      if (insError) {
        toast.error(`Error creando producto: ${insError.message}`)
        return
      }

      if (newProdImage && inserted) {
        const filename = `${clienteId}/${inserted.id}.webp`
        const { error: uploadError } = await supabase.storage
          .from('productos')
          .upload(filename, newProdImage, { upsert: true })
        if (!uploadError) {
          const { data: pub } = supabase.storage.from('productos').getPublicUrl(filename)
          await supabase.from('productos').update({ imagen: pub.publicUrl }).eq('id', inserted.id)
        } else {
          toast.error('El producto se creó, pero falló la subida de la imagen')
        }
      }

      toast.success('Producto creado')
      setShowAddModal(false)
      setNewProd({ nombre: '', precio: '', detalle: '', categoria_id: '', nuevaCategoria: '' })
      setNewProdImage(null)
      const [{ data: freshProds }, { data: freshCats }] = await Promise.all([
        supabase.from('productos').select('*').eq('cliente_id', clienteId),
        supabase.from('categorias').select('*').eq('cliente_id', clienteId)
      ])
      if (freshProds) setProductos(freshProds)
      if (freshCats) setCategorias(freshCats)
      if (freshProds && freshCats) await syncToBuilder(freshProds, freshCats)
    } finally {
      setSavingNewProd(false)
    }
  }

  const importarExcel = async (e) => {
    const file = e.target.files[0]
    
    if (!file) {
      toast.error('Seleccioná un archivo')
      return
    }
    
    if (!clienteId) {
      toast.error('No se encontró el perfil del restaurante')
      return
    }

    toast.loading('Procesando Excel...', { id: 'importar' })

    try {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data)
      const worksheet = workbook.Sheets[workbook.SheetNames[0]]
      const jsonData = XLSX.utils.sheet_to_json(worksheet)

      if (jsonData.length === 0) {
        toast.error('El archivo está vacío', { id: 'importar' })
        return
      }

      const requiredCols = ['Categoría', 'Producto', 'Precio']
      const hasRequired = requiredCols.every(col => 
        Object.keys(jsonData[0] || {}).some(k => k.toLowerCase().includes(col.toLowerCase()))
      )

      if (!hasRequired) {
        toast.error('El Excel debe tener columnas: Categoría, Producto, Precio', { id: 'importar' })
        return
      }

      // Obtener categorías únicas
      const catNames = [...new Set(jsonData.map(row => {
        const catKey = Object.keys(row).find(k => k.toLowerCase().includes('categor'))
        return row[catKey] || 'Sin categoría'
      }))]

      // Leer categorías frescas de la DB (no del state que puede estar stale)
      const { data: dbCats } = await supabase
        .from('categorias')
        .select('id, nombre')
        .eq('cliente_id', clienteId)

      // Crear mapeo de categorías
      const catMap = {}
      for (const catName of catNames) {
        const existing = (dbCats || []).find(c => c.nombre.toLowerCase() === catName.toLowerCase())
        if (existing) {
          catMap[catName] = existing.id
        } else {
          const { data: newCat, error: catError } = await supabase
            .from('categorias')
            .insert({
              cliente_id: clienteId,
              nombre: catName,
              orden: Object.keys(catMap).length
            })
            .select()
            .single()
          
          if (catError) {
            console.error('Error creando categoría:', catError)
            toast.error(`Error creando categoría "${catName}": ${catError.message}`, { id: 'importar' })
            return
          }
          
          if (newCat) {
            catMap[catName] = newCat.id
          }
        }
      }

      // Mapear productos
      const mappedData = jsonData.map(row => {
        const catKey = Object.keys(row).find(k => k.toLowerCase().includes('categor'))
        const prodKey = Object.keys(row).find(k => k.toLowerCase().includes('producto'))
        const precioKey = Object.keys(row).find(k => k.toLowerCase().includes('precio'))
        const detalleKey = Object.keys(row).find(k => {
          const key = k.toLowerCase()
          return key.includes('detalle') || key.includes('descripcion') || key.includes('descripción')
        })
        
        const catName = row[catKey] || 'Sin categoría'
        
        return {
          cliente_id: clienteId,
          categoria_id: catMap[catName],
          nombre: row[prodKey] || '',
          precio: parseFloat(row[precioKey]) || 0,
          detalle: detalleKey ? (row[detalleKey] || null) : null
        }
      })

      // Eliminar productos existentes
      const { error: deleteError } = await supabase
        .from('productos')
        .delete()
        .eq('cliente_id', clienteId)

      if (deleteError) {
        console.error('Error eliminando productos:', deleteError)
        toast.error(`Error al limpiar productos: ${deleteError.message}`, { id: 'importar' })
        return
      }

      // Insertar nuevos productos
      let { error: insertError } = await supabase
        .from('productos')
        .insert(mappedData)

      // Mismo caso que en crearProducto(): algunas instalaciones tienen la
      // columna `descripcion` en vez de `detalle`. Si Postgrest rechaza el
      // insert en bloque por esa columna, reintentamos ya renombrada, para
      // no perder todos los productos del Excel por un solo campo opcional.
      if (insertError?.code === 'PGRST204' &&
          /Could not find the 'detalle' column of 'productos'/.test(insertError.message || '')) {
        const mappedDataSinDetalle = mappedData.map(({ detalle, ...resto }) => ({ ...resto, descripcion: detalle }))
        const retry = await supabase
          .from('productos')
          .insert(mappedDataSinDetalle)
        insertError = retry.error
      }

      if (insertError) {
        console.error('Error insertando productos:', insertError)
        toast.error(`Error al importar: ${insertError.message}`, { id: 'importar' })
        return
      }

      toast.success(`✅ Importados ${mappedData.length} productos correctamente`, { id: 'importar' })
      setExcelRowsCount(mappedData.length)
      const fresh = await fetchData()

      // Volcar también al Builder (admin y socio comparten el mismo builder_products).
      // Se arma desde Supabase ya actualizado para conservar ids reales, detalle e imágenes.
      try {
        await syncToBuilder(fresh.productos, fresh.categorias)
      } catch (syncErr) {
        console.warn('No se pudo sincronizar el Excel importado con el Builder:', syncErr)
      }
    } catch (err) {
      console.error('Error procesando Excel:', err)
      toast.error('Error al procesar el archivo', { id: 'importar' })
    } finally {
      e.target.value = ''
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  return (
    <div>
      {rol === 'superadmin' && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 mb-4 flex flex-wrap gap-6">
          <span className="text-yellow-400 text-xs font-bold uppercase self-center">Superadmin</span>
          <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
            <input type="checkbox" checked={flags.ocultar_excel_imagenes} onChange={() => toggleFlag('ocultar_excel_imagenes')} className="accent-primary-500" />
            Ocultar "Importar Excel" / "Descargar imágenes" y bloquear cambio de imágenes de categorías/productos
          </label>
        </div>
      )}

      {/* Datos de contacto y delivery: mismos campos que el Builder (Portada),
          para no tener que ir hasta ahí solo para cambiar el WhatsApp o el
          horario. Se guardan en el mismo lugar (tabla clientes), así que
          quedan sincronizados se editen desde donde se editen. */}
      <div className="bg-dark-800 rounded-xl p-4 mb-6 border border-dark-700">
        <h3 className="text-white font-bold mb-3">📞 Datos de contacto y delivery</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-dark-400 mb-1 block">WhatsApp</label>
            <input
              type="text" value={contacto.whatsapp}
              onChange={e => setContacto(prev => ({ ...prev, whatsapp: e.target.value }))}
              placeholder="Ej: 5493511234567"
              className="w-full bg-dark-900 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-dark-400 mb-1 block">Instagram</label>
            <input
              type="text" value={contacto.instagram}
              onChange={e => setContacto(prev => ({ ...prev, instagram: e.target.value }))}
              placeholder="@usuario"
              className="w-full bg-dark-900 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-dark-400 mb-1 block">Dirección</label>
            <input
              type="text" value={contacto.direccion}
              onChange={e => setContacto(prev => ({ ...prev, direccion: e.target.value }))}
              placeholder="Calle 123, Ciudad"
              className="w-full bg-dark-900 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-dark-400 mb-1 block">Horario</label>
            <input
              type="text" value={contacto.horario}
              onChange={e => setContacto(prev => ({ ...prev, horario: e.target.value }))}
              placeholder="Lun a Dom 12 a 23hs"
              className="w-full bg-dark-900 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-dark-400 mb-1 block">Alias (para transferencias)</label>
            <input
              type="text" value={contacto.alias}
              onChange={e => setContacto(prev => ({ ...prev, alias: e.target.value }))}
              placeholder="mi.alias.mp"
              className="w-full bg-dark-900 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-dark-400 mb-1 block">Costo delivery</label>
            <input
              type="number" value={contacto.delivery}
              onChange={e => setContacto(prev => ({ ...prev, delivery: e.target.value }))}
              placeholder="0"
              className="w-full bg-dark-900 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm"
            />
          </div>
        </div>
        <button
          onClick={guardarContacto}
          disabled={savingContacto}
          className="mt-3 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          {savingContacto ? 'Guardando...' : '💾 Guardar datos de contacto'}
        </button>
      </div>

      {/* Barra superior */}
      <div className="bg-dark-800 rounded-xl p-4 mb-6 flex flex-wrap items-center justify-between gap-4 border border-dark-700">
        {!imagenesExcelBloqueado && ['admin', 'superadmin'].includes(rol) && (
          <button onClick={optimizeImages} disabled={optimizing} className="text-white bg-teal-700 rounded-lg px-4 py-2 disabled:opacity-50">
            {optimizing ? 'Optimizando imágenes…' : 'Reducir peso de imágenes'}
          </button>
        )}
        <h2 className="text-white font-bold text-lg">📋 Carta de Productos ({productos.length})</h2>
        <div className="flex gap-2 flex-wrap items-start">
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg transition"
          >
            ➕ Agregar producto
          </button>
          {!['mozo', 'cajero', 'cocina', 'delivery'].includes(rol) && (
            <button
              onClick={guardarProyectoCarta}
              disabled={savingProject}
              className="bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition font-medium self-start"
            >
              {savingProject ? '⏳ Guardando...' : '💾 Guardar proyecto'}
            </button>
          )}
          {!imagenesExcelBloqueado && (
            <div>
              <label className="flex flex-col items-center justify-center bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg cursor-pointer transition">
                <span>📥 Importar Excel</span>
                <span className="text-[10px] text-blue-100/80">.xlsx / .csv</span>
                <input type="file" accept=".xlsx,.xls,.csv" onChange={importarExcel} className="hidden" />
              </label>
              {excelRowsCount > 0 && (
                <p className="text-xs text-accent-400 mt-1 text-center">✓ {excelRowsCount} filas cargadas</p>
              )}
            </div>
          )}
          {!imagenesExcelBloqueado && (
            <button
              onClick={descargarImagenes}
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg transition self-start"
            >
              📦 Descargar imágenes
            </button>
          )}
          {!imagenesExcelBloqueado && (
            <label className="flex flex-col items-center justify-center bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg cursor-pointer transition">
              <span>🖼️ Imágenes categorías</span>
              <span className="text-[10px] text-blue-100/80">Múltiples · 500×500 px</span>
              <input type="file" accept="image/*" multiple className="hidden" onChange={e => handleBulkCategoryImages(e.target.files)} />
            </label>
          )}
          {!imagenesExcelBloqueado && (
            <label className="flex flex-col items-center justify-center bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg cursor-pointer transition">
              <span>🖼️ Imágenes productos</span>
              <span className="text-[10px] text-blue-100/80">Múltiples imágenes</span>
              <input type="file" accept="image/*" multiple className="hidden" onChange={e => handleBulkProductImages(e.target.files)} />
            </label>
          )}
        </div>
      </div>

      {/* Categorías con imágenes */}
      {categorias.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-bold">📂 Categorías ({categorias.length})</h3>
            <span className="text-dark-400 text-sm">
              {categorias.filter(c => c.imagen).length} con imagen
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {categorias.map(cat => {
              const cantidad = productos.filter(p => p.categoria_id === cat.id).length
              const isSelected = selectedCat === cat.id
              return (
                <button
                  type="button"
                  key={cat.id}
                  onClick={() => goToCategoria(cat.id)}
                  title={`Ver productos de ${cat.nombre}`}
                  className={`text-left bg-dark-800 rounded-xl p-3 border transition ${isSelected ? 'border-primary-500 ring-2 ring-primary-500/40' : 'border-dark-700 hover:border-primary-500/60'}`}
                >
                  <div className="relative group mb-2">
                    {cat.imagen ? (
                      <>
                        <img
                          src={cat.imagen}
                          alt={cat.nombre}
                          className="w-full h-20 rounded-lg object-cover"
                        />
                        {!imagenesExcelBloqueado && (
                          <span
                            role="button"
                            onClick={(e) => { e.stopPropagation(); deleteCategoryImage(cat.id) }}
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs opacity-0 group-hover:opacity-100 transition flex items-center justify-center"
                          >
                            ×
                          </span>
                        )}
                      </>
                    ) : (
                      <div className="w-full h-20 bg-dark-700 rounded-lg flex items-center justify-center text-dark-400 text-2xl">
                        📷
                      </div>
                    )}
                  </div>
                  <p className="text-white text-sm font-medium truncate">{cat.nombre}</p>
                  <p className="text-dark-400 text-xs mb-2">{cantidad} producto{cantidad === 1 ? '' : 's'}</p>
                  {!imagenesExcelBloqueado && (
                    <>
                      <input
                        type="file"
                        accept="image/*"
                        ref={el => catFileRefs.current[cat.id] = el}
                        onChange={e => uploadCategoryImage(cat.id, e.target.files[0])}
                        className="hidden"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <span
                        role="button"
                        onClick={(e) => { e.stopPropagation(); catFileRefs.current[cat.id]?.click() }}
                        className="block w-full text-center text-xs bg-dark-700 hover:bg-dark-600 text-white py-1.5 rounded-lg transition disabled:opacity-50"
                      >
                        {uploadingCatId === cat.id ? '⏳' : 'Cargar imagen'}
                      </span>
                    </>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Búsqueda */}
      <div ref={productosSectionRef} className="mb-4 flex flex-wrap items-start gap-4 scroll-mt-4">
        <div className="relative w-full md:w-96">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400 pointer-events-none">
            🔍
          </span>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar producto por nombre..."
            className="w-full pl-10 pr-9 py-2 bg-dark-800 border border-dark-700 rounded-xl text-white placeholder-dark-400 focus:outline-none focus:border-primary-500"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              title="Limpiar búsqueda"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-dark-400 hover:text-white text-sm"
            >
              ×
            </button>
          )}

          {/* Resultados en vivo, justo debajo del buscador */}
          {search.trim() && (
            <div className="absolute z-40 mt-2 w-full max-h-80 overflow-y-auto bg-dark-800 border border-dark-700 rounded-xl shadow-xl">
              {filteredProductos.length === 0 ? (
                <p className="text-dark-400 text-sm p-4">No se encontraron productos para "{search}".</p>
              ) : (
                filteredProductos.map(p => {
                  const catNombre = categorias.find(c => c.id === p.categoria_id)?.nombre || 'Sin categoría'
                  return (
                    <button
                      type="button"
                      key={p.id}
                      onClick={() => { setSelectedCat(p.categoria_id); setSearch(''); setTimeout(() => productosSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50) }}
                      className="w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-dark-700 transition border-b border-dark-700 last:border-0"
                    >
                      {p.imagen ? (
                        <img src={p.imagen} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                      ) : (
                        <span className="w-8 h-8 rounded-lg bg-dark-700 flex items-center justify-center text-dark-400 text-xs flex-shrink-0">🍽️</span>
                      )}
                      <span className="flex-1 min-w-0">
                        <span className="block text-white text-sm truncate">{p.nombre}</span>
                        <span className="block text-dark-400 text-xs truncate">{catNombre}</span>
                      </span>
                      <span className="text-accent-400 text-sm font-semibold flex-shrink-0">${p.precio}</span>
                    </button>
                  )
                })
              )}
            </div>
          )}
        </div>
        {selectedCat && (
          <button
            type="button"
            onClick={() => setSelectedCat(null)}
            className="flex items-center gap-1 text-sm bg-primary-500/20 text-primary-400 border border-primary-500/40 rounded-xl px-3 py-2 hover:bg-primary-500/30 transition"
          >
            ← Volver a todas las categorías
          </button>
        )}
      </div>

      {/* Panel de actualización masiva de precios: siempre visible (antes solo aparecía
          después de tildar algo, y no se notaba que existía) */}
      <div className={`border rounded-xl p-4 mb-6 transition ${selectedIds.length > 0 ? 'bg-yellow-500/20 border-yellow-500/50' : 'bg-dark-800 border-dark-700'}`}>
        <div className="flex flex-wrap items-center gap-4">
          <span className={`font-bold ${selectedIds.length > 0 ? 'text-yellow-400' : 'text-dark-400'}`}>
            {selectedIds.length > 0 ? `${selectedIds.length} seleccionados` : '💲 Cambiar precios en lote: tildá productos abajo (o "Seleccionar todos")'}
          </span>
          <label className="flex items-center gap-2 text-white text-sm cursor-pointer select-none bg-dark-900/60 border border-dark-600 rounded-xl px-3 py-2 hover:bg-dark-700 transition">
            <input
              type="checkbox"
              checked={allSelectedGlobal}
              onChange={selectAllGlobal}
              className="w-4 h-4 accent-primary-500"
            />
            Seleccionar todos los productos ({allIds.length})
          </label>
          <select
            value={bulkOperation}
            onChange={e => setBulkOperation(e.target.value)}
            className="bg-dark-800 border border-dark-700 rounded-lg px-3 py-2 text-white"
          >
            <option value="aumentar">Aumentar %</option>
            <option value="disminuir">Disminuir %</option>
            <option value="fijo">Poner precio fijo</option>
          </select>
          <input
            type="number"
            value={bulkValue}
            onChange={e => setBulkValue(e.target.value)}
            placeholder={bulkOperation === 'fijo' ? '$ Precio' : '% Valor'}
            className="w-24 bg-dark-800 border border-dark-700 rounded-lg px-3 py-2 text-white"
          />
          <button
            onClick={applyBulkUpdate}
            disabled={selectedIds.length === 0}
            className="bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-bold transition"
          >
            ✅ Aplicar
          </button>
          {selectedIds.length > 0 && (
            <button
              onClick={() => setSelectedIds([])}
              className="text-dark-400 hover:text-white"
            >
              Cancelar
            </button>
          )}
        </div>
      </div>

      {/* Tabla por categorías (si hay una categoría seleccionada en el grid de arriba,
          se muestra solo esa; si no, se listan todas como antes) */}
      {search.trim() && filteredProductos.length === 0 && (
        <p className="text-dark-400 text-sm mb-6">No se encontraron productos para "{search}".</p>
      )}
      {categoriasVisibles.map(cat => {
        const catProductos = filteredProductos.filter(p => p.categoria_id === cat.id)
        const catIds = catProductos.map(p => p.id)
        const allCatSelected = catIds.length > 0 && catIds.every(id => selectedIds.includes(id))

        // Si hay una búsqueda activa, ocultamos categorías sin resultados para no
        // mostrar tablas vacías
        if (search.trim() && catProductos.length === 0) return null

        return (
          <div key={cat.id} className="mb-6">
            <div className="flex items-center gap-3 mb-3">
              <input
                type="checkbox"
                checked={allCatSelected}
                onChange={() => selectAllInCategory(cat.id)}
                className="w-4 h-4 accent-primary-500"
              />
              {cat.imagen ? (
                <img
                  src={cat.imagen}
                  alt={cat.nombre}
                  className="w-8 h-8 rounded-lg object-cover"
                />
              ) : (
                <span className="w-8 h-8 rounded-lg bg-dark-700 flex items-center justify-center text-dark-400 text-sm">
                  📂
                </span>
              )}
              <h3 className="text-white font-bold text-lg border-b-2 border-cyan-400 pb-1">
                {cat.nombre}
              </h3>
              <span className="text-dark-400 text-sm">({catProductos.length})</span>
            </div>

            <div className="bg-dark-800 rounded-xl border border-dark-700 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-dark-700">
                    <th className="text-left text-white p-3 w-10">Sel</th>
                    <th className="text-left text-white p-3">Producto</th>
                    <th className="text-left text-white p-3 w-24">Imagen</th>
                    <th className="text-left text-white p-3 w-32">Precio</th>
                    <th className="text-left text-white p-3 w-28">Estado</th>
                    <th className="text-left text-white p-3 w-32">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {catProductos.map(prod => (
                    <tr key={prod.id} className="border-t border-dark-700 hover:bg-dark-700/50">
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(prod.id)}
                          onChange={() => toggleSelect(prod.id)}
                          className="w-4 h-4 accent-primary-500"
                        />
                      </td>
                      <td className="p-3 text-white">{prod.nombre}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          {prod.imagen ? (
                            <div className="relative group">
                              <img
                                src={prod.imagen}
                                alt=""
                                className="w-10 h-10 rounded-lg object-cover"
                              />
                              {!imagenesExcelBloqueado && (
                                <button
                                  onClick={() => deleteImage(prod.id)}
                                  className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 text-xs opacity-0 group-hover:opacity-100 transition"
                                >
                                  ×
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="text-dark-500 text-xs">Sin img</span>
                          )}
                          {!imagenesExcelBloqueado && <input
                            type="file"
                            accept="image/*"
                            ref={el => fileInputRefs.current[prod.id] = el}
                            onChange={e => uploadImage(prod.id, e.target.files[0])}
                            className="hidden"
                          />}
                          {!imagenesExcelBloqueado && <button
                            onClick={() => fileInputRefs.current[prod.id]?.click()}
                            disabled={uploadingId === prod.id}
                            className="text-blue-400 hover:text-blue-300 text-sm disabled:opacity-50"
                            title="Subir imagen"
                          >
                            {uploadingId === prod.id ? '⏳' : '📷'}
                          </button>}
                        </div>
                      </td>
                      <td className="p-3">
                        {editPrice === prod.id ? (
                          <div className="flex gap-1">
                            <input
                              type="number"
                              value={newPrice}
                              onChange={e => setNewPrice(e.target.value)}
                              className="w-20 bg-dark-900 border border-dark-600 rounded px-2 py-1 text-white text-sm"
                              step="0.01"
                            />
                            <button
                              onClick={() => updatePrice(prod.id)}
                              className="text-green-400 hover:text-green-300"
                            >
                              💾
                            </button>
                          </div>
                        ) : (
                          <span
                            className="text-white cursor-pointer hover:text-primary-400"
                            onClick={() => { setEditPrice(prod.id); setNewPrice(prod.precio) }}
                          >
                            ${prod.precio}
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        <span className="text-green-400">✅ Activo</span>
                      </td>
                      <td className="p-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => eliminarProducto(prod.id)}
                            className="text-red-400 hover:text-red-300 text-sm"
                            title="Eliminar"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}

      {/* Modal agregar producto */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 rounded-2xl p-6 max-w-lg w-full border border-dark-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bold text-xl">➕ Agregar producto</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-dark-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-dark-400 text-sm mb-1">Nombre *</label>
                <input
                  type="text"
                  value={newProd.nombre}
                  onChange={e => setNewProd({ ...newProd, nombre: e.target.value })}
                  className="w-full bg-dark-900 border border-dark-600 rounded-lg px-3 py-2 text-white"
                  placeholder="Ej: Milanesa napolitana"
                />
              </div>

              <div>
                <label className="block text-dark-400 text-sm mb-1">Precio *</label>
                <input
                  type="number"
                  min="0"
                  value={newProd.precio}
                  onChange={e => setNewProd({ ...newProd, precio: e.target.value })}
                  className="w-full bg-dark-900 border border-dark-600 rounded-lg px-3 py-2 text-white"
                  placeholder="Ej: 5000"
                />
              </div>

              <div>
                <label className="block text-dark-400 text-sm mb-1">Descripción</label>
                <input
                  type="text"
                  value={newProd.detalle}
                  onChange={e => setNewProd({ ...newProd, detalle: e.target.value })}
                  className="w-full bg-dark-900 border border-dark-600 rounded-lg px-3 py-2 text-white"
                  placeholder="Opcional"
                />
              </div>

              <div>
                <label className="block text-dark-400 text-sm mb-1">Categoría *</label>
                <select
                  value={newProd.categoria_id}
                  onChange={e => setNewProd({ ...newProd, categoria_id: e.target.value, nuevaCategoria: '' })}
                  className="w-full bg-dark-900 border border-dark-600 rounded-lg px-3 py-2 text-white mb-2"
                >
                  <option value="">— Elegir categoría existente —</option>
                  {categorias.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={newProd.nuevaCategoria}
                  onChange={e => setNewProd({ ...newProd, nuevaCategoria: e.target.value, categoria_id: '' })}
                  className="w-full bg-dark-900 border border-dark-600 rounded-lg px-3 py-2 text-white"
                  placeholder="...o creá una categoría nueva"
                />
              </div>

              <div>
                <label className="block text-dark-400 text-sm mb-1">Imagen (.webp)</label>
                <input
                  type="file"
                  accept=".webp,image/webp"
                  onChange={e => setNewProdImage(e.target.files[0] || null)}
                  className="w-full text-white text-sm"
                />
                <p className="text-dark-500 text-xs mt-1">Solo se aceptan imágenes en formato .webp</p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={crearProducto}
                disabled={savingNewProd}
                className="flex-1 bg-green-600 hover:bg-green-500 text-white px-4 py-3 rounded-xl font-bold transition disabled:opacity-50"
              >
                {savingNewProd ? 'Guardando...' : '✅ Crear producto'}
              </button>
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-3 bg-dark-700 hover:bg-dark-600 text-white rounded-xl transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
