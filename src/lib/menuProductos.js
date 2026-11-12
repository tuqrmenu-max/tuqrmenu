// Pantalla de productos del menú exportado, más clara de usar:
//  - un solo control por producto: botón "+" y, recién cuando hay unidades, "− cantidad +"
//    (antes: − 0 + y un casillero de confirmación; ahora "+" suma directo al pedido)
//  - fotos a todo el alto de la tarjeta, pegadas al borde, con esquinas redondeadas
//  - nombres y precios más grandes, botones de 44 px, fila resaltada si está en el pedido
//  - colores: azul del logo (#039CCF claro, #016FC1 relleno)
//  - barra fija abajo "Ver pedido · N productos · total"
//  - barra negra fina, sin título ni "Salir", y debajo las categorías una al lado de otra
//    (la del medio grande y las de los costados más chicas) para cambiar de categoría sin volver
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
      '#prodList .product-card{flex:none;align-items:center;gap:12px;min-height:88px;padding:0 10px 0 0;overflow:hidden;border-radius:14px;background:rgba(18,26,34,.88);border:1.5px solid #1c2733}',
      '#prodList .product-card.sel{border-color:#039CCF;background:rgba(5,30,46,.92)}',
      '#prodList .product-card img,#prodList .product-card .prod-placeholder{width:108px;height:auto;min-height:85px;align-self:stretch;object-fit:cover;border-radius:0 14px 14px 0;flex:none}',
      '#prodList .product-card .prod-info{padding:8px 0}',
      '#prodList .product-card h4{font-size:15.5px;font-weight:600;line-height:1.2}',
      '#prodList .product-card .prod-desc{font-size:12px;color:#a8b0bb}',
      '#prodList .product-card .price{font-size:16px;margin-top:4px}',
      '.pc-add{width:44px;height:44px;border-radius:50%;border:0;background:#016FC1;color:#fff;font-size:28px;line-height:1;display:grid;place-items:center;flex:none;cursor:pointer}',
      '.pc-add:active{background:#015a9c}',
      '.pc-step{display:flex;align-items:center;gap:2px;background:#07131c;border-radius:22px;padding:2px;flex:none}',
      '.pc-step button{width:38px;height:38px;border-radius:50%;border:0;background:#1b2630;color:#fff;font-size:22px;line-height:1;display:grid;place-items:center;cursor:pointer}',
      '.pc-step button.pl{background:#016FC1;color:#fff}',
      '.pc-step b{min-width:26px;text-align:center;font-size:17px;color:#fff}',
      '.pc-bar{position:sticky;bottom:0;margin:auto -10px 0;padding:14px 12px 14px;background:linear-gradient(rgba(11,13,16,0),rgba(11,13,16,.96) 38%);flex:none}',
      '.pc-bar button{width:100%;height:56px;border:0;border-radius:16px;background:#016FC1;color:#fff;display:flex;align-items:center;justify-content:space-between;padding:0 18px;font-weight:800;font-size:16px;cursor:pointer}',
      '.pc-bar small{display:block;font-weight:700;font-size:12.5px;opacity:.8;text-align:left}',
      // barra negra fina (una sola fila: flecha + íconos); el nombre de la categoría ya se ve abajo
      '#products .productsTop{min-height:60px;padding:6px 10px;grid-template-rows:48px}',
      '#products .productsTop .title{display:none!important}',
      '#products #exitTop{display:none!important}',
      '#products .products{height:calc(100vh - 156px)}',
      // categorías una al lado de otra (efecto anillo: la del medio grande, las de los costados más chicas)
      '#catStrip{position:relative;display:flex;gap:6px;height:96px;overflow-x:auto;overflow-y:hidden;padding:8px calc(50% - 38px) 4px;scrollbar-width:none;-webkit-overflow-scrolling:touch;scroll-snap-type:x proximity;touch-action:pan-x;overscroll-behavior-x:contain;background:linear-gradient(#000,rgba(0,0,0,.55))}',
      '#catStrip::-webkit-scrollbar{display:none}',
      '#catStrip{cursor:grab;user-select:none;-webkit-user-select:none}',
      '#catStrip.arrastrando{cursor:grabbing;scroll-snap-type:none}',
      '#catStrip .cs-item{cursor:inherit}',
      '.cs-item{flex:none;width:76px;padding:0;border:0;background:none;color:#cbd5e1;display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;scroll-snap-align:center;transition:transform .12s,opacity .12s}',
      '.cs-img{width:60px;height:60px;border-radius:14px;overflow:hidden;border:2px solid rgba(255,255,255,.22);background:#1f2937;display:grid;place-items:center;font-size:24px}',
      '.cs-img img{width:100%;height:100%;object-fit:cover;display:block}',
      '.cs-item.on .cs-img{border-color:#039CCF;box-shadow:0 0 0 3px rgba(3,156,207,.35)}',
      '.cs-name{font-size:11.5px;line-height:1.1;max-width:76px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.cs-item.on .cs-name{color:#fff;font-weight:700}'
    ].join('\n')
    var st = document.createElement('style')
    st.setAttribute('data-productos-nuevo', '1')
    st.textContent = css
    document.head.appendChild(st)


    // ---- tira de categorías ----
    var strip = document.createElement('div')
    strip.id = 'catStrip'
    var barra = document.querySelector('#products .productsTop')
    if (barra) barra.insertAdjacentElement('afterend', strip)
    var ultimaSel = null

    function efecto() {
      var r = strip.getBoundingClientRect()
      if (!r.width) return
      var cx = r.left + r.width / 2
      var mitad = r.width / 2
      var items = strip.querySelectorAll('.cs-item')
      for (var k = 0; k < items.length; k++) {
        var br = items[k].getBoundingClientRect()
        var d = Math.min(Math.abs(br.left + br.width / 2 - cx) / mitad, 1)
        items[k].style.transform = 'scale(' + (1 - d * 0.28).toFixed(3) + ')'
        items[k].style.opacity = String((1 - d * 0.5).toFixed(3))
      }
    }
    var tick = null
    strip.addEventListener('scroll', function () {
      if (tick) return
      tick = requestAnimationFrame(function () { tick = null; efecto() })
    }, { passive: true })

    // deslizar con el mouse (PC/tablet): arrastrar hacia ambos lados y rueda del mouse
    var arr = null
    var movido = false
    strip.addEventListener('mousedown', function (e) {
      if (e.button !== 0) return
      arr = { x: e.clientX, left: strip.scrollLeft }
      movido = false
    })
    window.addEventListener('mousemove', function (e) {
      if (!arr) return
      var dx = e.clientX - arr.x
      if (!movido && Math.abs(dx) < 5) return
      if (!movido) { movido = true; strip.classList.add('arrastrando') }
      strip.scrollLeft = arr.left - dx
      e.preventDefault()
    })
    window.addEventListener('mouseup', function () {
      if (!arr) return
      arr = null
      strip.classList.remove('arrastrando')
      if (movido) setTimeout(function () { movido = false }, 0)
    })
    // si se arrastró, no cuenta como toque en una categoría
    strip.addEventListener('click', function (e) {
      if (movido) { e.stopPropagation(); e.preventDefault() }
    }, true)
    strip.addEventListener('dragstart', function (e) { e.preventDefault() })
    strip.addEventListener('wheel', function (e) {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        strip.scrollLeft += e.deltaY
        e.preventDefault()
      }
    }, { passive: false })

    function construirTira() {
      strip.innerHTML = ''
      categories().forEach(function (c) {
        var name = c[0]
        var img = ''
        try { img = findCategoryImage(name) || '' } catch (e) { img = '' }
        var b = document.createElement('button')
        b.type = 'button'
        b.className = 'cs-item'
        b.setAttribute('data-cat', name)
        b.innerHTML = '<span class="cs-img">' + (img ? '<img src="' + img + '" alt="">' : '🍽️') + '</span><span class="cs-name">' + escapeHtml(name) + '</span>'
        b.onclick = function () {
          if (state.selectedCategory === name) return
          state.selectedCategory = name
          window.renderProducts()
          $('prodList').scrollTop = 0
        }
        strip.appendChild(b)
      })
    }

    function marcarTira(centrar, intento) {
      var items = strip.querySelectorAll('.cs-item')
      var on = null
      for (var k = 0; k < items.length; k++) {
        var esta = items[k].getAttribute('data-cat') === state.selectedCategory
        items[k].classList.toggle('on', esta)
        if (esta) on = items[k]
      }
      if (centrar && on) {
        // si la pantalla todavía está oculta no hay medidas: reintenta un momento después
        if (!strip.clientWidth && (intento || 0) < 12) { setTimeout(function () { marcarTira(true, (intento || 0) + 1) }, 60); return }
        strip.scrollTo({ left: on.offsetLeft + on.offsetWidth / 2 - strip.clientWidth / 2, behavior: intento ? 'auto' : 'smooth' })
      }
      efecto()
    }

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
      if (!strip.firstChild) construirTira()
      marcarTira(ultimaSel !== state.selectedCategory)
      ultimaSel = state.selectedCategory
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
