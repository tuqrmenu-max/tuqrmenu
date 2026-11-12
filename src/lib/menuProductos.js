// Pantalla de productos del menú exportado, más clara de usar:
//  - un solo control por producto: botón "+" y, recién cuando hay unidades, "− cantidad +"
//    (antes: − 0 + y un casillero de confirmación; ahora "+" suma directo al pedido)
//  - nombres y precios más grandes, botones de 44 px, fila resaltada si está en el pedido
//  - barra fija abajo "Ver pedido · N productos · total"
//  - título más grande y sin "Salir" (hacía lo mismo que la flecha de volver)
//
// Igual que menuUnificar.js, se inyecta en el HTML ya exportado (sirve para menús viejos
// y nuevos). Si la estructura no es la esperada, no hace nada.
// Se serializa con toString(): no puede usar variables de afuera.

function menuProductos() {
  try {
    var $ = function (id) { return document.getElementById(id) }
    if (window.__productosNuevo) return
    if (!$('prodList') || !$('floatingCart') || typeof renderProducts !== 'function' ||
        typeof findProductImage !== 'function' || typeof escapeHtml !== 'function' ||
        typeof money !== 'function' || typeof price !== 'function' ||
        typeof cartItems !== 'function' || typeof renderCart !== 'function' ||
        typeof renderCartBadge !== 'function' || typeof state === 'undefined') return
    window.__productosNuevo = true

    var css = [
      '#prodList{display:flex;flex-direction:column}',
      '#prodList .product-card{flex:none;align-items:center;gap:12px;min-height:80px;padding:8px 10px 8px 8px;border-radius:14px;background:rgba(18,26,34,.88);border:1.5px solid #1c2733}',
      '#prodList .product-card.sel{border-color:#22c55e;background:rgba(16,35,27,.92)}',
      '#prodList .product-card img,#prodList .product-card .prod-placeholder{width:84px;height:64px;align-self:center;border-radius:10px;flex:none}',
      '#prodList .product-card .prod-info{padding:0}',
      '#prodList .product-card h4{font-size:15.5px;font-weight:600;line-height:1.2}',
      '#prodList .product-card .prod-desc{font-size:12px;color:#a8b0bb}',
      '#prodList .product-card .price{font-size:16px;margin-top:4px}',
      '.pc-add{width:44px;height:44px;border-radius:50%;border:0;background:#1f7a3f;color:#fff;font-size:28px;line-height:1;display:grid;place-items:center;flex:none;cursor:pointer}',
      '.pc-add:active{background:#15803d}',
      '.pc-step{display:flex;align-items:center;gap:2px;background:#0b1812;border-radius:22px;padding:2px;flex:none}',
      '.pc-step button{width:38px;height:38px;border-radius:50%;border:0;background:#1b2630;color:#fff;font-size:22px;line-height:1;display:grid;place-items:center;cursor:pointer}',
      '.pc-step button.pl{background:#22c55e;color:#04210f}',
      '.pc-step b{min-width:26px;text-align:center;font-size:17px;color:#fff}',
      '.pc-bar{position:sticky;bottom:0;margin:auto -10px 0;padding:14px 12px 14px;background:linear-gradient(rgba(11,13,16,0),rgba(11,13,16,.96) 38%);flex:none}',
      '.pc-bar button{width:100%;height:56px;border:0;border-radius:16px;background:#22c55e;color:#04210f;display:flex;align-items:center;justify-content:space-between;padding:0 18px;font-weight:800;font-size:16px;cursor:pointer}',
      '.pc-bar small{display:block;font-weight:700;font-size:12.5px;opacity:.8;text-align:left}',
      '#products .productsTop{grid-template-rows:30px 54px}',
      '#products .productsTop .title{font-size:clamp(16px,5.4vw,21px)!important;font-weight:700}',
      '#products #exitTop{display:none!important}'
    ].join('\n')
    var st = document.createElement('style')
    st.setAttribute('data-productos-nuevo', '1')
    st.textContent = css
    document.head.appendChild(st)

    function enPedido(i) { return Number(state.cart[i] || 0) }

    window.renderProducts = function () {
      var list = $('prodList')
      $('prodTitle').textContent = state.selectedCategory || 'Productos'
      list.innerHTML = ''
      DATA.rows.forEach(function (r, i) {
        if ((r.categoria || 'Sin categoría') !== state.selectedCategory) return
        var img = findProductImage(r, i)
        var q = enPedido(i)
        var desc = (r.detalle || '').trim()
        var card = document.createElement('div')
        card.className = 'product-card' + (q > 0 ? ' sel' : '')
        card.innerHTML =
          (img ? '<img loading="lazy" decoding="async" src="' + img + '">' : '<div class="prod-placeholder">🍽️</div>') +
          '<div class="prod-info"><h4>' + escapeHtml(r.producto) + '</h4>' +
          (desc ? '<p class="prod-desc">' + escapeHtml(desc) + '</p>' : '') +
          '<div class="price">' + money(price(r.precio)) + '</div></div>' +
          (q > 0
            ? '<div class="pc-step"><button data-minus="' + i + '" aria-label="Quitar uno">−</button><b>' + q + '</b><button class="pl" data-plus="' + i + '" aria-label="Agregar uno">+</button></div>'
            : '<button class="pc-add" data-plus="' + i + '" aria-label="Agregar">+</button>')
        list.appendChild(card)
      })

      var items = cartItems()
      var cant = items.reduce(function (s, it) { return s + it.qty }, 0)
      if (cant > 0) {
        var total = items.reduce(function (s, it) { return s + price(it.precio) * it.qty }, 0)
        var bar = document.createElement('div')
        bar.className = 'pc-bar'
        bar.innerHTML = '<button type="button" data-verpedido="1"><span>Ver pedido<small>' + cant + (cant === 1 ? ' producto' : ' productos') + '</small></span><span>' + money(total) + '</span></button>'
        list.appendChild(bar)
        bar.querySelector('button').onclick = function () { $('floatingCart').click() }
      }

      list.querySelectorAll('[data-plus]').forEach(function (b) {
        b.onclick = function () {
          var i = String(b.dataset.plus)
          state.cart[i] = (state.cart[i] || 0) + 1
          window.renderProducts(); renderCart()
        }
      })
      list.querySelectorAll('[data-minus]').forEach(function (b) {
        b.onclick = function () {
          var i = String(b.dataset.minus)
          var q = state.cart[i] || 0
          if (q <= 1) delete state.cart[i]
          else state.cart[i] = q - 1
          window.renderProducts(); renderCart()
        }
      })
      renderCartBadge()
    }
    // si ya había una categoría abierta, la redibuja
    if (state.selectedCategory) window.renderProducts()
  } catch (e) {
    try { console.warn('productos nuevo:', e && e.message) } catch (_) { /* nada */ }
  }
}

export function menuProductosScript() {
  return '<script>(' + menuProductos.toString() + ')()</script>'
}

export function mejorarPantallaProductos(html) {
  if (!html || html.indexOf('window.__productosNuevo') !== -1) return html
  const s = menuProductosScript()
  const i = html.lastIndexOf('</body>')
  return i === -1 ? html + s : html.slice(0, i) + s + html.slice(i)
}
