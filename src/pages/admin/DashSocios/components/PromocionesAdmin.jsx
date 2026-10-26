import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import toast from 'react-hot-toast'
import { DIAS_PROMO, hhmm, textoHorarioPromo, tieneHorario, tieneLimite, estadoPromo, validarLimitesHorario, camposLimitesHorario } from '@/lib/promoVigencia'

const LIMITES_VACIOS = { usos_max: '', dias_semana: [], hora_desde: '', hora_hasta: '' }
// Si todavía no se ejecutó supabase/promociones_limites_horario.sql faltan estas columnas.
const faltaSqlLimites = msg => /usos_max|dias_semana|hora_desde|hora_hasta|zona_horaria|schema cache/i.test(msg || '')
const faltaFuncion = err => err && (err.code === 'PGRST202' || /canjear_promo|Could not find the function/i.test(err.message || ''))

// Cantidad de usos + días + horario. Se usa al crear la promo y en el editor de cada promo.
function LimitesHorarioCampos({ valor, onChange, className = '' }) {
  const set = patch => onChange({ ...valor, ...patch })
  const toggleDia = id => set({ dias_semana: valor.dias_semana.includes(id) ? valor.dias_semana.filter(d => d !== id) : [...valor.dias_semana, id] })
  return (
    <div className={`border border-dark-600 rounded-lg p-3 bg-dark-900/50 ${className}`}>
      <p className="text-white text-sm font-bold mb-3">⏱ Límite de usos, días y horario</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-dark-400 text-sm mb-1">Cantidad de veces que puede usarse</label>
          <input
            type="number" min="1" step="1" inputMode="numeric"
            value={valor.usos_max}
            onChange={e => set({ usos_max: e.target.value })}
            placeholder="Sin límite"
            className="w-full bg-dark-900 border border-dark-600 rounded-lg px-3 py-2 text-white"
          />
          <p className="text-[10px] text-dark-400 mt-1">Total entre todos los clientes. Al llegar al número deja de ofrecerse. Vacío = sin límite.</p>
        </div>
        <div className="md:col-span-2 space-y-3">
          <div>
            <label className="block text-dark-400 text-sm mb-1">Días en que vale</label>
            <div className="flex flex-wrap gap-2">
              {DIAS_PROMO.map(d => {
                const on = valor.dias_semana.includes(d.id)
                return (
                  <button
                    key={d.id} type="button" aria-pressed={on}
                    onClick={() => toggleDia(d.id)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${on ? 'bg-primary-600/30 border-primary-500 text-primary-300' : 'bg-dark-900 border-dark-600 text-dark-300 hover:border-primary-500/50'}`}
                  >{d.label}</button>
                )
              })}
              {valor.dias_semana.length > 0 && <button type="button" onClick={() => set({ dias_semana: [] })} className="text-xs text-dark-300 hover:text-white underline px-1">Todos los días</button>}
            </div>
            <p className="text-[10px] text-dark-400 mt-1">Sin ninguno marcado vale todos los días.</p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-dark-400 text-sm mb-1">Desde</label>
              <input type="time" value={valor.hora_desde} onChange={e => set({ hora_desde: e.target.value })} className="bg-dark-900 border border-dark-600 rounded-lg px-3 py-2 text-white" />
            </div>
            <div>
              <label className="block text-dark-400 text-sm mb-1">Hasta</label>
              <input type="time" value={valor.hora_hasta} onChange={e => set({ hora_hasta: e.target.value })} className="bg-dark-900 border border-dark-600 rounded-lg px-3 py-2 text-white" />
            </div>
            {(valor.hora_desde || valor.hora_hasta) && <button type="button" onClick={() => set({ hora_desde: '', hora_hasta: '' })} className="text-xs text-dark-300 hover:text-white underline pb-2">Todo el día</button>}
          </div>
          <p className="text-[10px] text-dark-400">Hora del local. Vacío = todo el día. Si “Hasta” es menor que “Desde” cruza la medianoche (ej. 20:00 a 02:00, la madrugada cuenta como parte del día en que empezó).</p>
        </div>
      </div>
    </div>
  )
}

export default function PromocionesAdmin({ clienteId }) {
  const { rol } = useAuth()
  // El staff (mozo, cocina, cajero, delivery) solo puede VER las promociones:
  // no crea ni elimina. Admin, superadmin y el dueño siguen gestionándolas.
  const soloLectura = ['mozo', 'cocina', 'cajero', 'delivery'].includes(rol)
  const [promociones, setPromociones] = useState([])
  const [productos, setProductos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [clientesForm, setClientesForm] = useState([])
  const [seleccionados, setSeleccionados] = useState({})
  const [promoSeleccionada, setPromoSeleccionada] = useState('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [tick, setTick] = useState(0)
  const [asignaciones, setAsignaciones] = useState([]) // filas de promociones_cliente (codigo/usado) de este socio
  const [enviando, setEnviando] = useState(false)
  const [codigoInput, setCodigoInput] = useState('')
  const [validando, setValidando] = useState(false)
  const [form, setForm] = useState({
    titulo: '',
    descripcion: '',
    tipo: '2x1_mismo',
    categoria: '',
    producto_ids: [],
    valor_descuento: '',
    asignacion: 'todos',
    fecha_envio: '',
    para_nuevos: false,
    _showCats: false,
    ...LIMITES_VACIOS
  })
  // Editor de "Límite y horario" de una promo ya creada
  const [editandoId, setEditandoId] = useState(null)
  const [editForm, setEditForm] = useState(LIMITES_VACIOS)
  const [guardandoLimites, setGuardandoLimites] = useState(false)

  useEffect(() => {
    if (clienteId) fetchData()
  }, [clienteId])

  // Re-render cada 30s para habilitar promos agendadas cuando llega la hora
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchData = async () => {
    const [promosRes, prodsRes, catsRes, solsRes] = await Promise.all([
      supabase.from('promociones').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false }),
      supabase.from('productos').select('*').eq('cliente_id', clienteId).order('nombre'),
      supabase.from('categorias').select('*').eq('cliente_id', clienteId).order('orden'),
      supabase.from('suscripciones').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false })
    ])

    if (!promosRes.error) setPromociones(promosRes.data || [])
    else console.error('Error cargando promos:', promosRes.error)
    if (!prodsRes.error) setProductos(prodsRes.data || [])
    else console.error('Error cargando productos:', prodsRes.error)
    if (!catsRes.error) setCategorias(catsRes.data || [])
    else console.error('Error cargando categorias:', catsRes.error)
    if (!solsRes.error) {
      setClientesForm(solsRes.data || [])
      setSeleccionados(prev => {
        const next = {}
        ;(solsRes.data || []).forEach(s => { next[s.id] = prev[s.id] || false })
        return next
      })
    } else console.error('Error cargando suscripciones:', solsRes.error)

    // Traer las asignaciones (codigo de canje / usado) de las promos de este socio
    const promoIds = (promosRes.data || []).map(p => p.id)
    if (promoIds.length > 0) {
      const { data: asigs, error: asigsError } = await supabase
        .from('promociones_cliente')
        .select('*')
        .in('promocion_id', promoIds)
      if (!asigsError) setAsignaciones(asigs || [])
    } else {
      setAsignaciones([])
    }

    setLoading(false)
  }

  // Busca (sin crear) una asignacion existente para una promo + suscriptor
  const asignacionPara = (promoId, suscripcionId) =>
    asignaciones.find(a => a.promocion_id === promoId && a.suscripcion_id === suscripcionId)

  // Devuelve la asignacion (con su codigo de canje), creandola si todavia no existe
  const getOrCrearAsignacion = async (promoId, suscripcionId) => {
    const existente = asignacionPara(promoId, suscripcionId)
    if (existente) return existente

    const { data, error } = await supabase
      .from('promociones_cliente')
      .insert({ promocion_id: promoId, suscripcion_id: suscripcionId })
      .select()

    if (error || !data?.[0]) return null
    const nueva = data[0]
    setAsignaciones(prev => [...prev, nueva])
    return nueva
  }

  const crearPromo = async (e) => {
    e.preventDefault()

    if (!form.titulo || !form.descripcion) {
      toast.error('Título y descripción son obligatorios')
      return
    }

    if (form.tipo === 'descuento' && (!form.valor_descuento || Number(form.valor_descuento) <= 0)) {
      toast.error('Ingresá el porcentaje de descuento')
      return
    }

    const errLimites = validarLimitesHorario(form)
    if (errLimites) {
      toast.error(errLimites)
      return
    }
    // Solo se envían los campos nuevos si se configuró algo: una promo común se crea igual que siempre.
    const limites = camposLimitesHorario(form)
    const hayLimites = limites.usos_max != null || limites.dias_semana != null || limites.hora_desde != null

    const { data, error } = await supabase
      .from('promociones')
      .insert({
        cliente_id: clienteId,
        titulo: form.titulo,
        descripcion: form.descripcion,
        tipo: form.tipo,
        categoria: form.categoria || null,
        producto_id: form.producto_ids.length > 0 ? JSON.stringify(form.producto_ids) : null,
        producto_nombre: form.producto_ids.length > 0 ? JSON.stringify(form.producto_ids.map(id => productos.find(p => p.id === id)?.nombre).filter(Boolean)) : null,
        valor_descuento: form.tipo === 'descuento' ? Number(form.valor_descuento) : null,
        asignacion: form.asignacion,
        fecha_envio: form.fecha_envio ? new Date(form.fecha_envio).toISOString() : null,
        para_nuevos: form.para_nuevos,
        ...(hayLimites ? limites : {})
      })
      .select()

    if (error) {
      console.error('Error creando promo:', error)
      const detalle = error.message || error.details || JSON.stringify(error)
      toast.error('Error al crear: ' + detalle + (hayLimites && faltaSqlLimites(detalle) ? ' (¿ejecutaste supabase/promociones_limites_horario.sql?)' : ''), { duration: 8000 })
      return
    }

    // Si asignación es "todos", asignar a todos los suscriptos
    if (form.asignacion === 'todos' && data?.[0]) {
      await asignarATodos(data[0].id)
    }

    toast.success('Promoción creada')
    setShowForm(false)
    setForm({ titulo: '', descripcion: '', tipo: '2x1_mismo', categoria: '', producto_ids: [], valor_descuento: '', asignacion: 'todos', fecha_envio: '', para_nuevos: false, _showCats: false, ...LIMITES_VACIOS })
    fetchData()
  }

  const asignarATodos = async (promoId) => {
    const { data: suscripciones } = await supabase
      .from('suscripciones')
      .select('id')
      .eq('cliente_id', clienteId)

    if (suscripciones?.length) {
      const inserts = suscripciones.map(s => ({
        promocion_id: promoId,
        suscripcion_id: s.id
      }))
      await supabase.from('promociones_cliente').insert(inserts)
    }
  }

  // TODO: Agregar columna 'activo' a tabla promociones para activar/desactivar
  // const togglePromo = async (id, activo) => {
  //   const { error } = await supabase
  //     .from('promociones')
  //     .update({ activo: !activo })
  //     .eq('id', id)
  //   if (!error) {
  //     toast.success(activo ? 'Promo desactivada' : 'Promo activada')
  //     fetchData()
  //   }
  // }

  const abrirEditor = (promo) => {
    if (editandoId === promo.id) { setEditandoId(null); return }
    setEditForm({
      usos_max: promo.usos_max ?? '',
      dias_semana: promo.dias_semana || [],
      hora_desde: hhmm(promo.hora_desde),
      hora_hasta: hhmm(promo.hora_hasta)
    })
    setEditandoId(promo.id)
  }

  const guardarLimites = async (promo) => {
    if (soloLectura) return
    const err = validarLimitesHorario(editForm)
    if (err) { toast.error(err); return }
    setGuardandoLimites(true)
    const { error } = await supabase.from('promociones').update(camposLimitesHorario(editForm)).eq('id', promo.id)
    setGuardandoLimites(false)
    if (error) {
      const detalle = error.message || error.details || JSON.stringify(error)
      toast.error('No se pudo guardar: ' + detalle + (faltaSqlLimites(detalle) ? ' (¿ejecutaste supabase/promociones_limites_horario.sql?)' : ''), { duration: 8000 })
      return
    }
    toast.success('Límite y horario guardados')
    setEditandoId(null)
    fetchData()
  }

  const eliminarPromo = async (id) => {
    if (soloLectura) return
    if (!confirm('¿Eliminar esta promoción?')) return

    await supabase.from('promociones_cliente').delete().eq('promocion_id', id)
    const { error } = await supabase.from('promociones').delete().eq('id', id)

    if (!error) {
      toast.success('Promoción eliminada')
      fetchData()
    }
  }

  const eliminarSolicitud = async (id) => {
    if (!confirm('¿Eliminar este cliente de la lista?')) return
    const { error } = await supabase.from('suscripciones').delete().eq('id', id)
    if (!error) {
      toast.success('Cliente eliminado')
      fetchData()
    }
  }

  const getTipoLabel = (tipo) => {
    const labels = {
      '2x1_mismo': '2x1 Mismo Producto',
      '2x1_categoria': '2x1 Categoría',
      'descuento': 'Descuento'
    }
    return labels[tipo] || tipo
  }

  const isAgendada = (promo) => {
    if (!promo.fecha_envio) return false
    return new Date(promo.fecha_envio).getTime() > Date.now()
  }

  const toggleTodos = (valor) => {
    const next = {}
    clientesForm.forEach(s => { next[s.id] = valor })
    setSeleccionados(next)
  }

  const todosSeleccionados = clientesForm.length > 0 && clientesForm.every(s => seleccionados[s.id])
  const cantidadSeleccionados = Object.values(seleccionados).filter(Boolean).length

  const normalizarWhatsapp = (wa) => {
    if (!wa) return ''
    let num = wa.replace(/\D/g, '')
    if (num.length === 10) num = '54' + num
    return num
  }

  const enviarPromos = async () => {
    const promo = promociones.find(p => p.id === promoSeleccionada)
    if (!promo) {
      toast.error('Seleccioná una promoción para enviar')
      return
    }
    if (isAgendada(promo)) {
      toast.error(`Esta promo está agendada para el ${new Date(promo.fecha_envio).toLocaleString()}`)
      return
    }
    if (estadoPromo(promo, asignaciones.filter(a => a.promocion_id === promo.id && a.usada).length) === 'agotada') {
      toast.error('Esta promo ya alcanzó su límite de usos')
      return
    }
    // Días, horario y cupo que se avisan al cliente en el mensaje
    const vigencia = [
      tieneHorario(promo) ? `Válida: ${textoHorarioPromo(promo)}.` : '',
      tieneLimite(promo) ? `Cupos limitados (${promo.usos_max}).` : ''
    ].filter(Boolean).join(' ')

    const destinatarios = clientesForm.filter(s => seleccionados[s.id])
    if (destinatarios.length === 0) {
      toast.error('Seleccioná al menos un cliente')
      return
    }

    setEnviando(true)
    let enviados = 0
    for (let i = 0; i < destinatarios.length; i++) {
      const cliente = destinatarios[i]
      const num = normalizarWhatsapp(cliente.whatsapp)
      if (!num) continue

      // Cada cliente tiene (o recibe) su propio codigo de canje unico para esta promo
      const asignacion = await getOrCrearAsignacion(promo.id, cliente.id)
      const codigo = asignacion?.codigo

      const cuerpo = codigo
        ? `🎁 *${promo.titulo}*\n\n${promo.descripcion}${vigencia ? `\n\n${vigencia}` : ''}\n\nMostrá este código en el local para usarla:\n*${codigo}*\n\n¡Te esperamos!`
        : `🎁 *${promo.titulo}*\n\n${promo.descripcion}${vigencia ? `\n\n${vigencia}` : ''}\n\n¡Te esperamos!`

      const mensaje = encodeURIComponent(cuerpo)
      setTimeout(() => {
        window.open(`https://wa.me/${num}?text=${mensaje}`, '_blank')
      }, i * 500)
      enviados++
    }

    setEnviando(false)
    toast.success(`Abriendo WhatsApp para ${enviados} cliente(s)...`)
  }

  // Validar un codigo mostrado por el cliente en el local y marcarlo como usado
  const validarCodigo = async () => {
    const codigo = codigoInput.trim().toUpperCase()
    if (!codigo) {
      toast.error('Ingresá un código')
      return
    }

    setValidando(true)

    // Buscamos primero en lo ya cargado; si no esta, consultamos por las dudas
    let asignacion = asignaciones.find(a => (a.codigo || '').toUpperCase() === codigo)
    if (!asignacion) {
      const promoIds = promociones.map(p => p.id)
      const { data } = await supabase
        .from('promociones_cliente')
        .select('*')
        .eq('codigo', codigo)
        .in('promocion_id', promoIds)
        .maybeSingle()
      asignacion = data || null
    }

    if (!asignacion) {
      toast.error('Código inválido o no pertenece a este local')
      setValidando(false)
      return
    }

    if (asignacion.activa === false) {
      toast.error('Esta promo fue desactivada por el local')
      setValidando(false)
      return
    }

    if (asignacion.usada) {
      toast.error(`Ese código ya fue usado el ${new Date(asignacion.fecha_uso).toLocaleString()}`)
      setValidando(false)
      return
    }

    const promo = promociones.find(p => p.id === asignacion.promocion_id)
    const cliente = clientesForm.find(c => c.id === asignacion.suscripcion_id)

    // Canje en el servidor: valida día, horario y cupo y marca el código como usado en una sola operación.
    const { data: canje, error: canjeError } = await supabase.rpc('canjear_promo', { p_codigo: codigo })
    if (!canjeError && canje) {
      setValidando(false)
      if (!canje.ok) {
        toast.error(canje.mensaje || 'No se pudo validar el código', { duration: 6000 })
        fetchData()
        return
      }
      setAsignaciones(prev => prev.map(a => (a.id === asignacion.id ? { ...a, usada: true, fecha_uso: new Date().toISOString() } : a)))
      setCodigoInput('')
      toast.success(`✓ Canjeada: "${promo?.titulo || 'Promo'}" — ${cliente?.nombre || 'Cliente'}${canje.usos_max ? ` (uso ${canje.usos} de ${canje.usos_max})` : ''}`)
      fetchData()
      return
    }
    if (canjeError && !faltaFuncion(canjeError)) {
      setValidando(false)
      toast.error('No se pudo validar el código: ' + (canjeError.message || ''))
      return
    }

    // Compatibilidad: si todavía no se ejecutó promociones_limites_horario.sql se usa el método anterior.
    const { data, error } = await supabase
      .from('promociones_cliente')
      .update({ usada: true, fecha_uso: new Date().toISOString() })
      .eq('id', asignacion.id)
      .select()

    setValidando(false)

    if (error || !data?.[0]) {
      toast.error('No se pudo validar el código')
      return
    }

    setAsignaciones(prev => prev.map(a => (a.id === data[0].id ? data[0] : a)))
    setCodigoInput('')
    toast.success(`✓ Canjeada: "${promo?.titulo || 'Promo'}" — ${cliente?.nombre || 'Cliente'}`)
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
      {/* Header */}
      <div className="bg-dark-800 rounded-xl p-4 mb-6 flex items-center justify-between border border-dark-700">
        <h2 className="text-white font-bold text-lg">🎁 Promociones ({promociones.length})</h2>
        {!soloLectura && (
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg font-bold transition"
        >
          {showForm ? '✕ Cancelar' : '+ Nueva Promo'}
        </button>
        )}
      </div>

      {/* Formulario */}
      {!soloLectura && showForm && (
        <form onSubmit={crearPromo} className="bg-dark-800 rounded-xl p-6 mb-6 border border-dark-700">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-dark-400 text-sm mb-1">Título *</label>
              <input
                type="text"
                value={form.titulo}
                onChange={e => setForm({ ...form, titulo: e.target.value })}
                className="w-full bg-dark-900 border border-dark-600 rounded-lg px-3 py-2 text-white"
                placeholder="Ej: 2x1 en tragos"
                required
              />
            </div>
            <div>
              <label className="block text-dark-400 text-sm mb-1">Tipo</label>
              <select
                value={form.tipo}
                onChange={e => setForm({ ...form, tipo: e.target.value })}
                className="w-full bg-dark-900 border border-dark-600 rounded-lg px-3 py-2 text-white"
              >
                <option value="2x1_mismo">2x1 Mismo Producto</option>
                <option value="2x1_categoria">2x1 Categoría</option>
                <option value="descuento">Descuento</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-dark-400 text-sm mb-1">Descripción *</label>
              <textarea
                value={form.descripcion}
                onChange={e => setForm({ ...form, descripcion: e.target.value })}
                className="w-full bg-dark-900 border border-dark-600 rounded-lg px-3 py-2 text-white"
                rows="2"
                placeholder="Descripción de la promoción"
                required
              />
            </div>
            {form.tipo === 'descuento' && (
              <div>
                <label className="block text-dark-400 text-sm mb-1">Descuento (%) *</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={form.valor_descuento}
                  onChange={e => setForm({ ...form, valor_descuento: e.target.value })}
                  className="w-full bg-dark-900 border border-dark-600 rounded-lg px-3 py-2 text-white"
                  placeholder="Ej: 20"
                  required
                />
              </div>
            )}
            {form.tipo === '2x1_categoria' && (
              <div className="md:col-span-2">
                <label className="block text-dark-400 text-sm mb-1">Categoría</label>
                <div className="max-h-48 overflow-y-auto space-y-1 bg-dark-900 border border-dark-600 rounded-lg p-2">
                  {categorias.map(cat => {
                    const count = productos.filter(p => p.categoria_id === cat.id).length
                    const selected = form.categoria === cat.nombre
                    return (
                      <label key={cat.id} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition ${selected ? 'bg-primary-600/20 border border-primary-500/50' : 'hover:bg-dark-800 border border-transparent'}`}>
                        <input type="radio" name="promoCategoria" checked={selected}
                          onChange={() => setForm({ ...form, categoria: cat.nombre, producto_ids: [] })}
                          className="accent-primary-500" />
                        <span className="text-white text-sm flex-1">{cat.nombre}</span>
                        <span className="text-dark-400 text-xs">{count}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            )}
            {(form.tipo === '2x1_mismo' || form.tipo === 'descuento') && (
              <div className="md:col-span-2">
                <label className="block text-dark-400 text-sm mb-1">Producto{form.tipo === 'descuento' ? '/s con descuento' : ''} *</label>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <button type="button" onClick={() => setForm({ ...form, _showCats: !form._showCats })}
                      className="w-full flex items-center justify-between bg-dark-900 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm hover:border-primary-500/50 transition">
                      <span>{form.categoria || 'Categorías'}</span>
                      <span className={`transition-transform ${form._showCats ? 'rotate-180' : ''}`}>▾</span>
                    </button>
                    {form._showCats && (
                      <div className="mt-1 max-h-40 overflow-y-auto bg-dark-900 border border-dark-600 rounded-lg">
                        {categorias.map(cat => {
                          const count = productos.filter(p => p.categoria_id === cat.id).length
                          const selected = form.categoria === cat.nombre
                          return (
                            <label key={cat.id} className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer transition text-sm ${selected ? 'bg-primary-600/20 text-primary-400' : 'text-white hover:bg-dark-800'}`}>
                              <input type="radio" name="promoCatSel" checked={selected}
                                onChange={() => setForm({ ...form, categoria: cat.nombre, producto_ids: [], _showCats: false })}
                                className="accent-primary-500" />
                              <span className="flex-1 truncate">{cat.nombre}</span>
                              <span className="text-dark-400 text-xs">{count}</span>
                            </label>
                          )
                        })}
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    {form.categoria ? (
                      <div className="max-h-40 overflow-y-auto bg-dark-900 border border-dark-600 rounded-lg">
                        {(() => {
                          const catId = categorias.find(c => c.nombre === form.categoria)?.id
                          const prods = productos.filter(p => p.categoria_id === catId)
                          const allSelected = prods.length > 0 && prods.every(p => form.producto_ids.includes(p.id))
                          return prods.length === 0 ? (
                            <p className="text-dark-500 text-xs p-2">Sin productos</p>
                          ) : (
                            <>
                              <label className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer transition text-sm border-b border-dark-600 ${allSelected ? 'bg-primary-600/20 text-primary-400' : 'text-white hover:bg-dark-800'}`}>
                                <input type="checkbox" checked={allSelected}
                                  onChange={() => {
                                    if (allSelected) {
                                      setForm({ ...form, producto_ids: form.producto_ids.filter(id => !prods.some(p => p.id === id)) })
                                    } else {
                                      const newIds = prods.map(p => p.id).filter(id => !form.producto_ids.includes(id))
                                      setForm({ ...form, producto_ids: [...form.producto_ids, ...newIds] })
                                    }
                                  }}
                                  className="accent-primary-500" />
                                <span className="font-medium">Seleccionar todos</span>
                              </label>
                              {prods.map(prod => {
                                const checked = form.producto_ids.includes(prod.id)
                                return (
                                  <label key={prod.id} className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer transition text-sm ${checked ? 'bg-primary-600/20 text-primary-400' : 'text-white hover:bg-dark-800'}`}>
                                    <input type="checkbox" checked={checked}
                                      onChange={() => {
                                        if (checked) {
                                          setForm({ ...form, producto_ids: form.producto_ids.filter(id => id !== prod.id) })
                                        } else {
                                          setForm({ ...form, producto_ids: [...form.producto_ids, prod.id] })
                                        }
                                      }}
                                      className="accent-primary-500" />
                                    <span className="flex-1 truncate">{prod.nombre}</span>
                                    <span className="text-dark-400 text-xs">${prod.precio}</span>
                                  </label>
                                )
                              })}
                            </>
                          )
                        })()}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-10 bg-dark-900 border border-dark-600 rounded-lg">
                        <span className="text-dark-500 text-xs">Elegí una categoría</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            <div>
              <label className="block text-dark-400 text-sm mb-1">Asignación</label>
              <select
                value={form.asignacion}
                onChange={e => setForm({ ...form, asignacion: e.target.value })}
                className="w-full bg-dark-900 border border-dark-600 rounded-lg px-3 py-2 text-white"
              >
                <option value="todos">Todos los suscriptos</option>
                <option value="manual">Asignar manualmente</option>
              </select>
            </div>
            <div className="hidden">
              <label className="block text-dark-400 text-sm mb-1">⏰ Agendar envío (opcional)</label>
              <input
                type="datetime-local"
                value={form.fecha_envio}
                onChange={e => setForm({ ...form, fecha_envio: e.target.value })}
                className="w-full bg-dark-900 border border-dark-600 rounded-lg px-3 py-2 text-white"
              />
            </div>
            <div className="md:col-span-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.para_nuevos}
                  onChange={e => setForm({ ...form, para_nuevos: e.target.checked })}
                  className="w-4 h-4 accent-green-500"
                />
                <span className="text-white text-sm">🆕 Enviar automáticamente a nuevos clientes al inscribirse</span>
              </label>
              <p className="text-[10px] text-dark-400 mt-1 ml-6">Cuando alguien complete el formulario "Hacete Socio" desde el menú, recibirá esta promo automáticamente</p>
            </div>
          </div>
          <LimitesHorarioCampos
            className="mt-4"
            valor={{ usos_max: form.usos_max, dias_semana: form.dias_semana, hora_desde: form.hora_desde, hora_hasta: form.hora_hasta }}
            onChange={v => setForm({ ...form, ...v })}
          />
          <button
            type="submit"
            className="mt-4 bg-primary-600 hover:bg-primary-500 text-white px-6 py-2 rounded-lg font-bold transition"
          >
            Crear Promoción
          </button>
        </form>
      )}

      {/* Lista de promociones */}
      {promociones.length === 0 ? (
        <div className="bg-dark-800 rounded-xl p-12 border border-dark-700 text-center mb-6">
          <p className="text-dark-400">No hay promociones creadas</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {promociones.map(promo => {
            const agendada = isAgendada(promo)
            const asigsPromo = asignaciones.filter(a => a.promocion_id === promo.id)
            const usadosCount = asigsPromo.filter(a => a.usada).length
            const estado = estadoPromo(promo, usadosCount)
            const ESTADOS = {
              activa: { label: 'Activa', badge: 'bg-green-500/20 text-green-400', borde: 'border-green-500/50' },
              agendada: { label: '⏰ Agendada', badge: 'bg-yellow-500/20 text-yellow-400', borde: 'border-yellow-500/50' },
              agotada: { label: '⛔ Agotada', badge: 'bg-red-500/20 text-red-400', borde: 'border-red-500/50' },
              fuera_de_horario: { label: '🕐 Fuera de horario', badge: 'bg-orange-500/20 text-orange-400', borde: 'border-orange-500/50' }
            }[estado]
            return (
              <div
                key={promo.id + tick}
                className={`bg-dark-800 rounded-xl p-5 border transition ${ESTADOS.borde}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-white font-bold">{promo.titulo}</h3>
                    <div className="flex flex-wrap gap-1 mt-1">
                      <span className="text-xs bg-primary-500/20 text-primary-400 px-2 py-1 rounded">
                        {getTipoLabel(promo.tipo)}
                      </span>
                      {promo.para_nuevos && (
                        <span className="text-xs bg-cyan-500/20 text-cyan-400 px-2 py-1 rounded">
                          🆕 Nuevos clientes
                        </span>
                      )}
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${ESTADOS.badge}`}>
                    {ESTADOS.label}
                  </span>
                </div>

                <p className="text-dark-400 text-sm mb-4">{promo.descripcion}</p>

                <div className="text-xs text-dark-500 mb-4">
                  {promo.categoria && <p>Categoría: {promo.categoria}</p>}
                  {promo.producto_id && (() => {
                    let ids = []
                    try { ids = JSON.parse(promo.producto_id) } catch { ids = [promo.producto_id] }
                    const names = ids.map(id => productos.find(p => p.id === id)?.nombre).filter(Boolean)
                    return names.length > 0 && <p>Producto{names.length > 1 ? 's' : ''}: {names.join(', ')}</p>
                  })()}
                  <p>Asignación: {promo.asignacion === 'todos' ? 'Automática' : 'Manual'}</p>
                  {promo.fecha_envio && (
                    <p>Envío programado: {new Date(promo.fecha_envio).toLocaleString()}</p>
                  )}
                  {asigsPromo.length > 0 && (
                    <p>Canjeadas: {usadosCount} / {asigsPromo.length}</p>
                  )}
                  {tieneLimite(promo) && (
                    <p className={estado === 'agotada' ? 'text-red-400' : 'text-dark-300'}>🔢 Usos: {usadosCount} de {promo.usos_max}{usadosCount < promo.usos_max ? ` (quedan ${promo.usos_max - usadosCount})` : ''}</p>
                  )}
                  {tieneHorario(promo) && <p className="text-dark-300">📅 {textoHorarioPromo(promo)}</p>}
                </div>

                {!soloLectura && (
                <div className="flex gap-2">
                  <button
                    onClick={() => abrirEditor(promo)}
                    className="flex-1 py-2 px-3 bg-primary-500/20 text-primary-300 hover:bg-primary-500/30 rounded-lg text-sm font-medium transition"
                  >
                    ⚙️ Límite y horario
                  </button>
                  <button
                    onClick={() => eliminarPromo(promo.id)}
                    className="flex-1 py-2 px-3 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg text-sm font-medium transition"
                  >
                    🗑️ Eliminar
                  </button>
                </div>
                )}
                {!soloLectura && editandoId === promo.id && (
                  <div className="mt-3">
                    <LimitesHorarioCampos valor={editForm} onChange={setEditForm} />
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => guardarLimites(promo)}
                        disabled={guardandoLimites}
                        className="flex-1 py-2 px-3 bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white rounded-lg text-sm font-bold transition"
                      >
                        {guardandoLimites ? 'Guardando…' : '💾 Guardar'}
                      </button>
                      <button onClick={() => setEditandoId(null)} className="py-2 px-3 bg-dark-700 text-white rounded-lg text-sm transition">Cancelar</button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Clientes interesados - Envío de promos por WhatsApp */}
      <div className="bg-dark-800 rounded-xl p-6 border border-dark-700 mt-8">
        <h3 className="text-white font-bold text-lg mb-1">📣 Enviar Promos por WhatsApp</h3>
        <p className="text-dark-400 text-sm mb-4">
          Clientes que completaron el formulario desde el menú ({clientesForm.length})
        </p>

        {clientesForm.length === 0 ? (
          <p className="text-dark-500 text-sm py-4 text-center">
            Todavía no hay clientes que hayan completado el formulario
          </p>
        ) : (
          <>
            {/* Controles */}
            <div className="flex flex-wrap items-end gap-3 mb-4">
              <div className="flex-1 min-w-[220px]">
                <label className="block text-dark-400 text-sm mb-1">Promoción a enviar *</label>
                <select
                  value={promoSeleccionada}
                  onChange={e => setPromoSeleccionada(e.target.value)}
                  className="w-full bg-dark-900 border border-dark-600 rounded-lg px-3 py-2 text-white"
                >
                  <option value="">Seleccionar promoción</option>
                  {promociones.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.titulo}{isAgendada(p) ? ' (⏰ agendada)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 text-dark-300 text-sm cursor-pointer select-none pb-2">
                <input
                  type="checkbox"
                  checked={todosSeleccionados}
                  onChange={e => toggleTodos(e.target.checked)}
                  className="w-4 h-4 accent-green-500"
                />
                Seleccionar todos
              </label>
              <button
                onClick={enviarPromos}
                disabled={cantidadSeleccionados === 0 || !promoSeleccionada || enviando}
                className="bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-5 py-2 rounded-lg font-bold transition ml-auto"
              >
                {enviando ? 'Enviando...' : `📤 Enviar Promos (${cantidadSeleccionados})`}
              </button>
            </div>

            {/* Lista de clientes */}
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {clientesForm.map(cliente => (
                <div
                  key={cliente.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition ${
                    seleccionados[cliente.id]
                      ? 'bg-green-500/10 border-green-500/40'
                      : 'bg-dark-900 border-dark-700'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={!!seleccionados[cliente.id]}
                    onChange={e => setSeleccionados({ ...seleccionados, [cliente.id]: e.target.checked })}
                    className="w-5 h-5 accent-green-500 cursor-pointer shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">{cliente.nombre || 'Sin nombre'}</p>
                    <p className="text-dark-400 text-xs truncate">
                      📱 {cliente.whatsapp || '-'}
                      {cliente.instagram && <> · 📷 {cliente.instagram}</>}
                      {cliente.created_at && <> · {new Date(cliente.created_at).toLocaleDateString()}</>}
                    </p>
                  </div>
                  <button
                    onClick={() => eliminarSolicitud(cliente.id)}
                    className="text-red-400 hover:text-red-300 text-sm px-2 py-1 rounded transition shrink-0"
                    title="Eliminar cliente"
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Validar codigo de promo cuando el cliente vuelve al local */}
      <div className="bg-dark-800 rounded-xl p-6 border border-dark-700 mt-8">
        <h3 className="text-white font-bold text-lg mb-1">✅ Validar código de promo</h3>
        <p className="text-dark-400 text-sm mb-4">
          Cuando el cliente vuelva y te muestre el código que le llegó por WhatsApp, escribilo acá para canjearlo. Cada código se puede usar una sola vez.
        </p>
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            value={codigoInput}
            onChange={e => setCodigoInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && validarCodigo()}
            placeholder="Ej: PR-4A2C9F"
            className="flex-1 min-w-[200px] bg-dark-900 border border-dark-600 rounded-lg px-3 py-2 text-white uppercase tracking-wider"
          />
          <button
            onClick={validarCodigo}
            disabled={validando}
            className="bg-primary-600 hover:bg-primary-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-5 py-2 rounded-lg font-bold transition"
          >
            {validando ? 'Validando...' : 'Validar y canjear'}
          </button>
        </div>
      </div>
    </div>
  )
}
