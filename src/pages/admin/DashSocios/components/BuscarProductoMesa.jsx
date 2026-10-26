import { useState, useEffect, useMemo } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { estadoPromo, textoHorarioPromo } from '@/lib/promoVigencia'
import { fmtMonto } from '@/lib/ticketFormat'
import { MESA_00, codigoMesa00 } from '@/lib/mesa00'

// ============================================================================
// Buscar producto (arriba de las mesas)
// ============================================================================
// Carga a mano un pedido sin pasar por el QR:
//   1) se escribe el nombre y se elige el producto de la Carta (la que se cargó con el Excel);
//   2) cada producto muestra su precio, un check y la cantidad; el importe sube en proporción;
//   3) si hay una promo vigente que aplica al producto se puede elegir (2x1);
//   4) se elige la mesa (1, 2, 3...) o "Mesa 00" (cliente que no se queda en el local, igual se
//      factura) y se agrega. Después se cobra desde Mesas igual que cualquier pedido, y el
//      ticket queda en Caja.
//
// Se guarda EXACTAMENTE como lo guarda el menú QR (comensales + pedidos_qr), así que el cobro, el
// ticket, Caja y los reportes no necesitan saber de dónde vino el pedido.

const NOMBRE_LOCAL = 'Pedido del local'
const es2x1 = tipo => tipo === '2x1_mismo' || tipo === '2x1_categoria'
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()

const parseLista = valor => {
  if (!valor) return []
  try {
    const v = JSON.parse(valor)
    return Array.isArray(v) ? v.map(String) : [String(v)]
  } catch { return [String(valor)] }
}

// Misma regla que el menú (usarPromo): 2x1 mismo producto / descuento → por producto elegido
// (id o nombre); 2x1 categoría → todos los productos de esa categoría.
function promoAplica(promo, producto, nombreCategoria) {
  if (promo.tipo === '2x1_categoria') return !!promo.categoria && norm(promo.categoria) === norm(nombreCategoria)
  if (parseLista(promo.producto_id).includes(String(producto.id))) return true
  return parseLista(promo.producto_nombre).map(norm).includes(norm(producto.nombre))
}

const precioDe = p => Number(p?.precio) || 0

export default function BuscarProductoMesa({ clienteId, mesas = [], onAgregado }) {
  const [abierto, setAbierto] = useState(true)
  const [productos, setProductos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [promos, setPromos] = useState([])
  const [usosPorPromo, setUsosPorPromo] = useState({})
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')
  const [tick, setTick] = useState(0)

  const [query, setQuery] = useState('')
  const [listaAbierta, setListaAbierta] = useState(false)
  const [lineas, setLineas] = useState([]) // { producto, qty, check, promoId }
  const [destino, setDestino] = useState('') // '' | '00' | número de mesa
  const [nombreCliente, setNombreCliente] = useState('')
  const [guardando, setGuardando] = useState(false)

  const cargar = async () => {
    if (!clienteId) return
    setErrorCarga('')
    const [pr, ca, po] = await Promise.all([
      supabase.from('productos').select('id, nombre, precio, categoria_id').eq('cliente_id', clienteId).order('nombre'),
      supabase.from('categorias').select('id, nombre').eq('cliente_id', clienteId),
      supabase.from('promociones').select('*').eq('cliente_id', clienteId)
    ])
    if (pr.error) setErrorCarga('No se pudo cargar la Carta: ' + pr.error.message)
    else setProductos(pr.data || [])
    if (!ca.error) setCategorias(ca.data || [])
    if (!po.error) {
      const lista = po.data || []
      setPromos(lista)
      // Usos ya canjeados por promo (para respetar el cupo máximo igual que el resto del sistema).
      if (lista.length > 0) {
        const us = await supabase.from('promociones_cliente').select('promocion_id, usada').in('promocion_id', lista.map(p => p.id))
        if (!us.error) {
          const conteo = {}
          ;(us.data || []).forEach(u => { if (u.usada) conteo[u.promocion_id] = (conteo[u.promocion_id] || 0) + 1 })
          setUsosPorPromo(conteo)
        }
      } else setUsosPorPromo({})
    }
    setCargando(false)
  }

  useEffect(() => { cargar() }, [clienteId])

  // Las promos tienen días y horario: se revalidan cada 30 s por si una vence con el panel abierto.
  useEffect(() => {
    const t = setInterval(() => setTick(x => x + 1), 30000)
    return () => clearInterval(t)
  }, [])

  const catNombre = useMemo(() => new Map(categorias.map(c => [c.id, c.nombre])), [categorias])

  const promoVigente = id => {
    const p = promos.find(x => x.id === id)
    return p && estadoPromo(p, usosPorPromo[p.id] || 0) === 'activa' ? p : null
  }
  const promosVigentes = useMemo(
    () => promos.filter(p => estadoPromo(p, usosPorPromo[p.id] || 0) === 'activa'),
    [promos, usosPorPromo, tick]
  )

  const resultados = useMemo(() => {
    const q = norm(query)
    if (!q) return []
    const tokens = q.split(/\s+/).filter(Boolean)
    return productos
      .map(p => ({ p, n: norm(p.nombre), c: norm(catNombre.get(p.categoria_id)) }))
      .filter(x => tokens.every(t => x.n.includes(t) || x.c.includes(t)))
      .sort((a, b) => (b.n.startsWith(q) ? 1 : 0) - (a.n.startsWith(q) ? 1 : 0) || a.n.localeCompare(b.n))
      .slice(0, 8)
      .map(x => x.p)
  }, [query, productos, catNombre])

  const elegirProducto = (producto) => {
    setLineas(prev => {
      const existente = prev.find(l => l.producto.id === producto.id)
      if (existente) return prev.map(l => l.producto.id === producto.id ? { ...l, qty: l.qty + 1, check: true } : l)
      return [...prev, { producto, qty: 1, check: true, promoId: '' }]
    })
    setQuery('')
    setListaAbierta(false)
  }

  const cambiarLinea = (id, patch) => setLineas(prev => prev.map(l => l.producto.id === id ? { ...l, ...patch } : l))
  const quitarLinea = (id) => setLineas(prev => prev.filter(l => l.producto.id !== id))
  const setCantidad = (id, valor) => {
    const n = Math.max(1, Math.min(999, parseInt(valor, 10) || 1))
    cambiarLinea(id, { qty: n })
  }

  // Con 2x1 la cantidad son PROMOS (pares): llevás 2 por cada una y pagás 1 → siempre se cobra
  // precio × cantidad. Es lo mismo que guarda el menú (cantidad 2, es_promo 1 → se cobra 1).
  const importeLinea = l => precioDe(l.producto) * l.qty
  const seleccionadas = lineas.filter(l => l.check && l.qty > 0)
  const totalAgregar = seleccionadas.reduce((s, l) => s + importeLinea(l), 0)

  const numerosMesa = mesas.map(m => m.numero).filter(n => n > 0).sort((a, b) => a - b)

  const agregar = async () => {
    if (guardando) return
    if (!destino) { toast.error('Elegí la mesa'); return }
    if (seleccionadas.length === 0) { toast.error('Marcá al menos un producto'); return }

    // Promo elegida: vuelve a validarse ahora (día, horario y cupo) antes de guardar.
    const items = []
    for (const l of seleccionadas) {
      let promo = null
      if (l.promoId) {
        promo = promoVigente(l.promoId)
        if (!promo) { toast.error(`La promo de "${l.producto.nombre}" ya no está vigente`); return }
        if (!es2x1(promo.tipo)) { toast.error('Ese tipo de promo no se puede cargar acá'); return }
      }
      items.push({
        producto_id: l.producto.id,
        cantidad: promo ? l.qty * 2 : l.qty,
        es_promo: promo ? 1 : 0
      })
    }

    setGuardando(true)
    let comensalCreado = null
    try {
      let comensalId
      let numero = null

      if (destino === '00') {
        // Mesa 00: cada carga es un pedido nuevo e independiente (como Mesa 0), con su código.
        const { data: base, error: eCodigo } = await supabase.rpc('generar_codigo_pedido', { p_cliente_id: clienteId, p_mesa: 0 })
        if (eCodigo || !base) throw new Error('No se pudo generar el código del pedido' + (eCodigo ? ': ' + eCodigo.message : ''))
        const { data: nuevo, error: eCom } = await supabase
          .from('comensales')
          .insert({
            cliente_id: clienteId,
            mesa: MESA_00,
            nombre: nombreCliente.trim() || 'Cliente Mesa 00',
            telefono: '',
            direccion: '',
            sesion_id: crypto.randomUUID(),
            activo: 1,
            codigo_pedido: codigoMesa00(base),
            estado_pedido: 'nuevo',
            metodo_entrega: 'retiro'
          })
          .select('id')
          .single()
        if (eCom) throw eCom
        comensalId = nuevo.id
        comensalCreado = nuevo.id
      } else {
        // Mesa 1+: se suma al comensal "Pedido del local" de esa mesa (si ya hay uno abierto), así
        // los agregados sucesivos quedan juntos; si no, se crea.
        numero = Number(destino)
        const { data: existente, error: eEx } = await supabase
          .from('comensales')
          .select('id')
          .eq('cliente_id', clienteId)
          .eq('mesa', numero)
          .eq('nombre', NOMBRE_LOCAL)
          .or('estado_pedido.is.null,estado_pedido.neq.cerrado')
          .order('id', { ascending: false })
          .limit(1)
        if (eEx) throw eEx
        if (existente && existente.length > 0) {
          comensalId = existente[0].id
        } else {
          const { data: nuevo, error: eCom } = await supabase
            .from('comensales')
            .insert({ cliente_id: clienteId, mesa: numero, nombre: NOMBRE_LOCAL, sesion_id: crypto.randomUUID(), activo: 1 })
            .select('id')
            .single()
          if (eCom) throw eCom
          comensalId = nuevo.id
          comensalCreado = nuevo.id
        }
      }

      const fecha = new Date().toISOString()
      const { error: ePed } = await supabase
        .from('pedidos_qr')
        .insert(items.map(i => ({ comensal_id: comensalId, producto_id: i.producto_id, cantidad: i.cantidad, pagado: 0, es_promo: i.es_promo, fecha_hora: fecha })))
      if (ePed) throw ePed

      if (numero !== null) {
        await supabase
          .from('mesas_operacion')
          .upsert({ cliente_id: clienteId, numero, estado: 'Ocupada' }, { onConflict: 'cliente_id,numero' })
      }

      toast.success(destino === '00' ? 'Agregado a Mesa 00' : `Agregado a Mesa ${numero}`)
      setLineas([])
      setNombreCliente('')
      onAgregado?.(destino)
    } catch (e) {
      // Si el comensal se creó en este intento y los productos no se pudieron guardar, se borra
      // para no dejar un pedido vacío colgado.
      if (comensalCreado) await supabase.from('comensales').delete().eq('id', comensalCreado)
      toast.error('No se pudo agregar: ' + (e?.message || 'error desconocido'))
    } finally {
      setGuardando(false)
    }
  }

  const inputCls = 'bg-dark-900 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-400'

  return (
    <div className="bg-dark-800 rounded-xl border border-dark-700 mb-6">
      <button
        type="button"
        onClick={() => { setAbierto(a => !a); if (!abierto) cargar() }}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-white font-bold flex items-center gap-2">
          🔎 Buscar producto
          {!cargando && <span className="text-dark-400 text-xs font-normal">({productos.length} en la Carta)</span>}
        </span>
        <span className="text-dark-400 text-sm">{abierto ? '▲' : '▼'}</span>
      </button>

      {abierto && (
        <div className="px-4 pb-4 pt-3 border-t border-dark-700 space-y-3">
          {errorCarga && <p role="alert" className="text-red-400 text-sm">{errorCarga}</p>}

          {/* Buscador */}
          <div className="relative">
            <div className="flex gap-2">
              <input
                type="text"
                value={query}
                onChange={e => { setQuery(e.target.value); setListaAbierta(true) }}
                onFocus={() => setListaAbierta(true)}
                onBlur={() => setTimeout(() => setListaAbierta(false), 150)}
                onKeyDown={e => { if (e.key === 'Enter' && resultados[0]) { e.preventDefault(); elegirProducto(resultados[0]) } }}
                placeholder={cargando ? 'Cargando Carta…' : 'Escribí el nombre del producto…'}
                disabled={cargando}
                className={`flex-1 ${inputCls}`}
                autoComplete="off"
              />
              <button
                type="button"
                onClick={cargar}
                title="Actualizar productos y promos"
                className="px-3 bg-dark-700 hover:bg-dark-600 text-white rounded-lg text-sm transition"
              >
                ↻
              </button>
            </div>
            {listaAbierta && query.trim() && (
              <div className="absolute z-20 left-0 right-12 mt-1 bg-dark-900 border border-dark-600 rounded-lg shadow-xl max-h-72 overflow-auto">
                {resultados.length === 0 ? (
                  <p className="px-3 py-2 text-dark-400 text-sm">No hay productos con ese nombre</p>
                ) : resultados.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onMouseDown={e => { e.preventDefault(); elegirProducto(p) }}
                    className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left hover:bg-dark-700 border-b border-dark-700/60 last:border-b-0"
                  >
                    <span className="min-w-0">
                      <span className="block text-white text-sm truncate">{p.nombre}</span>
                      {catNombre.get(p.categoria_id) && <span className="block text-dark-400 text-[11px] truncate">{catNombre.get(p.categoria_id)}</span>}
                    </span>
                    <span className="text-green-400 font-bold text-sm whitespace-nowrap">{fmtMonto(precioDe(p))}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Productos elegidos */}
          {lineas.length > 0 && (
            <div className="space-y-2">
              {lineas.map(l => {
                const id = l.producto.id
                const nombreCat = catNombre.get(l.producto.categoria_id)
                const aplicables = promosVigentes.filter(p => promoAplica(p, l.producto, nombreCat))
                const con2x1 = aplicables.filter(p => es2x1(p.tipo))
                const otras = aplicables.filter(p => !es2x1(p.tipo))
                const promoElegida = l.promoId ? promoVigente(l.promoId) : null
                const promoVencida = !!l.promoId && !promoElegida
                return (
                  <div key={id} className={`flex flex-wrap items-center gap-3 bg-dark-900/60 border rounded-lg px-3 py-2 ${l.check ? 'border-cyan-500/50' : 'border-dark-700 opacity-60'}`}>
                    <input
                      type="checkbox"
                      checked={l.check}
                      onChange={e => cambiarLinea(id, { check: e.target.checked })}
                      className="accent-cyan-500 w-4 h-4"
                      title="Incluir en el pedido"
                    />
                    <div className="flex-1 min-w-[150px]">
                      <p className="text-white text-sm font-medium">{l.producto.nombre}</p>
                      <p className="text-dark-400 text-xs">
                        {fmtMonto(precioDe(l.producto))} c/u
                        {promoElegida && <span className="ml-2 text-purple-400">🎁 2x1: llevás {l.qty * 2}, pagás {l.qty}</span>}
                      </p>
                      {promoVencida && <p className="text-amber-400 text-xs">Esa promo ya no está vigente: elegí otra o “Sin promo”.</p>}
                    </div>

                    {(con2x1.length > 0 || otras.length > 0 || promoVencida) && (
                      <select
                        value={l.promoId}
                        onChange={e => cambiarLinea(id, { promoId: e.target.value })}
                        className="bg-dark-900 border border-dark-600 rounded-lg px-2 py-1.5 text-white text-xs max-w-[190px]"
                        title="Promociones vigentes para este producto"
                      >
                        <option value="">Sin promo</option>
                        {promoVencida && <option value={l.promoId} disabled>(promo vencida)</option>}
                        {con2x1.map(p => <option key={p.id} value={p.id} title={textoHorarioPromo(p)}>🎁 {p.titulo}</option>)}
                        {otras.map(p => <option key={p.id} value={p.id} disabled>🎁 {p.titulo} (descuento %: no disponible acá)</option>)}
                      </select>
                    )}

                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => setCantidad(id, l.qty - 1)} className="w-7 h-7 bg-dark-700 hover:bg-dark-600 text-white rounded-md font-bold">−</button>
                      <input
                        type="number"
                        min="1"
                        max="999"
                        value={l.qty}
                        onChange={e => setCantidad(id, e.target.value)}
                        className="w-12 bg-dark-900 border border-dark-600 rounded-md py-1 text-white text-sm text-center"
                        title={promoElegida ? 'Cantidad de promos 2x1' : 'Cantidad'}
                      />
                      <button type="button" onClick={() => setCantidad(id, l.qty + 1)} className="w-7 h-7 bg-dark-700 hover:bg-dark-600 text-white rounded-md font-bold">+</button>
                    </div>

                    <span className="text-green-400 font-bold text-sm w-24 text-right tabular-nums">{fmtMonto(importeLinea(l))}</span>
                    <button type="button" onClick={() => quitarLinea(id)} className="text-red-400 hover:text-red-300 text-sm" title="Quitar">✕</button>
                  </div>
                )
              })}
            </div>
          )}

          {/* Destino */}
          <div className="flex flex-wrap items-end gap-3 pt-1">
            <label className="text-dark-400 text-xs">
              <span className="block mb-1">Mesa</span>
              <select value={destino} onChange={e => setDestino(e.target.value)} className={`min-w-[170px] ${inputCls}`}>
                <option value="">Elegir mesa…</option>
                <option value="00">Mesa 00 · Para llevar</option>
                {numerosMesa.map(n => <option key={n} value={String(n)}>Mesa {n}</option>)}
              </select>
            </label>
            {destino === '00' && (
              <label className="text-dark-400 text-xs">
                <span className="block mb-1">Nombre (opcional)</span>
                <input type="text" value={nombreCliente} onChange={e => setNombreCliente(e.target.value)} placeholder="Ej: Juan" maxLength={60} className={`w-40 ${inputCls}`} />
              </label>
            )}
            <div className="ml-auto flex items-center gap-4">
              <div className="text-right">
                <p className="text-dark-400 text-xs">A agregar</p>
                <p className="text-green-400 font-bold text-lg tabular-nums">{fmtMonto(totalAgregar)}</p>
              </div>
              <button
                type="button"
                onClick={agregar}
                disabled={guardando || !destino || seleccionadas.length === 0}
                className="px-4 py-2.5 bg-cyan-500 hover:bg-cyan-400 disabled:bg-dark-600 disabled:text-dark-400 disabled:cursor-not-allowed text-black font-bold rounded-lg text-sm transition"
              >
                {guardando ? 'Agregando…' : '➕ Agregar a la mesa'}
              </button>
            </div>
          </div>
          {destino === '00' && (
            <p className="text-dark-400 text-xs">
              Mesa 00 es para clientes que no se quedan en el local: no ocupa ninguna mesa. El pedido aparece en la sección “Mesa 00” de abajo, desde donde se cobra y queda en Caja.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
