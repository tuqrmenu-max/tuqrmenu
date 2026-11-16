// Aviso de personalización de un producto del pedido: "Sin lechuga, tomate" y el comentario
// que escribió el cliente. Si el cliente no cambió nada ni escribió nada, no muestra nada.
// Espera un item con { sin: [...], comentario } (ver sin_ingredientes y comentario de pedidos_qr).
export default function DetallePedido({ item, className = '' }) {
  const sin = Array.isArray(item?.sin) ? item.sin.filter(Boolean) : []
  const comentario = String(item?.comentario || '').trim()
  if (sin.length === 0 && !comentario) return null
  return (
    <span className={`block text-[11px] leading-snug font-semibold text-amber-400 ${className}`}>
      {sin.length > 0 && <span className="block">Sin {sin.join(', ')}</span>}
      {comentario && <span className="block break-words">💬 {comentario}</span>}
    </span>
  )
}
