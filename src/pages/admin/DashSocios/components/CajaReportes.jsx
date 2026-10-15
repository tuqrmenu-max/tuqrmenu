import { applyDateBounds, readPages } from '@/lib/readPages'
import { reportBounds } from '@/lib/reportBounds'
import { armarCuerpoTicket, desgloseItem, TICKET_W } from '@/lib/ticketFormat'
import { hoyLocal, diasEntre, rangosDeTurno, turnoAplica } from '@/lib/cajaRango'
import { startVisiblePolling } from '@/lib/visiblePolling'
import { etiquetaMesa, mesaDesdeTexto } from '@/lib/mesa00'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

// Orden y nombre de los roles en el selector único "Usuario".
const ROLES_CAJA = [
  { id: 'admin', label: 'Admin' },
  { id: 'cajero', label: 'Cajero' },
  { id: 'mozo', label: 'Mozo' },
  { id: 'cocina', label: 'Cocina' },
  { id: 'delivery', label: 'Delivery' }
]

export default function CajaReportes({ clienteId }) {
  const requestVersion = useRef(0)
  const [pagina, setPagina] = useState(0)
  const [resumen, setResumen] = useState({ categorias: {}, tickets_count: 0, tickets_total: 0 })
  const PAGE_SIZE = 25
  const [usuariosCaja, setUsuariosCaja] = useState([])
  const [errorUsuarios, setErrorUsuarios] = useState('')
  const [usuarioCaja, setUsuarioCaja] = useState('')
  const [turnoCaja, setTurnoCaja] = useState('')
  const [rangoCaja, setRangoCaja] = useState(null)
  // Un solo panel: Fecha desde (obligatoria) · Fecha hasta (opcional: vacía = solo ese día) · Mesa.
  const [filtros, setFiltros] = useState(() => ({ fecha_desde: hoyLocal(), fecha_hasta: '', mesa_num: '' }))
  useEffect(() => {
    let alive=true
    setPagina(0);setUsuariosCaja([]);setUsuarioCaja('');setTurnoCaja('');setRangoCaja(null)
    // Todos los roles (admin, cajero, mozo, cocina, delivery) en un solo selector.
    const refresh=async()=>{
      let lista=null
      const {data:rpcData,error:rpcError}=await supabase.rpc('qr_caja_usuarios',{p_cliente_id:clienteId})
      if(!alive)return
      if(!rpcError){
        lista=rpcData||[]
      }else{
        // Compatibilidad si todavía no se ejecutó supabase/caja_usuarios.sql: usuarios legibles +
        // mozos/repartidores (RPC) + el Admin (dueño) si se puede leer.
        const [{data,error},{data:equipo,error:equipoError},{data:cli}]=await Promise.all([
          supabase.from('cliente_usuarios').select('id,user_id,nombre,usuario,rol,activo,horarios').eq('cliente_id',clienteId).order('nombre'),
          supabase.rpc('qr_equipo_operativo',{p_cliente_id:clienteId}),
          supabase.from('clientes').select('user_id').eq('id',clienteId).maybeSingle()
        ])
        if(!alive)return
        if(error&&equipoError){setErrorUsuarios('No se pudieron cargar los usuarios. Reintentando…');return}
        lista=[...(data||[])]
        ;(equipo||[]).forEach(e=>{if(!lista.some(u=>u.user_id===e.user_id))lista.push({id:null,user_id:e.user_id,nombre:e.nombre,usuario:e.usuario,rol:e.rol,activo:e.activo,horarios:[]})})
        if(cli?.user_id&&!lista.some(u=>u.user_id===cli.user_id))lista.unshift({id:null,user_id:cli.user_id,nombre:'Administrador',usuario:'',rol:'admin',activo:true,horarios:[]})
      }
      setErrorUsuarios('')
      setUsuariosCaja(lista.map(u=>({...u,key:String(u.id??('u-'+u.user_id))})))
    }
    if(!clienteId)return
    const stop = startVisiblePolling(refresh,60000)
    return ()=>{alive=false;stop()}
  },[clienteId])
  const usuarioSeleccionado=usuariosCaja.find(u=>u.key===usuarioCaja)
  // Cómo se atribuye un ticket a la persona elegida según su rol:
  //  - mozo     -> tickets donde figura como Mozo (mozo_id)
  //  - delivery -> tickets donde figura como Repartidor (delivery_user_id)
  //  - resto    -> tickets que cobró esa persona (cobrado_por)
  // Mozo y repartidor no pueden cobrar, así que filtrarlos por "quién cobró" siempre daba vacío.
  const rolSel=usuarioSeleccionado?.rol
  const cobradorKey=usuarioSeleccionado?(
    usuarioSeleccionado.user_id&&rolSel==='mozo'?'mozo:'+usuarioSeleccionado.user_id:
    usuarioSeleccionado.user_id&&rolSel==='delivery'?'delivery:'+usuarioSeleccionado.user_id:
    usuarioSeleccionado.user_id?'id:'+usuarioSeleccionado.user_id:(usuarioSeleccionado.usuario?'login:'+usuarioSeleccionado.usuario:'')):''
  const comoTxt=cobradorKey.startsWith('mozo:')?'como mozo':cobradorKey.startsWith('delivery:')?'como repartidor':''
  // Período: sin "Fecha hasta" (o anterior a "desde") es solo el día de "Fecha desde" (00:00 → 00:00).
  const hastaInvalida=Boolean(filtros.fecha_hasta&&filtros.fecha_hasta<filtros.fecha_desde)
  const hastaEf=filtros.fecha_hasta&&!hastaInvalida?filtros.fecha_hasta:filtros.fecha_desde
  const diasPeriodo=diasEntre(filtros.fecha_desde,hastaEf,62)
  // Turnos del usuario que caen en algún día del período.
  const horariosDisponibles=(usuarioSeleccionado?.horarios||[]).map((h,index)=>({...h,index})).filter(h=>diasPeriodo.some(d=>turnoAplica(h,d)))
  const consultarTurno=()=>{
    setPagina(0)
    const h=horariosDisponibles.find(h=>String(h.index)===turnoCaja)
    if(!h||!diasPeriodo.length)return
    if(diasPeriodo.length>31){toast.error('Para consultar un turno elegí un período de hasta 31 días');return}
    const rangos=rangosDeTurno(h,diasPeriodo)
    if(!rangos||!rangos.length)return
    const periodo=hastaEf!==filtros.fecha_desde?filtros.fecha_desde+' → '+hastaEf:filtros.fecha_desde
    setRangoCaja({rangos,label:(usuarioSeleccionado.nombre||usuarioSeleccionado.usuario)+' · '+(h.nombre?h.nombre+' · ':'')+periodo+' · '+h.desde+'–'+h.hasta+(h.desde2?' / '+h.desde2+'–'+h.hasta2:'')})
  }
  const [errorReporte, setErrorReporte] = useState('')
  const [ticketsCaja, setTicketsCaja] = useState([])
  const [loading, setLoading] = useState(true)
  const [totales, setTotales] = useState({
    comensales: 0,
    mesas_atendidas: 0,
    items_vendidos: 0,
    total_facturado: 0,
    items_promo: 0,
    descuento_promo: 0
  })

  useEffect(() => {
    if (clienteId) fetchPedidos()
    return () => { requestVersion.current++ }
  }, [filtros, clienteId, rangoCaja, pagina, cobradorKey])

  const fetchPedidos = async () => {
    const request=++requestVersion.current
    setLoading(true)
    setErrorReporte('')
    try {
    // Con un turno aplicado, el turno decide el rango (un turno nocturno 22:00→06:00 no se corta a
    // las 00:00). Sin turno manda el período: de Fecha desde a Fecha hasta, o solo ese día si no hay hasta.
    const hasta_ef = filtros.fecha_hasta && filtros.fecha_hasta >= filtros.fecha_desde ? filtros.fecha_hasta : filtros.fecha_desde
    const filtrosFecha = rangoCaja ? { fecha_desde: '', fecha_hasta: '' } : { fecha_desde: filtros.fecha_desde, fecha_hasta: hasta_ef }
    const { desde, hasta } = reportBounds(filtrosFecha)
    // Mismos filtros para el listado y para los totales.
    const filtrarTickets = (q) => {
      q = applyDateBounds(q, 'cobrado_at', filtrosFecha, rangoCaja)
      if (filtros.mesa_num !== '') q = q.eq('mesa', mesaDesdeTexto(filtros.mesa_num))
      // Filtro por usuario (todos los roles en un solo selector, ver cobradorKey)
      if (cobradorKey.startsWith('mozo:')) q = q.eq('mozo_id', cobradorKey.slice(5))
      else if (cobradorKey.startsWith('delivery:')) q = q.eq('delivery_user_id', cobradorKey.slice(9))
      else if (cobradorKey.startsWith('id:')) q = q.eq('cobrado_por->>user_id', cobradorKey.slice(3))
      else if (cobradorKey.startsWith('login:')) q = q.eq('cobrado_por->>usuario', cobradorKey.slice(6))
      return q
    }
    let query = filtrarTickets(supabase.from('tickets_caja').select('id,mesa,codigo_pedido,cobrado_at,cobrado_por,items,total,impreso,items_total,delivery_monto,propina_monto,es_delivery,mozo_id,mozo_nombre,delivery_user_id,delivery_nombre').eq('cliente_id', clienteId))
    // Con un usuario elegido, los totales se calculan sobre sus tickets
    // (la función de resumen de Supabase no filtra por quién cobró).
    const resumenPorUsuario = async () => {
      const filas = await readPages(
        () => filtrarTickets(supabase.from('tickets_caja').select('id,total,items_total,delivery_monto,propina_monto').eq('cliente_id', clienteId)).order('cobrado_at', { ascending: false }).order('id'),
        () => request === requestVersion.current
      )
      if (filas === null) return null
      const r = { totales: { comensales: 0, mesas_atendidas: 0, items_vendidos: 0, total_facturado: 0, items_promo: 0, descuento_promo: 0 }, categorias: {}, tickets_count: filas.length, tickets_total: 0, tickets_items: 0, tickets_delivery: 0, tickets_propina: 0 }
      filas.forEach(t => {
        const total = Number(t.total) || 0, propina = Number(t.propina_monto) || 0, delivery = Number(t.delivery_monto) || 0
        r.tickets_total += total; r.tickets_propina += propina; r.tickets_delivery += delivery
        r.tickets_items += Number(t.items_total) || Math.max(0, total - propina - delivery)
      })
      return r
    }
    const [ticketsResult, summaryResult] = await Promise.all([
      query.order('cobrado_at', { ascending: false }).order('id').range(pagina * PAGE_SIZE, (pagina + 1) * PAGE_SIZE - 1),
      cobradorKey ? resumenPorUsuario().then(data => ({ data })) : supabase.rpc('qr_caja_resumen_v2', {
        p_cliente_id: clienteId, p_desde: desde, p_hasta: hasta,
        p_mesa: filtros.mesa_num === '' ? null : mesaDesdeTexto(filtros.mesa_num),
        p_cerrados: true, p_turnos: rangoCaja?.rangos || null
      })
    ])
    if (ticketsResult.error) throw ticketsResult.error
    if (summaryResult.error) throw summaryResult.error
    if (!summaryResult.data) throw new Error('Resumen no disponible')
    if (request !== requestVersion.current) return
    setTicketsCaja(ticketsResult.data || [])
    setResumen(summaryResult.data)
    setTotales(summaryResult.data.totales)

    } catch (error) {
      if (request === requestVersion.current) {
        setErrorReporte('No se pudo completar el reporte: ' + error.message)
        setTicketsCaja([]); setResumen({ categorias: {}, tickets_count: 0, tickets_total: 0, tickets_items: 0, tickets_delivery: 0, tickets_propina: 0 }); setTotales({ comensales: 0, mesas_atendidas: 0, items_vendidos: 0, total_facturado: 0, items_promo: 0, descuento_promo: 0 })
      }
    } finally { if (request === requestVersion.current) setLoading(false) }
  }


  // Cambiar usuario o fechas desactiva el turno consultado (vuelve al día completo / período).
  // La mesa es un filtro más y convive con el turno.
  const handleFiltro = (campo, valor) => {
    setPagina(0)
    if (campo === 'fecha_desde') {
      if (!valor) return // Fecha desde es obligatoria
      setRangoCaja(null); setTurnoCaja('')
    } else if (campo === 'fecha_hasta') {
      setRangoCaja(null); setTurnoCaja('')
    }
    setFiltros(prev => ({ ...prev, [campo]: valor }))
  }

  const agruparPorCategoria = () => resumen.categorias || {}
  const filtroPersona = !!cobradorKey
  const money = n => `$${Number(n || 0).toFixed(2)}`
  const periodoTxt = hastaEf !== filtros.fecha_desde ? filtros.fecha_desde + ' → ' + hastaEf : filtros.fecha_desde
  // Desglose de un ticket. Usa las columnas guardadas y, si vienen en 0
  // (ticket anterior a la migración), lo deriva de items/total.
  const desgloseTicket = (ticket) => {
    const lista = Array.isArray(ticket.items) ? ticket.items : []
    const sumaTipo = tipo => lista.filter(i => i?.tipo === tipo).reduce((s, i) => s + Number(i.subtotal || 0), 0)
    const propina = Number(ticket.propina_monto) || sumaTipo('propina')
    const delivery = Number(ticket.delivery_monto) || sumaTipo('delivery')
    const items = Number(ticket.items_total) || Math.max(0, Number(ticket.total || 0) - propina - delivery)
    return { propina, delivery, items }
  }

  // Reimprime un ticket ya cobrado con la misma configuración de Ticket.
  // La ventana se abre en el mismo toque (antes de esperar a Supabase) para
  // que el navegador no la bloquee.
  const reimprimirTicket = async (ticket) => {
    let win = null
    try { win = window.open('', '_blank', 'width=320,height=600') } catch { win = null }
    try {
      const { data: cli } = await supabase.from('clientes').select('ticket_config, nombre_restaurante').eq('id', clienteId).single()
      const tc = cli?.ticket_config || {}
      const sep = '━'.repeat(TICKET_W)
      const fecha = new Date(ticket.cobrado_at)
      const lista = Array.isArray(ticket.items) ? ticket.items : []
      const productos = lista.filter(i => i?.tipo !== 'propina' && i?.tipo !== 'delivery')
      const { propina, delivery } = desgloseTicket(ticket)
      const lines = [sep]
      if (tc.showName !== false) lines.push('   ' + (cli?.nombre_restaurante || 'Restaurante'))
      if (tc.showMesa !== false) lines.push('   Mesa N° ' + etiquetaMesa(ticket.mesa))
      if (ticket.codigo_pedido) lines.push('   Pedido #' + ticket.codigo_pedido)
      if (tc.showFecha !== false) lines.push('   ' + fecha.toLocaleDateString('es-AR'))
      if (tc.showHora !== false) lines.push('   ' + fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }))
      if (tc.showCuit && tc.cuit) lines.push('   CUIT: ' + tc.cuit)
      lines.push(sep)
      // Mismo formato que el mensaje de WhatsApp y que el ticket impreso al cobrar: producto,
      // cantidad, promo, Subtotal, Descuento promo 2x1, Delivery, Propina y TOTAL a la derecha.
      lines.push(...armarCuerpoTicket({ productos, delivery, propina, total: Number(ticket.total || 0), tc, sep }))
      lines.push(sep)
      if (tc.showFooter !== false) {
        lines.push(sep)
        if (tc.footerText) lines.push('   ' + tc.footerText)
        if (tc.footerText2) lines.push('   ' + tc.footerText2)
      }
      const texto = lines.join('\n')
      const fontSize = tc.fontSize === 'grande' ? '16px' : tc.fontSize === 'pequeño' ? '10px' : '13px'
      if (win) {
        const seguro = texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        win.document.write(`<html><head><title>Ticket ${ticket.codigo_pedido || ticket.mesa}</title><style>body { font-family: 'Courier New', monospace; font-size: ${fontSize}; margin: 10px; white-space: pre; line-height: 1.4; } @media print { body { margin: 0; } }</style></head><body>${seguro}</body></html>`)
        win.document.close()
        win.print()
        toast.success('Ticket enviado a impresora')
      } else {
        await navigator.clipboard.writeText(texto)
        toast.success('Ticket copiado. Pegá en Bloc de notas e imprimí con Ctrl+P')
      }
    } catch (e) {
      if (win) win.close()
      toast.error('No se pudo imprimir el ticket: ' + (e?.message || 'error'))
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
      {errorReporte && <p role="alert" className="text-red-400 mb-4">{errorReporte}</p>}
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  return (
    <div>
      {errorReporte && <p role="alert" className="text-red-400 mb-4">{errorReporte}</p>}
      <div className="bg-dark-800 rounded-xl p-4 mb-6 border border-dark-700">
        <h3 className="font-bold text-white mb-1">Caja por usuario y turno</h3>
        <p className="text-sm text-dark-300 mb-4">Elegí usuario y fecha. Si dejás vacía “Fecha hasta” se muestra solo el día de “Fecha desde” (de 00:00 a 00:00); si la completás, todo ese período. Con “Turno asignado” y “Consultar caja del turno” ves únicamente ese horario. Cada ticket muestra quién realizó el cobro; los anteriores sin ese dato indican “Sin registrar”.</p>
        {errorUsuarios && <p role="alert" className="text-red-400 mb-2">{errorUsuarios}</p>}
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-dark-400 text-sm mb-1">Usuario</label>
            <select
              value={usuarioCaja}
              onChange={e => { setPagina(0); setRangoCaja(null); setTurnoCaja(''); setUsuarioCaja(e.target.value) }}
              className="bg-dark-900 border border-dark-600 rounded-lg px-3 py-2 text-white"
            >
              <option value="">Todos los usuarios</option>
              {ROLES_CAJA.map(r => {
                const lista = usuariosCaja.filter(u => u.rol === r.id)
                return lista.length ? <optgroup key={r.id} label={r.label}>{lista.map(u => <option key={u.key} value={u.key}>{u.nombre || u.usuario}{u.activo === false ? ' (inactivo)' : ''}</option>)}</optgroup> : null
              })}
              {usuariosCaja.some(u => !ROLES_CAJA.some(r => r.id === u.rol)) && (
                <optgroup label="Otros">{usuariosCaja.filter(u => !ROLES_CAJA.some(r => r.id === u.rol)).map(u => <option key={u.key} value={u.key}>{u.nombre || u.usuario} · {u.rol}</option>)}</optgroup>
              )}
            </select>
          </div>
          <div>
            <label className="block text-dark-400 text-sm mb-1">Fecha desde</label>
            <input
              type="date"
              value={filtros.fecha_desde}
              onChange={e => handleFiltro('fecha_desde', e.target.value)}
              className="bg-dark-900 border border-dark-600 rounded-lg px-3 py-2 text-white"
            />
          </div>
          <div>
            <label className="block text-dark-400 text-sm mb-1">Fecha hasta <span className="text-dark-500">(opcional)</span></label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={filtros.fecha_hasta}
                min={filtros.fecha_desde}
                onChange={e => handleFiltro('fecha_hasta', e.target.value)}
                className="bg-dark-900 border border-dark-600 rounded-lg px-3 py-2 text-white"
              />
              {filtros.fecha_hasta && <button type="button" onClick={() => handleFiltro('fecha_hasta', '')} className="text-xs text-dark-300 hover:text-white underline whitespace-nowrap">Solo ese día</button>}
            </div>
          </div>
          <div>
            <label className="block text-dark-400 text-sm mb-1">Mesa</label>
            <input
              type="number"
              value={filtros.mesa_num}
              onChange={e => handleFiltro('mesa_num', e.target.value)}
              placeholder="N°"
              className="w-20 bg-dark-900 border border-dark-600 rounded-lg px-3 py-2 text-white"
            />
          </div>
          <div>
            <label className="block text-dark-400 text-sm mb-1">Turno asignado</label>
            <select
              value={turnoCaja}
              disabled={!usuarioSeleccionado}
              onChange={e => { setPagina(0); setRangoCaja(null); setTurnoCaja(e.target.value) }}
              className="bg-dark-900 border border-dark-600 rounded-lg px-3 py-2 text-white disabled:opacity-50"
            >
              <option value="">Todos los horarios</option>
              {horariosDisponibles.map(h => <option key={h.index} value={h.index}>{h.nombre ? h.nombre + ' · ' : ''}{h.desde}–{h.hasta}{h.desde2 ? ' / ' + h.desde2 + '–' + h.hasta2 : ''}</option>)}
            </select>
          </div>
          <button disabled={!horariosDisponibles.some(h => String(h.index) === turnoCaja)} onClick={consultarTurno} className="bg-primary-500 text-white rounded-lg px-4 py-2 disabled:opacity-50">Consultar caja del turno</button>
        </div>
        {hastaInvalida && <p className="text-amber-400 text-sm mt-3">“Fecha hasta” es anterior a “Fecha desde”: se muestra solo el día de “Fecha desde”.</p>}
        {usuarioSeleccionado && !horariosDisponibles.length && <p className="text-amber-400 text-sm mt-3">Este usuario no tiene turnos guardados en el período elegido (se muestran todos los horarios). Asignalos desde Usuarios.</p>}
        {usuarioSeleccionado && !rangoCaja && <p className="text-green-400 mt-3">{comoTxt ? 'Mostrando solo los tickets de ' : 'Mostrando solo los cobros de '}{usuarioSeleccionado.nombre || usuarioSeleccionado.usuario}{comoTxt ? ' ' + comoTxt : ''} · Período: {periodoTxt} (todos los horarios) · Total cobrado: ${Number(resumen.tickets_total || 0).toFixed(2)}</p>}
        {rangoCaja && <p className="text-green-400 mt-3">Consulta aplicada: {rangoCaja.label} · Total cobrado: ${Number(resumen.tickets_total || 0).toFixed(2)}<span className="block text-dark-400 text-xs mt-1">Se muestra solo ese turno. Si cambiás el usuario o las fechas, vuelve a todos los horarios.</span></p>}
      </div>

      {/* Totales de los tickets cobrados (respetan todos los filtros, incluidos mozo y delivery) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-dark-800 rounded-xl p-4 border border-dark-700 text-center">
          <p className="text-dark-400 text-sm">Tickets</p>
          <p className="text-2xl font-bold text-white">{resumen.tickets_count}</p>
        </div>
        <div className="bg-cyan-500/10 rounded-xl p-4 border border-cyan-500/40 text-center">
          <p className="text-cyan-400 text-sm">Total caja</p>
          <p className="text-2xl font-bold text-cyan-400">{money(resumen.tickets_items)}</p>
        </div>
        <div className="bg-orange-500/10 rounded-xl p-4 border border-orange-500/40 text-center">
          <p className="text-orange-400 text-sm">🛵 Delivery</p>
          <p className="text-2xl font-bold text-orange-400">{money(resumen.tickets_delivery)}</p>
        </div>
        <div className="bg-yellow-500/10 rounded-xl p-4 border border-yellow-500/40 text-center">
          <p className="text-yellow-400 text-sm">🧑‍🍳 Propina</p>
          <p className="text-2xl font-bold text-yellow-400">{money(resumen.tickets_propina)}</p>
        </div>
        <div className="bg-green-500/20 rounded-xl p-4 border border-green-500/50 text-center">
          <p className="text-green-400 text-sm">Total cobrado</p>
          <p className="text-2xl font-bold text-green-400">{money(resumen.tickets_total)}</p>
        </div>
      </div>

      {/* Resumen */}
      <div className="bg-dark-800 rounded-xl border border-dark-700 overflow-hidden mb-6">
        <div className="p-4 border-b border-dark-700 flex items-center justify-between">
          <h3 className="text-white font-bold">🧾 Tickets cobrados</h3>
          <span className="text-green-400 text-sm font-bold">{resumen.tickets_count}</span>
        </div>
        {ticketsCaja.length === 0 ? (
          <p className="p-5 text-dark-400 text-sm text-center">{comoTxt?`No hay tickets donde ${usuarioSeleccionado.nombre||usuarioSeleccionado.usuario} figure ${comoTxt}. ${comoTxt==='como mozo'?'El mozo queda en el ticket cuando se lo asigna en la tarjeta de la mesa o se lo elige al cobrar.':'El repartidor queda en el ticket cuando se lo elige en Confirmar cobro (pedidos de Delivery).'}`:(usuarioSeleccionado||rangoCaja)?'No hay tickets cobrados para la selección actual (usuario, fecha y turno).':'Todavía no hay tickets cobrados.'}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-dark-700 text-white">
                  {['Código de pedido', 'Mesa', 'Fecha', 'Hora', 'Usuario de caja', 'Mozo', 'Repartidor', 'Producto', 'Cant.', 'P. unitario', 'Subtotal', 'Items', 'Delivery', 'Propina', 'Total del ticket', 'Impresión'].map(titulo => (
                    <th key={titulo} className="text-left p-3 whitespace-nowrap">{titulo}</th>
                  ))}
                </tr>
              </thead>
              {ticketsCaja.map(ticket => {
                const items = Array.isArray(ticket.items) && ticket.items.length ? ticket.items : [null]
                const usuario = ticket.cobrado_por
                const { propina, delivery, items: itemsMonto } = desgloseTicket(ticket)
                return (
                  <tbody key={ticket.id} className="border-t-2 border-dark-600 hover:bg-dark-700/30">
                    {items.map((item, index) => {
                      const esPropina = item?.tipo === 'propina'
                      const esDelivery = item?.tipo === 'delivery'
                      const colorExtra = esPropina ? 'text-yellow-400' : 'text-orange-400'
                      return (
                      <tr key={`${ticket.id}-${index}`} className={`border-t border-dark-700${esPropina ? ' bg-yellow-500/5' : esDelivery ? ' bg-orange-500/5' : ''}`}>
                        {index === 0 && <>
                          <td rowSpan={items.length} className="p-3 align-top text-cyan-400 font-mono font-bold whitespace-nowrap">#{ticket.codigo_pedido || '—'}</td>
                          <td rowSpan={items.length} className="p-3 align-top text-white">{etiquetaMesa(ticket.mesa)}</td>
                          <td rowSpan={items.length} className="p-3 align-top text-dark-300 whitespace-nowrap">{new Date(ticket.cobrado_at).toLocaleDateString('es-AR')}</td>
                          <td rowSpan={items.length} className="p-3 align-top text-dark-300 whitespace-nowrap">{new Date(ticket.cobrado_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</td>
                          <td rowSpan={items.length} className="p-3 align-top text-white">
                            <span>{usuario?.nombre || usuario?.usuario || 'Sin registrar'}</span>
                            {usuario?.usuario && usuario.usuario !== usuario.nombre && <p className="text-xs text-dark-400">{usuario.usuario}</p>}
                          </td>
                          <td rowSpan={items.length} className="p-3 align-top text-white whitespace-nowrap">{ticket.mozo_nombre || <span className="text-dark-500">—</span>}</td>
                          <td rowSpan={items.length} className="p-3 align-top text-white whitespace-nowrap">{ticket.delivery_nombre ? `🛵 ${ticket.delivery_nombre}` : (ticket.es_delivery ? <span className="text-dark-400">Sin asignar</span> : <span className="text-dark-500">—</span>)}</td>
                        </>}
                        <td className={`p-3 ${esPropina || esDelivery ? colorExtra + ' font-medium' : 'text-white'}`}>{item ? (esPropina ? '🧑‍🍳 Propina' : esDelivery ? '🛵 Delivery' : (item.nombre || 'Producto')) : 'Sin detalle de productos'}</td>
                        <td className="p-3 text-cyan-300">{item ? (esPropina || esDelivery ? '—' : `${item.cantidad || 0}x`) : '—'}{item?.promo && !esPropina && !esDelivery && <span className="ml-1 text-purple-400 text-xs whitespace-nowrap">🎁 {desgloseItem(item).etiqueta}{desgloseItem(item).descuento > 0 ? ` (paga ${item.cantidad_cobrada}) · desc. -${money(desgloseItem(item).descuento)}` : ''}</span>}</td>
                        <td className="p-3 text-dark-300 whitespace-nowrap">{item ? `$${Number(item.precio || 0).toFixed(2)}` : '—'}</td>
                        <td className={`p-3 whitespace-nowrap ${esPropina || esDelivery ? colorExtra + ' font-medium' : 'text-white'}`}>{item ? money(esPropina || esDelivery ? Number(item.subtotal ?? item.precio ?? 0) : desgloseItem(item).bruto) : '—'}</td>
                        {index === 0 && <>
                          <td rowSpan={items.length} className="p-3 align-top text-cyan-300 whitespace-nowrap">{money(itemsMonto)}</td>
                          <td rowSpan={items.length} className="p-3 align-top text-orange-400 whitespace-nowrap">{delivery > 0 ? money(delivery) : '—'}</td>
                          <td rowSpan={items.length} className="p-3 align-top text-yellow-400 whitespace-nowrap">{propina > 0 ? money(propina) : '—'}</td>
                          <td rowSpan={items.length} className="p-3 align-top text-green-400 font-bold whitespace-nowrap">${Number(ticket.total || 0).toFixed(2)}</td>
                          <td rowSpan={items.length} className="p-3 align-top text-dark-300 whitespace-nowrap"><button onClick={() => reimprimirTicket(ticket)} className="bg-dark-700 hover:bg-dark-600 text-white px-3 py-1.5 rounded-lg transition">{ticket.impreso ? '🖨️ Reimprimir' : '🖨️ Imprimir'}</button></td>
                        </>}
                      </tr>
                    )})}
                  </tbody>
                )
              })}
            </table>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 mb-6 text-white">
        <button className="bg-dark-700 px-3 py-2 rounded disabled:opacity-40" disabled={pagina === 0} onClick={() => setPagina(p => p - 1)}>Anterior</button>
        <span>Página {pagina + 1} · Los totales incluyen todo el período</span>
        <button className="bg-dark-700 px-3 py-2 rounded disabled:opacity-40" disabled={(pagina + 1) * PAGE_SIZE >= resumen.tickets_count} onClick={() => setPagina(p => p + 1)}>Siguiente</button>
      </div>
      {filtroPersona && (
        <p className="text-dark-400 text-sm mb-6">Con un filtro de usuario, mozo o delivery activo se muestran solo los totales de tickets de arriba. Los totales por producto y categoría no se asignan a un usuario, mozo o repartidor.</p>
      )}
      {/* Resumen */}
      {!filtroPersona && <>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <div className="bg-dark-800 rounded-xl p-4 border border-dark-700 text-center">
          <p className="text-dark-400 text-sm">Comensales</p>
          <p className="text-2xl font-bold text-white">{totales.comensales}</p>
        </div>
        <div className="bg-dark-800 rounded-xl p-4 border border-dark-700 text-center">
          <p className="text-dark-400 text-sm">Mesas</p>
          <p className="text-2xl font-bold text-white">{totales.mesas_atendidas}</p>
        </div>
        <div className="bg-dark-800 rounded-xl p-4 border border-dark-700 text-center">
          <p className="text-dark-400 text-sm">Items vendidos</p>
          <p className="text-2xl font-bold text-white">{totales.items_vendidos}</p>
        </div>
        <div className="bg-green-500/20 rounded-xl p-4 border border-green-500/50 text-center">
          <p className="text-green-400 text-sm">Total facturado</p>
          <p className="text-2xl font-bold text-green-400">${totales.total_facturado.toFixed(2)}</p>
        </div>
        <div className="bg-purple-500/20 rounded-xl p-4 border border-purple-500/50 text-center">
          <p className="text-purple-400 text-sm">Items promo</p>
          <p className="text-2xl font-bold text-purple-400">{totales.items_promo}</p>
        </div>
        <div className="bg-yellow-500/20 rounded-xl p-4 border border-yellow-500/50 text-center">
          <p className="text-yellow-400 text-sm">Descuento promo</p>
          <p className="text-2xl font-bold text-yellow-400">${totales.descuento_promo.toFixed(2)}</p>
        </div>
      </div>

      {/* Resumen por categoría */}
      <div className="bg-dark-800 rounded-xl p-4 mb-6 border border-dark-700">
        <h3 className="text-white font-bold mb-4">📊 Por Categoría</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {Object.entries(agruparPorCategoria()).map(([cat, data]) => (
            <div key={cat} className="bg-dark-700 rounded-lg p-3">
              <p className="text-white font-medium truncate">{cat}</p>
              <p className="text-dark-400 text-sm">{data.cantidad} items • ${data.total.toFixed(2)}</p>
            </div>
          ))}
        </div>
      </div>
      </>}

    </div>
  )
}
