// Pantalla única para el menú exportado: la portada (logo + bienvenida) se junta con
// la pantalla de categorías, y el botón "atrás" del celular recorre las pantallas del
// menú (categorías → productos → carrito) en vez de salir del menú.
//
// Igual que menuShim.js, se inyecta en el HTML ya exportado (ver MenuView.jsx), así
// que sirve para menús viejos y nuevos sin volver a exportarlos. Se ejecuta al final
// del <body>, cuando el script del menú ya definió setView(), state, etc.
// Si la estructura del HTML no es la esperada, no hace nada (el menú queda como antes).
//
// IMPORTANTE: se serializa con toString() y corre dentro del iframe: no puede usar
// variables de afuera, ni contener la secuencia que cierra un script.

function menuUnificar() {
  try {
    var $ = function (id) { return document.getElementById(id) }
    var cats = $('cats')
    var cover = $('cover')
    if (!cats || !cover || typeof setView !== 'function' || typeof state === 'undefined') return
    if (window.__pantallaUnica) return
    window.__pantallaUnica = true

    var css = [
      // logo y bienvenida: arriba y centrados, sobre el anillo (sin tapar toques)
      // (de arriba hacia abajo: barra negra, bienvenida, logo, anillo)
      '#cats>#welcome{left:50%!important;top:13.5%!important;transform:translateX(-50%)!important;width:max-content;max-width:92%;white-space:normal;text-align:center;z-index:9;pointer-events:none}',
      '#cats>#logo{left:50%!important;top:21.5%!important;width:auto!important;height:15%;max-width:62%;max-height:none!important;transform:translateX(-50%)!important;z-index:9;pointer-events:none}',
      // encabezado de categorías: barra negra con info y promos; sin título, flecha, carrito ni "Salir"
      // barra negra fina (60 px en vez de 94)
      '#cats .productsTop{min-height:60px;grid-template-rows:0 48px}',
      '#cats .categories.ringMode{height:calc(100% - 60px)!important}',
      '#cats .title,#backCover,#categoriesCart,#exitMenuCats{display:none!important}',
      // sin "N productos" ni puntos indicadores bajo el nombre de la categoría
      '.ringCount,.ringDots,.ringTrack{display:none!important}'
    ].join('\n')
    var st = document.createElement('style')
    st.setAttribute('data-pantalla-unica', '1')
    st.textContent = css
    document.head.appendChild(st)

    ;[$('logo'), $('welcome')].forEach(function (el) { if (el) cats.appendChild(el) })
    var mb = $('menuBtn')
    if (mb) mb.style.display = 'none'

    // --- Navegación: el historial del navegador sigue a las pantallas del menú ---
    var orig = window.setView
    var stack = ['categories']
    var pendiente = null

    window.setView = function (name) {
      if (name === 'cover') name = 'categories'
      var i = stack.lastIndexOf(name)
      if (i === stack.length - 1) return orig(name)
      if (i >= 0) {
        // volver a una pantalla anterior = retroceder en el historial
        var pasos = stack.length - 1 - i
        try { history.go(-pasos) } catch (e) { /* se resuelve abajo */ }
        clearTimeout(pendiente)
        pendiente = setTimeout(function () {
          if (state.screen !== name) { stack.length = i + 1; orig(name) }
        }, 350)
        return
      }
      stack.push(name)
      try { history.pushState({ v: name }, '') } catch (e) { /* sin historial: igual navega */ }
      return orig(name)
    }

    window.addEventListener('popstate', function (e) {
      var v = (e.state && e.state.v) || 'categories'
      var i = stack.lastIndexOf(v)
      if (i < 0) { v = 'categories'; i = 0 }
      stack.length = i + 1
      clearTimeout(pendiente)
      orig(v)
    })

    // "Salir" ya no vuelve a una portada: lleva al inicio (categorías)
    ;['exitTop', 'exitCart'].forEach(function (id) {
      var b = $(id)
      if (b) b.onclick = function () { window.setView('categories') }
    })

    // pantalla de inicio = categorías
    orig('categories')
  } catch (e) {
    try { console.warn('pantalla unica:', e && e.message) } catch (_) { /* nada */ }
  }
}

// <script> listo para insertar antes de </body>.
export function menuUnificarScript() {
  return '<script>(' + menuUnificar.toString() + ')()</script>'
}

// Inserta el script al final del HTML del menú (idempotente).
export function unirPortadaCategorias(html) {
  if (!html || html.indexOf('data-pantalla-unica') !== -1 || html.indexOf('window.__pantallaUnica') !== -1) return html
  const s = menuUnificarScript()
  const i = html.lastIndexOf('</body>')
  return i === -1 ? html + s : html.slice(0, i) + s + html.slice(i)
}
