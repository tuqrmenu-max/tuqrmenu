import { applyDateBounds } from '@/lib/readPages'
import { reportBounds } from '@/lib/reportBounds'
import { startVisiblePolling } from '@/lib/visiblePolling'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

export default function CajaReportes({ clienteId }) {
  const requestVersion = useRef(0)
  const [pagina, setPagina] = useState(0)
  const [resumen, setResumen] = useState({ categorias: {}, tickets_count: 0, tickets_total: 0 })
  const PAGE_SIZE = 25
  const [usuariosCaja, setUsuariosCaja] = useState([])
  // Mozos y repartidores del restaurante (RPC: un mozo/cajero no puede leer
  // las filas de sus compañeros en cliente_usuarios por RLS).
  const [equipoOp, setEquipoOp] = useState([])
  const [errorUsuarios, setErrorUsuarios] = useState('')
  const [usuarioCaja, setUsuarioCaja] = useState('')
  const [fechaTurno, setFechaTurno] = useState(() => { const d=new Date(); return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-') })
  const [turnoCaja, setTurnoCaja] = useState('')
  const [rangoCaja, setRangoCaja] = useState(null)
  useEffect(() => {
    let alive=true
    setPagina(0);setUsuariosCaja([]);setEquipoOp([]);setUsuarioCaja('');setTurnoCaja('');setRangoCaja(null)
    const refresh=async()=>{
      const [{data,error},{data:equipo,error:equipoError}]=await Promise.all([
        supabase.from('cliente_usuarios').select('id,nombre,usuario,rol,activo,horarios').eq('cliente_id',clienteId).order('nombre'),
        supabase.rpc('qr_equipo_operativo',{p_cliente_id:clienteId})
      ])
      if(!alive)return
      setErrorUsuarios(error||equipoError ? 'No se pudieron cargar usuarios, turnos y equipo. Reintentando…' : '')
      if(!error)setUsuariosCaja(data||[])
      if(!equipoError)setEquipoOp(equipo||[])
    }
    if(!clienteId)return
    const stop = startVisiblePolling(refresh,60000)
    return ()=>{alive=false;stop()}
  },[clienteId])
  const usuarioSeleccionado=usuariosCaja.find(u=>String(u.id)===usuarioCaja)
  const diaTurno=new Date(fechaTurno+'T12:00:00')
  const horariosDisponibles=(usuarioSeleccionado?.horarios||[]).map((h,index)=>({...h,index})).filter(h=>h.activo!==false && (h.fechas?.length ? h.fechas.includes(fechaTurno) : (h.dias||[]).includes((diaTurno.getDay()+6)%7)))
  const consultarTurno=()=>{
    setPagina(0)
    const h=horariosDisponibles.find(h=>String(h.index)===turnoCaja)
    if(!h||!fechaTurno)return
    const rangos=[]
    let previousEnd=null
    for(const [desde,hasta] of [[h.desde,h.hasta],[h.desde2,h.hasta2]]){
      if(!desde||!hasta)continue
      const start=new Date(fechaTurno+'T'+desde+':00')
      if(previousEnd && start<previousEnd)start.setDate(start.getDate()+1)
      const end=new Date(start);const [hh,mm]=hasta.split(':').map(Number);end.setHours(hh,mm,0,0)
      if(end<=start)end.setDate(end.getDate()+1)
      if(!Number.isFinite(+start)||!Number.isFinite(+end))return
      rangos.push([start.toISOString(),end.toISOString()]);previousEnd=end
    }
    if(!rangos.length)return
    setFiltros(prev=>({...prev,fecha_desde:'',fecha_hasta:''}))
    setRangoCaja({rangos,label:(usuarioSeleccionado.nombre||usuarioSeleccionado.usuario)+' · '+fechaTurno+' · '+h.desde+'–'+h.hasta+(h.desde2?' / '+h.desde2+'–'+h.hasta2:'')})
  }
  const [errorReporte, setErrorReporte] = useState('')
  const [ticketsCaja, setTicketsCaja] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtros, setFiltros] = useState({
    fecha_desde: fechaTurno,
    fecha_hasta: fechaTurno,
    mesa_num: '',
    mozo_id: '',
    delivery: '',
    incluir_cerrados: true
  })
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
  }, [filtros, clienteId, rangoCaja, pagina])

  const fetchPedidos = async () => {
    const request=++requestVersion.current
    setLoading(true)
    setErrorReporte('')
    try {
    const { desde, hasta } = reportBounds(filtros)
    let query = supabase.from('tickets_caja').select('id,mesa,codigo_pedido,cobrado_at,cobrado_por,items,total,impreso,items_total,delivery_monto,propina_monto,es_delivery,mozo_id,mozo_nombre,delivery_user_id,delivery_nombre').eq('cliente_id', clienteId)
    query = applyDateBounds(query, 'cobrado_at', filtros, rangoCaja)
    if (filtros.mesa_num !== '') query = query.eq('mesa', Number(filtros.mesa_num))
    // Filtro por mozo y por delivery ('__todos' = cualquier pedido con delivery)
    if (filtros.mozo_id) query = query.eq('mozo_id', filtros.mozo_id)
    if (filtros.delivery === '__todos') query = query.eq('es_delivery', true)
    else if (filtros.delivery) query = query.eq('delivery_user_id', filtros.delivery)
    const [ticketsResult, summaryResult] = await Promise.all([
      query.order('cobrado_at', { ascending: false }).order('id').range(pagina * PAGE_SIZE, (pagina + 1) * PAGE_SIZE - 1),
      supabase.rpc('qr_caja_resumen_v2', {
        p_cliente_id: clienteId, p_desde: desde, p_hasta: hasta,
        p_mesa: filtros.mesa_num === '' ? null : Number(filtros.mesa_num),
        p_cerrados: filtros.incluir_cerrados, p_turnos: rangoCaja?.rangos || null,
        p_mozo: filtros.mozo_id || null,
        p_delivery: filtros.delivery && filtros.delivery !== '__todos' ? filtros.delivery : null,
        p_solo_delivery: filtros.delivery === '__todos'
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


  const handleFiltro = (campo, valor) => {
    setPagina(0)
    setFiltros(prev => ({ ...prev, [campo]: valor }))
  }

  const limpiarFiltros = () => {
    setPagina(0)
    setRangoCaja(null)
    setUsuarioCaja('');setTurnoCaja('')
    setFiltros({ fecha_desde: '', fecha_hasta: '', mesa_num: '', mozo_id: '', delivery: '', incluir_cerrados: true })
  }

  const agruparPorCategoria = () => resumen.categorias || {}
  const mozos = equipoOp.filter(u => u.rol === 'mozo')
  const repartidores = equipoOp.filter(u => u.rol === 'delivery')
  const filtroPersona = !!(filtros.mozo_id || filtros.delivery)
  const money = n => `$${Number(n || 0).toFixed(2)}`
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
      <div className="bg-dark-800 rounded-xl p-4 mb-4 border border-dark-700">
        <h3 className="font-bold text-white mb-2">Caja por usuario y turno</h3>
        <p className="text-sm text-dark-300 mb-3">Consulta movimientos del horario seleccionado. Cada ticket muestra quién realizó el cobro; los anteriores sin ese dato indican “Sin registrar”.</p>
        {errorUsuarios && <p role="alert" className="text-red-400 mb-2">{errorUsuarios}</p>}
        <div className="flex flex-wrap gap-3 items-end">
          <label className="text-sm text-white">Usuario
            <select className="block bg-dark-700 rounded p-2" value={usuarioCaja} onChange={e=>{setUsuarioCaja(e.target.value);setTurnoCaja('')}}>
              <option value="">Seleccionar usuario</option>
              {usuariosCaja.map(u=><option key={u.id} value={u.id}>{u.nombre||u.usuario} · {u.rol}{u.activo===false?' (inactivo)':''}</option>)}
            </select>
          </label>
          <label className="text-sm text-white">Fecha del turno
            <input type="date" className="block bg-dark-700 rounded p-2" value={fechaTurno} onChange={e=>{setFechaTurno(e.target.value);setTurnoCaja('')}} />
          </label>
          <label className="text-sm text-white">Turno asignado
            <select className="block bg-dark-700 rounded p-2" value={turnoCaja} onChange={e=>setTurnoCaja(e.target.value)}>
              <option value="">Seleccionar turno</option>
              {horariosDisponibles.map(h=><option key={h.index} value={h.index}>{h.desde}–{h.hasta}{h.desde2?' / '+h.desde2+'–'+h.hasta2:''}</option>)}
            </select>
          </label>
          <button disabled={!horariosDisponibles.some(h=>String(h.index)===turnoCaja)} onClick={consultarTurno} className="bg-primary-500 text-white rounded px-4 py-2 disabled:opacity-50">Consultar caja del turno</button>
          <button onClick={()=>{setPagina(0);setRangoCaja(null)}} className="bg-dark-700 text-white rounded px-4 py-2">Todos los horarios</button>
        </div>
        {usuarioCaja&&!horariosDisponibles.length&&<p className="text-amber-400 text-sm mt-3">Este usuario no tiene turnos guardados para la fecha seleccionada. Asignalos desde Usuarios.</p>}
        {rangoCaja&&<p className="text-green-400 mt-3">Consulta aplicada: {rangoCaja.label} · Total cobrado: ${Number(resumen.tickets_total || 0).toFixed(2)}</p>}
      </div>
      {/* Filtros */}
      <div className="bg-dark-800 rounded-xl p-4 mb-6 border border-dark-700">
        <div className="flex flex-wrap items-end gap-4">
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
            <label className="block text-dark-400 text-sm mb-1">Fecha hasta</label>
            <input
              type="date"
              value={filtros.fecha_hasta}
              onChange={e => handleFiltro('fecha_hasta', e.target.value)}
              className="bg-dark-900 border border-dark-600 rounded-lg px-3 py-2 text-white"
            />
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
            <label className="block text-dark-400 text-sm mb-1">Mozo</label>
            <select
              value={filtros.mozo_id}
              onChange={e => handleFiltro('mozo_id', e.target.value)}
              className="bg-dark-900 border border-dark-600 rounded-lg px-3 py-2 text-white"
            >
              <option value="">Todos</option>
              {mozos.map(u => <option key={u.user_id} value={u.user_id}>{u.nombre || u.usuario}{u.activo === false ? ' (inactivo)' : ''}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-dark-400 text-sm mb-1">Delivery</label>
            <select
              value={filtros.delivery}
              onChange={e => handleFiltro('delivery', e.target.value)}
              className="bg-dark-900 border border-dark-600 rounded-lg px-3 py-2 text-white"
            >
              <option value="">Todos</option>
              <option value="__todos">Solo pedidos con delivery</option>
              {repartidores.map(u => <option key={u.user_id} value={u.user_id}>🛵 {u.nombre || u.usuario}{u.activo === false ? ' (inactivo)' : ''}</option>)}
            </select>
          </div>
          <button
            onClick={limpiarFiltros}
            className="bg-dark-700 hover:bg-dark-600 text-white px-4 py-2 rounded-lg transition"
          >
            Limpiar
          </button>
          <label className="flex items-center gap-2 text-dark-300 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={filtros.incluir_cerrados}
              onChange={e => handleFiltro('incluir_cerrados', e.target.checked)}
              className="w-4 h-4 accent-green-500"
            />
            Incluir cerrados (caja diaria)
          </label>
        </div>
      </div>

      {/* Totales de los tickets cobrados (respetan todos los filtros, incluidos mozo y delivery) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-dark-800 rounded-xl p-4 border border-dark-700 text-center">
          <p className="text-dark-400 text-sm">Tickets</p>
          <p className="text-2xl font-bold text-white">{resumen.tickets_count}</p>
        </div>
        <div className="bg-cyan-500/10 rounded-xl p-4 border border-cyan-500/40 text-center">
          <p className="text-cyan-400 text-sm">Items</p>
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
          <p className="p-5 text-dark-400 text-sm text-center">Todavía no hay tickets cobrados.</p>
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
                          <td rowSpan={items.length} className="p-3 align-top text-white">{ticket.mesa}</td>
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
                        <td className="p-3 text-cyan-300">{item ? (esPropina || esDelivery ? '—' : `${item.cantidad || 0}x`) : '—'}</td>
                        <td className="p-3 text-dark-300 whitespace-nowrap">{item ? `$${Number(item.precio || 0).toFixed(2)}` : '—'}</td>
                        <td className={`p-3 whitespace-nowrap ${esPropina || esDelivery ? colorExtra + ' font-medium' : 'text-white'}`}>{item ? `$${Number(item.subtotal ?? ((item.precio || 0) * (item.cantidad || 0))).toFixed(2)}` : '—'}</td>
                        {index === 0 && <>
                          <td rowSpan={items.length} className="p-3 align-top text-cyan-300 whitespace-nowrap">{money(itemsMonto)}</td>
                          <td rowSpan={items.length} className="p-3 align-top text-orange-400 whitespace-nowrap">{delivery > 0 ? money(delivery) : '—'}</td>
                          <td rowSpan={items.length} className="p-3 align-top text-yellow-400 whitespace-nowrap">{propina > 0 ? money(propina) : '—'}</td>
                          <td rowSpan={items.length} className="p-3 align-top text-green-400 font-bold whitespace-nowrap">${Number(ticket.total || 0).toFixed(2)}</td>
                          <td rowSpan={items.length} className="p-3 align-top text-dark-300 whitespace-nowrap">{ticket.impreso ? '🖨️ Impreso' : '💰 Cobrado sin imprimir'}</td>
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
        <p className="text-dark-400 text-sm mb-6">Con un filtro de mozo o delivery activo se muestran solo los totales de tickets de arriba. Los totales por producto y categoría no se asignan a mozo/repartidor.</p>
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
