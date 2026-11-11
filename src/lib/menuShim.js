// Capa de compatibilidad para el menú público exportado.
//
// El HTML del menú (guardado en Storage) habla directo con la API REST de
// Supabase: /rest/v1/<tabla>. Al cerrar el acceso anónimo a las tablas, esas
// llamadas dejan de funcionar. Este script se inyecta al principio del HTML
// (ver MenuView.jsx) e intercepta fetch() SOLO para esas URLs, traduciéndolas a
// las funciones seguras (qr_*) de la base. Sirve igual para menús viejos y
// nuevos, sin tener que volver a exportarlos.
//
// IMPORTANTE: la función se serializa con toString() y se ejecuta dentro del
// iframe, así que NO puede usar variables de afuera (todo entra por parámetro).

function menuShim(SUPABASE_URL, INITIAL_STORAGE) {
  // El iframe corre en sandbox SIN allow-same-origin: su localStorage real no existe
  // (lanza SecurityError). Se reemplaza por uno en memoria que arranca con los datos
  // que le pasa la pagina padre y le avisa de cada cambio (postMessage) para guardarlos.
  ;(function () {
    var data = {}
    for (var k0 in (INITIAL_STORAGE || {})) data[k0] = String(INITIAL_STORAGE[k0])
    function avisar(op, k, v) {
      try { window.parent.postMessage({ tuqrmenuStorage: true, op: op, k: k, v: v }, '*') } catch (e) {}
    }
    var store = {
      getItem: function (k) { k = String(k); return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null },
      setItem: function (k, v) { k = String(k); v = String(v); data[k] = v; avisar('set', k, v) },
      removeItem: function (k) { k = String(k); delete data[k]; avisar('remove', k) },
      clear: function () { data = {}; avisar('clear') },
      key: function (i) { var ks = Object.keys(data); return i < ks.length ? ks[i] : null }
    }
    Object.defineProperty(store, 'length', { get: function () { return Object.keys(data).length } })
    try { Object.defineProperty(window, 'localStorage', { value: store, configurable: true }) } catch (e) {}
  })()

  var REST = SUPABASE_URL + '/rest/v1/'
  var origFetch = window.fetch.bind(window)
  var sesionDeComensal = {}

  function json(data, status) {
    return new Response(JSON.stringify(data), {
      status: status || 200,
      headers: { 'Content-Type': 'application/json' }
    })
  }
  function fail(msg, status) {
    return new Response(String(msg || 'error'), { status: status || 400 })
  }
  function eq(params, key) {
    var v = params.get(key)
    if (v == null) return null
    return v.indexOf('eq.') === 0 ? decodeURIComponent(v.slice(3)) : v
  }
  function sesionMesa(mesa) {
    try { return localStorage.getItem('mesa_' + mesa + '_sesion') } catch (e) { return null }
  }
  function sesionesLocales() {
    var out = []
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i)
        if (/^mesa_\d+_sesion$/.test(k)) out.push(localStorage.getItem(k))
      }
    } catch (e) {}
    return out
  }
  function headersDe(init, input) {
    var h = {}
    var src = (init && init.headers) || (input && input.headers) || {}
    if (typeof src.forEach === 'function' && !Array.isArray(src)) {
      src.forEach(function (v, k) { h[k] = v })
    } else if (Array.isArray(src)) {
      src.forEach(function (p) { h[p[0]] = p[1] })
    } else {
      for (var k in src) h[k] = src[k]
    }
    return h
  }

  async function rpc(fn, params, init, input) {
    var h = headersDe(init, input)
    var r = await origFetch(REST + 'rpc/' + fn, {
      method: 'POST',
      headers: { apikey: h.apikey || h.Apikey || '', Authorization: h.Authorization || h.authorization || '', 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    })
    var text = await r.text()
    var data = null
    try { data = text ? JSON.parse(text) : null } catch (e) { data = text }
    return { ok: r.ok, data: data, text: text }
  }

  window.fetch = async function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || ''
    if (url.indexOf(REST) !== 0) return origFetch(input, init)
    var method = ((init && init.method) || (input && input.method) || 'GET').toUpperCase()
    var u = new URL(url)
    var tabla = u.pathname.replace('/rest/v1/', '')
    var q = u.searchParams
    var body = null
    try {
      var raw = init && init.body
      body = raw ? JSON.parse(raw) : null
    } catch (e) { body = null }

    try {
      // --- Lecturas públicas permitidas (productos activos, categorías, promos): pasan directo
      if (method === 'GET' && (tabla === 'productos' || tabla === 'categorias' || tabla === 'promociones')) {
        return origFetch(input, init)
      }
      if (tabla.indexOf('rpc/') === 0) return origFetch(input, init)

      // --- Estado de la mesa (campana del mozo y propina)
      if (tabla === 'mesas_operacion' && method === 'GET') {
        var cid = eq(q, 'cliente_id'), num = parseInt(eq(q, 'numero'), 10)
        var r1 = await rpc('qr_mesa_leer', { p_cliente_id: cid, p_mesa: num, p_sesion: sesionMesa(num) }, init, input)
        return r1.ok ? json(r1.data || []) : fail(r1.text)
      }

      // --- Ítems ya pedidos por un comensal
      if (tabla === 'pedidos_qr' && method === 'GET') {
        var comId = eq(q, 'comensal_id')
        var cand = []
        if (sesionDeComensal[comId]) cand.push(sesionDeComensal[comId])
        sesionesLocales().forEach(function (s) { if (cand.indexOf(s) < 0) cand.push(s) })
        for (var i = 0; i < cand.length; i++) {
          var r2 = await rpc('qr_items_comensal', { p_comensal_id: comId, p_sesion: cand[i] }, init, input)
          if (r2.ok && Array.isArray(r2.data) && r2.data.length > 0) return json(r2.data)
        }
        return json([])
      }

      // --- Crear comensal
      if (tabla === 'comensales' && method === 'POST' && body) {
        var r3 = await rpc('qr_crear_comensal', {
          p_cliente_id: body.cliente_id, p_mesa: body.mesa, p_sesion: body.sesion_id,
          p_nombre: body.nombre || null, p_telefono: body.telefono || null, p_direccion: body.direccion || null,
          p_codigo_pedido: body.codigo_pedido || null, p_metodo_entrega: body.metodo_entrega || null
        }, init, input)
        if (!r3.ok) return fail(r3.text)
        sesionDeComensal[r3.data] = body.sesion_id
        return json([{ id: r3.data }], 201)
      }

      // --- Confirmar recepción (delivery / retiro)
      if (tabla === 'comensales' && method === 'PATCH' && body) {
        var r4 = await rpc('qr_confirmar_entrega', {
          p_cliente_id: eq(q, 'cliente_id'), p_comensal_id: eq(q, 'id'), p_sesion: eq(q, 'sesion_id')
        }, init, input)
        if (!r4.ok) return fail(r4.text)
        return json(r4.data ? [r4.data] : [])
      }

      // --- Agregar ítems al pedido
      if (tabla === 'pedidos_qr' && method === 'POST' && body) {
        var filas = Array.isArray(body) ? body : [body]
        var porComensal = {}
        filas.forEach(function (f) {
          (porComensal[f.comensal_id] = porComensal[f.comensal_id] || []).push({
            producto_id: f.producto_id, cantidad: f.cantidad, es_promo: f.es_promo ? 1 : 0
          })
        })
        for (var cId in porComensal) {
          var r5 = await rpc('qr_agregar_items', {
            p_comensal_id: cId, p_sesion: sesionDeComensal[cId] || null, p_items: porComensal[cId]
          }, init, input)
          if (!r5.ok) return fail(r5.text)
        }
        return json([], 201)
      }

      // --- Mesa: ocupada / mozo llamado / propina (POST = upsert, PATCH = update)
      if (tabla === 'mesas_operacion' && (method === 'POST' || method === 'PATCH') && body) {
        var fila = Array.isArray(body) ? body[0] : body
        var cliente = fila.cliente_id || eq(q, 'cliente_id')
        var mesa = parseInt(fila.numero != null ? fila.numero : eq(q, 'numero'), 10)
        if (fila.estado) {
          var r6 = await rpc('qr_mesa_marcar', { p_cliente_id: cliente, p_mesa: mesa, p_estado: fila.estado }, init, input)
          return r6.ok ? json(r6.data ? [{ estado: fila.estado }] : []) : fail(r6.text)
        }
        if (fila.propina_monto != null) {
          var r7 = await rpc('qr_mesa_propina', {
            p_cliente_id: cliente, p_mesa: mesa, p_monto: fila.propina_monto,
            p_sesion: fila.propina_sesion_id || sesionMesa(mesa) || null
          }, init, input)
          return r7.ok ? json(r7.data ? [{ propina_monto: fila.propina_monto }] : []) : fail(r7.text)
        }
      }

      // --- Socios y opiniones
      if (tabla === 'suscripciones' && method === 'POST' && body) {
        var r8 = await rpc('qr_suscribirse', {
          p_cliente_id: body.cliente_id, p_nombre: body.nombre, p_whatsapp: body.whatsapp, p_instagram: body.instagram || null
        }, init, input)
        return r8.ok ? json([{ id: r8.data }], 201) : fail(r8.text)
      }
      if (tabla === 'opiniones' && method === 'POST' && body) {
        var r9 = await rpc('qr_opinion', {
          p_cliente_id: body.cliente_id, p_whatsapp: body.whatsapp, p_mensaje: body.mensaje, p_mesa: body.mesa == null ? null : body.mesa
        }, init, input)
        return r9.ok ? json([{}], 201) : fail(r9.text)
      }
    } catch (e) {
      return fail(e && e.message, 500)
    }

    // Cualquier otra tabla: ya no hay acceso anónimo directo.
    return fail('operacion no permitida', 403)
  }
}

// Devuelve el <script> listo para insertar en el HTML del menú.
// initialStorage: datos del menu (sesion de mesa, propina, promos) que viven en el
// localStorage de la pagina padre y se pasan al iframe en sandbox.
export function menuShimScript(supabaseUrl, initialStorage) {
  const datos = JSON.stringify(initialStorage || {}).replace(/</g, '\\u003c')
  return '<script>(' + menuShim.toString() + ')(' + JSON.stringify(supabaseUrl) + ',' + datos + ')</script>'
}

// Claves que el menu exportado puede leer/escribir. Cualquier otra se ignora.
export const CLAVES_MENU = /^(mesa_\d+_(sesion|propina)|pedidoMesa0Seq_[\w-]+|promo(Count|Seen|Susc)_[\w-]*)$/

export function leerAlmacenMenu() {
  const out = {}
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (CLAVES_MENU.test(k)) out[k] = localStorage.getItem(k)
    }
  } catch (e) { /* sin almacenamiento */ }
  return out
}

// Aplica un mensaje del iframe al localStorage de la pagina (validado).
export function aplicarMensajeAlmacen(msg) {
  try {
    if (!msg || msg.tuqrmenuStorage !== true || typeof msg.k !== 'string' || !CLAVES_MENU.test(msg.k)) return
    if (msg.op === 'set' && typeof msg.v === 'string' && msg.v.length <= 4000) localStorage.setItem(msg.k, msg.v)
    else if (msg.op === 'remove') localStorage.removeItem(msg.k)
  } catch (e) { /* sin almacenamiento */ }
}
