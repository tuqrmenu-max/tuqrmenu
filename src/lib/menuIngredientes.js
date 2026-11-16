// Personalizar ingredientes en el menú exportado (etapa 2).
//
// Al tocar un producto que tiene el check "personalizar" (propio o de su categoría) se abre una
// ventana con la foto, los ingredientes con un check para cada uno, un espacio para comentarios y
// la cantidad. El cliente destilda lo que NO quiere. Si no cambia nada ni escribe nada, el producto
// se agrega normal y en la mesa no aparece ningún aviso.
//
// Cómo viaja lo personalizado:
//  - En el carrito, cada combinación distinta es una "línea" con su propia clave dentro de
//    state.cart: "v~<fila>~<json codificado>" (las comunes siguen siendo "<fila>"). La clave lleva
//    adentro lo elegido, así sobrevive al guardado/restauración del carrito de la mesa 00.
//  - cartItems() devuelve esas líneas con { sin: [...], comentario } y el envío del pedido las
//    manda al servidor (ver el parche en personalizarIngredientes y menuShim.js).
//  - El servidor (qr_agregar_items) valida todo de nuevo: solo guarda "sin" y comentario si el
//    producto lo permite y solo con ingredientes que el producto realmente tiene.
//
// Igual que menuProductos.js, se inyecta en el HTML ya exportado. Si la estructura no es la
// esperada, no hace nada. Se serializa con toString(): no puede usar variables de afuera.

function menuIngredientes() {
  try {
    var $ = function (id) { return document.getElementById(id) }
    if (window.__ingredientesNuevo) return
    if (!window.__productosNuevo || !$('prodList') || typeof renderProducts !== 'function' ||
        typeof findProductImage !== 'function' || typeof escapeHtml !== 'function' ||
        typeof money !== 'function' || typeof price !== 'function' ||
        typeof cartItems !== 'function' || typeof renderCart !== 'function' ||
        typeof renderCartBadge !== 'function' || typeof state === 'undefined' ||
        typeof DATA === 'undefined' || !DATA.rows) return
    // Si ningún producto se puede personalizar, no se toca nada del menú.
    var hay = false
    for (var h = 0; h < DATA.rows.length; h++) { if (DATA.rows[h] && DATA.rows[h].personalizable) { hay = true; break } }
    if (!hay) return
    window.__ingredientesNuevo = true

    // ---------- líneas personalizadas del carrito ----------
    function claveVar(base, sin, com) {
      return 'v~' + base + '~' + encodeURIComponent(JSON.stringify({ s: sin, c: com }))
    }
    function leerVar(key) {
      var k = String(key)
      if (k.slice(0, 2) !== 'v~') return null
      var rest = k.slice(2)
      var p = rest.indexOf('~')
      if (p < 0) return null
      try {
        var o = JSON.parse(decodeURIComponent(rest.slice(p + 1)))
        return { base: rest.slice(0, p), sin: Array.isArray(o.s) ? o.s : [], com: String(o.c || '') }
      } catch (e) { return null }
    }
    function copiar(r) { var o = {}; for (var f in r) { if (Object.prototype.hasOwnProperty.call(r, f)) o[f] = r[f] } return o }

    // Igual que el original, pero entiende las líneas personalizadas.
    window.cartItems = function () {
      var out = []
      Object.keys(state.cart).forEach(function (k) {
        var q = state.cart[k]
        if (!(q > 0)) return
        var v = leerVar(k)
        if (v) {
          var rv = DATA.rows[v.base]
          if (!rv) return
          var ov = copiar(rv)
          ov.idx = k; ov.qty = q; ov.sin = v.sin; ov.comentario = v.com
          out.push(ov)
        } else if (String(k).slice(0, 2) === 'v~') {
          return // clave personalizada dañada: se ignora (no debe quedar una línea vacía)
        } else {
          var o = copiar(DATA.rows[k] || {})
          o.idx = k; o.qty = q
          out.push(o)
        }
      })
      return out
    }

    // ---------- estilos ----------
    var css = [
      '#pzOv{position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,.74);display:none;align-items:flex-end;justify-content:center}',
      '#pzOv.on{display:flex}',
      '#pzBox{position:relative;width:100%;max-width:460px;max-height:94vh;overflow-y:auto;overscroll-behavior:contain;background:#10161d;color:#fff;border-radius:22px 22px 0 0;box-shadow:0 -10px 40px rgba(0,0,0,.5)}',
      '#pzImg{display:block;width:100%;height:210px;object-fit:cover;border-radius:22px 22px 0 0;background:#1b2630}',
      '#pzX{position:absolute;top:10px;right:10px;width:38px;height:38px;border-radius:50%;border:0;background:rgba(0,0,0,.6);color:#fff;font-size:22px;line-height:1;cursor:pointer;z-index:2}',
      '#pzBody{padding:14px 16px 6px}',
      '#pzBody h3{margin:0;font-size:20px;font-weight:700;line-height:1.2}',
      '#pzBody .pz-price{margin-top:4px;font-size:17px;color:#039CCF;font-weight:700}',
      '#pzBody .pz-desc{margin:6px 0 0;font-size:13px;color:#a8b0bb}',
      '#pzBody .pz-sec{margin:16px 0 2px;font-size:14px;font-weight:700;letter-spacing:.2px}',
      '#pzBody .pz-hint{margin:0 0 8px;font-size:12px;color:#8d97a3}',
      '.pz-ing{display:flex;align-items:center;gap:12px;padding:11px 12px;margin-bottom:8px;border:1.5px solid #1c2733;border-radius:12px;background:#0b1118;cursor:pointer;-webkit-tap-highlight-color:transparent}',
      '.pz-ing input{position:absolute;opacity:0;pointer-events:none}',
      '.pz-ck{width:24px;height:24px;border-radius:7px;border:2px solid #4b5563;display:grid;place-items:center;flex:none;font-size:15px;font-weight:700;color:transparent}',
      '.pz-ing input:checked + .pz-ck{background:#016FC1;border-color:#016FC1;color:#fff}',
      '.pz-nm{font-size:15px}',
      '.pz-ing input:not(:checked) ~ .pz-nm{text-decoration:line-through;opacity:.55}',
      '.pz-ing input:not(:checked) + .pz-ck{background:transparent}',
      '#pzCom{width:100%;box-sizing:border-box;min-height:74px;resize:vertical;border:1.5px solid #1c2733;border-radius:12px;background:#0b1118;color:#fff;font:inherit;font-size:15px;padding:10px 12px}',
      '#pzCom:focus{outline:none;border-color:#039CCF}',
      '#pzCnt{margin:4px 2px 0;text-align:right;font-size:11px;color:#6b7280}',
      '#pzFoot{position:sticky;bottom:0;display:flex;align-items:center;gap:10px;padding:12px 16px calc(12px + env(safe-area-inset-bottom,0px));background:#10161d;border-top:1px solid #1c2733}',
      '#pzFoot .pz-q{display:flex;align-items:center;gap:2px;background:#07131c;border-radius:22px;padding:2px;flex:none}',
      '#pzFoot .pz-q button{width:38px;height:38px;border-radius:50%;border:0;background:#1b2630;color:#fff;font-size:22px;line-height:1;cursor:pointer}',
      '#pzFoot .pz-q b{min-width:26px;text-align:center;font-size:17px}',
      '#pzAdd{flex:1;height:48px;border:0;border-radius:24px;background:#016FC1;color:#fff;font-size:16px;font-weight:700;cursor:pointer}',
      '#pzAdd:active{background:#015a9c}',
      '.pz-tag{margin-top:3px;font-size:11.5px;color:#039CCF;font-weight:600}',
      '.pz-det{margin-top:4px;font-size:12.5px;font-weight:400;color:#f59e0b;line-height:1.35}'
    ].join('')
    var st = document.createElement('style')
    st.textContent = css
    document.head.appendChild(st)

    // ---------- ventana ----------
    var ov = document.createElement('div')
    ov.id = 'pzOv'
    ov.setAttribute('role', 'dialog')
    ov.setAttribute('aria-modal', 'true')
    ov.innerHTML = '<div id="pzBox"></div>'
    document.body.appendChild(ov)
    var box = ov.firstChild
    var actual = null // { i, ings, qty }

    function cerrar() { ov.classList.remove('on'); actual = null }
    ov.addEventListener('click', function (e) { if (e.target === ov) cerrar() })
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && actual) cerrar() })

    function totalModal() {
      var r = DATA.rows[actual.i]
      return money(price(r.precio) * actual.qty)
    }

    function abrir(i) {
      var r = DATA.rows[i]
      if (!r) return
      var ings = Array.isArray(r.ingredientes) ? r.ingredientes.filter(function (x) { return String(x || '').trim() }) : []
      actual = { i: String(i), ings: ings, qty: 1 }
      var img = findProductImage(r, i)
      var desc = (r.detalle || '').trim()
      var h = '<button id="pzX" type="button" aria-label="Cerrar">×</button>'
      if (img) h += '<img id="pzImg" alt="" src="' + img + '">'
      h += '<div id="pzBody"' + (img ? '' : ' style="padding-top:54px"') + '>'
      h += '<h3>' + escapeHtml(r.producto) + '</h3><div class="pz-price">' + money(price(r.precio)) + '</div>'
      if (desc) h += '<p class="pz-desc">' + escapeHtml(desc) + '</p>'
      if (ings.length) {
        h += '<div class="pz-sec">Ingredientes</div><p class="pz-hint">Destildá lo que no querés en tu pedido.</p>'
        ings.forEach(function (n, k) {
          h += '<label class="pz-ing"><input type="checkbox" checked data-k="' + k + '"><span class="pz-ck">✓</span><span class="pz-nm">' + escapeHtml(n) + '</span></label>'
        })
      }
      h += '<div class="pz-sec">Comentarios</div><p class="pz-hint">Opcional. Por ejemplo: bien cocida, sin sal…</p>'
      h += '<textarea id="pzCom" maxlength="200" placeholder="Escribí acá tu comentario"></textarea><div id="pzCnt">0/200</div>'
      h += '</div>'
      h += '<div id="pzFoot"><div class="pz-q"><button type="button" id="pzMenos" aria-label="Quitar uno">−</button><b id="pzQty">1</b><button type="button" id="pzMas" aria-label="Agregar uno">+</button></div>'
      h += '<button type="button" id="pzAdd"></button></div>'
      box.innerHTML = h
      box.scrollTop = 0
      var ta = box.querySelector('#pzCom')
      var cnt = box.querySelector('#pzCnt')
      var btn = box.querySelector('#pzAdd')
      var qEl = box.querySelector('#pzQty')
      function pintar() { qEl.textContent = actual.qty; btn.textContent = 'Agregar · ' + totalModal() }
      pintar()
      ta.addEventListener('input', function () { cnt.textContent = ta.value.length + '/200' })
      box.querySelector('#pzX').onclick = cerrar
      box.querySelector('#pzMenos').onclick = function () { if (actual.qty > 1) { actual.qty--; pintar() } }
      box.querySelector('#pzMas').onclick = function () { if (actual.qty < 99) { actual.qty++; pintar() } }
      btn.onclick = function () {
        var sin = []
        actual.ings.forEach(function (n, k) {
          var c = box.querySelector('input[data-k="' + k + '"]')
          if (c && !c.checked) sin.push(n)
        })
        var com = String(ta.value || '').replace(/\s+/g, ' ').trim().slice(0, 200)
        var key = (!sin.length && !com) ? actual.i : claveVar(actual.i, sin, com)
        state.cart[key] = Math.min(99, (state.cart[key] || 0) + actual.qty)
        cerrar()
        window.renderProducts(); renderCart(); renderCartBadge()
        try { if (typeof showToast === 'function') showToast('Agregado al pedido') } catch (e) { /* nada */ }
      }
      ov.classList.add('on')
    }

    // Tocar el producto (o su "+") abre la ventana; los botones − / + del contador siguen sumando normal.
    $('prodList').addEventListener('click', function (e) {
      var t = e.target
      if (!t || !t.closest) return
      var card = t.closest('.product-card')
      if (!card || t.closest('.pc-step')) return
      var b = card.querySelector('[data-plus]')
      if (!b) return
      var i = String(b.getAttribute('data-plus'))
      var r = DATA.rows[i]
      if (!r || !r.personalizable) return
      e.preventDefault(); e.stopPropagation()
      abrir(i)
    }, true)

    // ---------- tarjetas del listado y carrito ----------
    function variantesDe(base) {
      var n = 0
      Object.keys(state.cart).forEach(function (k) {
        var v = leerVar(k)
        if (v && v.base === String(base) && state.cart[k] > 0) n += state.cart[k]
      })
      return n
    }
    function marcarTarjetas() {
      var cards = $('prodList').querySelectorAll('.product-card')
      for (var c = 0; c < cards.length; c++) {
        var b = cards[c].querySelector('[data-plus]')
        if (!b) continue
        var i = String(b.getAttribute('data-plus'))
        var r = DATA.rows[i]
        if (!r || !r.personalizable) continue
        var info = cards[c].querySelector('.prod-info')
        if (!info || info.querySelector('.pz-tag')) continue
        var n = variantesDe(i)
        var tag = document.createElement('div')
        tag.className = 'pz-tag'
        tag.textContent = '✎ Personalizable' + (n > 0 ? ' · ' + n + (n === 1 ? ' con cambios en tu pedido' : ' con cambios en tu pedido') : '')
        info.appendChild(tag)
        if (n > 0) cards[c].classList.add('sel')
      }
    }
    var rp = window.renderProducts
    window.renderProducts = function () {
      var res = rp.apply(this, arguments)
      try { marcarTarjetas() } catch (e) { /* nada */ }
      return res
    }

    function decorarCarrito() {
      var porClave = {}
      cartItems().forEach(function (it) { porClave[it.idx] = it })
      var btns = document.querySelectorAll('#cartList [data-del]')
      for (var b = 0; b < btns.length; b++) {
        var it = porClave[btns[b].getAttribute('data-del')]
        if (!it || (!(it.sin && it.sin.length) && !it.comentario)) continue
        var span = btns[b].parentNode.querySelector('span')
        if (!span || span.querySelector('.pz-det')) continue
        var t = []
        if (it.sin && it.sin.length) t.push('Sin: ' + it.sin.map(escapeHtml).join(', '))
        if (it.comentario) t.push('💬 ' + escapeHtml(it.comentario))
        span.insertAdjacentHTML('beforeend', '<div class="pz-det">' + t.join('<br>') + '</div>')
      }
    }
    var rc = window.renderCart
    window.renderCart = function () {
      var res = rc.apply(this, arguments)
      try { decorarCarrito() } catch (e) { /* nada */ }
      return res
    }

    // Si ya había una categoría abierta, la redibuja (agrega las etiquetas).
    if (state.selectedCategory) window.renderProducts()
  } catch (e) {
    try { console.warn('ingredientes:', e && e.message) } catch (_) { /* nada */ }
  }
}

export function menuIngredientesScript() {
  return '<script>(' + menuIngredientes.toString() + ')()</script>'
}

// Prepara el HTML del menú: parchea el envío del pedido para que lleve lo personalizado
// (también en menús viejos ya guardados) e inyecta la ventana. Si no encuentra donde parchar el
// envío, NO inyecta nada: mejor que el cliente no pueda personalizar a que crea que pidió
// "sin lechuga" y el pedido llegue sin el aviso.
export function personalizarIngredientes(html) {
  if (!html || html.indexOf('window.__ingredientesNuevo') !== -1) return html
  const reEnvio = /cantidad:i\.qty,pagado:0,es_promo:(?:0|state\.activePromo\?1:0),/g
  if (!reEnvio.test(html)) return html
  reEnvio.lastIndex = 0
  let out = html.replace(reEnvio, "cantidad:i.qty,sin_ingredientes:i.sin||[],comentario:i.comentario||'',pagado:0,es_promo:0,")
  // Mensaje de WhatsApp (mesa 0): que también diga "sin ..." y el comentario.
  out = out.split("const lines=cartItems().map(i=>i.qty+' x '+i.producto+' — '+money(price(i.precio)*i.qty));").join(
    "const lines=cartItems().map(i=>i.qty+' x '+i.producto+(i.sin&&i.sin.length?' (sin '+i.sin.join(', ')+')':'')+(i.comentario?' ['+i.comentario+']':'')+' — '+money(price(i.precio)*i.qty));"
  )
  const s = menuIngredientesScript()
  const i = out.lastIndexOf('</body>')
  return i === -1 ? out + s : out.slice(0, i) + s + out.slice(i)
}
