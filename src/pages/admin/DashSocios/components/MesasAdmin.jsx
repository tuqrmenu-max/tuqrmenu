import { createRevisionRefresh } from '@/lib/revisionRefresh'
import { startVisiblePolling } from '@/lib/visiblePolling'
import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { QRCodeSVG } from 'qrcode.react'
import { useAuth } from '@/hooks/useAuth'
import ChecklistEstados from './ChecklistEstados'
import ChatEquipo, { ROLE_COLOR } from './ChatEquipo'
import BuscarProductoMesa from './BuscarProductoMesa'
import { MESA_00, esMesa00, etiquetaMesa } from '@/lib/mesa00'
import { esPromoFlag, cantidadCobrada, monto, fmtMonto, desgloseItem, totalesProductos, armarCuerpoTicket, TICKET_W } from '@/lib/ticketFormat'

// Promo 2x1, desglose (subtotal / descuento / delivery / total) y formato de ticket:
// ver src/lib/ticketFormat.js (compartido con Caja para que ticket guardado, impreso y
// reimpreso se vean igual que el mensaje de WhatsApp).

export default function MesasAdmin({ clienteId }) {
  const { user, rol, profile } = useAuth()
  const esVistaOperativa = ['mozo', 'cocina', 'delivery'].includes(rol)
  const [mesas, setMesas] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorLectura, setErrorLectura] = useState('')
  const [itemsPorMesa, setItemsPorMesa] = useState({})
  const [cliente, setCliente] = useState(null)
  const [mesaSeleccionada, setMesaSeleccionada] = useState(null)
  const [detalleMesa, setDetalleMesa] = useState(null)
  const [clientesPorMesa, setClientesPorMesa] = useState({})
  const [pedidosDelivery, setPedidosDelivery] = useState([])
  // Mesa 00: clientes que no se quedan en el local (no es una mesa física, no tiene cuadradito).
  const [pedidosMesa00, setPedidosMesa00] = useState([])
  const [cantidadMesasInput, setCantidadMesasInput] = useState('')
  const [showChat, setShowChat] = useState(false)
  const [avisoChatColor, setAvisoChatColor] = useState(null)
  const [clienteFiltroId, setClienteFiltroId] = useState(null)
  const [itemsCobro, setItemsCobro] = useState([])
  const [cobroPreview, setCobroPreview] = useState(null)
  // Datos que se cargan en el cuadro de cobro y se guardan en tickets_caja:
  // propina, costo de delivery, mozo y repartidor. Son strings para poder
  // editar los inputs numéricos sin saltos.
  const [cobroExtras, setCobroExtras] = useState({ propina: '', delivery: '', mozoId: '', deliveryId: '' })
  const [equipoCobro, setEquipoCobro] = useState({ mozos: [], repartidores: [] })
  const qrRefs = useRef({})
  const ultimoMensajeVistoRef = useRef(null)

  // Aviso de mensaje nuevo con el chat cerrado. Revisa el último mensaje
  // de chat_mensajes cada 5s (mismo enfoque de polling que ya usa
  // ChatEquipo, para no depender de que Realtime esté habilitado) y,
  // como respaldo instantáneo, también escucha el canal de Realtime por
  // si el proyecto lo tiene activo. Si el mensaje no es propio y el chat
  // está cerrado, tiñe el botón con el color del rol de quien escribió.
  const revisarMensajeNuevoChat = useCallback(async () => {
    if (!clienteId) return
    const { data } = await supabase
      .from('chat_mensajes')
      .select('id, autor_user_id, autor_rol')
      .eq('cliente_id', clienteId)
      .order('qr_sequence', { ascending: false }).order('created_at', { ascending: false }).order('id', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!data || data.id === ultimoMensajeVistoRef.current) return
    const esPrimerChequeo = ultimoMensajeVistoRef.current === null
    ultimoMensajeVistoRef.current = data.id
    // No avisar de mensajes viejos al recién cargar la página.
    if (esPrimerChequeo) return
    if (data.autor_user_id && user?.id && data.autor_user_id === user.id) return
    setShowChat(prevOpen => {
      if (!prevOpen) setAvisoChatColor(ROLE_COLOR[data.autor_rol] || 'bg-gray-500')
      return prevOpen
    })
  }, [clienteId, user?.id])

  useEffect(() => {
    if (!clienteId) return
    const stopPolling = startVisiblePolling(revisarMensajeNuevoChat, 30000)
    const channel = supabase
      .channel(`chat-aviso-${clienteId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_mensajes', filter: `cliente_id=eq.${clienteId}` },
        ({ new: nuevo }) => {
          ultimoMensajeVistoRef.current = nuevo.id
          if (nuevo.autor_user_id && user?.id && nuevo.autor_user_id === user.id) return
          setShowChat(prevOpen => {
            if (!prevOpen) setAvisoChatColor(ROLE_COLOR[nuevo.autor_rol] || 'bg-gray-500')
            return prevOpen
          })
        }
      )
      .subscribe()
    return () => { stopPolling(); supabase.removeChannel(channel) }
  }, [clienteId, revisarMensajeNuevoChat])

  // Paleta de colores asignada por índice de comensal, para diferenciar
  // visualmente a cada cliente dentro de una misma mesa.
  const coloresComensal = ['#22d3ee', '#f97316', '#a855f7', '#f43f5e', '#84cc16', '#eab308', '#3b82f6', '#ec4899']
  const getColorComensal = (comensalId) => {
    if (!detalleMesa) return coloresComensal[0]
    const idx = detalleMesa.comensales.findIndex(c => c.id === comensalId)
    return coloresComensal[idx >= 0 ? idx % coloresComensal.length : 0]
  }

  const getColorMesaComensal = (numero, comensalId) => {
    const lista = clientesPorMesa[numero] || []
    const idx = lista.findIndex(c => c.id === comensalId)
    return coloresComensal[idx >= 0 ? idx % coloresComensal.length : 0]
  }

  // Propina cargada por el comensal desde el QR (mesas 1 en adelante; Mesa 0
  // es delivery/retiro y nunca tiene propina). Se guarda a nivel mesa junto
  // con la sesión del comensal que la tocó por última vez, así se la puede
  // pintar del mismo color que sus pedidos en vez de mostrarla "suelta".
  const COLOR_PROPINA_DEFAULT = '#eab308'
  const getColorPropinaMesa = (numero, sesionId) => {
    if (!sesionId) return COLOR_PROPINA_DEFAULT
    const idx = (clientesPorMesa[numero] || []).findIndex(c => c.sesion_id === sesionId)
    return idx >= 0 ? coloresComensal[idx % coloresComensal.length] : COLOR_PROPINA_DEFAULT
  }

  // Arma un "item" de propina para poder mostrarlo junto a los productos en
  // el ticket/preview de cobro y guardarlo en tickets_caja. No es un
  // producto real (no vive en pedidos_qr), por eso va marcado con esPropina:
  // así se lo excluye al marcar pedidos como pagados y no se descuenta del
  // total que se ve en la tarjeta de la mesa (ese sigue siendo solo
  // productos, como corresponde).
  const armarItemPropina = (numero, monto, sesionId) => {
    if (!numero || numero <= 0 || !monto) return null
    return {
      id: `propina-mesa-${numero}`,
      esPropina: true,
      comensal_id: null,
      nombre: 'Propina',
      precio: monto,
      cantidad: 1,
      pagado: false,
      color: getColorPropinaMesa(numero, sesionId)
    }
  }
  const getPropinaMesa = (numero) => {
    if (!numero || numero <= 0) return null
    const mesa = mesas.find(m => m.numero === numero)
    return armarItemPropina(numero, Number(mesa?.propina_monto || 0), mesa?.propina_sesion_id)
  }

  // Lectura directa de la mesa al momento de cobrar/imprimir: el estado
  // `mesas` se actualiza por polling y el detalle abierto es una foto, así
  // que antes de armar el cobro se pide el valor actual a la base. Si la
  // consulta falla, se usa lo que ya está en memoria.
  const leerPropinaFresca = async (numero) => {
    if (!numero || numero <= 0) return null
    const { data, error } = await supabase
      .from('mesas_operacion')
      .select('propina_monto, propina_sesion_id')
      .eq('cliente_id', clienteId)
      .eq('numero', numero)
      .maybeSingle()
    if (error || !data) return getPropinaMesa(numero)
    return armarItemPropina(numero, Number(data.propina_monto || 0), data.propina_sesion_id)
  }

  // Mantiene la propina del detalle abierto al día con el polling: si el
  // comensal la carga o la cambia en el QR con la mesa abierta, se ve sin
  // tener que cerrar y volver a abrir.
  useEffect(() => {
    if (!mesaSeleccionada) return
    setDetalleMesa(prev => {
      if (!prev || prev.numero !== mesaSeleccionada) return prev
      const propina = getPropinaMesa(mesaSeleccionada)
      if ((prev.propina?.precio || 0) === (propina?.precio || 0) && prev.propina?.color === propina?.color) return prev
      const productos = prev.items.filter(i => !i.pagado).reduce((t, i) => t + monto(i), 0)
      return { ...prev, propina, total: productos + (propina?.precio || 0) }
    })
  }, [mesas, clientesPorMesa, mesaSeleccionada])

  // Abre el cuadro de cobro con los valores iniciales de propina/mozo.
  // Si la mesa ya tiene un mozo asignado (elegido desde su tarjeta) se usa
  // ese; si no, y quien cobra es un mozo, queda preseleccionado él mismo.
  const abrirCobro = (preview) => {
    const propinaInicial = Number(preview.items.find(i => i.esPropina)?.precio || 0)
    const mesaAsignada = preview.numero > 0 ? mesas.find(m => m.numero === preview.numero)?.mozo_asignado_id : null
    setCobroExtras({
      propina: propinaInicial > 0 ? String(propinaInicial) : '',
      delivery: '',
      mozoId: mesaAsignada || (rol === 'mozo' && user?.id ? user.id : ''),
      deliveryId: ''
    })
    setCobroPreview(preview)
  }

  // Desglose del cobro en curso: productos + propina (solo mesas 1+) +
  // delivery (solo pedidos Mesa 0 con delivery). `items` es la lista final
  // que se imprime y se guarda en tickets_caja.
  const calcularCobro = () => {
    if (!cobroPreview) return null
    const propinaOrig = cobroPreview.items.find(i => i.esPropina) || null
    const productos = cobroPreview.items.filter(i => !i.esPropina)
    const subtotal = productos.reduce((s, i) => s + monto(i), 0)
    const propina = cobroPreview.numero > 0 ? Math.max(0, Number(cobroExtras.propina) || 0) : 0
    const delivery = cobroPreview.esDelivery ? Math.max(0, Number(cobroExtras.delivery) || 0) : 0
    const items = [...productos]
    if (propina > 0) {
      items.push({ id: `propina-mesa-${cobroPreview.numero}`, esPropina: true, comensal_id: null, nombre: 'Propina', precio: propina, cantidad: 1, pagado: false, color: propinaOrig?.color || COLOR_PROPINA_DEFAULT })
    }
    if (delivery > 0) {
      items.push({ id: `delivery-${cobroPreview.numero}`, esDelivery: true, comensal_id: null, nombre: 'Delivery', precio: delivery, cantidad: 1, pagado: false, color: '#fb923c' })
    }
    // bruto = precio × cantidad entregada; descuento = lo que ahorra la promo 2x1. subtotal sigue
    // siendo lo cobrado por los productos (items_total en Caja): bruto − descuento.
    const { bruto, descuento } = totalesProductos(productos)
    return { propinaOrig, productos, subtotal, bruto, descuento, propina, delivery, items, total: subtotal + propina + delivery }
  }

  // Lista de mozos/repartidores activos del restaurante. Se carga una sola
  // vez (no depende de tener el cobro abierto) porque también la usa el
  // selector de "Mozo" que aparece directo en la tarjeta de cada mesa.
  useEffect(() => {
    if (!clienteId) return
    let alive = true
    ;(async () => {
      const { data, error } = await supabase.rpc('qr_equipo_operativo', { p_cliente_id: clienteId })
      if (alive && !error) {
        const activos = (data || []).filter(u => u.activo)
        setEquipoCobro({ mozos: activos.filter(u => u.rol === 'mozo'), repartidores: activos.filter(u => u.rol === 'delivery') })
      }
      if (alive && error) toast.error('No se pudo cargar la lista de mozos/repartidores: ' + error.message)
    })()
    return () => { alive = false }
  }, [clienteId])

  // Al abrir un cobro: si es delivery, precarga el costo de envío configurado.
  useEffect(() => {
    if (!cobroPreview) return
    let alive = true
    ;(async () => {
      if (cobroPreview.esDelivery) {
        const { data: c } = await supabase.from('clientes').select('delivery').eq('id', clienteId).single()
        const costo = Number(c?.delivery || 0)
        if (alive && costo > 0) setCobroExtras(prev => prev.delivery === '' ? { ...prev, delivery: String(costo) } : prev)
      }
    })()
    return () => { alive = false }
  }, [cobroPreview])

  // Guarda en la mesa qué mozo quedó a cargo (elegido directo desde la
  // tarjeta). Al cobrar esa mesa, el cuadro de cobro lo precarga solo.
  const asignarMozoMesa = async (numero, mozoId) => {
    setMesas(prev => prev.map(m => m.numero === numero ? { ...m, mozo_asignado_id: mozoId || null } : m))
    const { error } = await supabase
      .from('mesas_operacion')
      .update({ mozo_asignado_id: mozoId || null })
      .eq('cliente_id', clienteId)
      .eq('numero', numero)
    if (error) toast.error('No se pudo guardar el mozo: ' + error.message)
  }


  const pedidoEntregadoMesa = (numero, comensalId) => {
    const comensal = (clientesPorMesa[numero] || []).find(c => c.id === comensalId)
    return ['entregado', 'cerrado'].includes(comensal?.estado_pedido)
  }

  // El superadmin siempre puede eliminar mesas (es quien administra el check).
  // El socio (rol 'admin') puede eliminarlas salvo que el superadmin haya
  // marcado "ocultar_eliminar_mesa" para su restaurante.
  // Acciones puntuales dentro de Mesas configurables por rol desde
  // Usuarios > Permisos (permisos_mesas_acciones). Admin/Superadmin
  // siempre las tienen todas; mozo/cajero/cocina dependen del check.
  const tienePermisoMesaAccion = (accionId) =>
    (cliente?.permisos_mesas_acciones?.[rol] || []).includes(accionId)
  const puedeAgregarMesa = rol === 'superadmin' || rol === 'admin' || tienePermisoMesaAccion('agregar_mesa')
  const puedeVerChatMesas = rol === 'superadmin' || rol === 'admin' || tienePermisoMesaAccion('chat')
  const puedeDescargarQR = rol === 'superadmin' || rol === 'admin' || tienePermisoMesaAccion('descargar_qr')
  const puedeEliminarMesas = rol === 'superadmin' || (rol === 'admin' && !cliente?.ocultar_eliminar_mesa) || tienePermisoMesaAccion('borrar_mesa')

  useEffect(() => {
    if (clienteId) {
      fetchCliente()
      let active = true
      const check = createRevisionRefresh(async () => {
        const { data, error } = await supabase.from('clientes').select('qr_operations_version').eq('id', clienteId).single()
        if (error) throw error
        return data?.qr_operations_version
      }, async () => { await Promise.all([fetchMesas(), fetchPedidosDelivery()]) })
      const stop = startVisiblePolling(async () => {
        try { await check(); if (active) setErrorLectura('') }
        catch (e) { if (active) setErrorLectura('No se pudo actualizar Mesas: ' + e.message) }
        finally { if (active) setLoading(false) }
      }, 5000)
      return () => { active = false; stop() }
    }
  }, [clienteId])

  useEffect(() => {
    if (mesaSeleccionada) {
      fetchDetalleMesa(mesaSeleccionada)
    }
  }, [mesaSeleccionada])

  const fetchCliente = async () => {
    const { data, error } = await supabase
      .from('clientes')
      .select('id, user_id, menu_url, nombre_restaurante, ocultar_eliminar_mesa, permisos_mesas_acciones, delivery')
      .eq('id', clienteId)
      .single()
    if (error) console.error('Error fetching cliente:', error)
    if (data) setCliente(data)
  }

  // Check exclusivo del superadmin: oculta el botón "Eliminar mesa" para
  // el socio dueño de este restaurante, sin afectar al propio superadmin.
  const toggleOcultarEliminarMesa = async () => {
    const value = !cliente?.ocultar_eliminar_mesa
    setCliente(prev => ({ ...prev, ocultar_eliminar_mesa: value }))
    const { error } = await supabase
      .from('clientes')
      .update({ ocultar_eliminar_mesa: value })
      .eq('id', clienteId)
    if (error) {
      toast.error('Error: ' + error.message)
      setCliente(prev => ({ ...prev, ocultar_eliminar_mesa: !value }))
    } else {
      toast.success(value ? 'Botón "Eliminar mesa" suspendido para este socio' : 'Botón "Eliminar mesa" habilitado para este socio')
    }
  }

  // Visibilidad individual: cada cliente/comensal controla su propio checklist
  // en la tarjeta y en el QR que corresponde a su sesión.
  const toggleOcultarChecklistComensal = async (comensal) => {
    const value = !comensal.ocultar_checklist
    const { error } = await supabase
      .from('comensales')
      .update({ ocultar_checklist: value })
      .eq('id', comensal.id)
    if (error) {
      toast.error('Error: ' + error.message)
    } else {
      toast.success(value ? 'Checklist oculto para este cliente' : 'Checklist visible para este cliente')
      fetchMesas().catch(e => setErrorLectura(e.message))
      fetchPedidosDelivery().catch(e => setErrorLectura(e.message))
    }
  }

  const fetchMesas = async () => {
    const { data, error } = await supabase
      .from('mesas_operacion')
      .select('*')
      .eq('cliente_id', clienteId)
      .order('numero')

    if (error) throw error
    if (data) {
      setMesas(data)
      await fetchDatosMesas(data)
    }
  }

  // Antes esto eran 2 funciones separadas que hacían una consulta POR MESA
  // cada una (patrón N+1): con 3 mesas, hasta 10 requests por ciclo de
  // polling de 5s. Ahora son solo 2 consultas en total, sin importar
  // cuántas mesas haya: una trae todos los comensales de todas las mesas
  // de una vez (.in('mesa', numeros)), la otra todos los pedidos
  // pendientes de esos comensales de una vez (.in('comensal_id', ids)).
  // Se agrupan en el cliente (JS) por número de mesa.
  const fetchDatosMesas = async (mesasData) => {
    const numeros = mesasData.map(m => m.numero)
    if (numeros.length === 0) {
      setClientesPorMesa({})
      setItemsPorMesa({})
      return
    }

    const { data: comensales, error: comensalesError } = await supabase
      .from('comensales')
      .select('id, mesa, nombre, sesion_id, estado_pedido, derivado_area, metodo_entrega, preparado_at, entregado_at, cerrado_at, comentario_cliente, ocultar_checklist')
      .eq('cliente_id', clienteId)
      .in('mesa', numeros)
      .or('estado_pedido.is.null,estado_pedido.neq.cerrado')

    if (comensalesError) throw comensalesError
    const clientes = {}
    numeros.forEach(n => { clientes[n] = [] })
    ;(comensales || []).forEach(c => {
      if (!clientes[c.mesa]) clientes[c.mesa] = []
      clientes[c.mesa].push(c)
    })
    setClientesPorMesa(clientes)

    const comensalIds = (comensales || []).map(c => c.id)
    const items = {}
    if (comensalIds.length > 0) {
      const { data: pedidos, error: pedidosError } = await supabase
        .from('pedidos_qr')
        .select('comensal_id, cantidad, es_promo, productos!inner(nombre, precio)')
        .in('comensal_id', comensalIds)
        .eq('pagado', 0)

      if (pedidosError) throw pedidosError
      const mesaPorComensal = {}
      ;(comensales || []).forEach(c => { mesaPorComensal[c.id] = c.mesa })

      ;(pedidos || []).forEach(p => {
        const mesaNum = mesaPorComensal[p.comensal_id]
        if (mesaNum === undefined) return
        if (!items[mesaNum]) items[mesaNum] = []
        items[mesaNum].push({
          comensal_id: p.comensal_id,
          nombre: p.productos?.nombre,
          precio: p.productos?.precio || 0,
          cantidad: p.cantidad,
          es_promo: p.es_promo
        })
      })
    }
    setItemsPorMesa(items)
  }

  // Pedidos de delivery/retiro (mesa 0, sin QR de mesa física, hechos por
  // WhatsApp). Cada uno es un cliente distinto identificado por nombre +
  // teléfono, con su propio código, así que se muestran como una lista de
  // pedidos individuales en vez de una única mesa con un total conjunto.
  // Estados visibles aqui: nuevo / en_preparacion / preparado / entregado.
  // Los cerrados quedan disponibles en Caja, sin consultarlos desde Mesas.
  const fetchPedidosDelivery = async () => {
    fetchPedidosMesa00().catch(e => setErrorLectura(e.message))
    const { data: comensales, error: comensalesError } = await supabase
      .from('comensales')
      .select('id, mesa, nombre, telefono, direccion, codigo_pedido, estado_pedido, derivado_area, metodo_entrega, preparado_at, entregado_at, cerrado_at, comentario_cliente, ocultar_checklist')
      .eq('cliente_id', clienteId)
      .eq('mesa', 0)
      .in('estado_pedido', ['nuevo', 'en_preparacion', 'preparado', 'en_delivery', 'entregado'])
      .order('id', { ascending: true })

    if (comensalesError) throw comensalesError
    if (!comensales || comensales.length === 0) { setPedidosDelivery([]); return }

    // Reemplaza códigos aleatorios heredados (por ejemplo P3RNJ62) en los
    // pedidos activos de Mesa 0. El código nuevo queda persistido y se sigue
    // mostrando exactamente en la cabecera de la misma tarjeta.
    const comensalesNormalizados = [...comensales]
    if (['superadmin', 'admin', 'cajero'].includes(rol)) {
      for (let i = 0; i < comensalesNormalizados.length; i++) {
        const actual = String(comensalesNormalizados[i].codigo_pedido || '')
        if (/^\d{8}-\d{2,}-M0$/.test(actual)) continue
        const { data: codigoNuevo } = await supabase.rpc('generar_codigo_pedido', {
          p_cliente_id: clienteId,
          p_mesa: 0
        })
        if (!codigoNuevo) continue
        const { error: codigoUpdateError } = await supabase
          .from('comensales')
          .update({ codigo_pedido: codigoNuevo })
          .eq('id', comensalesNormalizados[i].id)
        if (!codigoUpdateError) comensalesNormalizados[i] = { ...comensalesNormalizados[i], codigo_pedido: codigoNuevo }
      }
    }

    const comensalIds = comensalesNormalizados.map(c => c.id)
    const { data: pedidos, error: pedidosError } = await supabase
      .from('pedidos_qr')
      .select('id, comensal_id, cantidad, pagado, es_promo, productos!inner(nombre, precio)')
      .in('comensal_id', comensalIds)
      .eq('pagado', 0)

    if (pedidosError) throw pedidosError
    const itemsPorComensal = {}
    ;(pedidos || []).forEach(p => {
      if (!itemsPorComensal[p.comensal_id]) itemsPorComensal[p.comensal_id] = []
      itemsPorComensal[p.comensal_id].push({
        id: p.id,
        comensal_id: p.comensal_id,
        nombre: p.productos?.nombre,
        precio: p.productos?.precio || 0,
        cantidad: p.cantidad,
        pagado: p.pagado,
        es_promo: p.es_promo
      })
    })

    setPedidosDelivery(comensalesNormalizados.map(c => {
      const items = itemsPorComensal[c.id] || []
      return { ...c, items, total: items.reduce((s, i) => s + monto(i), 0) }
    }))
  }

  // Pedidos de Mesa 00 (mesa = -1 en la base): cada uno es un cliente/pedido independiente, igual que
  // en Mesa 0, pero no pasan por WhatsApp (vienen del link ?mesa=00 o de "Buscar producto").
  // Se listan aparte y se cobran con el mismo cuadro de cobro; el ticket queda en Caja como Mesa 00.
  const fetchPedidosMesa00 = async () => {
    const { data: comensales, error: comensalesError } = await supabase
      .from('comensales')
      .select('id, mesa, nombre, telefono, direccion, codigo_pedido, estado_pedido, derivado_area, metodo_entrega, preparado_at, entregado_at, cerrado_at, comentario_cliente, ocultar_checklist')
      .eq('cliente_id', clienteId)
      .eq('mesa', MESA_00)
      .in('estado_pedido', ['nuevo', 'en_preparacion', 'preparado', 'en_delivery', 'entregado'])
      .order('id', { ascending: true })

    if (comensalesError) throw comensalesError
    if (!comensales || comensales.length === 0) { setPedidosMesa00([]); return }

    const { data: pedidos, error: pedidosError } = await supabase
      .from('pedidos_qr')
      .select('id, comensal_id, cantidad, pagado, es_promo, productos!inner(nombre, precio)')
      .in('comensal_id', comensales.map(c => c.id))
      .eq('pagado', 0)

    if (pedidosError) throw pedidosError
    const itemsPorComensal = {}
    ;(pedidos || []).forEach(p => {
      if (!itemsPorComensal[p.comensal_id]) itemsPorComensal[p.comensal_id] = []
      itemsPorComensal[p.comensal_id].push({
        id: p.id,
        comensal_id: p.comensal_id,
        nombre: p.productos?.nombre,
        precio: p.productos?.precio || 0,
        cantidad: p.cantidad,
        pagado: p.pagado,
        es_promo: p.es_promo
      })
    })

    setPedidosMesa00(comensales.map(c => {
      const items = itemsPorComensal[c.id] || []
      return { ...c, items, total: items.reduce((s, i) => s + monto(i), 0) }
    }))
  }

  // Caja/admin elige quién prepara el pedido: mozo o cocina.
  // Pasa a 'en_preparacion' (check amarillo listo) y guarda derivado_area.
  const derivarPedido = async (comensalId, area) => {
    const { error } = await supabase
      .from('comensales')
      .update({ derivado_area: area, estado_pedido: 'en_preparacion' })
      .eq('id', comensalId)
    if (error) { toast.error('Error al derivar: ' + error.message); return }
    toast.success(area === 'cocina' ? 'Derivado a Cocina' : 'Derivado a Mozo')
    fetchPedidosDelivery().catch(e => setErrorLectura(e.message))
    fetchMesas().catch(e => setErrorLectura(e.message))
  }

  // Mantener handler viejo por compatibilidad si algo lo llama aún.
  // Marca como preparado (check azul).
  const marcarListoMozo = async (comensalId) => {
    const { error } = await supabase
      .from('comensales')
      .update({ estado_pedido: 'preparado', preparado_at: new Date().toISOString() })
      .eq('id', comensalId)
    if (error) { toast.error('Error: ' + error.message); return }
    toast.success('Pedido preparado')
    fetchPedidosDelivery().catch(e => setErrorLectura(e.message))
    fetchMesas().catch(e => setErrorLectura(e.message))
  }

  // Caja despacha el pedido ya preparado (delivery o retiro).
  // Pasa a 'entregado' (check morado) y guarda metodo_entrega + timestamp.
  // NO marca pagado=1: eso lo hace el check verde al cerrar.
  const despacharPedido = async (comensalId, metodo) => {
    const { error } = await supabase
      .from('comensales')
      .update({
        estado_pedido: 'entregado',
        metodo_entrega: metodo,
        entregado_at: new Date().toISOString()
      })
      .eq('id', comensalId)
    if (error) { toast.error('Error al despachar: ' + error.message); return }
    toast.success(metodo === 'delivery' ? 'Enviado a delivery' : 'Listo para retirar')
    fetchPedidosDelivery().catch(e => setErrorLectura(e.message))
    fetchMesas().catch(e => setErrorLectura(e.message))
  }

  // Cierra el pedido: check verde, marca pagado=1 y guarda comentario.
  // El comentario se pide via prompt en ChecklistEstados; acá se ejecuta
  // el UPDATE completo en una sola pasada.
  const cerrarPedido = async (comensalId, comentario) => {
    const { error: e1 } = await supabase
      .from('pedidos_qr')
      .update({ pagado: 1 })
      .eq('comensal_id', comensalId)
      .eq('pagado', 0)
    if (e1) { toast.error('Error cerrando pedidos: ' + e1.message); return }
    const { error: e2 } = await supabase
      .from('comensales')
      .update({
        estado_pedido: 'cerrado',
        cerrado_at: new Date().toISOString(),
        comentario_cliente: comentario || null
      })
      .eq('id', comensalId)
    if (e2) { toast.error('Error cerrando comensal: ' + e2.message); return }
    toast.success('Pedido cerrado y archivado')
    fetchPedidosDelivery().catch(e => setErrorLectura(e.message))
    fetchMesas().catch(e => setErrorLectura(e.message))
  }

  const fetchDetalleMesa = async (numero) => {
    const comensales = clientesPorMesa[numero] || []
    const propina = getPropinaMesa(numero)
    if (comensales.length === 0) {
      setDetalleMesa({ numero, items: [], comensales: [], total: propina?.precio || 0, propina })
      return
    }

    const comensalIds = comensales.map(c => c.id)
    const { data: pedidos, error: pedidosError } = await supabase
      .from('pedidos_qr')
      .select('id, comensal_id, cantidad, pagado, es_promo, comensales!inner(nombre), productos!inner(nombre, precio)')
      .in('comensal_id', comensalIds)
      .order('fecha_hora', { ascending: false })

    if (pedidosError) { toast.error(pedidosError.message); return }
    const items = pedidos?.map(p => ({
      id: p.id,
      comensal_id: p.comensal_id,
      nombre: p.productos?.nombre,
      precio: p.productos?.precio || 0,
      cantidad: p.cantidad,
      pagado: p.pagado,
      es_promo: p.es_promo,
      comensal: p.comensales?.nombre || 'Sin nombre'
    })) || []

    const total = items.filter(i => !i.pagado).reduce((s, i) => s + monto(i), 0) + (propina?.precio || 0)

    setDetalleMesa({ numero, items, comensales, total, propina })
  }

  const calcularTotalMesa = (numero) => {
    const items = itemsPorMesa[numero] || []
    return items.reduce((s, i) => s + monto(i), 0)
  }

  const agregarMesa = async () => {
    const nuevaMesa = mesas.length > 0 ? Math.max(...mesas.map(m => m.numero)) + 1 : 1
    const { error } = await supabase
      .from('mesas_operacion')
      .insert({ cliente_id: clienteId, numero: nuevaMesa, estado: 'Libre', total: 0 })

    if (!error) {
      toast.success(`Mesa ${nuevaMesa} agregada`)
      fetchMesas().catch(e => setErrorLectura(e.message))
    }
  }

  const eliminarMesa = async (numero) => {
    if (!puedeEliminarMesas) {
      toast.error('No tenés permiso para eliminar mesas')
      return
    }
    if (!confirm(`¿Eliminar Mesa N° ${numero}?`)) return
    const { error } = await supabase
      .from('mesas_operacion')
      .delete()
      .eq('cliente_id', clienteId)
      .eq('numero', numero)

    if (!error) {
      toast.success(`Mesa ${numero} eliminada`)
      fetchMesas().catch(e => setErrorLectura(e.message))
    }
  }

  // Igual que agregarMesa/eliminarMesa pero de una: el socio escribe la
  // cantidad total de mesas que quiere tener y esto agrega o borra las que
  // falten/sobren para llegar a ese número. No reemplaza los botones +/-,
  // se suma como otra forma de hacer lo mismo.
  const setCantidadMesas = async (valor) => {
    const objetivo = parseInt(valor, 10)
    if (!Number.isFinite(objetivo) || objetivo < 0) {
      toast.error('Ingresá un número de mesas válido')
      return
    }
    const actual = mesas.length
    if (objetivo === actual) {
      setCantidadMesasInput('')
      return
    }

    if (objetivo > actual) {
      if (!puedeAgregarMesa) {
        toast.error('No tenés permiso para agregar mesas')
        return
      }
      let siguiente = mesas.length > 0 ? Math.max(...mesas.map(m => m.numero)) : 0
      const nuevas = []
      for (let i = 0; i < objetivo - actual; i++) {
        siguiente += 1
        nuevas.push({ cliente_id: clienteId, numero: siguiente, estado: 'Libre', total: 0 })
      }
      const { error } = await supabase.from('mesas_operacion').insert(nuevas)
      if (!error) {
        toast.success(`Se agregaron ${nuevas.length} mesa${nuevas.length === 1 ? '' : 's'}`)
        fetchMesas().catch(e => setErrorLectura(e.message))
      } else {
        toast.error('Error al agregar mesas: ' + error.message)
      }
    } else {
      if (!puedeEliminarMesas) {
        toast.error('No tenés permiso para eliminar mesas')
        return
      }
      const aBorrar = actual - objetivo
      const numerosABorrar = [...mesas]
        .sort((a, b) => b.numero - a.numero)
        .slice(0, aBorrar)
        .map(m => m.numero)
      const listado = numerosABorrar.slice().sort((a, b) => a - b).join(', ')
      if (!confirm(`¿Eliminar ${aBorrar} mesa${aBorrar === 1 ? '' : 's'} (N° ${listado})?`)) return
      const { error } = await supabase
        .from('mesas_operacion')
        .delete()
        .eq('cliente_id', clienteId)
        .in('numero', numerosABorrar)
      if (!error) {
        toast.success(`Se eliminaron ${aBorrar} mesa${aBorrar === 1 ? '' : 's'}`)
        fetchMesas().catch(e => setErrorLectura(e.message))
      } else {
        toast.error('Error al eliminar mesas: ' + error.message)
      }
    }
    setCantidadMesasInput('')
  }

  const atenderMozo = async (numero, e) => {
    e.stopPropagation()
    const { error } = await supabase
      .from('mesas_operacion')
      .update({ estado: 'Ocupada' })
      .eq('cliente_id', clienteId)
      .eq('numero', numero)
      .eq('estado', 'Pendiente')

    if (!error) {
      toast.success(`Mesa ${numero} atendida`)
      fetchMesas().catch(e => setErrorLectura(e.message))
    }
  }

  // Abre el mismo cartel de "Imprimir / Confirmar / Cancelar" pero tomando
  // TODOS los pedidos pendientes de la mesa (ignora la selección de
  // checks puntuales), para cerrar la mesa completa.
  const abrirPreviewCierre = async () => {
    if (!detalleMesa) return
    const pendientes = detalleMesa.items.filter(i => !i.pagado)
    const propina = await leerPropinaFresca(detalleMesa.numero)
    const total = pendientes.reduce((s, i) => s + monto(i), 0) + (propina?.precio || 0)
    abrirCobro({ numero: detalleMesa.numero, items: propina ? [...pendientes, propina] : pendientes, total, cierre: true })
  }

  // Selección de productos a cobrar (uno o varios comensales, o la mesa
  // completa). El check vive en cada fila de producto; togglea su id
  // dentro de la lista de seleccionados.
  const toggleItemCobro = (itemId) => {
    setItemsCobro(prev => prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId])
  }

  // Abre la vista previa del ticket con lo que se va a cobrar. Si no se
  // marcó ningún check puntual, se toma como "cobrar todo lo pendiente"
  // (comportamiento de toda la vida), para no romper el flujo simple.
  const abrirPreviewCobro = async () => {
    if (!detalleMesa) return
    const pendientes = detalleMesa.items.filter(i => !i.pagado)
    const seleccionados = itemsCobro.length > 0
      ? pendientes.filter(i => itemsCobro.includes(i.id))
      : pendientes
    const propina = await leerPropinaFresca(detalleMesa.numero)

    if (seleccionados.length === 0 && !propina) {
      toast.error('No hay productos para cobrar')
      return
    }

    const total = seleccionados.reduce((s, i) => s + monto(i), 0) + (propina?.precio || 0)
    abrirCobro({ numero: detalleMesa.numero, items: propina ? [...seleccionados, propina] : seleccionados, total })
  }

  // Botón Cobrar de la tarjeta: carga todos los pedidos pendientes de esa
  // mesa y abre directamente las opciones Imprimir / Cobrar / Cancelar.
  const abrirCobroDesdeTarjeta = async (numero) => {
    const { data: comensales, error: comensalesError } = await supabase
      .from('comensales')
      .select('id')
      .eq('cliente_id', clienteId)
      .eq('mesa', numero)

    if (comensalesError) { toast.error(comensalesError.message); return }
    const ids = (comensales || []).map(c => c.id)
    const propina = await leerPropinaFresca(numero)
    if (ids.length === 0) {
      if (!propina) {
        toast.error('No hay pedidos para cobrar')
        return
      }
      abrirCobro({ numero, items: [propina], total: propina.precio })
      return
    }

    const { data: pedidos, error } = await supabase
      .from('pedidos_qr')
      .select('id, comensal_id, cantidad, pagado, es_promo, productos!inner(nombre, precio)')
      .in('comensal_id', ids)
      .eq('pagado', 0)

    if (error) {
      toast.error('Error al cargar el cobro: ' + error.message)
      return
    }

    const items = (pedidos || []).map(p => ({
      id: p.id,
      comensal_id: p.comensal_id,
      nombre: p.productos?.nombre,
      precio: p.productos?.precio || 0,
      cantidad: p.cantidad,
      pagado: p.pagado,
      es_promo: p.es_promo
    }))
    if (items.length === 0 && !propina) {
      toast.error('No hay pedidos para cobrar')
      return
    }
    const total = items.reduce((s, i) => s + monto(i), 0) + (propina?.precio || 0)
    abrirCobro({ numero, items: propina ? [...items, propina] : items, total })
  }

  // Mesa 0 contiene pedidos independientes. Abre el mismo cuadro de cobro,
  // pero solo con los productos del pedido seleccionado.
  const abrirCobroPedidoMesa0 = (pedido) => {
    if (!pedido.items?.length) {
      // Pedido sin productos: no hay nada que cobrar, pero se puede cerrar
      // para que no quede abierto para siempre (no genera ticket en Caja).
      if (confirm('Este pedido no tiene productos. ¿Cerrarlo?')) cerrarPedido(pedido.id, '')
      return
    }
    abrirCobro({ numero: esMesa00(pedido.mesa) ? MESA_00 : 0, items: pedido.items, total: pedido.total, codigoPedido: pedido.codigo_pedido, esDelivery: pedido.metodo_entrega === 'delivery' })
  }

  const imprimirTicketCobro = async () => {
    if (!cobroPreview) return
    const calc = calcularCobro()
    const clientesInvolucrados = new Set(calc.items.map(i => i.comensal_id)).size
    const { texto, fontSize } = await generarTicketTexto(cobroPreview.numero, calc.items, calc.total, clientesInvolucrados)
    abrirVentanaTicket(cobroPreview.numero, texto, fontSize)
    await confirmarCobro({ impreso: true })
  }

  // Confirma el cobro: marca SOLO los pedidos seleccionados como pagados
  // en Supabase. Si quedan pedidos pendientes de otros comensales, la mesa
  // sigue abierta (Ocupada) con el resto de la cuenta; si no queda nada
  // pendiente, la mesa se libera.
  const confirmarCobro = async ({ impreso = false } = {}) => {
    if (!cobroPreview) return
    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData?.user) {
      toast.error('No se pudo verificar el usuario del cobro. Volvé a iniciar sesión.')
      return
    }
    const usuarioCobro = authData.user
    const perfilCobro = profile?.user_id === usuarioCobro.id ? profile : null
    const cobradoPor = {
      user_id: usuarioCobro.id,
      nombre: perfilCobro?.nombre || perfilCobro?.usuario || usuarioCobro.email || usuarioCobro.id,
      usuario: perfilCobro?.usuario || usuarioCobro.email || ''
    }
    // La propina y el delivery no son pedidos reales (no existen en
    // pedidos_qr), así que se excluyen de los ids que se marcan como pagados.
    const calc = calcularCobro()
    const propinaItem = calc.propinaOrig
    const ids = calc.productos.map(i => i.id)
    const redondear = n => Math.round(n * 100) / 100

    // Mozo (mesas 1+) y repartidor (delivery Mesa 0) elegidos en el cuadro.
    const nombreDe = (lista, id) => {
      if (!id) return null
      const u = lista.find(x => x.user_id === id)
      if (u) return u.nombre || u.usuario
      return id === user?.id ? (profile?.nombre || profile?.usuario || null) : null
    }
    const mozoId = cobroPreview.numero > 0 && cobroExtras.mozoId ? cobroExtras.mozoId : null
    const repartidorId = cobroPreview.esDelivery && cobroExtras.deliveryId ? cobroExtras.deliveryId : null

    // Guardar primero el ticket completo. Si falla, no se marca nada como
    // pagado para impedir que una venta desaparezca sin llegar a Caja.
    let codigoTicket = cobroPreview.codigoPedido
    if (!codigoTicket) {
      const { data: codigoGenerado, error: codigoError } = await supabase.rpc('generar_codigo_pedido', {
        p_cliente_id: clienteId,
        p_mesa: cobroPreview.numero
      })
      if (codigoError || !codigoGenerado) {
        toast.error('No se pudo generar el código del ticket: ' + (codigoError?.message || 'respuesta vacía'))
        return
      }
      codigoTicket = codigoGenerado
    }
    const referenciaCobro = 'pedidos:' + [...ids].sort().join(',')
    const { error: ticketError } = await supabase
      .from('tickets_caja')
      .insert({
        cliente_id: clienteId,
        mesa: cobroPreview.numero,
        codigo_pedido: codigoTicket,
        referencia_cobro: referenciaCobro,
        cobrado_por: cobradoPor,
        total: redondear(calc.total),
        items_total: redondear(calc.subtotal),
        propina_monto: redondear(calc.propina),
        delivery_monto: redondear(calc.delivery),
        es_delivery: !!cobroPreview.esDelivery,
        mozo_id: mozoId,
        mozo_nombre: nombreDe(equipoCobro.mozos, mozoId),
        delivery_user_id: repartidorId,
        delivery_nombre: nombreDe(equipoCobro.repartidores, repartidorId),
        impreso,
        items: calc.items.map(i => i.esPropina ? {
          tipo: 'propina',
          pedido_id: null,
          comensal_id: null,
          nombre: 'Propina',
          cantidad: 1,
          precio: i.precio,
          subtotal: i.precio
        } : i.esDelivery ? {
          tipo: 'delivery',
          pedido_id: null,
          comensal_id: null,
          nombre: 'Delivery',
          cantidad: 1,
          precio: i.precio,
          subtotal: i.precio
        } : {
          pedido_id: i.id,
          comensal_id: i.comensal_id,
          nombre: i.producto || i.nombre,
          cantidad: i.cantidad,
          precio: i.precio,
          subtotal: monto(i),
          subtotal_bruto: desgloseItem(i).bruto,
          descuento: desgloseItem(i).descuento,
          ...(esPromoFlag(i.es_promo) ? { promo: desgloseItem(i).descuento > 0 ? '2x1' : 'promo', cantidad_cobrada: cantidadCobrada(i) } : {})
        })
      })

    if (ticketError && ticketError.code !== '23505') {
      toast.error('No se pudo guardar el ticket en Caja: ' + ticketError.message)
      return
    }

    if (ids.length > 0) {
      const { error } = await supabase
        .from('pedidos_qr')
        .update({ pagado: 1 })
        .in('id', ids)

      if (error) {
        toast.error('Error al cobrar: ' + error.message)
        return
      }
    }

    // Solo Cobrar (también ejecutado después de Imprimir) cierra la cuenta.
    // Esto incluye el pedido individual de mesa 0; el check verde no cobra.
    // (la propina no tiene comensal_id real, se descarta acá)
    const comensalesCobrados = [...new Set(cobroPreview.items.map(i => i.comensal_id).filter(Boolean))]
    await Promise.all(comensalesCobrados.map(async comensalId => {
      const { count } = await supabase
        .from('pedidos_qr')
        .select('id', { count: 'exact', head: true })
        .eq('comensal_id', comensalId)
        .eq('pagado', 0)
      if (count === 0) {
        await supabase
          .from('comensales')
          .update({ estado_pedido: 'cerrado', cerrado_at: new Date().toISOString() })
          .eq('id', comensalId)
      }
    }))

    const numero = cobroPreview.numero
    const comensales = clientesPorMesa[numero] || []
    let nuevoTotal = 0
    if (comensales.length > 0) {
      const comensalIds = comensales.map(c => c.id)
      const { data: restantes } = await supabase
        .from('pedidos_qr')
        .select('cantidad, es_promo, productos!inner(precio)')
        .in('comensal_id', comensalIds)
        .eq('pagado', 0)
      nuevoTotal = (restantes || []).reduce((s, p) => s + monto({ precio: p.productos?.precio, cantidad: p.cantidad, es_promo: p.es_promo }), 0)
    }

    // "Cerrar Mesa" siempre libera la mesa, aunque en teoría no debería
    // quedar pendiente nada (se tomaron todos los pedidos al abrir el
    // cartel). Un cobro parcial normal solo libera si no queda nada.
    const cerrarDeTodasFormas = cobroPreview.cierre
    const estadoFinal = cerrarDeTodasFormas || nuevoTotal === 0 ? 'Libre' : 'Ocupada'
    const totalFinal = cerrarDeTodasFormas ? 0 : nuevoTotal

    // Si esta cobranza incluyó la propina, se resetea en la mesa para que
    // no se vuelva a cobrar en una próxima cuenta parcial de la misma mesa.
    const updateMesa = { total: totalFinal, estado: estadoFinal }
    if (propinaItem) { updateMesa.propina_monto = 0; updateMesa.propina_sesion_id = null }

    await supabase
      .from('mesas_operacion')
      .update(updateMesa)
      .eq('cliente_id', clienteId)
      .eq('numero', numero)

    toast.success(cobroPreview.cierre ? `Mesa ${numero} cerrada` : `Cobrado: $${calc.total.toFixed(2)}`)
    setCobroPreview(null)
    setItemsCobro([])

    if (estadoFinal === 'Libre') {
      setMesaSeleccionada(null)
      setDetalleMesa(null)
    } else {
      fetchDetalleMesa(numero)
    }
    fetchMesas().catch(e => setErrorLectura(e.message))
    if (numero <= 0) {
      fetchPedidosDelivery().catch(e => setErrorLectura(e.message))
      }
  }

  const cerrarCliente = async (comensalId, mesaNumero) => {
    if (!confirm('¿Cerrar este cliente? Sus pedidos pendientes se marcarán como pagados.')) return

    await supabase
      .from('pedidos_qr')
      .update({ pagado: 1 })
      .eq('comensal_id', comensalId)
      .eq('pagado', 0)

    await supabase
      .from('comensales')
      .delete()
      .eq('id', comensalId)

    toast.success('Cliente cerrado')
    fetchMesas().catch(e => setErrorLectura(e.message))
    fetchDetalleMesa(mesaNumero)
  }

  const generarTicketTexto = async (numero, items, total, clientesCount) => {
    const ahora = new Date()
    const fecha = ahora.toLocaleDateString('es-AR')
    const hora = ahora.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })

    const { data: clienteData } = await supabase
      .from('clientes')
      .select('ticket_config, nombre_restaurante')
      .eq('id', clienteId)
      .single()

    const tc = clienteData?.ticket_config || {}
    const separador = '━'.repeat(TICKET_W)

    const lines = []
    lines.push(separador)
    if (tc.showName !== false) lines.push('   ' + (clienteData?.nombre_restaurante || 'Restaurante'))
    if (tc.showMesa !== false) lines.push('   Mesa N° ' + etiquetaMesa(numero))
    if (tc.showFecha !== false) lines.push('   ' + fecha)
    if (tc.showHora !== false) lines.push('   ' + hora)
    if (tc.showAddress !== false && cliente?.direccion) lines.push('   ' + cliente.direccion)
    if (tc.showPhone !== false && cliente?.telefono) lines.push('   Tel: ' + cliente.telefono)
    if (tc.showCuit && tc.cuit) lines.push('   CUIT: ' + tc.cuit)
    lines.push(separador)

    // Propina y delivery no son productos: van en su propia línea (siempre visibles, aunque el
    // detalle esté oculto en la config del ticket) y no entran en el Subtotal.
    // Orden = mensaje de WhatsApp: producto/cantidad/promo, Subtotal, Descuento promo 2x1,
    // Delivery, Propina y TOTAL, con los importes alineados a la derecha.
    const propinaTicket = items.filter(i => i.esPropina).reduce((s, i) => s + monto(i), 0)
    const deliveryTicket = items.filter(i => i.esDelivery).reduce((s, i) => s + monto(i), 0)
    const itemsTicket = items.filter(i => !i.esPropina && !i.esDelivery)

    lines.push(...armarCuerpoTicket({ productos: itemsTicket, delivery: deliveryTicket, propina: propinaTicket, total, tc, sep: separador }))
    lines.push(separador)
    if (clientesCount != null) lines.push('   Clientes: ' + clientesCount)

    if (tc.showFooter !== false) {
      lines.push(separador)
      if (tc.footerText) lines.push('   ' + tc.footerText)
      if (tc.footerText2) lines.push('   ' + tc.footerText2)
    }

    const fontSize = tc.fontSize === 'grande' ? '16px' : tc.fontSize === 'pequeño' ? '10px' : '13px'
    return { texto: lines.join('\n'), fontSize }
  }

  const abrirVentanaTicket = (numero, texto, fontSize) => {
    try {
      const printWindow = window.open('', '_blank', 'width=320,height=600')
      if (printWindow) {
        printWindow.document.write(`
          <html><head><title>Mesa ${etiquetaMesa(numero)}</title>
          <style>
            body { font-family: 'Courier New', monospace; font-size: ${fontSize}; margin: 10px; white-space: pre; line-height: 1.4; }
            @media print { body { margin: 0; } }
          </style></head><body>${texto}</body></html>
        `)
        printWindow.document.close()
        printWindow.print()
        toast.success('Ticket enviado a impresora')
      } else {
        navigator.clipboard.writeText(texto)
        toast.success('Ticket copiado. Pegá en Bloc de notas e imprimí con Ctrl+P')
      }
    } catch {
      navigator.clipboard.writeText(texto)
      toast.success('Ticket copiado al portapapeles')
    }
  }

  const imprimirTicket = async (numero) => {
    const propina = await leerPropinaFresca(numero)
    const items = [...(itemsPorMesa[numero] || []), ...(propina ? [propina] : [])]
    const total = calcularTotalMesa(numero) + (propina?.precio || 0)
    const comensales = clientesPorMesa[numero] || []
    const { texto, fontSize } = await generarTicketTexto(numero, items, total, comensales.length)
    abrirVentanaTicket(numero, texto, fontSize)
  }

  const getEstadoColor = (estado, hasOrders) => {
    if (hasOrders) return 'bg-green-500'
    switch (estado) {
      case 'Libre': return 'bg-white'
      case 'Ocupada': return 'bg-green-500'
      case 'Pendiente': return 'bg-yellow-400'
      default: return 'bg-gray-400'
    }
  }

  const getMesaStyle = (estado, hasOrders) => {
    if (estado === 'Pendiente') {
      return 'border-red-500 shadow-[0_0_25px_rgba(239,68,68,0.5)] animate-shake-vibrate'
    }
    if (hasOrders || estado === 'Ocupada') {
      return 'border-green-500 shadow-[0_0_12px_rgba(34,197,94,0.3)]'
    }
    return 'border-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.3)]'
  }

  const getMesaUrl = useCallback((numero) => {
    const origin = window.location.origin
    const userId = cliente?.user_id
    if (!userId) return null
    return `${origin}/menu/${userId}?mesa=${esMesa00(numero) ? '00' : numero}`
  }, [cliente, clienteId])

  const downloadQR = (numero) => {
    const svg = qrRefs.current[numero]
    if (!svg) return false
    const url = getMesaUrl(numero)
    if (!url) return false

    const svgData = new XMLSerializer().serializeToString(svg)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    canvas.width = 400
    canvas.height = 500
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    const img = new Image()
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)))

    return new Promise((resolve) => {
      img.onload = () => {
        const qrSize = 350
        const x = (canvas.width - qrSize) / 2
        ctx.drawImage(img, x, 20, qrSize, qrSize)
        ctx.fillStyle = '#000000'
        ctx.font = 'bold 36px Arial'
        ctx.textAlign = 'center'
        ctx.fillText(`Mesa ${etiquetaMesa(numero)}`, canvas.width / 2, canvas.height - 40)

        canvas.toBlob((blob) => {
          const blobUrl = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = blobUrl
          a.download = `qr-mesa-${etiquetaMesa(numero)}.png`
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
          resolve(true)
        }, 'image/png')
      }
      img.onerror = () => resolve(false)
    })
  }

  const copiarLinkMesa00 = async () => {
    const url = getMesaUrl(MESA_00)
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Link de Mesa 00 copiado')
    } catch {
      window.prompt('Copiá el link de Mesa 00:', url)
    }
  }

  const downloadAllQRs = async () => {
    // Mesa 0 = Delivery/Retiro/WhatsApp. No es una mesa física de
    // mesas_operacion, pero usa el mismo link (cliente.user_id) que ya se
    // genera y se guarda en Supabase, así que se agrega como una tarjeta
    // más de la hoja, con el nombre del socio en vez de "Mesa 0" a secas.
    const mesa0Url = getMesaUrl(0)
    const items = [
      ...(mesa0Url ? [{
        refKey: 'mesa0',
        label: `Mesa 0 - Delivery/Retiro`,
        sublabel: cliente?.nombre_restaurante || ''
      }] : []),
      ...(getMesaUrl(MESA_00) ? [{
        refKey: MESA_00,
        label: `Mesa 00 - Para llevar`,
        sublabel: cliente?.nombre_restaurante || ''
      }] : []),
      ...mesas.map(mesa => ({ refKey: mesa.numero, label: `Mesa ${mesa.numero}`, sublabel: '' }))
    ]

    if (items.length === 0) return

    toast.loading('Generando hoja de QR codes...', { id: 'download-all' })

    const cols = Math.min(items.length, 3)
    const rows = Math.ceil(items.length / cols)
    const cellW = 400
    const cellH = 480
    const padX = 40
    const padY = 40
    const headerH = 80

    const canvas = document.createElement('canvas')
    canvas.width = cols * cellW + padX * 2
    canvas.height = rows * cellH + padY * 2 + headerH
    const ctx = canvas.getContext('2d')

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#000000'
    ctx.font = 'bold 32px Arial'
    ctx.textAlign = 'center'
    ctx.fillText('QR Codes - ' + (cliente?.nombre_restaurante || ''), canvas.width / 2, 50)

    let loaded = 0
    const total = items.length

    await new Promise((resolve) => {
      items.forEach((item, idx) => {
        const svg = qrRefs.current[item.refKey]
        if (!svg) { loaded++; if (loaded === total) resolve(); return }

        const col = idx % cols
        const row = Math.floor(idx / cols)
        const x = padX + col * cellW
        const y = padY + headerH + row * cellH

        const svgData = new XMLSerializer().serializeToString(svg)
        const img = new Image()
        img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)))

        img.onload = () => {
          const qrSize = 320
          ctx.drawImage(img, x + (cellW - qrSize) / 2, y + 10, qrSize, qrSize)
          ctx.fillStyle = '#000000'
          ctx.font = 'bold 28px Arial'
          ctx.textAlign = 'center'
          ctx.fillText(item.label, x + cellW / 2, y + qrSize + 45)
          if (item.sublabel) {
            ctx.font = '20px Arial'
            ctx.fillText(item.sublabel, x + cellW / 2, y + qrSize + 75)
          }
          loaded++
          if (loaded === total) resolve()
        }
        img.onerror = () => { loaded++; if (loaded === total) resolve() }
      })
    })

    canvas.toBlob((blob) => {
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = 'qr-todas-las-mesas.png'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
      toast.success('Hoja de QR descargada', { id: 'download-all' })
    }, 'image/png')
  }

  // Tarjeta de un pedido de Mesa 0 (Delivery / Retiro) o de Mesa 00 (para llevar): mismo contenido y
  // mismas acciones (derivar, checklist, cobrar). Antes vivía dentro del map de Delivery / Retiro.
  const renderPedidoCard = (p) => (
              <div key={p.id} className={`bg-dark-800 border-2 ${esMesa00(p.mesa) ? 'border-teal-500/40' : 'border-orange-500/40'} rounded-xl p-4`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`${esMesa00(p.mesa) ? 'text-teal-300' : 'text-orange-400'} font-mono font-bold text-sm`}>#{p.codigo_pedido || '—'}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    p.estado_pedido === 'nuevo' ? 'bg-yellow-500/20 text-yellow-400' :
                    p.estado_pedido === 'en_preparacion' ? 'bg-yellow-500/20 text-yellow-400' :
                    p.estado_pedido === 'preparado' ? 'bg-blue-500/20 text-blue-400' :
                    p.estado_pedido === 'en_delivery' ? 'bg-purple-500/20 text-purple-400' :
                    'bg-purple-500/20 text-purple-400'
                  }`}>
                    {p.estado_pedido === 'nuevo' ? 'Nuevo' :
                     p.estado_pedido === 'en_preparacion' ? `En ${p.derivado_area || 'preparación'}` :
                     p.estado_pedido === 'preparado' ? 'Preparado' :
                     p.estado_pedido === 'en_delivery' ? 'Delivery' :
                     'Entregado'}
                  </span>
                </div>
                <p className="text-white text-sm font-medium">{p.nombre || 'Sin nombre'}</p>
                {!esVistaOperativa && (
                  <p className="text-dark-400 text-xs mb-1">📞 {p.telefono || 'Sin teléfono'}</p>
                )}
                <p className="text-dark-400 text-xs mb-2">
                  {p.metodo_entrega === 'delivery' ? `🛵 ${p.direccion || 'Sin dirección'}` : '🏠 Retira en el local'}
                </p>
                {(() => {
                  // Mismo desglose que el mensaje de WhatsApp: producto, cantidad, promo, Subtotal,
                  // Descuento promo 2x1, Delivery y TOTAL. Todos los importes en la misma columna
                  // (derecha) y el TOTAL debajo de todos los precios.
                  const ds = p.items.map(desgloseItem)
                  const bruto = ds.reduce((t, d) => t + d.bruto, 0)
                  const descuento = ds.reduce((t, d) => t + d.descuento, 0)
                  const costoDelivery = p.metodo_entrega === 'delivery' ? Number(cliente?.delivery || 0) : 0
                  const totalPedido = bruto - descuento + costoDelivery
                  const precioCls = 'ml-2 whitespace-nowrap tabular-nums text-right'
                  return (
                    <div className="border-t border-b border-dark-700 py-2 mb-3 min-h-[40px]">
                      {p.items.length > 0 ? p.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-baseline text-xs text-dark-300 py-0.5">
                          <span className="text-cyan-400 font-bold mr-2">{item.cantidad}x</span>
                          <span className="flex-1 min-w-0 break-words">
                            {item.nombre}
                            {ds[idx].promo && <span className="ml-1 text-purple-400 text-[10px] whitespace-nowrap">🎁 {ds[idx].etiqueta}</span>}
                          </span>
                          {!esVistaOperativa && <span className={precioCls}>{fmtMonto(ds[idx].bruto)}</span>}
                        </div>
                      )) : <p className="text-dark-500 text-xs italic text-center">Sin items</p>}
                      {!esVistaOperativa && p.items.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-dashed border-dark-700 space-y-0.5 text-xs">
                          <div className="flex justify-between text-dark-300"><span>Subtotal</span><span className={precioCls}>{fmtMonto(bruto)}</span></div>
                          {descuento > 0 && <div className="flex justify-between text-purple-400"><span>🎁 Descuento promo 2x1</span><span className={precioCls}>-{fmtMonto(descuento)}</span></div>}
                          {costoDelivery > 0 && <div className="flex justify-between text-orange-400"><span>🛵 Delivery</span><span className={precioCls}>{fmtMonto(costoDelivery)}</span></div>}
                          <div className="flex justify-between text-green-400 font-bold text-sm pt-1 mt-1 border-t border-dark-600"><span>Total</span><span className={precioCls}>{fmtMonto(totalPedido)}</span></div>
                        </div>
                      )}
                    </div>
                  )
                })()}

                {['superadmin', 'admin', 'cajero'].includes(rol) && (
                  <label className="flex items-center gap-1.5 text-[10px] text-dark-300 mb-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!p.ocultar_checklist}
                      onChange={() => toggleOcultarChecklistComensal(p)}
                      className="accent-cyan-500"
                    />
                    Ocultar checklist en este QR
                  </label>
                )}

                {/* Acciones: cajero/admin eligen area; el resto usa ChecklistEstados */}
                {p.estado_pedido === 'nuevo' && (rol === 'admin' || rol === 'cajero' || rol === 'superadmin') ? (
                  <div className="flex gap-2 mb-2">
                    <button
                      onClick={() => derivarPedido(p.id, 'mozo')}
                      className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white text-xs py-2 rounded-lg transition"
                    >
                      🧑‍🍳 A Mozo
                    </button>
                    <button
                      onClick={() => derivarPedido(p.id, 'cocina')}
                      className="flex-1 bg-purple-600 hover:bg-purple-500 text-white text-xs py-2 rounded-lg transition"
                    >
                      👨‍🍳 A Cocina
                    </button>
                  </div>
                ) : null}

                {/* El seguimiento se ve desde que ingresa el pedido. */}
                {!p.ocultar_checklist && (
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs text-dark-400">Checklist:</span>
                    <ChecklistEstados
                      comensal={p}
                      onUpdate={() => { fetchPedidosDelivery().catch(e => setErrorLectura(e.message)) }}
                      onCerrar={cerrarPedido}
                    />
                  </div>
                )}

                {['superadmin', 'admin', 'cajero'].includes(rol) && (
                  <button
                    type="button"
                    onClick={() => abrirCobroPedidoMesa0(p)}
                    className="w-full mt-2 bg-green-500/20 text-green-400 hover:bg-green-500/30 py-2 rounded-lg font-medium transition text-xs"
                  >
                    💰 Cobrar
                  </button>
                )}

                {/* Atajo para que el rol adecuado pueda marcar el azul manualmente
                    si el check esta deshabilitado por permisos */}
                {p.estado_pedido === 'en_preparacion' && p.derivado_area === 'mozo' && rol === 'cajero' && (
                  <button
                    onClick={() => marcarListoMozo(p.id)}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs py-2 rounded-lg transition mt-1"
                  >
                    ✅ Marcar preparado (mozo)
                  </button>
                )}
              </div>
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  return (
    <div>
      {errorLectura && <p role="alert" className="text-red-400 p-3">{errorLectura}</p>}
      {/* Check exclusivo del superadmin para suspender el botón de eliminar mesa del socio */}
      {rol === 'superadmin' && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 mb-4 flex flex-wrap gap-6">
          <span className="text-yellow-400 text-xs font-bold uppercase self-center">Superadmin</span>
          <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
            <input
              type="checkbox"
              checked={!!cliente?.ocultar_eliminar_mesa}
              onChange={toggleOcultarEliminarMesa}
              className="accent-primary-500"
            />
            Suspender botón "Eliminar mesa" para este socio (no se ve en su panel)
          </label>
        </div>
      )}

      {/* Link / QR de Mesa 00 (para llevar): mismo menú que Mesa 0 pero sin WhatsApp */}
      {puedeDescargarQR && getMesaUrl(MESA_00) && (
        <div className="bg-dark-800 rounded-xl px-4 py-3 mb-6 flex flex-wrap items-center gap-3 border border-dark-700">
          <div className="flex-1 min-w-[200px]">
            <p className="text-white font-bold text-sm">🥡 Mesa 00 · Para llevar</p>
            <p className="text-dark-400 text-xs">Mismo menú que Mesa 0, pero el pedido no va por WhatsApp: llega a Mesas y se cobra desde acá.</p>
            <p className="text-cyan-300 font-mono text-[11px] break-all mt-1">{getMesaUrl(MESA_00)}</p>
          </div>
          <button
            onClick={copiarLinkMesa00}
            className="bg-dark-700 hover:bg-dark-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition"
          >
            🔗 Copiar link
          </button>
          <button
            onClick={() => downloadQR(MESA_00)}
            className="bg-cyan-600 hover:bg-cyan-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition"
          >
            📥 QR
          </button>
        </div>
      )}

      {/* Buscar producto: carga manual de un pedido en una mesa o en Mesa 00 */}
      {['superadmin', 'admin', 'cajero'].includes(rol) && (
        <BuscarProductoMesa
          clienteId={clienteId}
          mesas={mesas}
          onAgregado={() => {
            fetchMesas().catch(e => setErrorLectura(e.message))
            fetchPedidosDelivery().catch(e => setErrorLectura(e.message))
          }}
        />
      )}

      {/* Barra de control: cocina no gestiona mesas físicas ni QRs */}
      {!esVistaOperativa && (
        <div className="bg-dark-800 rounded-xl p-4 mb-6 flex flex-wrap items-center justify-center gap-4 border border-dark-700">
          {puedeEliminarMesas && (
            <button
              onClick={() => eliminarMesa(mesas.length > 0 ? mesas[mesas.length - 1].numero : 0)}
              className="w-10 h-10 bg-cyan-400 text-black font-bold rounded-lg hover:bg-cyan-300 transition text-xl"
            >
              −
            </button>
          )}
          <span className="text-white font-bold text-lg flex items-center gap-2">
            Mesas:
            <input
              type="number"
              min="0"
              value={cantidadMesasInput}
              onChange={e => setCantidadMesasInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') setCantidadMesas(cantidadMesasInput) }}
              placeholder={String(mesas.length)}
              title="Escribí la cantidad total de mesas y apretá Enter"
              className="w-16 bg-dark-900 border border-dark-600 rounded-lg px-2 py-1 text-white text-center text-lg font-bold focus:outline-none focus:border-cyan-400"
            />
          </span>
          {puedeAgregarMesa && (
            <button
              onClick={agregarMesa}
              className="w-10 h-10 bg-cyan-400 text-black font-bold rounded-lg hover:bg-cyan-300 transition text-xl"
            >
              +
            </button>
          )}
          {puedeVerChatMesas && (
            <button
              onClick={() => { setShowChat(prev => !prev); setAvisoChatColor(null) }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ml-4 ${showChat ? 'bg-primary-500 text-white' : avisoChatColor ? `${avisoChatColor} text-white animate-pulse` : 'bg-dark-700 hover:bg-dark-600 text-white'}`}
            >
              💬 Chat
            </button>
          )}
          {puedeDescargarQR && (mesas.length > 0 || getMesaUrl(0)) && (
            <button
              onClick={downloadAllQRs}
              className="bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
            >
              📥 Descargar todos QR
            </button>
          )}
        </div>
      )}

      {/* Vista operativa (mozo/cocina): sin barra de gestión de mesas
          salvo lo que el dueño habilite puntualmente desde Usuarios > Permisos. */}
      {esVistaOperativa && (puedeAgregarMesa || puedeDescargarQR || puedeVerChatMesas || puedeEliminarMesas) && (
        <div className="bg-dark-800 rounded-xl p-4 mb-6 flex flex-wrap items-center justify-end gap-4 border border-dark-700">
          {puedeEliminarMesas && (
            <button
              onClick={() => eliminarMesa(mesas.length > 0 ? mesas[mesas.length - 1].numero : 0)}
              className="w-10 h-10 bg-cyan-400 text-black font-bold rounded-lg hover:bg-cyan-300 transition text-xl"
            >
              −
            </button>
          )}
          {puedeAgregarMesa && (
            <button
              onClick={agregarMesa}
              className="w-10 h-10 bg-cyan-400 text-black font-bold rounded-lg hover:bg-cyan-300 transition text-xl"
            >
              +
            </button>
          )}
          {puedeDescargarQR && (mesas.length > 0 || getMesaUrl(0)) && (
            <button
              onClick={downloadAllQRs}
              className="bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
            >
              📥 Descargar todos QR
            </button>
          )}
          {puedeVerChatMesas && (
            <button
              onClick={() => { setShowChat(prev => !prev); setAvisoChatColor(null) }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${showChat ? 'bg-primary-500 text-white' : avisoChatColor ? `${avisoChatColor} text-white animate-pulse` : 'bg-dark-700 hover:bg-dark-600 text-white'}`}
            >
              💬 Chat del equipo
            </button>
          )}
        </div>
      )}

      {/* Chat del equipo: en el flujo normal de la página (no flotante),
          así al abrirse empuja el contenido de abajo (delivery / mesas)
          en vez de taparlo. */}
      <ChatEquipo clienteId={clienteId} open={showChat} onClose={() => setShowChat(false)} />

      {/* Delivery / Retiro (Mesa 0) */}
      {pedidosDelivery.length > 0 && (
        <div className="mb-6">
          <h2 className="text-white font-bold text-lg mb-3 flex items-center gap-2">🛵 Delivery / Retiro <span className="text-dark-400 text-sm font-normal">({pedidosDelivery.length})</span></h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {pedidosDelivery.map(renderPedidoCard)}
          </div>
        </div>
      )}

      {/* Mesa 00: clientes que no se quedan en el local. No es una mesa física: no tiene cuadradito. */}
      {pedidosMesa00.length > 0 && (
        <div className="mb-6">
          <h2 className="text-white font-bold text-lg mb-3 flex items-center gap-2">🥡 Mesa 00 · Para llevar <span className="text-dark-400 text-sm font-normal">({pedidosMesa00.length})</span></h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {pedidosMesa00.map(renderPedidoCard)}
          </div>
        </div>
      )}

      {/* Grid de mesas */}
      {mesas.length === 0 ? (
        <div className="text-center py-12 text-dark-400">
          <p className="text-lg">No hay mesas creadas. Usa el botón + para agregar.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {mesas.map((mesa) => {
            const propinaMesa = getPropinaMesa(mesa.numero)
            const total = calcularTotalMesa(mesa.numero) + (propinaMesa?.precio || 0)
            const idsActivosMesa = new Set((itemsPorMesa[mesa.numero] || []).map(i => i.comensal_id))
            const numClientes = (clientesPorMesa[mesa.numero] || []).filter(c => idsActivosMesa.has(c.id)).length

            return (
              <div
                key={mesa.id}
                onClick={() => {
                  if (esVistaOperativa) return
                  if (mesa.estado === 'Pendiente') atenderMozo(mesa.numero, { stopPropagation: () => {} })
                  setClienteFiltroId(null)
                  setItemsCobro([])
                  setMesaSeleccionada(mesa.numero)
                }}
                className={`bg-dark-800 border-2 rounded-xl p-4 transition-all ${esVistaOperativa ? 'cursor-default' : 'cursor-pointer hover:scale-105'} ${getMesaStyle(mesa.estado, itemsPorMesa[mesa.numero]?.length > 0)}`}
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`w-4 h-4 rounded-full ${getEstadoColor(mesa.estado, itemsPorMesa[mesa.numero]?.length > 0)}`}></span>
                    <span className="text-white font-bold">Mesa {mesa.numero}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {mesa.estado === 'Pendiente' && !esVistaOperativa && (
                      <button
                        onClick={(e) => atenderMozo(mesa.numero, e)}
                        className="text-red-500 text-lg animate-bounce"
                        title="Atender llamado"
                      >
                        🔔
                      </button>
                    )}
                    {mesa.estado === 'Pendiente' && esVistaOperativa && (
                      <span className="text-red-500 text-lg" title="Mesa solicitando atención">🔔</span>
                    )}
                  </div>
                </div>

                {/* Info */}
                <div className="text-sm text-dark-400 mb-2">
                  👤 {numClientes > 0 ? `${numClientes} cliente${numClientes > 1 ? 's' : ''}` : 'Sin clientes'}
                </div>

                {/* Items */}
                <div className="border-t border-b border-dark-700 py-2 mb-3 min-h-[60px]">
                  {itemsPorMesa[mesa.numero]?.length > 0 ? (
                    itemsPorMesa[mesa.numero].slice(0, 5).map((item, idx) => {
                      const color = getColorMesaComensal(mesa.numero, item.comensal_id)
                      return (
                      <div key={idx} className="flex justify-between text-xs text-dark-300 py-1">
                        <span className="font-bold mr-2" style={{ color }}>{item.cantidad}x</span>
                        <span className="flex-1 truncate" style={{ color }}>{item.nombre}</span>
                        {!esVistaOperativa && <span className="ml-2 whitespace-nowrap" style={{ color }}>${monto(item).toFixed(2)}</span>}
                        {pedidoEntregadoMesa(mesa.numero, item.comensal_id) && (
                          <span className="ml-2 text-green-400 font-bold whitespace-nowrap">✓ OK</span>
                        )}
                      </div>
                      )
                    })
                  ) : !propinaMesa ? (
                    <p className="text-dark-500 text-xs italic text-center">Sin pedidos</p>
                  ) : null}
                  {propinaMesa && (
                    <div
                      className={`flex justify-between text-xs font-bold py-1 ${itemsPorMesa[mesa.numero]?.length > 0 ? 'mt-1 border-t border-dashed border-dark-600' : ''}`}
                      style={{ color: propinaMesa.color }}
                    >
                      <span>🧑‍🍳 Propina</span>
                      <span>${propinaMesa.precio.toFixed(2)}</span>
                    </div>
                  )}
                </div>

                {/* Mozo asignado a la mesa: queda guardado y se precarga solo al cobrar */}
                {['superadmin', 'admin', 'cajero', 'mozo'].includes(rol) && (
                  <label className="flex items-center justify-between gap-2 text-xs text-dark-300 mb-3" onClick={e => e.stopPropagation()}>
                    <span>🧑‍🍳 Mozo</span>
                    <select
                      value={mesa.mozo_asignado_id || ''}
                      onChange={e => asignarMozoMesa(mesa.numero, e.target.value)}
                      className="bg-dark-900 border border-dark-600 rounded px-2 py-1 text-white text-xs"
                    >
                      <option value="">Sin asignar</option>
                      {equipoCobro.mozos.map(u => <option key={u.user_id} value={u.user_id}>{u.nombre || u.usuario}</option>)}
                    </select>
                  </label>
                )}

                {(clientesPorMesa[mesa.numero] || [])
                  .filter(c => idsActivosMesa.has(c.id))
                  .map(c => (
                    <div key={c.id} className="mb-3 rounded-lg p-2 border" style={{ borderColor: getColorMesaComensal(mesa.numero, c.id), backgroundColor: `${getColorMesaComensal(mesa.numero, c.id)}12` }} onClick={e => e.stopPropagation()}>
                      <p className="text-[11px] mb-2 truncate" style={{ color: getColorMesaComensal(mesa.numero, c.id) }}>{c.nombre || `Cliente Mesa ${mesa.numero}`}</p>
                      {['superadmin', 'admin', 'cajero'].includes(rol) && (
                        <label className="flex items-center gap-1.5 text-[10px] text-dark-300 mb-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!c.ocultar_checklist}
                            onChange={() => toggleOcultarChecklistComensal(c)}
                            className="accent-cyan-500"
                          />
                          Ocultar checklist en este QR
                        </label>
                      )}
                      {c.estado_pedido === 'nuevo' && ['superadmin', 'admin', 'cajero'].includes(rol) && (
                        <div className="flex gap-2 mb-2">
                          <button onClick={() => derivarPedido(c.id, 'mozo')} className="flex-1 bg-cyan-600 hover:bg-cyan-400 hover:scale-105 hover:shadow-[0_0_14px_rgba(34,211,238,0.65)] text-white text-[10px] py-1.5 rounded transition-all duration-150">A Mozo</button>
                          <button onClick={() => derivarPedido(c.id, 'cocina')} className="flex-1 bg-purple-600 hover:bg-purple-400 hover:scale-105 hover:shadow-[0_0_14px_rgba(168,85,247,0.65)] text-white text-[10px] py-1.5 rounded transition-all duration-150">A Cocina</button>
                        </div>
                      )}
                      {!c.ocultar_checklist && (
                        <ChecklistEstados
                          comensal={c}
                          onUpdate={fetchMesas}
                          onCerrar={cerrarPedido}
                        />
                      )}
                      {['entregado', 'cerrado'].includes(c.estado_pedido) && (
                        <p className="mt-2 text-[11px] font-bold text-green-400">✓ OK · Entregado a la mesa</p>
                      )}
                    </div>
                  ))}

                {/* Mozo y cocina solo observan productos/checklist y marcan el segundo check. */}
                {!esVistaOperativa && <div className="flex justify-between items-center">
                  <button
                    onClick={(e) => { e.stopPropagation(); abrirCobroDesdeTarjeta(mesa.numero) }}
                    className="text-green-400 hover:text-green-300 text-xs flex items-center gap-1"
                    title="Cobrar mesa"
                  >
                    💰 Cobrar
                  </button>
                  <div className="flex items-center gap-2">
                    {puedeEliminarMesas && (
                      <button
                        onClick={(e) => { e.stopPropagation(); eliminarMesa(mesa.numero) }}
                        className="text-red-400 hover:text-red-300 text-xs"
                      >
                        🗑️
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); downloadQR(mesa.numero) }}
                      className="text-cyan-400 hover:text-cyan-300 text-xs"
                      title="Descargar QR"
                    >
                      📥
                    </button>
                    <span className="text-green-400 font-bold text-sm">
                      {total > 0 ? `$${total.toFixed(2)}` : '$0'}
                    </span>
                  </div>
                </div>}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal detalle mesa */}
      {mesaSeleccionada && detalleMesa && (() => {
        // Solo mostramos como "cliente activo" al comensal que todavía tiene
        // algún pedido pendiente de pago (si ya se le cobró todo, desaparece
        // de la lista aunque su registro siga en la base).
        const comensalesActivos = detalleMesa.comensales.filter(c =>
          detalleMesa.items.some(i => i.comensal_id === c.id && !i.pagado)
        )
        const pendientes = detalleMesa.items.filter(i => !i.pagado)
        const visibles = pendientes.filter(i => !clienteFiltroId || i.comensal_id === clienteFiltroId)
        const todosVisiblesSeleccionados = visibles.length > 0 && visibles.every(i => itemsCobro.includes(i.id))

        const toggleTodosVisibles = () => {
          const idsVisibles = visibles.map(i => i.id)
          if (todosVisiblesSeleccionados) {
            setItemsCobro(prev => prev.filter(id => !idsVisibles.includes(id)))
          } else {
            setItemsCobro(prev => [...new Set([...prev, ...idsVisibles])])
          }
        }

        return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => { setMesaSeleccionada(null); setDetalleMesa(null); setClienteFiltroId(null); setItemsCobro([]) }}>
          <div className="bg-dark-800 border border-dark-600 rounded-2xl w-full max-w-md max-h-[85vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Header modal */}
            <div className="bg-dark-700 px-5 py-4 flex items-center justify-between border-b border-dark-600">
              <div>
                <h3 className="text-white font-bold text-lg">Mesa {detalleMesa.numero}</h3>
                <p className="text-dark-400 text-xs">{comensalesActivos.length} cliente{comensalesActivos.length !== 1 ? 's' : ''}</p>
              </div>
              <button onClick={() => { setMesaSeleccionada(null); setDetalleMesa(null); setClienteFiltroId(null); setItemsCobro([]) }} className="text-dark-400 hover:text-white text-xl">✕</button>
            </div>

            {/* Lista de clientes */}
            {comensalesActivos.length > 0 && (
              <div className="px-5 py-3 border-b border-dark-600">
                <p className="text-dark-400 text-xs mb-2">Clientes activos:</p>
                <div className="flex flex-wrap gap-2">
                  {comensalesActivos.map(c => {
                    const color = getColorComensal(c.id)
                    const filtroActivo = clienteFiltroId === c.id
                    return (
                      <div
                        key={c.id}
                        className="flex items-center gap-2 rounded-lg px-3 py-1.5 border"
                        style={{
                          backgroundColor: `${color}1A`,
                          borderColor: color
                        }}
                      >
                        <span className="text-sm font-medium" style={{ color }}>{c.nombre}</span>
                        <button
                          onClick={() => setClienteFiltroId(filtroActivo ? null : c.id)}
                          className="text-xs hover:opacity-70"
                          style={{ color }}
                          title={filtroActivo ? 'Ver todos los pedidos' : 'Ver solo su pedido'}
                        >
                          {filtroActivo ? '☑' : '☐'}
                        </button>
                        <button
                          onClick={() => cerrarCliente(c.id, detalleMesa.numero)}
                          className="text-red-400 hover:text-red-300 text-xs"
                          title="Cerrar cliente"
                        >
                          ✕
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Items */}
            <div className="flex-1 overflow-auto px-5 py-3">
              {(detalleMesa.items.length > 0 || detalleMesa.propina) ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-dark-400 text-xs border-b border-dark-600">
                      <th className="text-left py-2 w-6">
                        <input
                          type="checkbox"
                          checked={todosVisiblesSeleccionados}
                          onChange={toggleTodosVisibles}
                          title="Seleccionar todos para cobrar"
                        />
                      </th>
                      <th className="text-left py-2">Cant</th>
                      <th className="text-left py-2">Producto</th>
                      <th className="text-right py-2">P.U.</th>
                      <th className="text-right py-2">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibles.map((item, idx) => {
                        const color = getColorComensal(item.comensal_id)
                        return (
                          <tr key={idx} className="border-b border-dark-700/50">
                            <td className="py-2">
                              <input
                                type="checkbox"
                                checked={itemsCobro.includes(item.id)}
                                onChange={() => toggleItemCobro(item.id)}
                                style={{ accentColor: color }}
                                title="Marcar para cobrar"
                              />
                            </td>
                            <td className="py-2 font-bold" style={{ color }}>{item.cantidad}x</td>
                            <td className="py-2" style={{ color }}>{item.nombre}</td>
                            <td className="py-2 text-dark-300 text-right">${item.precio.toFixed(2)}</td>
                            <td className="py-2 text-green-400 font-bold text-right">${monto(item).toFixed(2)}</td>
                          </tr>
                        )
                      })}
                    {detalleMesa.propina && (
                      <tr className="border-b border-dark-700/50 border-t border-dashed border-dark-500">
                        <td className="py-2" />
                        <td className="py-2" style={{ color: detalleMesa.propina.color }}>🧑‍🍳</td>
                        <td className="py-2 font-medium" style={{ color: detalleMesa.propina.color }}>
                          Propina
                        </td>
                        <td className="py-2 text-dark-300 text-right">—</td>
                        <td className="py-2 text-green-400 font-bold text-right">${detalleMesa.propina.precio.toFixed(2)}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              ) : (
                <p className="text-dark-500 text-sm italic text-center py-6">Sin pedidos en esta mesa</p>
              )}
            </div>

            {/* Footer modal */}
            <div className="border-t border-dark-600 px-5 py-4 space-y-3">
              {itemsCobro.length > 0 && (
                <p className="text-cyan-400 text-xs">
                  {itemsCobro.length} producto{itemsCobro.length !== 1 ? 's' : ''} seleccionado{itemsCobro.length !== 1 ? 's' : ''} para cobrar
                </p>
              )}
              <div className="flex justify-between items-center">
                <span className="text-white font-bold text-lg">Total:</span>
                <span className="text-green-400 font-bold text-xl">${detalleMesa.total.toFixed(2)}</span>
              </div>
              <div>
                <button
                  onClick={abrirPreviewCobro}
                  className="w-full bg-green-500/20 text-green-400 hover:bg-green-500/30 py-2.5 rounded-xl font-medium transition text-sm"
                >
                  💰 Cobrar
                </button>
              </div>
            </div>
          </div>
        </div>
        )
      })()}

      {/* Modal preview de ticket / confirmación de cobro o cierre */}
      {cobroPreview && (() => {
        const calc = calcularCobro()
        const inputCls = 'bg-dark-900 border border-dark-600 rounded px-2 py-1 text-white'
        return (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4" onClick={() => setCobroPreview(null)}>
          <div className="bg-dark-800 border border-dark-600 rounded-2xl w-full max-w-sm max-h-[85vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="bg-dark-700 px-5 py-4 flex items-center justify-between border-b border-dark-600">
              <h3 className="text-white font-bold text-lg">{cobroPreview.cierre ? 'Cerrar mesa' : 'Confirmar cobro'}</h3>
              <button onClick={() => setCobroPreview(null)} className="text-dark-400 hover:text-white text-xl">✕</button>
            </div>

            <div className="flex-1 overflow-auto px-5 py-3 font-mono text-xs text-dark-200">
              <p className="text-center text-dark-400 mb-2">Mesa N° {etiquetaMesa(cobroPreview.numero)}</p>
              <div className="border-t border-dashed border-dark-600 my-2"></div>
              {calc.items.length > 0 ? (
                <>
                  {calc.productos.map((item, idx) => {
                    const d = desgloseItem(item)
                    return (
                      <div key={idx} className="flex justify-between gap-2 py-0.5">
                        <span className="min-w-0 break-words">
                          {item.cantidad}x {item.producto || item.nombre}
                          {d.promo && <span className="ml-1 text-purple-400">🎁 {d.etiqueta}</span>}
                        </span>
                        <span className="whitespace-nowrap tabular-nums text-right">{fmtMonto(d.bruto)}</span>
                      </div>
                    )
                  })}
                  <div className="border-t border-dashed border-dark-600 my-2"></div>
                  {calc.productos.length > 0 && (
                    <div className="flex justify-between py-0.5"><span>Subtotal</span><span className="whitespace-nowrap tabular-nums text-right">{fmtMonto(calc.bruto)}</span></div>
                  )}
                  {calc.descuento > 0 && (
                    <div className="flex justify-between py-0.5 text-purple-400"><span>🎁 Descuento promo 2x1</span><span className="whitespace-nowrap tabular-nums text-right">-{fmtMonto(calc.descuento)}</span></div>
                  )}
                  {calc.items.filter(i => i.esDelivery || i.esPropina).map((item, idx) => (
                    <div key={'extra' + idx} className="flex justify-between py-0.5" style={{ color: item.color, fontWeight: 700 }}>
                      <span>{item.esPropina ? '🧑‍🍳 Propina' : '🛵 Delivery'}</span>
                      <span className="whitespace-nowrap tabular-nums text-right">{fmtMonto(monto(item))}</span>
                    </div>
                  ))}
                </>
              ) : (
                <p className="text-center text-dark-500 italic py-2">Sin productos pendientes</p>
              )}
              <div className="border-t border-dashed border-dark-600 my-2"></div>
              <div className="flex justify-between text-white font-bold text-sm">
                <span>TOTAL</span>
                <span className="whitespace-nowrap tabular-nums text-right">{fmtMonto(calc.total)}</span>
              </div>

              {/* Datos que se guardan en Caja para poder filtrar después */}
              {(cobroPreview.numero > 0 || cobroPreview.esDelivery) && (
                <div className="mt-4 pt-3 border-t border-dark-600 space-y-2 font-sans">
                  {cobroPreview.numero > 0 && (
                    <>
                      <label className="flex items-center justify-between gap-2 text-dark-300">
                        <span>🧑‍🍳 Mozo</span>
                        <select value={cobroExtras.mozoId} onChange={e => setCobroExtras(prev => ({ ...prev, mozoId: e.target.value }))} className={`w-40 ${inputCls}`}>
                          <option value="">Sin asignar</option>
                          {equipoCobro.mozos.map(u => <option key={u.user_id} value={u.user_id}>{u.nombre || u.usuario}</option>)}
                        </select>
                      </label>
                      {calc.propina > 0 && !cobroExtras.mozoId && (
                        <p className="text-amber-400 text-[11px]">Elegí el mozo para que la propina quede a su nombre en Caja.</p>
                      )}
                    </>
                  )}
                  {cobroPreview.esDelivery && (
                    <>
                      <label className="flex items-center justify-between gap-2 text-dark-300">
                        <span>Repartidor</span>
                        <select value={cobroExtras.deliveryId} onChange={e => setCobroExtras(prev => ({ ...prev, deliveryId: e.target.value }))} className={`w-40 ${inputCls}`}>
                          <option value="">Sin asignar</option>
                          {equipoCobro.repartidores.map(u => <option key={u.user_id} value={u.user_id}>{u.nombre || u.usuario}</option>)}
                        </select>
                      </label>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="border-t border-dark-600 px-5 py-4 space-y-2">
              <button
                onClick={imprimirTicketCobro}
                className="w-full bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 py-2.5 rounded-xl font-medium transition text-sm"
              >
                🖨️ Imprimir
              </button>
              <button
                  onClick={() => confirmarCobro()}
                className="w-full bg-green-500/20 text-green-400 hover:bg-green-500/30 py-2.5 rounded-xl font-medium transition text-sm"
              >
                💰 Cobrar
              </button>
              <button
                onClick={() => setCobroPreview(null)}
                className="w-full bg-dark-700 text-dark-300 hover:bg-dark-600 py-2 rounded-xl font-medium transition text-sm"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
        )
      })()}

      {/* QR codes ocultos */}
      <div className="hidden">
        {/* Mesa 0: delivery / retiro / WhatsApp. Mismo link que se genera y
            guarda en Supabase (cliente.user_id), usado también en "Descargar
            todos QR". */}
        {getMesaUrl(0) && (
          <QRCodeSVG
            ref={(el) => { qrRefs.current['mesa0'] = el }}
            value={getMesaUrl(0)}
            size={350}
            bgColor="#ffffff"
            fgColor="#000000"
            level="M"
            includeMargin={false}
          />
        )}
        {getMesaUrl(MESA_00) && (
          <QRCodeSVG
            ref={(el) => { qrRefs.current[MESA_00] = el }}
            value={getMesaUrl(MESA_00)}
            size={350}
            bgColor="#ffffff"
            fgColor="#000000"
            level="M"
            includeMargin={false}
          />
        )}
        {mesas.map(mesa => {
          const url = getMesaUrl(mesa.numero)
          return url ? (
            <QRCodeSVG
              key={mesa.id}
              ref={(el) => { qrRefs.current[mesa.numero] = el }}
              value={url}
              size={350}
              bgColor="#ffffff"
              fgColor="#000000"
              level="M"
              includeMargin={false}
            />
          ) : null
        })}
      </div>
    </div>
  )
}
