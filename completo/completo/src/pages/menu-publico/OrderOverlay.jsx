import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useOrderState } from './useOrderState'
import './styles.css'

export default function OrderOverlay({ clienteId, mesaNumero, restauranteNombre, whatsapp }) {
  const [categorias, setCategorias] = useState([])
  const [productos, setProductos] = useState([])
  const [activeCategory, setActiveCategory] = useState(null)
  const [mozoCalled, setMozoCalled] = useState(false)
  const [showCart, setShowCart] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [showCover, setShowCover] = useState(true)

  const {
    cart,
    cartTotal,
    cartCount,
    sentItems,
    fetchSentItems,
    loading,
    orderSent,
    addToCart,
    removeFromCart,
    updateQuantity,
    confirmOrder,
    callMozo
  } = useOrderState()

  useEffect(() => {
    if (clienteId) fetchData()
  }, [clienteId])

  // Carga el pedido ya enviado (pendiente de pago) para mostrarlo en gris,
  // y lo vuelve a chequear cada tanto: si el cajero cobra o cierra la mesa,
  // ese pedido se marca como pagado y acá desaparece solo.
  useEffect(() => {
    if (!clienteId || !mesaNumero) return
    fetchSentItems(clienteId, parseInt(mesaNumero))
    const interval = setInterval(() => {
      fetchSentItems(clienteId, parseInt(mesaNumero))
    }, 6000)
    return () => clearInterval(interval)
  }, [clienteId, mesaNumero, fetchSentItems])

  const fetchData = async () => {
    setLoadingData(true)
    const [catRes, prodRes] = await Promise.all([
      supabase
        .from('categorias')
        .select('id, nombre, imagen')
        .eq('cliente_id', clienteId)
        .order('orden'),
      supabase
        .from('productos')
        .select('id, nombre, precio, detalle, imagen, categoria_id')
        .eq('cliente_id', clienteId)
        .order('nombre')
    ])

    if (catRes.data) setCategorias(catRes.data)
    if (prodRes.data) setProductos(prodRes.data)
    if (catRes.data?.length > 0) setActiveCategory(catRes.data[0].id)
    setLoadingData(false)
  }

  const filteredProducts = activeCategory
    ? productos.filter(p => p.categoria_id === activeCategory)
    : productos

  const getQtyInCart = (productoId) => {
    const item = cart.find(i => i.producto_id === productoId)
    return item ? item.cantidad : 0
  }

  const handleConfirm = async () => {
    const ok = await confirmOrder(clienteId, parseInt(mesaNumero))
    if (ok) setShowCart(false)
  }

  const handleCallMozo = async () => {
    if (navigator.vibrate) navigator.vibrate(500)
    const ok = await callMozo(clienteId, parseInt(mesaNumero))
    if (ok) {
      setMozoCalled(true)
    }
  }

  useEffect(() => {
    if (!mozoCalled || !clienteId || !mesaNumero) return
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('mesas_operacion')
        .select('estado')
        .eq('cliente_id', clienteId)
        .eq('numero', parseInt(mesaNumero))
        .single()
      if (data && data.estado !== 'Pendiente') {
        setMozoCalled(false)
        clearInterval(interval)
      }
    }, 3000)
    return () => clearInterval(interval)
  }, [mozoCalled, clienteId, mesaNumero])

  useEffect(() => {
    if (!clienteId || !mesaNumero) return
    const checkInitial = async () => {
      const { data } = await supabase
        .from('mesas_operacion')
        .select('estado')
        .eq('cliente_id', clienteId)
        .eq('numero', parseInt(mesaNumero))
        .single()
      if (data && data.estado === 'Pendiente') setMozoCalled(true)
    }
    checkInitial()
  }, [clienteId, mesaNumero])

  const handleWhatsApp = () => {
    if (!whatsapp) return
    const items = cart.map(i => `${i.cantidad}x ${i.nombre}`).join('%0A')
    const total = cartTotal.toFixed(2)
    const texto = `Pedido Mesa ${mesaNumero}:%0A${items}%0A%0ATotal: $${total}`
    const num = whatsapp.replace('+', '').replace(/\s/g, '')
    window.open(`https://wa.me/${num}?text=${texto}`, '_blank')
  }

  if (loadingData) {
    return (
      <div className="order-overlay">
        <div className="order-overlay-backdrop" />
        <div className="order-overlay-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ color: '#5fd8c4', fontSize: 14 }}>Cargando menú...</div>
        </div>
      </div>
    )
  }

  if (showCover) {
    return (
      <div className="order-overlay">
        <div className="order-overlay-backdrop" />
        <div className="order-cover">
          <h1 className="order-cover-title">{restauranteNombre || 'Menú'}</h1>
          <p className="order-cover-subtitle">Mesa {mesaNumero}</p>
          <button className="order-cover-btn" onClick={() => setShowCover(false)}>
            VER MENÚ
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="order-overlay">
      <div className="order-overlay-backdrop" />
      <div className="order-overlay-content">
        {/* Header */}
        <div className="order-header">
          <h1 className="order-header-title">{restauranteNombre || 'Menú'}</h1>
          <p className="order-header-subtitle">Mesa {mesaNumero}</p>
        </div>

        {/* Category tabs */}
        {categorias.length > 0 && (
          <div className="order-tabs">
            {categorias.map(cat => (
              <button
                key={cat.id}
                className={`order-tab ${activeCategory === cat.id ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat.id)}
              >
                {cat.nombre}
              </button>
            ))}
          </div>
        )}

        {/* Products list */}
        <div className="order-products">
          {filteredProducts.length === 0 ? (
            <div className="order-empty">
              <div className="order-empty-icon">🍽️</div>
              <p className="order-empty-text">No hay productos disponibles</p>
            </div>
          ) : (
            filteredProducts.map(product => {
              const qty = getQtyInCart(product.id)
              return (
                <div key={product.id} className="order-product-card">
                  {product.imagen && (
                    <img
                      src={product.imagen}
                      alt={product.nombre}
                      className="order-product-img"
                      loading="lazy"
                    />
                  )}
                  <div className="order-product-info">
                    <p className="order-product-name">{product.nombre}</p>
                    {product.detalle && (
                      <p className="order-product-detail">{product.detalle}</p>
                    )}
                    <span className="order-product-price">${product.precio}</span>
                  </div>
                  <div className="order-product-actions">
                    {qty === 0 ? (
                      <button className="order-add-btn" onClick={() => addToCart(product)}>
                        +
                      </button>
                    ) : (
                      <div className="order-qty-controls">
                        <button
                          className="order-qty-btn"
                          onClick={() => updateQuantity(product.id, qty - 1)}
                        >
                          −
                        </button>
                        <span className="order-qty-value">{qty}</span>
                        <button
                          className="order-qty-btn"
                          onClick={() => updateQuantity(product.id, qty + 1)}
                        >
                          +
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Cart bar */}
        <div className={`order-cart-bar ${cartCount === 0 && sentItems.length === 0 ? 'empty' : ''}`}>
          <div className="order-cart-summary">
            <span className="order-cart-count">
              <strong>{cartCount}</strong> {cartCount === 1 ? 'item' : 'items'}
            </span>
            <span className="order-cart-total">${cartTotal.toFixed(2)}</span>
          </div>

          {showCart && (cart.length > 0 || sentItems.length > 0) && (
            <div className="order-cart-items">
              {sentItems.length > 0 && (
                <>
                  <div className="order-cart-section-label">Ya enviado</div>
                  {sentItems.map(item => (
                    <div key={`sent-${item.producto_id}`} className="order-cart-item order-cart-item-sent">
                      <span className="order-cart-item-name">
                        {item.cantidad}x {item.nombre}
                      </span>
                      <span className="order-cart-item-price">
                        ${(item.precio * item.cantidad).toFixed(2)}
                      </span>
                    </div>
                  ))}
                  {cart.length > 0 && <div className="order-cart-section-label">Pedido nuevo</div>}
                </>
              )}
              {cart.map(item => (
                <div key={item.producto_id} className="order-cart-item">
                  <span className="order-cart-item-name">
                    {item.cantidad}x {item.nombre}
                  </span>
                  <span className="order-cart-item-price">
                    ${(item.precio * item.cantidad).toFixed(2)}
                  </span>
                  <button
                    className="order-cart-item-remove"
                    onClick={() => removeFromCart(item.producto_id)}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            className={`order-confirm-btn ${orderSent ? 'success' : ''}`}
            onClick={() => {
              if (showCart && cartCount > 0) {
                handleConfirm()
              } else {
                setShowCart(true)
              }
            }}
            disabled={loading || (showCart && cartCount === 0) || (!showCart && cartCount === 0 && sentItems.length === 0)}
          >
            {loading
              ? 'Enviando...'
              : orderSent
                ? '¡Pedido enviado!'
                : showCart
                  ? 'Confirmar Pedido'
                  : `Ver Carrito ($${cartTotal.toFixed(2)})`
            }
          </button>

          {showCart && cart.length > 0 && whatsapp && (
            <button className="order-whatsapp-btn" onClick={handleWhatsApp}>
              <span>📱</span> Pedir por WhatsApp
            </button>
          )}
        </div>
      </div>

      {/* Llamar mozo */}
      <button
        className={`order-mozo-btn ${mozoCalled ? 'called' : ''}`}
        onClick={handleCallMozo}
        title="Llamar al mozo"
      >
        🔔
      </button>

      {/* Toast de pedido enviado */}
      {orderSent && (
        <div className="order-sent-toast">
          ¡Pedido enviado!<br />
          <span style={{ fontSize: 12, fontWeight: 400 }}>Esperá un momento</span>
        </div>
      )}
    </div>
  )
}
