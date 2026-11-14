// Selector de idioma dentro del menú del cliente (QR).
//
// Igual que menuShim.js y menuUnificar.js, se inyecta en el HTML ya exportado (ver
// MenuView.jsx): sirve para menús viejos y nuevos sin volver a exportarlos.
// Agrega un ícono 🌐 en la barra negra, al lado del logo, que abre la lista de idiomas
// habilitados para el local, y traduce los textos fijos del menú con un diccionario.
// El idioma elegido queda guardado en el dispositivo (clave "menuLang").
//
// IMPORTANTE: la función se serializa con toString() y corre dentro del iframe: no puede
// usar variables de afuera (todo entra por CFG) ni contener la secuencia que cierra un script.
import { COLUMNAS, FILAS } from './menuIdiomasTextos'
import { IDIOMAS } from './idiomas'

function menuIdiomas(CFG) {
  try {
    if (window.__menuIdiomas) return
    var doc = document
    var lista = CFG.idiomas || []
    if (lista.length < 2) return
    window.__menuIdiomas = true

    var dict = CFG.dict || {}
    var nombres = CFG.nombres || {}
    var lang = 'es'
    try {
      var guardado = localStorage.getItem('menuLang')
      if (guardado && lista.indexOf(guardado) >= 0) lang = guardado
    } catch (e) { /* sin almacenamiento */ }

    var SKIP = '#prodList,#catList,#cartList,.ringName,#idiomaPanel,script,style'
    var RE_PRE = /^[^\p{L}\p{N}¡¿]*/u
    var RE_LET = /[\p{L}\p{N}]/u
    var orig = new WeakMap()

    function traducir(txt) {
      var d = dict[lang]
      if (!d) return null
      var m = /^(\s*)([\s\S]*?)(\s*)$/.exec(txt)
      var core = m[2].replace(/\s+/g, ' ')
      if (!core) return null
      var pre = RE_PRE.exec(core)[0]
      var rest = core.slice(pre.length)
      if (!rest) return null
      var hit = d.e[rest]
      if (hit !== undefined) return m[1] + pre + hit + m[3]
      for (var i = 0; i < d.p.length; i++) {
        var k = d.p[i][0]
        if (rest.indexOf(k) !== 0) continue
        var next = rest.charAt(k.length)
        if (next === '' || !RE_LET.test(next) || k.charAt(k.length - 1) === ':') {
          return m[1] + pre + d.p[i][1] + rest.slice(k.length) + m[3]
        }
      }
      return null
    }

    // Devuelve el texto a mostrar y el registro (original/traducido) para poder restaurar.
    function resolver(actual, rec) {
      if (rec && actual !== rec.t) rec = null // la página puso contenido nuevo
      var base = rec ? rec.o : actual
      var out = lang === 'es' ? null : traducir(base)
      if (out === null) return { texto: base, rec: null }
      return { texto: out, rec: { o: base, t: out } }
    }

    function procTexto(n) {
      var r = resolver(n.nodeValue, orig.get(n))
      if (n.nodeValue !== r.texto) n.nodeValue = r.texto
      if (r.rec) orig.set(n, r.rec); else orig.delete(n)
    }

    var attrs = ['placeholder', 'title']
    var origAttr = new WeakMap()
    function procAttrs(el) {
      for (var i = 0; i < attrs.length; i++) {
        var a = attrs[i]
        if (!el.hasAttribute(a)) continue
        var recs = origAttr.get(el) || {}
        var r = resolver(el.getAttribute(a), recs[a])
        if (el.getAttribute(a) !== r.texto) el.setAttribute(a, r.texto)
        if (r.rec) recs[a] = r.rec; else delete recs[a]
        origAttr.set(el, recs)
      }
    }

    var obs
    function escanear() {
      if (obs) obs.disconnect()
      try {
        var w = doc.createTreeWalker(doc.body, 1 | 4, {
          acceptNode: function (n) {
            if (n.nodeType === 1) {
              if (n.matches(SKIP)) return 2 // FILTER_REJECT: ignora el subárbol
              procAttrs(n)
              return 3 // FILTER_SKIP: sigue con los hijos
            }
            return 1
          }
        })
        var nodos = []
        while (w.nextNode()) nodos.push(w.currentNode)
        nodos.forEach(procTexto)
        doc.documentElement.lang = lang
        etiquetas()
      } catch (e) { /* el menú sigue funcionando en español */ }
      if (obs) obs.observe(doc.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: attrs })
    }

    var timer = null
    obs = new MutationObserver(function () {
      if (timer) return
      timer = setTimeout(function () { timer = null; escanear() }, 40)
    })

    // --- Ícono 🌐 al lado del logo, en la barra negra de cada pantalla ---
    var st = doc.createElement('style')
    st.textContent = [
      '.idiomaBtn{font-size:22px}',
      '.idiomaTag{position:absolute;right:-3px;bottom:-1px;font-size:9px;font-weight:800;line-height:1;background:#2f6fed;color:#fff;border-radius:6px;padding:2px 3px;display:none}',
      '.idiomaBtn.on .idiomaTag{display:block}',
      '#idiomaPanel{position:fixed;z-index:99999;min-width:170px;max-width:80vw;background:#111827;border:1px solid #374151;border-radius:12px;box-shadow:0 12px 32px rgba(0,0,0,.6);overflow:hidden}',
      '#idiomaPanel button{display:flex;align-items:center;gap:10px;width:100%;border:0;background:transparent;color:#e5e7eb;font-size:15px;text-align:left;padding:11px 14px;cursor:pointer}',
      '#idiomaPanel button:active,#idiomaPanel button.sel{background:rgba(47,111,237,.25);color:#fff}'
    ].join('\n')
    doc.head.appendChild(st)

    var botones = []
    ;['logoInfoCategories', 'logoInfoProducts', 'logoInfoCart'].forEach(function (id) {
      var ancla = doc.getElementById(id)
      if (!ancla || !ancla.parentNode) return
      var b = doc.createElement('button')
      b.type = 'button'
      b.className = 'topActionBtn idiomaBtn'
      b.setAttribute('aria-label', 'Idioma / Language')
      b.appendChild(doc.createTextNode('🌐'))
      var tag = doc.createElement('span')
      tag.className = 'idiomaTag'
      b.appendChild(tag)
      ancla.parentNode.insertBefore(b, ancla.nextSibling)
      b.addEventListener('click', function (e) { e.stopPropagation(); alternar(b) })
      botones.push(b)
    })
    if (!botones.length) return

    function etiquetas() {
      botones.forEach(function (b) {
        b.classList.toggle('on', lang !== 'es')
        b.querySelector('.idiomaTag').textContent = lang.toUpperCase()
      })
    }

    function cerrar() {
      var p = doc.getElementById('idiomaPanel')
      if (p) p.parentNode.removeChild(p)
    }

    function elegir(code) {
      lang = code
      try { localStorage.setItem('menuLang', code) } catch (e) { /* sin almacenamiento */ }
      cerrar()
      escanear()
    }

    function alternar(btn) {
      if (doc.getElementById('idiomaPanel')) { cerrar(); return }
      var p = doc.createElement('div')
      p.id = 'idiomaPanel'
      p.setAttribute('role', 'listbox')
      lista.forEach(function (code) {
        var n = nombres[code] || { n: code, b: '' }
        var it = doc.createElement('button')
        it.type = 'button'
        it.setAttribute('role', 'option')
        if (code === lang) it.className = 'sel'
        it.textContent = (n.b ? n.b + '  ' : '') + n.n
        it.addEventListener('click', function (e) { e.stopPropagation(); elegir(code) })
        p.appendChild(it)
      })
      doc.body.appendChild(p)
      var r = btn.getBoundingClientRect()
      p.style.top = Math.round(r.bottom + 6) + 'px'
      var der = Math.max(8, Math.round(window.innerWidth - r.right))
      p.style.right = der + 'px'
    }

    doc.addEventListener('click', function (e) {
      var p = doc.getElementById('idiomaPanel')
      if (p && !p.contains(e.target)) cerrar()
    })
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape') cerrar() })

    escanear()
  } catch (e) {
    try { console.warn('idiomas del menu:', e && e.message) } catch (_) { /* nada */ }
  }
}

// Diccionario solo de los idiomas habilitados: { en: { e: {texto: traducción}, p: [[prefijo, traducción]] } }
export function armarDiccionario(idiomas) {
  const dict = {}
  COLUMNAS.forEach((code, col) => {
    if (!idiomas.includes(code)) return
    const e = {}
    const p = []
    FILAS.forEach(fila => {
      const origen = fila[0]
      const destino = fila[col + 1]
      if (origen.endsWith('*')) p.push([origen.slice(0, -1), destino])
      else e[origen] = destino
    })
    p.sort((a, b) => b[0].length - a[0].length)
    dict[code] = { e, p }
  })
  return dict
}

function nombresIdiomas() {
  const out = { es: { n: 'Español', b: '🇪🇸' } }
  IDIOMAS.forEach(i => { out[i.code] = { n: i.nativo, b: i.bandera } })
  return out
}

// Inserta el selector y el diccionario al final del HTML del menú (idempotente).
// `idiomas` = lista habilitada por el super admin (incluye 'es'). Con solo español no hace nada.
export function aplicarIdiomasMenu(html, idiomas) {
  if (!html || !Array.isArray(idiomas) || idiomas.length < 2) return html
  if (html.indexOf('window.__menuIdiomas') !== -1) return html
  const orden = ['es', ...COLUMNAS].filter(c => idiomas.includes(c))
  const cfg = { idiomas: orden, dict: armarDiccionario(orden), nombres: nombresIdiomas() }
  const datos = JSON.stringify(cfg).replace(/</g, '\\u003c')
  const script = '<script>(' + menuIdiomas.toString() + ')(' + datos + ')</script>'
  const i = html.lastIndexOf('</body>')
  return i === -1 ? html + script : html.slice(0, i) + script + html.slice(i)
}
