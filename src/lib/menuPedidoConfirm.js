// Confirmación del pedido de Mesa 0 (delivery / retiro) dentro del menú del cliente.
//
// Antes, al tocar "Enviar Pedido" el menú abría WhatsApp solo (window.open a wa.me) y vaciaba el
// carrito: el cliente salía de la app sin ver ninguna confirmación. Ahora:
//   · el pedido se guarda igual que siempre (comensales + pedidos_qr), que es lo que le llega al local;
//   · el cliente ve una pantalla "¡Pedido enviado!" con el código de su pedido y el estado sigue
//     visible en "Mi pedido";
//   · WhatsApp pasa a ser un botón opcional ("Avisar por WhatsApp") que el cliente toca si quiere;
//   · si el pedido NO se pudo guardar (o el menú no tiene conexión a la base), el carrito se conserva
//     y la pantalla ofrece enviarlo por WhatsApp.
//
// Igual que mesa00Menu.js / menuShim.js se inyecta en el HTML ya exportado (ver MenuView.jsx), así
// que sirve para menús viejos y nuevos sin volver a exportarlos. No se aplica a Mesa 00 (que ya
// funciona sin WhatsApp) ni a las mesas 1+ (que nunca salían de la app).
//
// IMPORTANTE: las dos funciones se serializan con toString() y corren dentro del iframe: no pueden
// usar variables de afuera ni contener la secuencia que cierra un script.

// PRE (antes del script del menú): observa fetch para saber si el pedido se guardó y captura el
// window.open hacia wa.me en lugar de abrirlo (devuelve una ventana falsa que guarda la URL).
function confirmarPedidoPre() {
  var C = (window.__confPedido = { abrio: false, intento: false, ok: false, url: '', codigo: '' })
  var RE_WA = /wa\.me\/[^?]*\?text=Pedido/i
  var f = window.fetch
  if (typeof f === 'function') {
    window.fetch = function (input, init) {
      var esPedidos = false
      try {
        var url = typeof input === 'string' ? input : (input && input.url) || ''
        var method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase()
        if (method === 'POST' && url.indexOf('/rest/v1/') > -1) {
          if (/\/rest\/v1\/comensales(\?|$)/.test(url) && init && typeof init.body === 'string') {
            var row = JSON.parse(init.body)
            if (row && !Array.isArray(row) && row.mesa === 0) {
              C.intento = true
              C.ok = false
              C.codigo = row.codigo_pedido ? String(row.codigo_pedido) : ''
            }
          } else if (/\/rest\/v1\/pedidos_qr(\?|$)/.test(url) && C.intento) {
            esPedidos = true
          }
        }
      } catch (e) { /* el menú sigue funcionando igual */ }
      var res = f.call(window, input, init)
      if (esPedidos) res.then(function (r) { if (r && r.ok) C.ok = true }, function () {})
      return res
    }
  }
  var abrir = window.open
  function ventanaFalsa() {
    return {
      closed: false,
      close: function () {},
      focus: function () {},
      location: {
        get href() { return C.url },
        set href(v) { C.url = String(v) }
      }
    }
  }
  window.open = function (u) {
    if (!u || RE_WA.test(String(u))) {
      C.abrio = true
      if (u) C.url = String(u)
      return ventanaFalsa()
    }
    return abrir.apply(window, arguments)
  }
}

// POST (después del script del menú): envuelve el botón "Enviar Pedido" y, cuando el envío
// terminó, muestra la confirmación.
function confirmarPedidoPost() {
  var C = window.__confPedido
  var btn = document.getElementById('send')
  if (!C || !btn || typeof btn.onclick !== 'function') return
  var orig = btn.onclick

  function el(padre, tag, texto, css) {
    var n = document.createElement(tag)
    if (texto != null) n.textContent = texto
    if (css) n.style.cssText = css
    padre.appendChild(n)
    return n
  }

  function vaciarCarrito() {
    try {
      state.cart = {}
      state.draftQty = {}
      state.pickupEnabled = false
      state.pickupName = ''
      state.pickupCode = ''
      state.codigoPedido = ''
      renderCart()
      renderProducts()
      renderCartBadge()
    } catch (e) { /* nada */ }
  }

  function mostrar(modo, urlWa, codigo) {
    var viejo = document.getElementById('pedidoOk')
    if (viejo) viejo.remove()
    var ov = document.createElement('div')
    ov.id = 'pedidoOk'
    ov.setAttribute('role', 'dialog')
    ov.setAttribute('aria-modal', 'true')
    ov.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:100000;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box'
    var caja = el(ov, 'div', null, 'width:100%;max-width:360px;background:#111827;border:1px solid #374151;border-radius:18px;padding:24px 20px 20px;text-align:center;color:#e5e7eb;box-shadow:0 20px 60px rgba(0,0,0,.6);box-sizing:border-box;font-family:inherit')

    var ok = modo === 'ok'
    el(caja, 'div', ok ? '✓' : '!', 'width:56px;height:56px;line-height:56px;margin:0 auto 12px;border-radius:50%;font-size:30px;font-weight:800;color:#fff;background:' + (ok ? '#16a34a' : '#d97706'))

    var titulo = ok ? '¡Pedido enviado!' : (modo === 'fallo' ? 'No se pudo registrar el pedido' : 'Enviá tu pedido por WhatsApp')
    el(caja, 'div', titulo, 'font-size:20px;font-weight:800;color:#fff;margin-bottom:8px')

    var cuerpo = ok
      ? 'Tu pedido ya llegó al local. Seguí su estado desde esta pantalla.'
      : (modo === 'fallo'
        ? 'No pudimos registrar tu pedido en el sistema del local. Enviálo por WhatsApp para que lo reciban.'
        : 'Tocá el botón para abrir WhatsApp y mandar tu pedido al local.')
    el(caja, 'div', cuerpo, 'font-size:15px;line-height:1.4;color:#cbd5e1;margin-bottom:14px')

    if (ok && codigo) {
      var bloque = el(caja, 'div', null, 'background:#0b1220;border:1px solid #374151;border-radius:12px;padding:10px 12px;margin-bottom:14px')
      el(bloque, 'div', 'Código de pedido', 'font-size:12px;color:#94a3b8;margin-bottom:2px')
      el(bloque, 'div', codigo, 'font-size:18px;font-weight:800;color:#fff;letter-spacing:.5px')
    }

    var cerrar = function () { ov.remove() }
    if (urlWa) {
      var a = document.createElement('a')
      a.href = urlWa
      a.target = '_blank'
      a.rel = 'noopener noreferrer'
      a.textContent = ok ? 'Avisar por WhatsApp' : 'Enviar pedido por WhatsApp'
      a.style.cssText = ok
        ? 'display:block;padding:12px 14px;border-radius:12px;font-size:16px;font-weight:700;text-decoration:none;color:#e5e7eb;border:1px solid #374151;margin-bottom:10px'
        : 'display:block;padding:13px 14px;border-radius:12px;font-size:16px;font-weight:800;text-decoration:none;color:#fff;background:#16a34a;margin-bottom:10px'
      if (!ok) {
        // El pedido nunca llegó al sistema: al mandarlo por WhatsApp se da por enviado.
        a.addEventListener('click', function () { setTimeout(function () { vaciarCarrito(); cerrar() }, 400) })
      }
      caja.appendChild(a)
    }
    var b = el(caja, 'button', ok ? 'Listo' : 'Cerrar', 'display:block;width:100%;padding:12px 14px;border-radius:12px;border:0;font-size:16px;font-weight:700;cursor:pointer;color:#fff;background:' + (ok ? '#2f6fed' : '#374151'))
    b.type = 'button'
    b.addEventListener('click', cerrar)
    document.body.appendChild(ov)
  }

  btn.onclick = async function (ev) {
    var snap = null
    try {
      snap = JSON.stringify({
        cart: state.cart, draftQty: state.draftQty, activePromo: state.activePromo,
        promoProducts: state.promoProducts, pickupEnabled: state.pickupEnabled,
        deliveryEnabled: state.deliveryEnabled, pickupName: state.pickupName
      })
    } catch (e) { /* nada */ }
    C.abrio = false
    C.intento = false
    C.ok = false
    C.url = ''
    C.codigo = ''
    var r = await orig.call(this, ev)
    // Si el menú cortó antes (fuera de horario, falta nombre/teléfono, carrito vacío...) no hay nada que mostrar.
    if (!C.abrio) return r
    var urlWa = /wa\.me\/[0-9]/.test(C.url) ? C.url : ''
    var guardado = C.intento && C.ok
    if (!guardado) {
      // No llegó al sistema del local: se devuelve el carrito para que no se pierda.
      try {
        if (snap) {
          var s = JSON.parse(snap)
          state.cart = s.cart || {}
          state.draftQty = s.draftQty || {}
          state.activePromo = s.activePromo || null
          state.promoProducts = s.promoProducts || {}
          state.pickupEnabled = !!s.pickupEnabled
          state.deliveryEnabled = !!s.deliveryEnabled
          state.pickupName = s.pickupName || ''
        }
        renderCart()
        renderProducts()
        renderCartBadge()
      } catch (e) { /* nada */ }
      if (!urlWa) {
        showToast(C.intento ? 'Error al enviar. Intentá de nuevo' : 'WhatsApp no disponible')
        return r
      }
    }
    mostrar(guardado ? 'ok' : (C.intento ? 'fallo' : 'solo'), urlWa, C.codigo)
    return r
  }
}

function envolver(fn, arg) {
  return '<script>(' + fn.toString() + ')(' + (arg === undefined ? '' : JSON.stringify(arg)) + ')</script>'
}

// Inserta la confirmación en el HTML del menú (idempotente). Solo para Mesa 0 (no Mesa 00).
export function aplicarConfirmacionPedido(html) {
  if (!html || html.indexOf('__confPedido') !== -1) return html
  const pre = envolver(confirmarPedidoPre)
  const post = envolver(confirmarPedidoPost)
  let out = String(html)
  const head = out.match(/<head[^>]*>/i)
  out = head
    ? out.slice(0, head.index + head[0].length) + pre + out.slice(head.index + head[0].length)
    : pre + out
  const fin = out.toLowerCase().lastIndexOf('</body>')
  return fin >= 0 ? out.slice(0, fin) + post + out.slice(fin) : out + post
}
