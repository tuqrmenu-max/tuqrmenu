import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export function useOrderState() {
  const [cart, setCart] = useState([])
  const [loading, setLoading] = useState(false)
  const [orderSent, setOrderSent] = useState(false)
  // Pedidos ya confirmados en esta sesión de mesa: se muestran de fondo,
  // en gris, sin poder modificarlos (solo lectura), mientras el cliente
  // arma un pedido nuevo.
  const [sentItems, setSentItems] = useState([])

  // Trae de la base lo que este comensal ya pidió y todavía no fue pagado
  // (pagado = 0). Esto es lo que se muestra "de fondo", en gris, en el
  // carrito. Al traerlo de la base (y no solo guardarlo en memoria) se
  // mantiene aunque el cliente recargue la página, y desaparece solo cuando
  // el cajero cobra o cierra la mesa (que marca esos pedidos como pagados).
  const fetchSentItems = useCallback(async (clienteId, mesaNumero) => {
    try {
      const sesionId = localStorage.getItem(`mesa_${mesaNumero}_sesion`)
      if (!sesionId) {
        setSentItems([])
        return
      }

      const { data: comensal } = await supabase.rpc('qr_pedido_estado_v2', {
        p_cliente_id: clienteId,
        p_mesa: mesaNumero,
        p_sesion: sesionId
      })

      if (!comensal) {
        setSentItems([])
        return
      }

      const { data: pedidos, error } = await supabase.rpc('qr_items_comensal', {
        p_comensal_id: comensal.id,
        p_sesion: sesionId
      })

      if (error) throw error

      const agrupados = {}
      ;(pedidos || []).forEach(p => {
        const key = p.producto_id
        if (!agrupados[key]) {
          agrupados[key] = {
            producto_id: p.producto_id,
            nombre: p.productos?.nombre || 'Producto',
            precio: p.productos?.precio || 0,
            cantidad: 0
          }
        }
        agrupados[key].cantidad += p.cantidad
      })

      setSentItems(Object.values(agrupados))
    } catch (error) {
      console.error('Error cargando pedido ya enviado:', error)
    }
  }, [])

  const addToCart = useCallback((product) => {
    setCart(prev => {
      const existing = prev.find(item => item.producto_id === product.id)
      if (existing) {
        return prev.map(item =>
          item.producto_id === product.id
            ? { ...item, cantidad: item.cantidad + 1 }
            : item
        )
      }
      return [...prev, {
        producto_id: product.id,
        nombre: product.nombre,
        precio: product.precio,
        imagen: product.imagen,
        cantidad: 1
      }]
    })
  }, [])

  const removeFromCart = useCallback((productoId) => {
    setCart(prev => prev.filter(item => item.producto_id !== productoId))
  }, [])

  const updateQuantity = useCallback((productoId, qty) => {
    if (qty <= 0) {
      setCart(prev => prev.filter(item => item.producto_id !== productoId))
      return
    }
    setCart(prev => prev.map(item =>
      item.producto_id === productoId
        ? { ...item, cantidad: qty }
        : item
    ))
  }, [])

  const clearCart = useCallback(() => {
    setCart([])
    setOrderSent(false)
  }, [])

  const cartTotal = cart.reduce((sum, item) => sum + item.precio * item.cantidad, 0)
  const cartCount = cart.reduce((sum, item) => sum + item.cantidad, 0)

  const confirmOrder = useCallback(async (clienteId, mesaNumero) => {
    if (cart.length === 0) return false
    setLoading(true)

    try {
      const sesionId = localStorage.getItem(`mesa_${mesaNumero}_sesion`) || crypto.randomUUID()
      localStorage.setItem(`mesa_${mesaNumero}_sesion`, sesionId)

      // Todo el pedido pasa por funciones seguras de la base (no hay acceso directo a las tablas).
      const { data: comensalId, error: errorComensal } = await supabase.rpc('qr_crear_comensal', {
        p_cliente_id: clienteId,
        p_mesa: mesaNumero,
        p_sesion: sesionId,
        p_nombre: `Cliente Mesa ${mesaNumero}`,
        p_reusar: true
      })
      if (errorComensal || !comensalId) throw errorComensal || new Error('No se pudo crear el comensal')

      const { error: errorPedidos } = await supabase.rpc('qr_agregar_items', {
        p_comensal_id: comensalId,
        p_sesion: sesionId,
        p_items: cart.map(item => ({
          producto_id: item.producto_id,
          cantidad: item.cantidad,
          es_promo: 0
        }))
      })
      if (errorPedidos) throw errorPedidos

      await supabase.rpc('qr_mesa_marcar', {
        p_cliente_id: clienteId,
        p_mesa: mesaNumero,
        p_estado: 'Ocupada'
      })

      // Recargamos desde la base en vez de mezclar a mano en memoria, para
      // que el "ya enviado" en gris siempre refleje lo que realmente está
      // pendiente de pago (y desaparezca solo si el cajero ya lo cobró).
      await fetchSentItems(clienteId, mesaNumero)

      setCart([])
      setOrderSent(true)
      setTimeout(() => setOrderSent(false), 5000)
      return true
    } catch (error) {
      console.error('Error confirmando pedido:', error)
      return false
    } finally {
      setLoading(false)
    }
  }, [cart, fetchSentItems])

  const callMozo = useCallback(async (clienteId, mesaNumero) => {
    try {
      await supabase.rpc('qr_mesa_marcar', {
        p_cliente_id: clienteId,
        p_mesa: mesaNumero,
        p_estado: 'Pendiente'
      })
      return true
    } catch (error) {
      console.error('Error llamando mozo:', error)
      return false
    }
  }, [])

  return {
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
    clearCart,
    confirmOrder,
    callMozo
  }
}
