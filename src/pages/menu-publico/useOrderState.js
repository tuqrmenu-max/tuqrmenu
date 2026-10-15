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

      const { data: comensal } = await supabase
        .from('comensales')
        .select('id')
        .eq('cliente_id', clienteId)
        .eq('mesa', mesaNumero)
        .eq('sesion_id', sesionId)
        .maybeSingle()

      if (!comensal) {
        setSentItems([])
        return
      }

      const { data: pedidos, error } = await supabase
        .from('pedidos_qr')
        .select('producto_id, cantidad, productos(nombre, precio)')
        .eq('comensal_id', comensal.id)
        .eq('pagado', 0)

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

      let comensalId = null

      const { data: comensalExistente } = await supabase
        .from('comensales')
        .select('id')
        .eq('cliente_id', clienteId)
        .eq('mesa', mesaNumero)
        .eq('sesion_id', sesionId)
        .maybeSingle()

      if (comensalExistente) {
        comensalId = comensalExistente.id
      } else {
        const { data: nuevoComensal, error: errorComensal } = await supabase
          .from('comensales')
          .insert({
            cliente_id: clienteId,
            mesa: mesaNumero,
            nombre: `Cliente Mesa ${mesaNumero}`,
            sesion_id: sesionId,
            activo: 1
          })
          .select('id')
          .single()

        if (errorComensal) throw errorComensal
        comensalId = nuevoComensal.id
      }

      const pedidos = cart.map(item => ({
        comensal_id: comensalId,
        producto_id: item.producto_id,
        cantidad: item.cantidad,
        pagado: 0,
        es_promo: 0,
        fecha_hora: new Date().toISOString()
      }))

      const { error: errorPedidos } = await supabase
        .from('pedidos_qr')
        .insert(pedidos)

      if (errorPedidos) throw errorPedidos

      await supabase
        .from('mesas_operacion')
        .upsert({
          cliente_id: clienteId,
          numero: mesaNumero,
          estado: 'Ocupada'
        }, { onConflict: 'cliente_id,numero' })

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
      await supabase
        .from('mesas_operacion')
        .upsert({
          cliente_id: clienteId,
          numero: mesaNumero,
          estado: 'Pendiente'
        }, { onConflict: 'cliente_id,numero' })
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
