// Desglose y formato comunes de pedido / ticket (Mesas, cobro, impresión y reimpresión de Caja).
// Mismo orden que el mensaje de WhatsApp del menú:
//   producto, cantidad, promo → Subtotal → Descuento promo 2x1 → Delivery → Propina → TOTAL
// con todos los importes alineados a la derecha y el TOTAL debajo de los demás precios.

// Promo 2x1: el menú guarda el producto promocionado con cantidad 2 y es_promo=1, pero SOLO se
// cobra una unidad por cada par (2x1 = paga 1). "cantidad" es lo que se entrega;
// "cantidadCobrada" lo que se cobra.
export const esPromoFlag = v => v === 1 || v === true || v === '1' || v === 'true'
export const cantidadCobrada = i => (esPromoFlag(i?.es_promo) ? Math.ceil((Number(i.cantidad) || 0) / 2) : Number(i?.cantidad) || 0)
export const monto = i => (Number(i?.precio) || 0) * cantidadCobrada(i)

export const fmtMonto = n => '$' + (Number(n) || 0).toFixed(2)

// Desglose de UN item. Sirve para items "vivos" (pedidos_qr: es_promo) y para items ya guardados
// en tickets_caja.items (promo / cantidad_cobrada).
//   bruto     = precio × cantidad entregada (lo que muestra el mensaje de WhatsApp)
//   neto      = lo que realmente se cobra
//   descuento = bruto − neto (solo en promos 2x1)
export function desgloseItem(i) {
  const cantidad = Number(i?.cantidad) || 0
  const promo = esPromoFlag(i?.es_promo) || !!i?.promo
  const cobrada = promo
    ? (i?.cantidad_cobrada != null && i.cantidad_cobrada !== '' ? Number(i.cantidad_cobrada) : Math.ceil(cantidad / 2))
    : cantidad
  let precio = Number(i?.precio) || 0
  // Ticket guardado sin precio unitario: se deduce de lo cobrado.
  if (!precio && i?.subtotal != null && cobrada > 0) precio = (Number(i.subtotal) || 0) / cobrada
  const bruto = precio * cantidad
  const neto = precio * cobrada
  const descuento = promo ? Math.max(0, bruto - neto) : 0
  return { cantidad, precio, promo, bruto, neto, descuento, etiqueta: promo ? (descuento > 0 ? 'promo 2x1' : 'promo') : '' }
}

export function totalesProductos(productos) {
  return (productos || []).reduce((t, i) => {
    const d = desgloseItem(i)
    t.bruto += d.bruto; t.neto += d.neto; t.descuento += d.descuento
    return t
  }, { bruto: 0, neto: 0, descuento: 0 })
}

// Ancho del ticket en caracteres (ventana de 320px, fuente monoespaciada).
export const TICKET_W = 32

// Una fila "descripción ........ importe" con el importe pegado a la derecha. Si la descripción es
// larga se parte en varias líneas (el importe queda en la primera).
export function filaTicket(izq, der, W = TICKET_W) {
  const d = String(der ?? '')
  const ancho = Math.max(8, W - d.length - 1)
  const partes = []
  let resto = String(izq ?? '')
  let w = ancho
  while (resto.length > w) {
    let corte = resto.lastIndexOf(' ', w)
    if (corte < 1) corte = w
    partes.push(resto.slice(0, corte))
    resto = resto.slice(corte).trim()
    w = ancho - 3
  }
  partes.push(resto)
  return partes.map((p, idx) => idx === 0 ? p.padEnd(ancho) + ' ' + d : '   ' + p).join('\n')
}

// Cuerpo del ticket (detalle + subtotal + descuento + delivery + propina + total).
// `productos`: items sin propina ni delivery. `tc`: ticket_config del restaurante.
export function armarCuerpoTicket({ productos, delivery = 0, propina = 0, total, tc = {}, sep }) {
  const s = sep || '━'.repeat(TICKET_W)
  const lines = []
  const { bruto, descuento } = totalesProductos(productos)
  if (tc.showDetalle !== false) {
    productos.forEach(i => {
      const d = desgloseItem(i)
      const nombre = `${d.cantidad}x ${i.producto || i.nombre || 'Producto'}${d.etiqueta ? ' (' + d.etiqueta + ')' : ''}`
      lines.push(filaTicket(nombre, fmtMonto(d.bruto)))
    })
    lines.push(s)
  }
  if (tc.showSubtotal !== false) lines.push(filaTicket('Subtotal', fmtMonto(bruto)))
  // Descuento, delivery y propina se muestran siempre que existan (afectan el total).
  if (descuento > 0) lines.push(filaTicket('Descuento promo 2x1', '-' + fmtMonto(descuento)))
  if (delivery > 0) lines.push(filaTicket('Delivery', fmtMonto(delivery)))
  if (propina > 0) lines.push(filaTicket('Propina', fmtMonto(propina)))
  if (tc.showTotal !== false) lines.push(filaTicket('TOTAL', fmtMonto(total)))
  return lines
}
