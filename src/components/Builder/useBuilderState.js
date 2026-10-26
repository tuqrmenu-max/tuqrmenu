import { storeMenuImage } from '@/lib/menuImages'
import { create } from 'zustand'

const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
const slug = s => norm(s).replace(/[^a-z0-9]/g, '')
const fileKey = n => norm(String(n || '').split(/[\\/]/).pop())
const stripExt = n => String(n || '').replace(/\.[a-z0-9]+$/i, '')

const aliases = {
  categoria: ['categoria', 'categorias', 'category', 'rubro'],
  producto: ['producto', 'productos', 'product', 'item', 'nombre'],
  precio: ['precio', 'price', 'valor'],
  detalle: ['detalle', 'detalles', 'descripcion', 'description'],
  imagen: ['imagen', 'imagenes', 'image', 'img', 'foto']
}

function mapRow(raw) {
  const out = { categoria: '', producto: '', precio: '', detalle: '', imagen: '' }
  const keys = Object.keys(raw)
  for (const f in aliases) {
    const found = keys.find(k => aliases[f].includes(norm(k)))
    if (found) out[f] = raw[found]
  }
  return out
}

export const useBuilderState = create((set, get) => ({
  socioId: null,
  userId: null,
  clientName: '',
  coverBg: '',
  categoriesBg: '',
  productsBg: '',
  cartBg: '',
  logo: '',
  logoBar: '',
  blur: 55,
  categoriesBlur: 55,
  productsBlur: 55,
  cartBlur: 55,
  welcomeText: '',
  welcomeColor: '#e8ecef',
  welcomeBg: '#008080',
  welcomeBgNone: false,
  welcomeSize: 16,
  buttonText: 'VER MENÚ',
  buttonBg: '#008080',
  buttonBorder: '#2f6fed',
  buttonColor: '#ffffff',
  buttonFontSize: 14,
  buttonPadding: 15,
  buttonWidth: 82,
  rows: [],
  productImages: {},
  categoryImages: {},
  categoryTransforms: {},
  screen: 'cover',
  selectedCategory: '',
  cart: {},
  draftQty: {},
  whatsapp: '',
  instagram: '',
  address: '',
  hours: '',
  promo: '',
  alias: '',
  delivery: 0,
  deliveryEnabled: false,
  customerAddress: '',
  waIcon: '',
  igIcon: '',
  mapIcon: '',
  promoIcon: '',
  forceSupabaseOrders: false,
  sharePromoWithMesaZero: false,
  topBarFrameBorderColor: '#9ca3af',
  topBarFrameBorderTransparent: false,
  topBarFrameBgColor: '#000000',
  topBarFrameBgTransparent: true,
  logoTransform: { x: 280, y: 670, scale: 1, rotation: 0 },
  welcomeTransform: { x: 300, y: 120, scale: 1, rotation: 0 },
  buttonTransform: { x: 100, y: 1680, scale: 1, rotation: 0 },
  headerControls: {},
  topTransforms: {
    back: { x: 20, y: 10, scale: 1, rotation: 0 },
    logo: { x: 560, y: 10, scale: 1, rotation: 0 },
    wa: { x: 470, y: 40, scale: 1, rotation: 0 },
    promo: { x: 660, y: 10, scale: 1, rotation: 0 },
    cart: { x: 820, y: 10, scale: 1, rotation: 0 },
    map: { x: 770, y: 40, scale: 1, rotation: 0 },
    ig: { x: 920, y: 40, scale: 1, rotation: 0 },
    bell: { x: 760, y: 10, scale: 1, rotation: 0 },
    mesa: { x: 30, y: 100, scale: 1, rotation: 0 },
    exit: { x: 930, y: 10, scale: 1, rotation: 0 },
    frame: { x: 8, y: 20, scale: 1, rotation: 0 }
  },
  menuUrl: null,

  setSocioId: (id) => set({ socioId: id }),
  setField: (field, value) => set({ [field]: value }),
  setTransform: (field, patch) => set(state => ({
    [field]: { ...state[field], ...patch }
  })),
  setTopTransform: (key, patch) => set(state => ({
    topTransforms: { ...state.topTransforms, [key]: { ...state.topTransforms[key], ...patch } }
  })),
  setCategoryTransform: (cat, patch) => set(state => {
    const key = slug(cat) || 'sin-categoria'
    const current = state.categoryTransforms[key] || { x: 16, y: 104, scale: 1, rotation: 0 }
    return { categoryTransforms: { ...state.categoryTransforms, [key]: { ...current, ...patch } } }
  }),
  setScreen: (screen) => set({ screen }),
  setSelectedCategory: (cat) => set({ selectedCategory: cat }),
  setCart: (cart) => set({ cart }),
  setDraftQty: (draftQty) => set({ draftQty }),
  setMenuUrl: (url) => set({ menuUrl: url }),

  loadExcel: (rows) => set({ rows: rows.map(mapRow).filter(x => x.categoria || x.producto || x.precio) }),

  categories: () => {
    const m = new Map()
    get().rows.forEach(r => {
      const c = r.categoria || 'Sin categoría'
      m.set(c, (m.get(c) || 0) + 1)
    })
    return [...m.entries()]
  },

  findProductImage: (r, idx) => {
    if (!r) return ''
    const state = get()
    const overrideKey = idx !== undefined ? '__row_' + idx : ''
    if (overrideKey && state.productImages[overrideKey]) return state.productImages[overrideKey]
    const candidates = [r.imagen, r.producto].filter(Boolean)
    for (const candidate of candidates) {
      const k = fileKey(candidate)
      if (state.productImages[k]) return state.productImages[k]
      const target = slug(stripExt(k))
      const alt = Object.keys(state.productImages).find(x => !x.startsWith('__') && slug(stripExt(x)) === target)
      if (alt) return state.productImages[alt]
    }
    return ''
  },

  findCategoryImage: (cat) => {
    const state = get()
    const k = slug(cat)
    const override = '__cat_' + k
    if (state.categoryImages[override]) return state.categoryImages[override]
    const own = Object.keys(state.categoryImages).find(x => !x.startsWith('__') && slug(stripExt(x)) === k)
    if (own) return state.categoryImages[own]
    // Find first product in this category that has an image
    const catRows = state.rows.map((r, i) => ({ r, i })).filter(({ r }) => (r.categoria || 'Sin categoría') === cat)
    for (const { r, i } of catRows) {
      const img = state.findProductImage(r, i)
      if (img) return img
    }
    return ''
  },

  missingProductImages: () => {
    const state = get()
    if (!state.rows || !Array.isArray(state.rows)) return []
    return state.rows.map((r, i) => {
      if (!r) return null
      const img = state.findProductImage(r, i)
      return { r, i, img }
    }).filter(x => x && !x.img)
  },

  productAiPrompt: (r) => {
    if (!r) return ''
    const name = (r.producto || 'producto gastronómico').trim()
    const detail = (r.detalle || '').trim()
    const category = (r.categoria || 'Gastronomía').trim()
    const extra = detail ? ` Descripción del producto: ${detail}.` : ''
    return `Fotografía gastronómica publicitaria ultra realista de ${name}, categoría ${category}.${extra} Presentación apetitosa y profesional, producto completo y centrado, vista tres cuartos ligeramente elevada, iluminación suave de estudio, detalles nítidos, materiales y texturas realistas, sombras naturales muy sutiles, composición limpia. Servido en vajilla blanca elegante cuando corresponda. Sin personas, sin manos, sin cubiertos cortados, sin texto, sin logotipos, sin marcas de agua, sin marco. Imagen cuadrada de 300 x 300 px, objeto aislado, fondo completamente transparente real con canal alfa, bordes limpios, formato final WEBP.`
  },

  categoryKey: (cat) => slug(cat) || 'sin-categoria',

  getCategoryTransform: (cat, index = 0) => {
    const state = get()
    const key = slug(cat) || 'sin-categoria'
    const defaultTransform = {
      x: 60 + (index % 3) * 350,
      y: 350 + Math.floor(index / 3) * 420,
      scale: 1,
      rotation: 0
    }
    return state.categoryTransforms[key] || defaultTransform
  },

  normalizeSquareImage: (file, size = 300) => new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = () => {
      const img = new Image()
      img.onerror = reject
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        ctx.clearRect(0, 0, size, size)
        const scale = Math.min(size / img.width, size / img.height)
        const w = img.width * scale, h = img.height * scale
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h)
        resolve(canvas.toDataURL('image/webp', 0.7))
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  }),

  setProductImage: (key, dataUrl) => set(state => ({
    productImages: { ...state.productImages, [key]: dataUrl }
  })),

  // Mejor esfuerzo: si el producto/categoría del Builder tiene un
  // homónimo en la tabla `productos`/`categorias` (la que usa la
  // pantalla Carta), le copia la misma imagen para que se vea igual
  // en los dos lugares. Si no encuentra coincidencia, no hace nada.
  syncProductImageToDB: async (productName, dataUrl) => {
    const state = get()
    if (!state.socioId || !productName) return
    try {
      const { supabase } = await import('@/lib/supabase')
      const { data: matches } = await supabase.from('productos').select('id,nombre').eq('cliente_id', state.socioId)
      const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')
      const target = norm(productName)
      const match = (matches || []).find(p => norm(p.nombre) === target)
      if (match) await supabase.from('productos').update({ imagen: await storeMenuImage(state.socioId, dataUrl) }).eq('id', match.id)
    } catch (e) { console.error('[Builder] sync imagen producto', e) }
  },

  syncCategoryImageToDB: async (catName, dataUrl) => {
    const state = get()
    if (!state.socioId || !catName) return
    try {
      const { supabase } = await import('@/lib/supabase')
      const { data: matches } = await supabase.from('categorias').select('id,nombre').eq('cliente_id', state.socioId)
      const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')
      const target = norm(catName)
      const match = (matches || []).find(c => norm(c.nombre) === target)
      if (match) await supabase.from('categorias').update({ imagen: await storeMenuImage(state.socioId, dataUrl) }).eq('id', match.id)
    } catch (e) { console.error('[Builder] sync imagen categoria', e) }
  },

  setCategoryImage: (key, dataUrl) => set(state => ({
    categoryImages: { ...state.categoryImages, [key]: dataUrl }
  })),

  resetTopTransforms: () => set({
    topTransforms: {
      back: { x: 20, y: 10, scale: 1, rotation: 0 },
      logo: { x: 560, y: 10, scale: 1, rotation: 0 },
      wa: { x: 470, y: 40, scale: 1, rotation: 0 },
      promo: { x: 660, y: 10, scale: 1, rotation: 0 },
      cart: { x: 820, y: 10, scale: 1, rotation: 0 },
      map: { x: 770, y: 40, scale: 1, rotation: 0 },
      ig: { x: 920, y: 40, scale: 1, rotation: 0 },
      bell: { x: 760, y: 10, scale: 1, rotation: 0 },
      mesa: { x: 30, y: 100, scale: 1, rotation: 0 },
      exit: { x: 930, y: 10, scale: 1, rotation: 0 },
      frame: { x: 8, y: 20, scale: 1, rotation: 0 }
    }
  }),

  resetLogoTransform: () => set({ logoTransform: { x: 280, y: 670, scale: 1, rotation: 0 } }),
  resetWelcomeTransform: () => set({ welcomeTransform: { x: 300, y: 120, scale: 1, rotation: 0 } }),
  resetButtonTransform: () => set({ buttonTransform: { x: 100, y: 1680, scale: 1, rotation: 0 } }),

  loadSocioData: (socio) => set({
    socioId: socio.id,
    userId: socio.user_id || null,
    clientName: socio.nombre_restaurante || '',
    whatsapp: socio.whatsapp || '',
    address: socio.direccion || '',
    hours: socio.horario || '',
    instagram: socio.instagram || '',
    promo: socio.promociones || '',
    alias: socio.alias || '',
    delivery: socio.delivery || 0,
    logo: socio.logo_url || '',
    coverBg: socio.fondo_menu || '',
    welcomeText: socio.bienvenido || '',
    menuUrl: socio.menu_url || ''
  }),

  getBuilderConfig: () => {
    const s = get()
    return {
      categoriesBg: s.categoriesBg,
      productsBg: s.productsBg,
      cartBg: s.cartBg,
      blur: s.blur,
      categoriesBlur: s.categoriesBlur,
      productsBlur: s.productsBlur,
      cartBlur: s.cartBlur,
      welcomeColor: s.welcomeColor,
      welcomeBg: s.welcomeBg,
      welcomeBgNone: s.welcomeBgNone,
      welcomeSize: s.welcomeSize,
      buttonText: s.buttonText,
      buttonBg: s.buttonBg,
      buttonBorder: s.buttonBorder,
      buttonColor: s.buttonColor,
      buttonFontSize: s.buttonFontSize,
      buttonPadding: s.buttonPadding,
      buttonWidth: s.buttonWidth,
      logoTransform: s.logoTransform,
      welcomeTransform: s.welcomeTransform,
      buttonTransform: s.buttonTransform,
      topTransforms: s.topTransforms,
      headerControls: s.headerControls,
      categoryTransforms: s.categoryTransforms,
      waIcon: s.waIcon,
      igIcon: s.igIcon,
      mapIcon: s.mapIcon,
      promoIcon: s.promoIcon,
      forceSupabaseOrders: s.forceSupabaseOrders,
      sharePromoWithMesaZero: s.sharePromoWithMesaZero,
      topBarFrameBorderColor: s.topBarFrameBorderColor,
      topBarFrameBorderTransparent: s.topBarFrameBorderTransparent,
      topBarFrameBgColor: s.topBarFrameBgColor,
      topBarFrameBgTransparent: s.topBarFrameBgTransparent,
      logoBar: s.logoBar
    }
  },

  loadBuilderConfig: (config) => {
    if (!config) return
    const patch = {}
    const fields = [
      'categoriesBg', 'productsBg', 'cartBg', 'blur', 'categoriesBlur', 'productsBlur', 'cartBlur',
      'welcomeColor', 'welcomeBg', 'welcomeBgNone', 'welcomeSize',
      'buttonText', 'buttonBg', 'buttonBorder', 'buttonColor', 'buttonFontSize', 'buttonPadding', 'buttonWidth',
      'logoTransform', 'welcomeTransform', 'buttonTransform',
      'topTransforms', 'headerControls', 'categoryTransforms',
      'waIcon', 'igIcon', 'mapIcon', 'promoIcon', 'forceSupabaseOrders', 'sharePromoWithMesaZero',
      'topBarFrameBorderColor', 'topBarFrameBorderTransparent',
      'topBarFrameBgColor', 'topBarFrameBgTransparent',
      'logoBar'
    ]
    for (const f of fields) {
      if (config[f] !== undefined && config[f] !== null) patch[f] = config[f]
    }
    // Convierte una sola vez la distribución antigua (que incluía posiciones
    // de WhatsApp/Instagram/Mapa y Salir en 0,0) al encabezado compacto real.
    if (patch.topTransforms) {
      const legacy = patch.topTransforms
      if (legacy.wa || legacy.ig || legacy.map || Number(legacy.exit?.x || 0) === 0) {
        const compact = { back: 20, logo: 560, promo: 660, bell: 760, exit: 930 }
        const next = { ...legacy }
        Object.entries(compact).forEach(([key, x]) => {
          next[key] = { ...(legacy[key] || {}), x, y: 10, scale: legacy[key]?.scale || 1, rotation: legacy[key]?.rotation || 0 }
        })
        patch.topTransforms = next
      }
    }
    set(patch)
  },

  loadFromSupabase: async (clienteId) => {
    const { supabase } = await import('@/lib/supabase')

    const { data: cats } = await supabase
      .from('categorias')
      .select('id, nombre, imagen, orden')
      .eq('cliente_id', clienteId)
      .order('orden')

    const { data: prods } = await supabase
      .from('productos')
      .select('id, nombre, precio, detalle, imagen, categoria_id')
      .eq('cliente_id', clienteId)

    if (!prods || !cats) return

    const catMap = {}
    cats.forEach(c => { catMap[c.id] = c })

    const productImages = {}
    const categoryImages = {}
    const rows = prods.map((p, i) => {
      const cat = catMap[p.categoria_id]
      if (p.imagen) productImages['__row_' + i] = p.imagen
      return {
        categoria: cat?.nombre || 'Sin categoría',
        producto: p.nombre || '',
        precio: String(p.precio || ''),
        detalle: p.detalle || '',
        imagen: p.imagen || ''
      }
    })

    cats.forEach(c => {
      if (c.imagen) categoryImages['__cat_' + slug(c.nombre)] = c.imagen
    })

    set({ rows, productImages, categoryImages })
  },

  exportHtml: () => {
    const state = get()
    const slugify = s => norm(s).replace(/[^a-z0-9]/g, '')
    const money = n => '$' + Number(n || 0).toLocaleString('es-AR', { maximumFractionDigits: 2 })
    const price = v => { const n = parseFloat(String(v || '').replace(',', '.')); return Number.isFinite(n) ? n : 0 }
    const hexAlpha = (hex, a) => {
      const h = String(hex).replace('#', '')
      const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16)
      if (!Number.isFinite(n)) return hex
      return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

    const data = {
      clientName: state.clientName,
      socioId: state.socioId,
      coverBg: state.coverBg,
      categoriesBg: state.categoriesBg,
      productsBg: state.productsBg,
      cartBg: state.cartBg,
      logo: state.logo,
      logoBar: state.logoBar,
      blur: state.blur,
      categoriesBlur: state.categoriesBlur,
      productsBlur: state.productsBlur,
      cartBlur: state.cartBlur,
      welcomeText: state.welcomeText,
      welcomeColor: state.welcomeColor,
      welcomeBg: state.welcomeBg,
      welcomeBgNone: state.welcomeBgNone,
      welcomeSize: state.welcomeSize,
      buttonText: state.buttonText,
      buttonBg: state.buttonBg,
      buttonBorder: state.buttonBorder,
      buttonColor: state.buttonColor,
      buttonFontSize: state.buttonFontSize,
      buttonPadding: state.buttonPadding,
      buttonWidth: state.buttonWidth,
      rows: state.rows,
      productImages: state.productImages,
      categoryImages: state.categoryImages,
      categoryTransforms: state.categoryTransforms,
      whatsapp: state.whatsapp,
      instagram: state.instagram,
      address: state.address,
      hours: state.hours,
      promo: state.promo,
      alias: state.alias,
      delivery: state.delivery,
      logoTransform: state.logoTransform,
      welcomeTransform: state.welcomeTransform,
      buttonTransform: state.buttonTransform,
      topTransforms: state.topTransforms,
      headerControls: state.headerControls,
      waIcon: state.waIcon,
      igIcon: state.igIcon,
      mapIcon: state.mapIcon,
      promoIcon: state.promoIcon,
      forceSupabaseOrders: state.forceSupabaseOrders,
      topBarFrameBorderColor: state.topBarFrameBorderColor,
      topBarFrameBorderTransparent: state.topBarFrameBorderTransparent,
      topBarFrameBgColor: state.topBarFrameBgColor,
      topBarFrameBgTransparent: state.topBarFrameBgTransparent,
      // Horario de pedidos: el valor real siempre lo termina pisando
      // MenuView.jsx en cada carga (lee clientes.horario_pedidos_activo /
      // horario_pedidos en vivo, igual que hace con los íconos). Estos son
      // solo el fallback dentro del HTML exportado.
      horarioPedidosActivo: false,
      horarioPedidos: {},
      supabaseUrl: supabaseUrl,
      supabaseAnonKey: supabaseAnonKey
    }

    const safeJson = JSON.stringify(data).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')

    const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${state.clientName || 'MenuQR'}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{overscroll-behavior:none;overscroll-behavior-y:none}
body{background:#0b0d10;color:#eef1f3;font-family:Inter,Segoe UI,Arial,sans-serif;min-height:100vh;display:grid;place-items:center;padding:14px;overscroll-behavior:none;overscroll-behavior-y:none}
.phone{width:min(430px,100vw);height:min(100vh,calc((100vw - 24px)*16/9));max-height:932px;aspect-ratio:9/16;position:relative;overflow:hidden;background:#111;border-radius:22px;box-shadow:0 20px 70px rgba(0,0,0,.5);overscroll-behavior:none;overscroll-behavior-y:none;touch-action:pan-y}
@media(max-width:520px){body{padding:0;min-height:100dvh}.phone{width:100vw;height:100dvh;max-height:none;aspect-ratio:auto;border-radius:0;box-shadow:none}}
.bg{position:absolute;inset:0;background-size:cover;background-position:center;background-repeat:no-repeat;filter:blur(8px)}
.shade{position:absolute;inset:0}
.view{position:absolute;inset:0;z-index:2;display:none}
.view.active{display:block}
#cart.active{display:block;overflow-y:auto;-webkit-overflow-scrolling:touch}
#cart>.cartTop{position:sticky;top:0;z-index:8;background:#000}
.welcome{position:absolute;left:0;top:0;transform-origin:top left;white-space:nowrap;border-radius:999px;padding:8px 14px;font-weight:800;text-shadow:0 2px 8px #000}
.logo{position:absolute;left:0;top:0;width:48.3871%;max-height:38%;transform-origin:top left;object-fit:contain;filter:drop-shadow(0 10px 20px rgba(0,0,0,.55))}
.menuBtn,.sendBtn{position:absolute;left:0;top:0;width:81.9355%;transform-origin:top left;border-radius:16px;padding:15px;border:1.5px solid #2f6fed;background:rgba(0,128,128,.3);color:white;font-weight:900;font-size:14px;letter-spacing:.08em;backdrop-filter:blur(6px);cursor:pointer}
.top{display:flex;align-items:center;gap:8px;padding:16px}
.catsTop{position:relative;height:72px;padding:0;display:block;overflow:visible;background:linear-gradient(180deg,rgba(0,0,0,.58),rgba(0,0,0,.08))}
.catsTopFrame{position:absolute;left:8px;top:20px;right:8px;height:72px;border:1px solid rgba(156,163,175,.55);border-radius:14px;background:transparent;z-index:2;pointer-events:none}
.topItem{position:absolute;left:0;top:0;transform-origin:top left;z-index:3}
.round{width:48px;height:48px;border:0;background:transparent;color:white;display:grid;place-items:center;cursor:pointer;text-decoration:none;font-size:38px;font-weight:900;line-height:1;filter:drop-shadow(0 5px 12px rgba(0,0,0,.8));position:relative}
.smallLogo{width:38px;height:38px;border-radius:6px;object-fit:cover}
.cat{position:absolute;cursor:pointer;text-align:center}
.catImg{width:96px;height:96px;overflow:hidden;display:grid;place-items:center;margin:0 auto 4px}
.catImg img{width:100%;height:100%;object-fit:cover}
.cat b{color:#fff;font-size:11px;display:block;max-width:96px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.productsTop{position:sticky;top:0;z-index:8;min-height:94px;padding:6px 10px;background:#000;display:grid;grid-template-columns:minmax(44px,1fr) auto;grid-template-rows:28px 54px;align-items:center;gap:0 clamp(3px,1.4vw,8px);overflow:hidden}
.productsTop .productBack,.productsTop .topActionBtn,.productsTop .bellBtnTop,.productsTop .floatingCart,.productsTop .exitTopBtn{position:relative!important;left:auto!important;right:auto!important;top:auto!important;bottom:auto!important;transform:none!important;transform-origin:center!important}
.productsTop .title{grid-column:1/-1;grid-row:1;width:100%;padding:0;margin:0;font-size:clamp(12px,3.7vw,15px);line-height:1.15;text-shadow:0 3px 10px rgba(0,0,0,.85);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.productBack,.productCart{border:0;background:transparent;color:white;display:grid;place-items:center;cursor:pointer;filter:drop-shadow(0 5px 12px rgba(0,0,0,.8))}
.productBack{grid-column:1;grid-row:2;justify-self:start;width:clamp(42px,12vw,54px);height:clamp(42px,12vw,54px);font-size:clamp(32px,9vw,42px);font-weight:900;line-height:1;flex-shrink:0}
.productCart{position:relative;width:48px;height:48px;font-size:31px}
.products{height:calc(100vh - 64px);overflow-y:auto;padding:0 10px 40px;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;overscroll-behavior-y:contain;touch-action:pan-y}
.topActions{grid-column:2;grid-row:2;min-width:0;max-width:100%;display:flex;align-items:center;justify-content:flex-end;gap:clamp(2px,1.2vw,8px);margin-left:auto;overflow:hidden}
.mesaTop{display:none;flex:0 1 auto;min-width:34px;max-width:58px;height:34px;padding:0 5px;border-radius:8px;background:#2f6fed;color:#fff;font-size:clamp(9px,2.6vw,12px);font-weight:800;align-items:center;justify-content:center;white-space:nowrap;overflow:hidden}
.topActionBtn{width:40px;height:40px;border-radius:10px;border:0;background:transparent;color:#fff;font-size:22px;cursor:pointer;display:grid;place-items:center;padding:0;filter:drop-shadow(0 2px 6px rgba(0,0,0,.7));position:relative}
.topActionBtn img{width:var(--icon-size,32px);height:var(--icon-size,32px);max-width:40px;max-height:40px;object-fit:cover;border-radius:6px}
.promoDot{position:absolute;top:-4px;right:-4px;min-width:20px;height:20px;background:#22c55e;border-radius:50%;border:2px solid #000;z-index:10;display:none;font-size:12px;font-weight:700;color:#fff;line-height:20px;text-align:center;padding:0 4px}
.promoDot.visible{display:block}
.bellBtnTop{width:44px;height:44px;border-radius:50%;border:2px solid #f59e0b;background:rgba(245,158,11,.15);color:#f59e0b;font-size:24px;cursor:pointer;display:grid;place-items:center;transition:all .2s;padding:0}
.bellBtnTop.active{border-color:#ef4444;background:rgba(239,68,68,.25);color:#ef4444;animation:pulse-bell 1.2s ease-in-out infinite}
.bellBtnTop:active{background:rgba(245,158,11,.35);transform:scale(.92)}
.exitTopBtn{height:40px;border:0;background:transparent;color:#fff;padding:0 10px;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px;filter:drop-shadow(0 2px 6px rgba(0,0,0,.7))}
.categories{height:calc(100% - 64px);overflow:auto;padding:0 14px 20px;position:relative;overscroll-behavior:contain;overscroll-behavior-y:contain;touch-action:pan-y;-webkit-overflow-scrolling:touch}
.catsBottom{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:420px;display:flex;align-items:center;justify-content:space-between;padding:14px 16px;background:rgba(0,0,0,.9);backdrop-filter:blur(12px);border-top:1px solid rgba(255,255,255,.12);z-index:99}
.catsBottom .logoBottom{width:42px;height:42px;border-radius:10px;object-fit:cover}
.catsBottom .exitBtn{background:transparent;border:0;color:#fff;padding:10px 16px;border-radius:12px;font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px}
.catsBottom .bellBtn{width:50px;height:50px;border-radius:50%;border:2px solid #f59e0b;background:rgba(245,158,11,.15);color:#f59e0b;font-size:28px;cursor:pointer;display:grid;place-items:center;transition:all .2s}
.catsBottom .bellBtn.active{border-color:#ef4444;background:rgba(239,68,68,.25);color:#ef4444;animation:pulse-bell 1.2s ease-in-out infinite}
.catsBottom .bellBtn:active{background:rgba(245,158,11,.35);transform:scale(.92)}
.floatingCart{position:relative;width:40px;height:40px;border-radius:10px;background:transparent;border:0;color:#fff;font-size:24px;cursor:pointer;display:grid;place-items:center;box-shadow:none;padding:0;filter:drop-shadow(0 2px 6px rgba(0,0,0,.7))}
.floatingCart .badge{position:absolute;top:-4px;right:-4px;background:#f59e0b;color:#fff;font-size:10px;font-weight:700;min-width:16px;height:16px;border-radius:8px;display:grid;place-items:center;padding:0 3px}
.badge{position:absolute;top:-4px;right:-4px;background:#2f6fed;color:#fff;font-size:11px;font-weight:700;min-width:18px;height:18px;border-radius:9px;display:grid;place-items:center;padding:0 4px}
.product-card{display:flex;align-items:stretch;gap:10px;padding:0;background:rgba(31,41,55,.7);border-radius:16px;margin-bottom:8px;border:1px solid rgba(55,65,81,.5);overflow:hidden;min-height:84px}
.product-card img{width:88px;align-self:stretch;object-fit:cover;flex-shrink:0;display:block}
.product-card .prod-placeholder{width:88px;align-self:stretch;background:#1f2937;display:grid;place-items:center;font-size:26px;flex-shrink:0}
.product-card .prod-info{flex:1;min-width:0;padding:10px 10px 10px 0;display:flex;flex-direction:column;justify-content:center}
.product-card h4{margin:0;color:#fff;font-size:14px;line-height:1.3}
.product-card .prod-desc{margin:2px 0 0;color:#9ca3af;font-size:11px;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.product-card .price{color:#5fd8c4;font-weight:700;font-size:14px;margin-top:2px}
.qty{display:flex;align-items:center;gap:6px;flex-shrink:0;padding-right:12px;align-self:center}
.qty button{width:32px;height:32px;border-radius:8px;border:0;background:#166534;color:#fff;font-size:18px;cursor:pointer;display:grid;place-items:center;transition:background .15s}
.qty button:active{background:#15803d}
.qty span{min-width:24px;text-align:center;font-weight:700;color:#fff;font-size:16px}
.qty .check{width:36px;height:36px;border-radius:8px;border:2.5px solid #3b82f6;background:transparent;color:#fff;display:grid;place-items:center;padding:0;cursor:pointer;transition:all .2s;flex-shrink:0}
.qty .check span{font-size:20px;line-height:1}
.qty .check.active{background:#22c55e;border-color:#22c55e}
.cartBody{height:calc(100vh - 64px);overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;overscroll-behavior-y:contain;touch-action:pan-y}
.cartList{padding:14px;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}
.cart-item{display:flex;justify-content:space-between;align-items:center;padding:12px;background:rgba(31,41,55,.7);border-radius:12px;margin-bottom:8px}
.cart-item span{color:#fff;font-size:14px;line-height:1.5}
.cart-item b{color:#5fd8c4}
.cart-item button{background:rgba(239,68,68,.2);color:#ef4444;border:0;padding:6px 12px;border-radius:8px;cursor:pointer;font-size:12px}
.cart-section-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:rgba(255,255,255,.35);padding:6px 2px 4px}
.cart-item-sent{opacity:.55}
.cart-item-sent span{color:rgba(255,255,255,.45)}
.cart-item-sent b{color:rgba(255,255,255,.4)}
.order-status{margin:8px 0 14px;padding:10px;background:rgba(17,24,39,.82);border:1px solid rgba(95,216,196,.25);border-radius:12px}
.order-status-title{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:#9ca3af;margin-bottom:8px}
.order-status-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.order-status-step{display:flex;align-items:center;gap:6px;color:#d1d5db;font-size:11px;min-width:0}
.order-status-check{width:20px;height:20px;border-radius:5px;border:2px solid var(--step-color);display:grid;place-items:center;flex:0 0 20px;color:#fff;font-size:12px;font-weight:900}
.order-status-step.done .order-status-check{background:var(--step-color)}
.totals{padding:14px;border-top:1px solid #374151}
.totals p{display:flex;justify-content:space-between;margin:6px 0;color:#9ca3af;font-size:14px}
.totals b{color:#fff}
.sendBtn{position:relative;width:calc(100% - 28px);margin:14px;border:0;border-radius:16px;padding:16px;background:#008080;color:#fff;font-weight:900;font-size:15px;cursor:pointer}
.aliasRow{display:flex;align-items:center;gap:8px;padding:0 14px 14px}
.aliasRow span{flex:1;color:#9ca3af;font-size:13px}
.aliasRow button{background:#374151;color:#fff;border:0;padding:6px 12px;border-radius:8px;cursor:pointer;font-size:12px}
.cartTop{display:flex;align-items:center;gap:8px;padding:10px 14px}
.cartTop .title{flex:1;font-size:17px}
.cartPromo{width:48px;height:48px;border:0;background:transparent;color:white;font-size:24px;cursor:pointer;position:relative}
.customer-address{display:block;padding:0 14px 8px}
.customer-address input{width:100%;padding:10px 12px;border-radius:10px;border:1px solid #374151;background:#1f2937;color:#fff;font-size:14px}
.deliveryLine{display:flex;align-items:center;gap:9px;padding:0 14px 8px;color:#dfe6eb;font-size:14px;font-weight:700}
.deliveryCheck{width:30px;height:30px;border-radius:7px;border:2px solid #2f6fed;background:rgba(47,111,237,.08);color:#fff;display:grid;place-items:center;padding:0;cursor:pointer}
.deliveryCheck span{opacity:0;font-size:18px;font-weight:900;line-height:1}
.deliveryCheck.active{background:#2f6fed;border-color:#2f6fed}
.deliveryCheck.active span{opacity:1}
.benefitsBox{margin:10px 14px;border:1px solid rgba(47,111,237,.35);background:rgba(8,18,38,.58);border-radius:16px;padding:12px}
.benefitsBox h4{margin:0 0 4px;color:#fff;font-size:14px}
.benefitsBox p{margin:0 0 8px;color:#b8c4d8;font-size:11.5px;line-height:1.35}
.benefitsBox input{width:100%;margin:5px 0;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.06);border-radius:8px;padding:8px 10px;color:#fff;font-size:13px}
.benefitsBox button{width:100%;margin-top:8px;padding:10px;border:0;border-radius:10px;background:#008080;color:#fff;font-weight:700;cursor:pointer}
.title{padding:0 14px 8px;font-size:17px;text-shadow:0 3px 10px rgba(0,0,0,.85)}
.popover{position:absolute;bottom:80px;left:14px;right:14px;background:rgba(8,18,38,.95);border:1px solid rgba(47,111,237,.35);border-radius:16px;padding:14px;z-index:10;color:#fff;font-size:13px;line-height:1.5;box-shadow:0 10px 40px rgba(0,0,0,.5)}
.popover.hidden{display:none}
.mesa-badge{position:fixed;top:12px;left:14px;background:#2f6fed;color:#fff;padding:6px 14px;border-radius:999px;font-size:13px;font-weight:700;z-index:9999;box-shadow:0 4px 16px rgba(47,111,237,.5);display:none}
.mesa-inline{display:inline-block;background:#2f6fed;color:#fff;padding:2px 10px;border-radius:999px;font-size:13px;font-weight:700;margin-right:8px;vertical-align:middle}
.mesa-badge{display:flex;align-items:center;gap:10px}
.mesa-badge .cart-icon{position:relative;width:40px;height:40px;border-radius:10px;background:rgba(255,255,255,.15);border:0;color:#fff;font-size:22px;cursor:pointer;display:grid;place-items:center}
.mesa-badge .cart-icon .badge{position:absolute;top:-4px;right:-4px;background:#ef4444;color:#fff;font-size:10px;font-weight:700;min-width:16px;height:16px;border-radius:8px;display:grid;place-items:center;padding:0 3px}
.promo-form{padding:0}
.promo-form h4{margin:0 0 8px;font-size:22px;color:#fff}
.promo-form input{width:100%;margin:5px 0;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.06);border-radius:8px;padding:10px 12px;color:#fff;font-size:20px;box-sizing:border-box}
.wsp-group{display:flex;gap:6px;align-items:center;margin:5px 0}
.wsp-group select{width:100px;flex-shrink:0;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.06);border-radius:8px;padding:10px 4px;color:#fff;font-size:15px;appearance:auto}
.wsp-group input{flex:1;min-width:0}
.promo-form button{width:100%;margin-top:8px;padding:11px;border:0;border-radius:10px;background:#008080;color:#fff;font-weight:700;cursor:pointer;font-size:21px}
.promo-form .success-msg{color:#22c55e;text-align:center;padding:16px 0;font-weight:700;font-size:21px}
@keyframes pulse-bell{0%,100%{transform:scale(1)}50%{transform:scale(1.12)}}
</style>
</head>
<body>
<div class="phone" id="phone">
<div class="bg" id="bg"></div>
<div class="shade" id="shade"></div>
<section id="cover" class="view active">
<div id="welcome" class="welcome"></div>
<img id="logo" class="logo hidden" alt="logo">
<button id="menuBtn" class="menuBtn">VER MENU</button>
</section>
<section id="cats" class="view">
<div class="productsTop">
<button class="productBack" id="backCover">←</button>
<h3 class="title">Categorías</h3>
<div class="topActions">
<button id="logoInfoCategories" class="topActionBtn" title="Información"></button>
<button id="promoCategories" class="topActionBtn">🎁<span class="promoDot"></span></button>
<button class="bellBtnTop" id="callMozoCats" style="display:none">🔔</button>
<span class="mesaTop" id="mesaTopCats"></span>
<button id="categoriesCart" class="floatingCart">🛒<span class="badge cartBadge">0</span></button>
<button id="exitMenuCats" class="exitTopBtn">✕ Salir</button>
</div>
</div>
<div id="catList" class="categories"></div>
</section>
<section id="products" class="view">
<div class="productsTop">
<button class="productBack" id="backCats">←</button>
<h3 id="prodTitle" class="title">Productos</h3>
<div id="topActions" class="topActions">
<button id="logoInfoProducts" class="topActionBtn" title="Información"></button>
<button id="promoProducts" class="topActionBtn">🎁<span class="promoDot" id="promoDotProducts"></span></button>
<button class="bellBtnTop" id="callMozoTop" style="display:none">🔔</button>
<span class="mesaTop" id="mesaTopProducts"></span>
<div id="floatingCart" class="floatingCart">🛒<span id="badge" class="badge cartBadge">0</span></div>
<button id="exitTop" class="exitTopBtn">✕ Salir</button>
</div>
</div>
<div id="prodList" class="products"></div>
</section>
<section id="cart" class="view">
<div class="productsTop cartTop">
<button class="productBack" id="backProducts">←</button>
<h3 class="title">Mi pedido</h3>
<div class="topActions">
<button id="logoInfoCart" class="topActionBtn" title="Información"></button>
<button id="cartPromo" class="topActionBtn" title="Promociones">🎁<span class="promoDot" id="promoDotCart"></span></button>
<button class="bellBtnTop" id="callMozoCart" style="display:none">🔔</button>
<span class="mesaTop" id="mesaTopCart"></span>
<button id="cartCurrent" class="floatingCart">🛒<span class="badge cartBadge">0</span></button>
<button id="exitCart" class="exitTopBtn">✕ Salir</button>
</div>
</div>
<div id="cartPop" class="popover hidden"></div>
<div id="cartBody" class="cartBody">
<div id="cartList" class="cartList"></div>
<div id="deliverySection">
<label class="customer-address">Tu nombre<input id="customerName" placeholder="Nombre y apellido"></label>
<label class="customer-address">Tu teléfono<input id="customerPhone" placeholder="Ej: 351 555 1234" inputmode="tel"></label>
<label class="customer-address">Dirección delivery<input id="customerAddress" placeholder="Calle, número, barrio"></label>
<div class="deliveryLine"><button id="deliveryCheck" class="deliveryCheck" type="button"><span>✓</span></button><span>Agregar delivery al pedido</span></div>
<div class="deliveryLine" id="pickupRow" style="display:none"><button id="pickupCheck" class="deliveryCheck" type="button"><span>✓</span></button><span>Retirar en el local</span></div>
</div>
<div id="propinaSection" style="display:none;margin:0 14px 14px;padding:12px;border:1px solid rgba(255,255,255,.15);border-radius:12px">
<p style="color:#fff;font-size:13px;font-weight:700;margin:0 0 8px">🧑‍🍳 Propina para el mozo</p>
<div style="display:flex;gap:8px;margin-bottom:8px">
<button id="propinaModoMonto" type="button" style="flex:1;padding:8px;border-radius:8px;border:1.5px solid #2f6fed;background:rgba(47,111,237,.15);color:#fff;font-size:13px;font-weight:700;cursor:pointer">Monto $</button>
<button id="propinaModoPct" type="button" style="flex:1;padding:8px;border-radius:8px;border:1.5px solid #2f6fed;background:transparent;color:#fff;font-size:13px;font-weight:700;cursor:pointer">% del total</button>
</div>
<input id="propinaInput" type="number" min="0" placeholder="0" style="width:100%;padding:10px;border-radius:8px;border:1px solid rgba(255,255,255,.2);background:rgba(0,0,0,.2);color:#fff;font-size:14px">
<p style="color:#9ca3af;font-size:12px;margin:6px 0 0">Propina: <b id="propinaCalculada" style="color:#22c55e">$0</b></p>
</div>
<div class="totals"><p>Subtotal <b id="sub">$0</b></p><p id="promoDiscRow" style="display:none;color:#22c55e">Descuento promo <b id="promoDisc">-$0</b></p><p id="delRow">Delivery <b id="del">$0</b></p><p id="propinaRow" style="display:none">Propina mozo <b id="propinaTot">$0</b></p><p>Total <b id="tot">$0</b></p></div>
<button id="send" class="sendBtn">Enviar Pedido</button>
<div id="aliasRow" class="aliasRow"></div>
</div>
</section>
</div>
<div id="pop" class="popover hidden"></div>
<div id="mesaBadge" class="mesa-badge" style="display:none"></div>
<script>
const DATA=${safeJson};
const $=id=>document.getElementById(id);const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').trim();const slug=s=>norm(s).replace(/[^a-z0-9]/g,'');const stripExt=n=>String(n||'').replace(/\\.[a-z0-9]+$/i,'');const fileKey=n=>norm(String(n||'').split(/[\\\\/]/).pop());function price(v){const n=parseFloat(String(v||'').replace(',','.'));return Number.isFinite(n)?n:0}function money(n){return '$'+Number(n||0).toLocaleString('es-AR',{maximumFractionDigits:2})}function hexAlpha(hex,a){const h=String(hex).replace('#','');const n=parseInt(h.length===3?h.split('').map(c=>c+c).join(''):h,16);if(!Number.isFinite(n))return hex;return'rgba('+((n>>16)&255)+','+((n>>8)&255)+','+(n&255)+','+a+')'}

const mesaNumero=parseInt(new URLSearchParams(window.location.search).get('mesa')||'0',10);
// Sesión del comensal en este dispositivo/mesa. Se reutiliza la misma clave
// de localStorage que usa el envío de pedido (mesa_<n>_sesion) para que,
// cuando el pedido se registre en "comensales", quede con el mismo id de
// sesión que ya usamos acá para guardar la propina. Así, en Caja/Mesas se
// puede identificar con qué comensal (y de qué color) vino la propina.
const propinaSesionId=mesaNumero>0?(()=>{let id=localStorage.getItem('mesa_'+mesaNumero+'_sesion');if(!id){id=crypto.randomUUID();localStorage.setItem('mesa_'+mesaNumero+'_sesion',id)}return id})():null;
if(mesaNumero>0){['callMozoTop','callMozoCats','callMozoCart'].forEach(id=>{const el=$(id);if(el)el.style.display=''})}
if(mesaNumero>0){['mesaTopCats','mesaTopProducts','mesaTopCart'].forEach(id=>{const el=$(id);if(el){el.textContent='Mesa '+mesaNumero;el.style.display='flex'}})}
let supabaseClient=null;
if(DATA.supabaseUrl&&DATA.supabaseAnonKey){supabaseClient={url:DATA.supabaseUrl,key:DATA.supabaseAnonKey,headers:{apikey:DATA.supabaseAnonKey,Authorization:'Bearer '+DATA.supabaseAnonKey,'Content-Type':'application/json'}}}
async function sbInsert(table,row){if(!supabaseClient)return{data:null,error:null};try{const r=await fetch(supabaseClient.url+'/rest/v1/'+table,{method:'POST',headers:{...supabaseClient.headers,'Prefer':'return=representation'},body:JSON.stringify(row)});if(!r.ok)return{data:null,error:await r.text()};return{data:await r.json(),error:null}}catch(e){return{data:null,error:e.message}}}
async function sbUpsert(table,row,conflict){if(!supabaseClient)return{data:null,error:null};try{const headers={...supabaseClient.headers,'Prefer':'resolution=merge-duplicates,return=representation'};const url=supabaseClient.url+'/rest/v1/'+table+(conflict?'?on_conflict='+conflict:'');const r=await fetch(url,{method:'POST',headers,body:JSON.stringify(row)});if(!r.ok)return{data:null,error:await r.text()};return{data:await r.json(),error:null}}catch(e){return{data:null,error:e.message}}}
async function sbRpc(fn,params){if(!supabaseClient)return{data:null,error:null};try{const r=await fetch(supabaseClient.url+'/rest/v1/rpc/'+fn,{method:'POST',headers:supabaseClient.headers,body:JSON.stringify(params||{})});if(!r.ok)return{data:null,error:await r.text()};return{data:await r.json(),error:null}}catch(e){return{data:null,error:e.message}}}
async function sbUpdate(table,filter,patch){if(!supabaseClient)return{data:null,error:null};try{const r=await fetch(supabaseClient.url+'/rest/v1/'+table+'?'+filter,{method:'PATCH',headers:{...supabaseClient.headers,'Prefer':'return=representation'},body:JSON.stringify(patch)});if(!r.ok)return{data:null,error:await r.text()};return{data:await r.json(),error:null}}catch(e){return{data:null,error:e.message}}}

function findProductImage(r,i){const overrideKey=i!==undefined?'__row_'+i:'';if(overrideKey&&DATA.productImages[overrideKey])return DATA.productImages[overrideKey];const candidates=[r.imagen,r.producto].filter(Boolean);for(const candidate of candidates){const k=fileKey(candidate);if(DATA.productImages[k])return DATA.productImages[k];const target=slug(stripExt(k));const alt=Object.keys(DATA.productImages).find(x=>!x.startsWith('__')&&slug(stripExt(x))===target);if(alt)return DATA.productImages[alt];}return''}
function findCategoryImage(cat){const k=slug(cat);const override='__cat_'+k;if(DATA.categoryImages[override])return DATA.categoryImages[override];const own=Object.keys(DATA.categoryImages).find(x=>!x.startsWith('__')&&slug(stripExt(x))===k);if(own)return DATA.categoryImages[own];const idx=DATA.rows.findIndex(r=>(r.categoria||'Sin categoría')===cat&&findProductImage(r,DATA.rows.indexOf(r)));return idx>=0?findProductImage(DATA.rows[idx],idx):''}
function categories(){const m=new Map();DATA.rows.forEach(r=>{const c=r.categoria||'Sin categoría';m.set(c,(m.get(c)||0)+1)});return[...m.entries()]}
const state={screen:'cover',selectedCategory:'',cart:{},draftQty:{},deliveryEnabled:false,customerAddress:'',customerName:'',customerPhone:'',activePromo:null,promoProducts:{},pickupEnabled:false,pickupName:'',sentItems:[],sentOrder:null,checklistVisible:true,propinaTipo:'monto',propinaValor:0};
function applySafeTopTransforms(){
  const tt=DATA.topTransforms||{};
  const defs={back:20,logo:420,promo:560,bell:700,mesa:760,cart:820,exit:900};
  const groups={back:['backCover','backCats','backProducts'],logo:['logoInfoCategories','logoInfoProducts','logoInfoCart'],promo:['promoCategories','promoProducts','cartPromo'],bell:['callMozoCats','callMozoTop','callMozoCart'],mesa:['mesaTopCats','mesaTopProducts','mesaTopCart'],cart:['categoriesCart','floatingCart','cartCurrent'],exit:['exitMenuCats','exitTop','exitCart']};
  Object.entries(groups).forEach(([key,ids])=>ids.forEach(id=>{const el=$(id);if(!el)return;const t=tt[key]||{};const dx=Math.max(-8,Math.min(8,(Number(t.x??defs[key])-defs[key])/20));const dy=Math.max(-6,Math.min(6,Number(t.y||0)/10));el.style.setProperty('position','relative','important');el.style.setProperty('left','auto','important');el.style.setProperty('top','auto','important');el.style.setProperty('transform','translate('+dx+'px,'+dy+'px)','important');if(key==='logo'||key==='promo'){const size=Math.max(20,Math.min(40,32*Math.max(.25,Math.min(1.25,Number(t.scale||1)))));el.style.setProperty('--icon-size',size+'px')}}));
}
function applyCartaHeaderControls(){
  const cfg=DATA.headerControls;
  if(!cfg || !Object.keys(cfg).length)return;
  const keys={logoInfoCategories:'logo',logoInfoProducts:'logo',logoInfoCart:'logo',promoCategories:'promo',promoProducts:'promo',cartPromo:'promo',categoriesCart:'cart',floatingCart:'cart',cartCurrent:'cart',exitMenuCats:'exit',exitTop:'exit',exitCart:'exit',callMozoCats:'bell',callMozoTop:'bell',callMozoCart:'bell',mesaTopCats:'mesa',mesaTopProducts:'mesa',mesaTopCart:'mesa'};
  document.querySelectorAll('.view.active .topActions').forEach(row=>{
    row.style.width=Math.max(0,row.parentElement.clientWidth-82)+'px';row.style.height='54px';row.style.position='relative';row.style.overflow='hidden';
    const els=Array.from(row.children).filter(el=>getComputedStyle(el).display!=='none');
    const gap=4;const slot=(row.clientWidth-gap*(els.length-1))/Math.max(1,els.length);
    els.forEach((el,i)=>{
      const c=cfg[keys[el.id]]||{};
      const clamp=(n,a,b)=>Math.max(a,Math.min(b,Number(n)||0));
      const zoom=clamp(c.zoom??100,25,200)/100;
      const width=Math.min(slot, (keys[el.id]==='exit'?58:40)*zoom);
      const height=Math.min(46,40*zoom);
      const x=(slot-width)*clamp(c.x??50,0,100)/100;
      const y=4+(46-height)*clamp(c.y??50,0,100)/100;
      el.style.setProperty('position','absolute','important');el.style.setProperty('left',(i*(slot+gap)+x)+'px','important');el.style.setProperty('top',y+'px','important');el.style.setProperty('transform','none','important');
      el.style.width=width+'px';el.style.minWidth='0';el.style.maxWidth='none';el.style.height=height+'px';el.style.padding='0';el.style.fontSize=Math.min(keys[el.id]==='exit'||keys[el.id]==='mesa'?13*zoom:28*zoom,width/(keys[el.id]==='exit'||keys[el.id]==='mesa'?4:1),height*.8)+'px';
      el.querySelectorAll('img').forEach(img=>{img.style.setProperty('width',Math.min(width,height)+'px','important');img.style.setProperty('height',Math.min(width,height)+'px','important');img.style.maxWidth='100%';img.style.maxHeight='100%';img.style.objectFit='contain'});
      el.querySelectorAll('.badge,.promoDot').forEach(b=>{b.style.top='0';b.style.right='0'});
    });
  });
}
window.addEventListener('resize',()=>requestAnimationFrame(applyCartaHeaderControls));
function setView(name){state.screen=name;['cover','cats','products','cart'].forEach(id=>$(id).classList.remove('active'));({cover:'cover',categories:'cats',products:'products',cart:'cart'}[name]&&$(({cover:'cover',categories:'cats',products:'products',cart:'cart'}[name])).classList.add('active'));renderBg();if(name==='categories')renderTopIcons();applyCompactTopTransforms();applySafeTopTransforms();requestAnimationFrame(applyCartaHeaderControls);const mb=$('mesaBadge');if(mb)mb.style.display='none'}
function renderBg(){const bg=state.screen==='cover'?DATA.coverBg:(state.screen==='categories'?(DATA.categoriesBg||DATA.coverBg):(state.screen==='products'?(DATA.productsBg||DATA.categoriesBg||DATA.coverBg):(DATA.cartBg||DATA.productsBg||DATA.categoriesBg||DATA.coverBg)));const blurVal=state.screen==='cover'?DATA.blur:(state.screen==='categories'?(DATA.categoriesBlur||DATA.blur):(state.screen==='products'?(DATA.productsBlur||DATA.blur):(DATA.cartBlur||DATA.blur)));$('bg').style.backgroundImage=bg?'url('+bg+')':'linear-gradient(160deg,#1b2027,#0b0d10)';$('bg').style.filter='blur('+(blurVal/100)*18+'px)';$('shade').style.background=state.screen==='cover'?'rgba(0,0,0,.1)':'rgba(0,0,0,.45)'}
function renderCover(){renderBg();const w=$('welcome');w.textContent=DATA.welcomeText;w.style.color=DATA.welcomeColor;w.style.background=(DATA.welcomeText&&!DATA.welcomeBgNone)?DATA.welcomeBg+'99':'transparent';w.style.fontSize=DATA.welcomeSize+'px';w.classList.toggle('hidden',!DATA.welcomeText);const t=DATA.welcomeTransform||{x:300,y:120,scale:1,rotation:0};w.style.left=(t.x/1080*100)+'%';w.style.top=(t.y/1920*100)+'%';w.style.transform='rotate('+(t.rotation||0)+'deg) scale('+(t.scale||1)+')';const logo=$('logo');logo.src=DATA.logo;logo.classList.toggle('hidden',!DATA.logo);const lt=DATA.logoTransform||{x:280,y:670,scale:1,rotation:0};logo.style.left=(lt.x/1080*100)+'%';logo.style.top=(lt.y/1920*100)+'%';logo.style.transform='rotate('+(lt.rotation||0)+'deg) scale('+(lt.scale||1)+')';const b=$('menuBtn');b.textContent=DATA.buttonText||'VER MENÚ';b.style.background=hexAlpha(DATA.buttonBg||'#008080',0.3);b.style.borderColor=DATA.buttonBorder;b.style.color=DATA.buttonColor;b.style.padding=(DATA.buttonPadding||15)+'px';b.style.fontSize=(DATA.buttonFontSize||14)+'px';b.style.width=(DATA.buttonWidth||82)+'%';const bt=DATA.buttonTransform||{x:100,y:1680,scale:1,rotation:0};b.style.left=(bt.x/1080*100)+'%';b.style.top=(bt.y/1920*100)+'%';b.style.transform='rotate('+(bt.rotation||0)+'deg) scale('+(bt.scale||1)+')';renderTopIcons()}
function renderLogoButtonContent(el){if(!el)return;const barLogo=DATA.logoBar||DATA.logo;if(barLogo){el.innerHTML='<img src="'+barLogo+'" style="width:32px;height:32px;object-fit:cover;border-radius:6px" alt="">'}else{el.textContent='ℹ️'}}
const promoSeenKey='promoSeen_'+(DATA.socioId||'');
const promoCountKey='promoCount_'+(DATA.socioId||'');
let _promoCount=parseInt(localStorage.getItem(promoCountKey)||'0',10);
function applyPromoDots(){const seen=parseInt(localStorage.getItem(promoSeenKey)||'0',10);const show=_promoCount>seen;console.log('[PROMO-DOTS] _promoCount='+_promoCount+' seen='+seen+' show='+show+' dots='+document.querySelectorAll('.promoDot').length);document.querySelectorAll('.promoDot').forEach(d=>{if(show){d.classList.add('visible');d.textContent=_promoCount}else{d.classList.remove('visible');d.textContent=''}})}
function renderTopIcons(){const tt=DATA.topTransforms||{};const iconMap={promo:{key:'promo',icon:DATA.promoIcon,fallback:'🎁'}};Object.entries(iconMap).forEach(([id,{key,icon,fallback}])=>{const el=$(id);if(!el)return;const existingDot=el.querySelector('.promoDot');if(icon){el.innerHTML='<img src="'+icon+'" style="width:32px;height:32px;object-fit:cover;border-radius:6px" alt="">';if(existingDot)el.appendChild(existingDot);else{const d=document.createElement('span');d.className='promoDot';d.id='promoDot';el.appendChild(d)}}else if(fallback){if(!existingDot){el.textContent=fallback;const d=document.createElement('span');d.className='promoDot';d.id='promoDot';el.appendChild(d)}else{el.textContent=fallback;el.appendChild(existingDot)}}const t=tt[key];if(!t)return;el.style.position='absolute';el.style.left=(t.x/1080*100)+'%';el.style.top=(t.y/1920*100)+'%';el.style.transform='rotate('+(t.rotation||0)+'deg) scale('+(t.scale||1)+')';el.style.transformOrigin='top left'});const backEl=$('backCover');if(backEl){backEl.textContent='←';const bt=tt.back;if(bt){backEl.style.position='absolute';backEl.style.left=(bt.x/1080*100)+'%';backEl.style.top=(bt.y/1920*100)+'%';backEl.style.transform='rotate('+(bt.rotation||0)+'deg) scale('+(bt.scale||1)+')';backEl.style.transformOrigin='top left'}}const bellEl=$('callMozoCats');if(bellEl){const bt=tt.bell;if(bt){bellEl.style.position='absolute';bellEl.style.left=(bt.x/1080*100)+'%';bellEl.style.top=(bt.y/1920*100)+'%';bellEl.style.transform='rotate('+(bt.rotation||0)+'deg) scale('+(bt.scale||1)+')';bellEl.style.transformOrigin='top left'}}
['callMozoTop','callMozoCart'].forEach(id=>{const el=$(id);if(!el)return;const bt=tt.bell;if(bt){el.style.position='absolute';el.style.left=(bt.x/1080*100)+'%';el.style.top=(bt.y/1920*100)+'%';el.style.transform='rotate('+(bt.rotation||0)+'deg) scale('+(bt.scale||1)+')';el.style.transformOrigin='top left'}});
const mesaEl=$('mesaBadge');if(mesaEl){const mt=tt.mesa;if(mt){mesaEl.style.left=(mt.x/1080*100)+'%';mesaEl.style.top=(mt.y/1920*100)+'%';mesaEl.style.transform='rotate('+(mt.rotation||0)+'deg) scale('+(mt.scale||1)+')';mesaEl.style.transformOrigin='top left'}}const exitEl=$('exitMenuCats');if(exitEl){const bt=tt.exit;if(bt){exitEl.style.position='absolute';exitEl.style.left=(bt.x/1080*100)+'%';exitEl.style.top=(bt.y/1920*100)+'%';exitEl.style.transform='rotate('+(bt.rotation||0)+'deg) scale('+(bt.scale||1)+')';exitEl.style.transformOrigin='top left'}}const topLogo=$('topLogo');if(topLogo){renderLogoButtonContent(topLogo);const tlt=tt.logo;if(tlt){topLogo.style.position='absolute';topLogo.style.left=(tlt.x/1080*100)+'%';topLogo.style.top=(tlt.y/1920*100)+'%';topLogo.style.transform='rotate('+(tlt.rotation||0)+'deg) scale('+(tlt.scale||1)+')';topLogo.style.transformOrigin='top left'}}const frameEl=$('catsTopFrame');if(frameEl){const ft=tt.frame||{x:8,y:20,scale:1,rotation:0};frameEl.style.left=(ft.x/1080*100)+'%';frameEl.style.top=ft.y+'px';frameEl.style.width=(((1080-2*ft.x)*ft.scale)/1080*100)+'%';frameEl.style.height=(72*ft.scale)+'px';frameEl.style.borderRadius=(14*ft.scale)+'px';frameEl.style.border=DATA.topBarFrameBorderTransparent?'none':'1px solid '+(DATA.topBarFrameBorderColor||'rgba(156,163,175,0.55)');frameEl.style.background=DATA.topBarFrameBgTransparent?'transparent':(DATA.topBarFrameBgColor||'transparent');frameEl.style.transform='rotate('+(ft.rotation||0)+'deg)';frameEl.style.transformOrigin='top left'}
applyPromoDots();
}
function renderCategories(){$('catList').innerHTML='';categories().forEach(([c,count],idx)=>{const img=findCategoryImage(c);const t=(DATA.categoryTransforms||{})[slug(c)||'sin-categoria']||{x:60+(idx%3)*350,y:350+Math.floor(idx/3)*420,scale:1,rotation:0};const div=document.createElement('div');div.className='cat';div.style.left=(t.x/1080*100)+'%';div.style.top=(t.y/1920*100)+'%';div.style.transform='rotate('+(t.rotation||0)+'deg) scale('+(t.scale||1)+')';div.innerHTML='<div class="catImg">'+(img?'<img loading="lazy" decoding="async" src="'+img+'">':'🍽️')+'</div><b>'+c+'</b>';div.onclick=()=>{state.selectedCategory=c;renderProducts();setView('products')};$('catList').appendChild(div)})}
function applyCompactTopTransforms(){const tt=DATA.topTransforms||{};const groups={back:['backCover','backCats','backProducts'],logo:['logoInfoCategories','logoInfoProducts','logoInfoCart'],promo:['promoCategories','promoProducts','cartPromo'],bell:['callMozoCats','callMozoTop','callMozoCart'],exit:['exitMenuCats','exitTop','exitCart']};Object.entries(groups).forEach(([key,ids])=>{const t=tt[key];if(!t)return;ids.forEach(id=>{const el=$(id);if(!el)return;el.style.position='absolute';el.style.left=(Number(t.x||0)/1080*100)+'%';el.style.top=Number(t.y||0)+'px';el.style.transformOrigin='top left';el.style.transform='rotate('+(t.rotation||0)+'deg) scale('+(t.scale||1)+')'})});const mt=tt.mesa;const mesa=$('mesaBadge');if(mt&&mesa){mesa.style.left=(Number(mt.x||0)/1080*100)+'%';mesa.style.top=(Number(mt.y||0)/1920*100)+'%';mesa.style.transformOrigin='top left';mesa.style.transform='rotate('+(mt.rotation||0)+'deg) scale('+(mt.scale||1)+')'}}
function renderProducts(){$('prodTitle').textContent=state.selectedCategory||'Productos';$('prodList').innerHTML='';DATA.rows.forEach((r,i)=>{if((r.categoria||'Sin categoría')!==state.selectedCategory)return;const img=findProductImage(r,i);const q=state.draftQty[i]||0;const inCart=Number(state.cart[i]||0)>0;const card=document.createElement('div');card.className='product-card';const desc=(r.detalle||'').trim();card.innerHTML=(img?'<img loading="lazy" decoding="async" src="'+img+'">':'<div class="prod-placeholder">🍽️</div>')+'<div class="prod-info"><h4>'+escapeHtml(r.producto)+'</h4>'+(desc?'<p class="prod-desc">'+escapeHtml(desc)+'</p>':'')+'<div class="price">'+money(price(r.precio))+'</div></div>'+'<div class="qty"><button data-minus="'+i+'">−</button><span>'+q+'</span><button data-plus="'+i+'">+</button><button class="check '+(inCart?'active':'')+'" data-check="'+i+'" title="Agregar al carrito"><span>'+(inCart?'✓':'')+'</span></button></div>';$('prodList').appendChild(card)});$('prodList').querySelectorAll('[data-plus]').forEach(b=>b.onclick=()=>{const i=String(b.dataset.plus);state.draftQty[i]=(state.draftQty[i]||0)+1;renderProducts()});$('prodList').querySelectorAll('[data-minus]').forEach(b=>b.onclick=()=>{const i=String(b.dataset.minus);if(state.draftQty[i]>0)state.draftQty[i]--;renderProducts()});$('prodList').querySelectorAll('[data-check]').forEach(b=>b.onclick=()=>{const i=String(b.dataset.check);const q=state.draftQty[i]||1;if(state.cart[i]){delete state.cart[i];delete state.draftQty[i]}else{state.cart[i]=q}renderProducts();renderCartBadge();renderCart()});renderCartBadge()}
function cartItems(){return Object.entries(state.cart).filter(([,q])=>q>0).map(([i,q])=>({...DATA.rows[i],idx:i,qty:q}))}
function renderCartBadge(){const cartQty=cartItems().reduce((s,i)=>s+i.qty,0);const promoQty=Object.values(state.promoProducts).filter(Boolean).length;const total=cartQty+promoQty;document.querySelectorAll('.cartBadge').forEach(b=>{b.textContent=total;b.style.background=total>0?'#22c55e':'#f59e0b'})}
let confirmingDelivery=false;
document.addEventListener('click',async event=>{
  if(!event.target.closest('#confirmCustomerDelivery')||mesaNumero!==0||confirmingDelivery||!state.sentOrder)return;
  const order=state.sentOrder;
  const expected=order.metodo_entrega==='retiro'?'preparado':'en_delivery';
  const session=localStorage.getItem('mesa_0_sesion');
  if(order.estado_pedido!==expected||!session||!supabaseClient)return;
  confirmingDelivery=true;renderCart();
  try{
    const filter='id=eq.'+encodeURIComponent(order.id)+'&cliente_id=eq.'+encodeURIComponent(DATA.socioId)+'&mesa=eq.0&sesion_id=eq.'+encodeURIComponent(session)+'&estado_pedido=eq.'+expected;
    const result=await sbUpdate('comensales',filter,{estado_pedido:'entregado',entregado_at:new Date().toISOString()});
    if(result.error||!Array.isArray(result.data)||result.data.length!==1)throw new Error('No se pudo confirmar');
    state.sentOrder={...order,...result.data[0]};
    showToast('Recepción confirmada. ¡Gracias!');
  }catch(error){showToast('No se pudo confirmar la entrega. Intentá nuevamente.');}
  finally{confirmingDelivery=false;await fetchSentItems();if(state.screen==='cart')renderCart();}
});
function renderCart(){renderCartBadge();$('cartList').innerHTML='';
if(state.checklistVisible&&state.sentOrder&&!(mesaNumero===0&&(state.sentOrder.estado_pedido==='entregado'||state.sentOrder.estado_pedido==='cerrado')&&(cartItems().length>0||state.activePromo))){
  const ep=state.sentOrder.estado_pedido||'nuevo';
  const rank=mesaNumero>0
    ? ({nuevo:0,en_preparacion:1,preparado:2,en_delivery:3,entregado:4,cerrado:4}[ep]||0)
    : ({nuevo:0,en_preparacion:1,preparado:2,en_delivery:3,entregado:4,cerrado:4}[ep]||0);
  const steps=(mesaNumero>0||state.sentOrder.metodo_entrega==='retiro')
    ? [['Ingresa menú','#f59e0b',1],['Cocina','#3b82f6',2],['Pedido entregado','#22c55e',4]]
    : [['Ingresa menú','#f59e0b',1],[state.sentOrder.derivado_area==='mozo'?'Mozo':'Cocina','#3b82f6',2],['Delivery','#a855f7',3],['Pedido entregado','#22c55e',4]];
  let statusHtml='<div class="order-status"><div class="order-status-title">Estado del pedido</div><div class="order-status-list">';
  steps.forEach(s=>{const done=rank>=s[2];const customerStep=mesaNumero===0&&s[2]===4;const ready=state.sentOrder.metodo_entrega==='retiro'?ep==='preparado':ep==='en_delivery';const tag=customerStep?'button':'div';statusHtml+='<'+tag+(customerStep?' type="button" id="confirmCustomerDelivery" aria-label="Confirmar pedido entregado" aria-pressed="'+done+'" '+((done||!ready||confirmingDelivery)?'disabled':''):'')+' class="order-status-step '+(done?'done':'')+'" style="--step-color:'+s[1]+';'+(customerStep?'background:transparent;border:0;padding:0;text-align:left;cursor:pointer':'')+'"><span class="order-status-check">'+(done?'✓':'')+'</span><span>'+s[0]+'</span></'+tag+'>'});
  statusHtml+='</div></div>';
  $('cartList').innerHTML+=statusHtml;
}
if(state.sentItems&&state.sentItems.length>0){
  let sentHtml='<div class="cart-section-label">Ya enviado</div>';
  state.sentItems.forEach(i=>{
    sentHtml+='<div class="cart-item cart-item-sent"><span>'+i.cantidad+' x '+escapeHtml(i.nombre)+'<br><b>'+money(price(i.precio)*i.cantidad)+'</b></span></div>';
  });
  if(cartItems().length>0||state.activePromo)sentHtml+='<div class="cart-section-label">Pedido nuevo</div>';
  $('cartList').innerHTML+=sentHtml;
}
if(state.activePromo){
  const ap=state.activePromo;
  const is2x1=ap.tipo==='2x1_mismo'||ap.tipo==='2x1_categoria';
  const isDescuento=ap.tipo==='descuento';
  const descuentoPct=Number(ap.valor_descuento)||0;
  let promoHtml='<div style="background:rgba(34,197,94,.12);border:1px solid rgba(34,197,94,.3);border-radius:10px;padding:10px 12px;margin-bottom:10px"><div style="display:flex;justify-content:space-between;align-items:center"><span style="color:#22c55e;font-weight:700;font-size:13px">🎁 '+ap.titulo+'</span><button id="clearPromo" style="background:transparent;border:0;color:#9ca3af;font-size:18px;cursor:pointer;line-height:1">✕</button></div><span style="display:block;color:#9ca3af;font-size:12px;margin-top:4px">'+ap.codigo+'</span></div>';
  promoHtml+='<div id="promoProdList">';
  const promoIdxs=Object.keys(state.promoProducts);
  if(promoIdxs.length>0){
    promoIdxs.forEach(idx=>{
      const r=DATA.rows[idx];
      if(!r)return;
      const checked=!!state.promoProducts[idx];
      const p=price(r.precio);
      const originalTotal=is2x1?p*2:p;
      const discountedTotal=is2x1?p:(isDescuento?p*(1-descuentoPct/100):originalTotal);
      const showStrike=is2x1||(isDescuento&&descuentoPct>0);
      promoHtml+='<div class="cart-item" style="opacity:'+(checked?1:0.5)+';border-left:3px solid '+(checked?'#22c55e':'#374151')+'">' +
        '<div style="display:flex;align-items:center;gap:10px;flex:1">' +
          '<div class="promo-check" data-promo-check="'+idx+'" style="width:24px;height:24px;border-radius:6px;border:2px solid '+(checked?'#22c55e':'#4b5563')+';background:'+(checked?'#22c55e':'transparent')+';display:grid;place-items:center;cursor:pointer;flex-shrink:0">' +
            '<span style="color:#fff;font-size:14px;font-weight:700;opacity:'+(checked?1:0)+'">✓</span>' +
          '</div>' +
          '<div style="flex:1;min-width:0">' +
            '<div style="color:#fff;font-size:14px;font-weight:500">'+r.producto+'</div>' +
            '<div style="display:flex;align-items:center;gap:6px;margin-top:2px">' +
              (showStrike?'<span style="color:#6b7280;font-size:12px;text-decoration:line-through">'+money(originalTotal)+'</span>':'') +
              '<span style="color:#22c55e;font-size:14px;font-weight:700">'+money(discountedTotal)+'</span>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    });
    if(isDescuento&&descuentoPct>0){
      const selIdxs=promoIdxs.filter(idx=>state.promoProducts[idx]);
      let totalDisc=0;
      selIdxs.forEach(idx=>{const r=DATA.rows[idx];if(!r)return;totalDisc+=price(r.precio)*descuentoPct/100});
      if(selIdxs.length>0){
        promoHtml+='<div style="display:flex;justify-content:space-between;padding:8px 12px;color:#22c55e;font-size:13px;font-weight:600;border-top:1px solid rgba(34,197,94,.2)"><span>🎉 '+descuentoPct+'% OFF aplicado</span><span>-'+money(totalDisc)+'</span></div>';
      }
    }
    if(is2x1){
      const selIdxs=promoIdxs.filter(idx=>state.promoProducts[idx]);
      const grps={};
      selIdxs.forEach(idx=>{const r=DATA.rows[idx];if(!r||!r.producto)return;if(!grps[r.producto])grps[r.producto]={count:0,price:0};grps[r.producto].count++;grps[r.producto].price=price(r.precio)});
      let totalFree=0;let totalDisc=0;
      Object.values(grps).forEach(g=>{totalFree+=g.count;totalDisc+=g.count*g.price});
      if(totalFree>0){
        promoHtml+='<div style="display:flex;justify-content:space-between;padding:8px 12px;color:#22c55e;font-size:13px;font-weight:600;border-top:1px solid rgba(34,197,94,.2)"><span>🎉 2x1 aplicado</span><span>-'+money(totalDisc)+'</span></div>';
      }
    }
  }
  promoHtml+='</div>';
  $('cartList').innerHTML+=promoHtml;
  $('cartList').querySelectorAll('[data-promo-check]').forEach(b=>b.onclick=()=>{
    const idx=b.dataset.promoCheck;
    state.promoProducts[idx]=!state.promoProducts[idx];
    renderCart();renderCartBadge();
  });
}
cartItems().forEach(i=>{
  const row=document.createElement('div');
  row.className='cart-item';
  row.innerHTML='<span>'+i.qty+' x '+i.producto+'<br><b>'+money(price(i.precio)*i.qty)+'</b></span><button data-del="'+i.idx+'">Quitar</button>';
  $('cartList').appendChild(row);
});
$('cartList').querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{delete state.cart[b.dataset.del];renderCart();renderProducts()});
const clearBtn=$('clearPromo');
if(clearBtn)clearBtn.onclick=()=>{state.activePromo=null;state.promoProducts={};renderCart();renderCartBadge()};
let sub=cartItems().reduce((s,i)=>s+price(i.precio)*i.qty,0);
let promoSubtotal=0;
let promoDiscount=0;
if(state.activePromo&&(state.activePromo.tipo==='2x1_mismo'||state.activePromo.tipo==='2x1_categoria')){
  const selectedIdxs=Object.keys(state.promoProducts).filter(idx=>state.promoProducts[idx]);
  console.log('[CART] selectedIdxs:',selectedIdxs,'promoProducts:',JSON.stringify(state.promoProducts));
  const groups={};
  selectedIdxs.forEach(idx=>{
    const r=DATA.rows[idx];
    console.log('[CART] idx:',idx,'r:',r?'found':'NULL','precio:',r?r.precio:'N/A');
    if(!r)return;
    const n=r.producto;
    if(!n)return;
    if(!groups[n])groups[n]={count:0,price:0};
    groups[n].count++;
    groups[n].price=price(r.precio);
  });
  Object.values(groups).forEach(g=>{
    promoSubtotal+=g.count*g.price*2;
    promoDiscount+=g.count*g.price;
  });
  console.log('[CART] promoSubtotal:',promoSubtotal,'promoDiscount:',promoDiscount);
}else if(state.activePromo&&state.activePromo.tipo==='descuento'){
  const pct=Number(state.activePromo.valor_descuento)||0;
  const selectedIdxs=Object.keys(state.promoProducts).filter(idx=>state.promoProducts[idx]);
  selectedIdxs.forEach(idx=>{
    const r=DATA.rows[idx];
    if(!r)return;
    const p=price(r.precio);
    promoSubtotal+=p;
    promoDiscount+=p*pct/100;
  });
}
const del=state.deliveryEnabled?price(DATA.delivery):0;
if(mesaNumero>0)sincronizarPropinaConCuenta();
const sentBase=(state.sentItems||[]).reduce((s,i)=>s+price(i.precio)*(Number(i.cantidad)||0),0);
const baseParaPropina=Math.max(0,sub+promoSubtotal-promoDiscount+sentBase);
const propina=mesaNumero>0?calcularPropina(baseParaPropina):0;
const totalAfter=Math.max(0,sub+promoSubtotal-promoDiscount+del+propina);
const subEl=$('sub');if(subEl)subEl.textContent=money(sub+promoSubtotal);
const discRow=$('promoDiscRow');
if(discRow){discRow.style.display=promoDiscount>0?'flex':'none';const discEl=$('promoDisc');if(discEl)discEl.textContent='-'+money(promoDiscount)}
const delEl=$('del');if(delEl)delEl.textContent=money(del);
const propRow=$('propinaRow');
if(propRow){propRow.style.display=propina>0?'flex':'none';const propEl=$('propinaTot');if(propEl)propEl.textContent=money(propina)}
const propCalcEl=$('propinaCalculada');if(propCalcEl)propCalcEl.textContent=money(propina);
guardarPropinaEnMesa(propina);
const totEl=$('tot');if(totEl)totEl.textContent=money(totalAfter);
const dc=$('deliveryCheck');if(dc)dc.classList.toggle('active',!!state.deliveryEnabled);
const pc=$('pickupCheck');if(pc)pc.classList.toggle('active',!!state.pickupEnabled);
renderAliasRow()}
function renderAliasRow(){const box=$('aliasRow');if(!box)return;const alias=DATA.alias||'';box.innerHTML='<span>'+(alias||'Sin alias')+'</span><button id="aliasCopy">Copiar alias</button>';$('aliasCopy').onclick=async()=>{if(!alias)return;try{await navigator.clipboard.writeText(alias)}catch(e){const ta=document.createElement('textarea');ta.value=alias;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove()}}}

// Propina para el mozo (solo mesas 1+, no aplica a delivery/retiro de Mesa 0).
// "Monto": el número tipeado es directamente el importe. "%": el número es
// un porcentaje sobre el subtotal (antes de delivery), recalculado en vivo
// contra el total actual del pedido.
function calcularPropina(baseSubtotal){
  const valor=Number(state.propinaValor)||0;
  if(valor<=0)return 0;
  return state.propinaTipo==='porcentaje'?baseSubtotal*valor/100:valor;
}
let propinaGuardarTimer=null;
let propinaUltimaGuardada=null;
let propinaPendiente=0;
let propinaVioCuenta=false;
let sentItemsListos=false;
const PROPINA_KEY=mesaNumero>0?'mesa_'+mesaNumero+'_propina':null;
// La propina se recuerda en este dispositivo (igual que la sesión) para que
// sobreviva a recargas y a cerrar/abrir el navegador.
function guardarPropinaLocal(){
  if(!PROPINA_KEY)return;
  try{localStorage.setItem(PROPINA_KEY,JSON.stringify({t:state.propinaTipo,v:state.propinaValor,c:propinaVioCuenta?1:0}))}catch(e){}
}
function borrarPropinaLocal(){if(PROPINA_KEY){try{localStorage.removeItem(PROPINA_KEY)}catch(e){}}}
function resetPropinaLocal(){
  state.propinaValor='';state.propinaTocada=false;propinaVioCuenta=false;propinaUltimaGuardada=0;propinaPendiente=0;
  clearTimeout(propinaGuardarTimer);propinaGuardarTimer=null;borrarPropinaLocal();
  const inp=$('propinaInput');if(inp)inp.value='';
}
// Cuando el cajero cobra, los pedidos pasan a pagados y \"Ya enviado\" queda
// vacío: en ese momento la propina de esa cuenta ya se cobró y se limpia acá
// para que no se vuelva a cargar en la mesa.
function sincronizarPropinaConCuenta(){
  const hay=state.sentItems&&state.sentItems.length>0;
  if(hay){if(!propinaVioCuenta){propinaVioCuenta=true;if(state.propinaTocada)guardarPropinaLocal()}return}
  if(propinaVioCuenta&&sentItemsListos&&cartItems().length===0&&!state.activePromo)resetPropinaLocal();
}
// Guarda en mesas_operacion EXACTAMENTE el monto que ve el comensal. Solo
// escribe si el comensal cargó/restauró una propina (nunca pisa con 0 por
// un simple render) y solo si el monto cambió.
function guardarPropinaEnMesa(propina,inmediato){
  if(mesaNumero<=0||!supabaseClient||!DATA.socioId)return;
  if(!state.propinaTocada)return;
  // En modo % el monto depende de la cuenta ya enviada: hasta no leerla, no se guarda (daría 0).
  if(state.propinaTipo==='porcentaje'&&!sentItemsListos)return;
  propina=Math.round((Number(propina)||0)*100)/100;
  if(!inmediato&&propinaUltimaGuardada!==null&&propina===propinaUltimaGuardada&&!propinaGuardarTimer)return;
  propinaPendiente=propina;
  clearTimeout(propinaGuardarTimer);propinaGuardarTimer=null;
  const ejecutar=async()=>{
    propinaGuardarTimer=null;
    const monto=propinaPendiente;
    const filtro='cliente_id=eq.'+DATA.socioId+'&numero=eq.'+mesaNumero;
    const sesion=monto>0?propinaSesionId:null;
    let r=await sbUpdate('mesas_operacion',filtro,{propina_monto:monto,propina_sesion_id:sesion});
    // Si falta la columna propina_sesion_id (migración sin correr), se guarda solo el monto.
    if(r.error)r=await sbUpdate('mesas_operacion',filtro,{propina_monto:monto});
    // Si la fila de la mesa todavía no existe, se crea.
    if(!r.error&&Array.isArray(r.data)&&r.data.length===0){
      r=await sbUpsert('mesas_operacion',{cliente_id:DATA.socioId,numero:mesaNumero,propina_monto:monto,propina_sesion_id:sesion},'cliente_id,numero');
      if(r.error)r=await sbUpsert('mesas_operacion',{cliente_id:DATA.socioId,numero:mesaNumero,propina_monto:monto},'cliente_id,numero');
    }
    if(r.error){console.warn('[PROPINA] no se pudo guardar',r.error);return false}
    propinaUltimaGuardada=monto;return true;
  };
  if(inmediato)return ejecutar();
  propinaGuardarTimer=setTimeout(ejecutar,500);
}
// Fuerza el guardado pendiente ya mismo (al enviar el pedido o al salir de la pestaña).
function flushPropina(){
  if(!propinaGuardarTimer)return;
  clearTimeout(propinaGuardarTimer);propinaGuardarTimer=null;
  return guardarPropinaEnMesa(propinaPendiente,true);
}
document.addEventListener('visibilitychange',()=>{if(document.hidden)flushPropina()});
window.addEventListener('pagehide',()=>{flushPropina()});
function setupPropina(){
  const section=$('propinaSection');
  if(section)section.style.display=mesaNumero>0?'block':'none';
  if(mesaNumero<=0)return;
  const btnMonto=$('propinaModoMonto');const btnPct=$('propinaModoPct');const input=$('propinaInput');
  // El botón del modo elegido (Monto $ / % del total) se pinta de verde al
  // apretarlo, para distinguir de un vistazo cuál de los dos está activo.
  const pintarModo=(btn,activo)=>{
    if(!btn)return;
    btn.style.background=activo?'rgba(34,197,94,.18)':'transparent';
    btn.style.borderColor=activo?'#22c55e':'#2f6fed';
    btn.style.color=activo?'#22c55e':'#fff';
  };
  const marcarActivo=()=>{
    pintarModo(btnMonto,state.propinaTipo==='monto');
    pintarModo(btnPct,state.propinaTipo==='porcentaje');
    if(input)input.placeholder=state.propinaTipo==='porcentaje'?'Ej: 10 (%)':'Ej: 500';
  };
  state.propinaTipo='monto';state.propinaValor='';state.propinaTocada=false;
  // Restaura la propina que este comensal ya había cargado en este dispositivo.
  try{
    const raw=PROPINA_KEY?localStorage.getItem(PROPINA_KEY):null;
    if(raw){const sv=JSON.parse(raw);if(sv&&Number(sv.v)>0){state.propinaTipo=sv.t==='porcentaje'?'porcentaje':'monto';state.propinaValor=String(sv.v);state.propinaTocada=true;propinaVioCuenta=!!sv.c}}
  }catch(e){}
  if(input&&state.propinaValor)input.value=state.propinaValor;
  if(btnMonto)btnMonto.onclick=()=>{state.propinaTipo='monto';marcarActivo();guardarPropinaLocal();renderCart()};
  if(btnPct)btnPct.onclick=()=>{state.propinaTipo='porcentaje';marcarActivo();guardarPropinaLocal();renderCart()};
  if(input)input.oninput=e=>{state.propinaValor=e.target.value;state.propinaTocada=true;guardarPropinaLocal();renderCart()};
  marcarActivo();
  // Sin dato local: si la mesa ya tiene una propina de esta misma sesión, se muestra igual.
  if(!state.propinaTocada&&supabaseClient&&DATA.socioId){
    sbSelect('mesas_operacion','cliente_id=eq.'+DATA.socioId+'&numero=eq.'+mesaNumero+'&select=propina_monto,propina_sesion_id').then(r=>{
      const m=r.data&&r.data[0];
      if(!m||state.propinaTocada)return;
      const monto=Number(m.propina_monto)||0;
      if(monto>0&&m.propina_sesion_id===propinaSesionId){
        state.propinaTipo='monto';state.propinaValor=String(monto);state.propinaTocada=true;propinaUltimaGuardada=monto;
        if(input)input.value=state.propinaValor;marcarActivo();guardarPropinaLocal();
        if(state.screen==='cart')renderCart();
      }
    }).catch(()=>{});
  }
}
function orderMessage(){const lines=cartItems().map(i=>i.qty+' x '+i.producto+' — '+money(price(i.precio)*i.qty));const sub=cartItems().reduce((s,i)=>s+price(i.precio)*i.qty,0);if(state.activePromo){const es2x1=state.activePromo.tipo==='2x1_mismo'||state.activePromo.tipo==='2x1_categoria';const pg={};Object.keys(state.promoProducts).filter(idx=>state.promoProducts[idx]).forEach(idx=>{const r=DATA.rows[idx];if(!r||!r.producto)return;if(!pg[r.producto])pg[r.producto]={qty:0,price:price(r.precio)};pg[r.producto].qty+=es2x1?2:1});Object.keys(pg).forEach(n=>lines.push(pg[n].qty+' x '+n+' — '+money(pg[n].price*pg[n].qty)+(es2x1?' (promo 2x1)':'')))}let promoSubtotal=0;let promoDiscount=0;if(state.activePromo&&(state.activePromo.tipo==='2x1_mismo'||state.activePromo.tipo==='2x1_categoria')){const selectedIdxs=Object.keys(state.promoProducts).filter(idx=>state.promoProducts[idx]);const groups={};selectedIdxs.forEach(idx=>{const r=DATA.rows[idx];if(!r)return;const n=r.producto;if(!n)return;if(!groups[n])groups[n]={count:0,price:0};groups[n].count++;groups[n].price=price(r.precio)});Object.values(groups).forEach(g=>{promoSubtotal+=g.count*g.price*2;promoDiscount+=g.count*g.price})}else if(state.activePromo&&state.activePromo.tipo==='descuento'){const pct=Number(state.activePromo.valor_descuento)||0;const selectedIdxs=Object.keys(state.promoProducts).filter(idx=>state.promoProducts[idx]);selectedIdxs.forEach(idx=>{const r=DATA.rows[idx];if(!r)return;const p=price(r.precio);promoSubtotal+=p;promoDiscount+=p*pct/100})}const del=state.deliveryEnabled?price(DATA.delivery):0;let msg='Pedido:'+(mesaNumero>0?'\\nMesa: '+mesaNumero:'')+'\\n'+lines.join('\\n')+'\\n\\nSubtotal: '+money(sub+promoSubtotal);if(promoDiscount>0)msg+='\\nDescuento promo: -'+money(promoDiscount);msg+=(state.deliveryEnabled?'\\nDelivery: '+money(del):(state.pickupEnabled?'\\nRetira en el local\\nCódigo de retiro: '+(state.pickupCode||''):'\\nRetira en el local: sin delivery'))+'\\nTotal: '+money(Math.max(0,(sub+promoSubtotal-promoDiscount+del)));if(mesaNumero===0){msg+='\\nNombre: '+(state.customerName||'');msg+='\\nTeléfono: '+(state.customerPhone||'')}if(state.customerAddress)msg+='\\nDirección: '+state.customerAddress;if(state.codigoPedido)msg+='\\nCódigo de pedido: '+state.codigoPedido;return msg}

function showToast(msg){let t=document.getElementById('toast-msg');if(!t){t=document.createElement('div');t.id='toast-msg';t.style.cssText='position:fixed;bottom:30px;left:50%;transform:translateX(-50%);background:#008080;color:#fff;padding:14px 28px;border-radius:14px;font-size:15px;font-weight:700;z-index:9999;box-shadow:0 8px 30px rgba(0,0,0,.5);text-align:center;max-width:90vw;transition:opacity .4s';document.body.appendChild(t)}t.textContent=msg;t.style.opacity='1';setTimeout(()=>{t.style.opacity='0';setTimeout(()=>t.remove(),500)},3000)}

async function sbSelect(table,params){
  if(!supabaseClient)return{data:null,error:null};
  try{const url=supabaseClient.url+'/rest/v1/'+table+'?'+params;
  const r=await fetch(url,{method:'GET',headers:supabaseClient.headers});
  if(!r.ok)return{data:null,error:await r.text()};return{data:await r.json(),error:null}}catch(e){return{data:null,error:e.message}}
}
async function marcarPromoUsadaYLimpiar(){
  if(state.activePromo&&state.activePromo.codigo){
    try{
      // El canje se registra en el servidor (valida día, horario y cupo). Si esa función todavía no existe
      // (SQL sin ejecutar) se usa el método anterior.
      const rc=await sbRpc('canjear_promo',{p_codigo:state.activePromo.codigo});
      if(rc.error&&/canjear_promo|PGRST202|404/.test(String(rc.error)))await sbUpdate('promociones_cliente','codigo=eq.'+encodeURIComponent(state.activePromo.codigo),{usada:true,fecha_uso:new Date().toISOString()})
    }
    catch(e){console.log('[PROMO] error al marcar usada:',e)}
  }
  state.activePromo=null;
  state.promoProducts={};
}
function promoOrderItems(){
  if(!state.activePromo)return[];
  const tipo=state.activePromo.tipo;
  const selectedIdxs=Object.keys(state.promoProducts).filter(idx=>state.promoProducts[idx]);
  return selectedIdxs.map(idx=>{
    const r=DATA.rows[idx];
    if(!r||!r.producto)return null;
    return {producto:r.producto,qty:(tipo==='2x1_mismo'||tipo==='2x1_categoria')?2:1};
  }).filter(Boolean);
}
async function sendSupabaseOrder(){
  if(!supabaseClient||!DATA.socioId)return false;
  const promoItems=promoOrderItems();
  if(cartItems().length===0&&promoItems.length===0)return false;
  const sesionId=localStorage.getItem('mesa_'+mesaNumero+'_sesion')||crypto.randomUUID();
  localStorage.setItem('mesa_'+mesaNumero+'_sesion',sesionId);
  let comensalId=null;
  const cr=await sbInsert('comensales',{cliente_id:DATA.socioId,mesa:mesaNumero,nombre:'Cliente Mesa '+mesaNumero,sesion_id:sesionId,activo:1});
  if(cr.data&&cr.data.length>0){comensalId=cr.data[0].id}
  if(!comensalId)return false;
  const {data:prods}=await sbSelect('productos','select=id,nombre&cliente_id=eq.'+DATA.socioId);
  const idMap={};if(prods)prods.forEach(p=>{idMap[p.nombre]=p.id});
  const pedidos=[
    ...cartItems().map(i=>({comensal_id:comensalId,producto_id:idMap[i.producto]||'00000000-0000-0000-0000-000000000000',cantidad:i.qty,pagado:0,es_promo:0,fecha_hora:new Date().toISOString()})),
    ...promoItems.map(i=>({comensal_id:comensalId,producto_id:idMap[i.producto]||'00000000-0000-0000-0000-000000000000',cantidad:i.qty,pagado:0,es_promo:1,fecha_hora:new Date().toISOString()}))
  ];
  if(pedidos.length===0)return false;
  const pr=await sbInsert('pedidos_qr',pedidos);
  if(pr.error)return false;
  await sbUpsert('mesas_operacion',{cliente_id:DATA.socioId,numero:mesaNumero,estado:'Ocupada'},'cliente_id,numero');
  return true;
}

// Trae lo que este comensal ya pidió y todavía no fue pagado (pagado=0),
// para mostrarlo "de fondo", en gris y sin poder tocarlo, en Mi pedido.
// Se guarda por sesión (misma lógica que sendSupabaseOrder), así que
// sobrevive a un refresh de página, y desaparece solo cuando el cajero
// cobra o cierra la mesa (eso marca esos pedidos como pagados).
let sentItemsFlight=null;
let mesa0Visto=false;
let lastItemsVersion=null;
let trackedComensal=null;
let orderTrackingDone=false;
let sentRefreshRequested=false;
async function fetchSentItems(force=true){
  if(force){orderTrackingDone=false;sentRefreshRequested=true}
  if(sentItemsFlight)return sentItemsFlight;
  if(orderTrackingDone&&!force)return;
  sentItemsFlight=(async()=>{
    do{
      const forced=sentRefreshRequested;sentRefreshRequested=false;
      if(!supabaseClient||!DATA.socioId)return;
      const sesionId=localStorage.getItem('mesa_'+mesaNumero+'_sesion');
      if(!sesionId){state.sentItems=[];state.sentOrder=null;orderTrackingDone=true;sentItemsListos=true;return}
      const response=await sbRpc('qr_pedido_estado_v2',{p_cliente_id:DATA.socioId,p_mesa:mesaNumero,p_sesion:sesionId});
      if(response.error){console.warn('No se pudo actualizar el pedido',response.error);return}
      const comensal=response.data;
      if(!comensal){state.sentItems=[];state.sentOrder=null;lastItemsVersion=null;trackedComensal=null;orderTrackingDone=true;sentItemsListos=true;return}
      state.sentOrder=comensal;state.checklistVisible=!Boolean(comensal.ocultar_checklist);if(mesaNumero===0){const fin=comensal.estado_pedido==='entregado'||comensal.estado_pedido==='cerrado';if(!fin){mesa0Visto=true}else if(!mesa0Visto){try{localStorage.removeItem('mesa_0_sesion')}catch(e){}state.sentOrder=null;state.sentItems=[];lastItemsVersion=null;trackedComensal=null;orderTrackingDone=true;sentItemsListos=true;return}}
      if(comensal.estado_pedido==='cerrado'){
        state.sentItems=[];orderTrackingDone=true;lastItemsVersion=null;sentItemsListos=true;return;
      }
      if(!forced&&trackedComensal===comensal.id&&lastItemsVersion===comensal.items_version)continue;
      const result=await sbSelect('pedidos_qr','select=producto_id,cantidad,productos(nombre,precio)&comensal_id=eq.'+comensal.id+'&pagado=eq.0');
      if(result.error||!result.data)return;
      const grouped={};
      result.data.forEach(p=>{
        const key=p.producto_id;
        if(!grouped[key])grouped[key]={nombre:(p.productos&&p.productos.nombre)||'Producto',precio:(p.productos&&p.productos.precio)||0,cantidad:0};
        grouped[key].cantidad+=Number(p.cantidad)||0;
      });
      state.sentItems=Object.values(grouped);sentItemsListos=true;
      trackedComensal=comensal.id;lastItemsVersion=comensal.items_version;
    }while(sentRefreshRequested);
  })().finally(()=>{sentItemsFlight=null;if(sentRefreshRequested)return fetchSentItems(true)});
  return sentItemsFlight;
}

async function generarCodigoPedido(numeroMesa=0){
  if(supabaseClient&&DATA.socioId){
    const r=await sbRpc('generar_codigo_pedido',{p_cliente_id:DATA.socioId,p_mesa:Number(numeroMesa)||0});
    if(r.data)return String(r.data);
    if(Number(numeroMesa)===0){
      const legacy=await sbRpc('generar_codigo_pedido_mesa0',{p_cliente_id:DATA.socioId});
      if(legacy.data)return String(legacy.data);
    }
  }
  const d=new Date();
  const fecha=String(d.getDate()).padStart(2,'0')+String(d.getMonth()+1).padStart(2,'0')+d.getFullYear();
  const key='pedidoMesa0Seq_'+DATA.socioId+'_'+fecha;
  const n=(parseInt(localStorage.getItem(key)||'0',10)||0)+1;
  localStorage.setItem(key,String(n));
  return fecha+'-'+String(n).padStart(2,'0')+'-M'+Number(numeroMesa||0);
}

// Pedido de delivery/retiro (mesa 0, sin QR de mesa): a diferencia de
// sendSupabaseOrder (que acumula pedidos de una misma mesa/sesión), acá
// cada envío es un pedido nuevo e independiente, identificado por
// nombre+teléfono del cliente y con un código propio que lo va a
// acompañar durante todo el circuito caja -> mozo/cocina -> caja ->
// delivery/retiro.
async function enviarPedidoDelivery(){
  if(!supabaseClient||!DATA.socioId)return false;
  const promoItems=promoOrderItems();
  if(cartItems().length===0&&promoItems.length===0)return false;
  const metodo=state.deliveryEnabled?'delivery':'retiro';
  const sesionId=crypto.randomUUID();
  localStorage.setItem('mesa_0_sesion',sesionId);
  const cr=await sbInsert('comensales',{
    cliente_id:DATA.socioId,
    mesa:0,
    nombre:(state.customerName||'Cliente').trim(),
    telefono:(state.customerPhone||'').trim(),
    direccion:state.deliveryEnabled?(state.customerAddress||'').trim():'',
    sesion_id:sesionId,
    activo:1,
    codigo_pedido:state.codigoPedido,
    estado_pedido:'nuevo',
    metodo_entrega:metodo
  });
  if(!cr.data||cr.data.length===0)return false;
  const comensalId=cr.data[0].id;
  const {data:prods}=await sbSelect('productos','select=id,nombre&cliente_id=eq.'+DATA.socioId);
  const idMap={};if(prods)prods.forEach(p=>{idMap[p.nombre]=p.id});
  const pedidos=[
    ...cartItems().map(i=>({comensal_id:comensalId,producto_id:idMap[i.producto]||'00000000-0000-0000-0000-000000000000',cantidad:i.qty,pagado:0,es_promo:0,fecha_hora:new Date().toISOString()})),
    ...promoItems.map(i=>({comensal_id:comensalId,producto_id:idMap[i.producto]||'00000000-0000-0000-0000-000000000000',cantidad:i.qty,pagado:0,es_promo:1,fecha_hora:new Date().toISOString()}))
  ];
  if(pedidos.length===0)return false;
  const pr=await sbInsert('pedidos_qr',pedidos);
  if(pr.error)return false;
  mesa0Visto=true;
  await fetchSentItems();
  return true;
}

$('menuBtn').onclick=()=>setView('categories');$('backCover').onclick=()=>{setView('cover')};$('backCats').onclick=()=>setView('categories');const openCart=()=>{fetchSentItems().then(()=>{renderCart();setView('cart')})};const fcEl=$('floatingCart');if(fcEl)fcEl.onclick=openCart;const ccEl=$('categoriesCart');if(ccEl)ccEl.onclick=openCart;$('backProducts').onclick=()=>setView('products');
const suscKey='promoSusc_'+(DATA.socioId||'');
function escapeHtml(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
// =====================================================
// Horario de pedidos: chequeo al tocar "Enviar Pedido" y modal de
// "Fuera de horario" con opinión/consulta.
// DATA.horarioPedidos = {"0":[{desde,hasta}],...,"6":[...]}; "0"=Domingo.
// Array vacío = día cerrado. Si "hasta"<="desde" la franja cruza la
// medianoche (ej 20:00 a 02:00).
// =====================================================
function estaDentroDeHorarioPedidos(){
  if(!DATA.horarioPedidosActivo)return true;
  const cfg=DATA.horarioPedidos||{};
  const ahora=new Date();
  const franjas=cfg[String(ahora.getDay())]||[];
  if(franjas.length===0)return false;
  const minutosAhora=ahora.getHours()*60+ahora.getMinutes();
  return franjas.some(f=>{
    const [dh,dm]=String(f.desde||'0:0').split(':').map(Number);
    const [hh,hm]=String(f.hasta||'0:0').split(':').map(Number);
    const desde=(dh||0)*60+(dm||0);
    const hasta=(hh||0)*60+(hm||0);
    if(hasta<=desde)return minutosAhora>=desde||minutosAhora<hasta;
    return minutosAhora>=desde&&minutosAhora<hasta;
  });
}
const DIAS_ABREV={0:'Dom',1:'Lun',2:'Mar',3:'Mié',4:'Jue',5:'Vie',6:'Sáb'};
// Agrupa días consecutivos (Lun..Dom) que tengan el mismo horario en una
// sola línea (ej: "Lun a Vie: 11:00 a 23:00hs") para que ocupe poco lugar
// y se entienda rápido, en vez de listar los 7 días uno por uno.
function horarioPedidosGrupos(){
  const cfg=DATA.horarioPedidos||{};
  const orden=[1,2,3,4,5,6,0];
  const dias=orden.map(d=>{
    const franjas=cfg[String(d)]||[];
    const txt=franjas.length?franjas.map(f=>f.desde+' a '+f.hasta).join(' y '):'Cerrado';
    return {d,txt};
  });
  const grupos=[];
  dias.forEach(dia=>{
    const ultimo=grupos[grupos.length-1];
    if(ultimo&&ultimo.txt===dia.txt)ultimo.dias.push(dia.d);
    else grupos.push({txt:dia.txt,dias:[dia.d]});
  });
  return grupos;
}
function hayHorarioPedidosCargado(){
  const cfg=DATA.horarioPedidos||{};
  return Object.keys(cfg).some(k=>Array.isArray(cfg[k])&&cfg[k].length>0);
}
function etiquetaDiasHorario(dias){
  const nombres=dias.map(d=>DIAS_ABREV[d]);
  if(nombres.length===1)return nombres[0];
  if(nombres.length===2)return nombres[0]+' y '+nombres[1];
  return nombres[0]+' a '+nombres[nombres.length-1];
}
function formatHorarioPedidosHtml(){
  if(!hayHorarioPedidosCargado())return '';
  const grupos=horarioPedidosGrupos();
  return grupos.map(g=>'<div style="display:flex;justify-content:space-between;gap:10px;padding:2px 0"><span>'+etiquetaDiasHorario(g.dias)+'</span><b style="color:#fff">'+(g.txt==='Cerrado'?g.txt:g.txt+'hs')+'</b></div>').join('');
}
function renderHorarioPopHtml(){
  return '<button id="horarioClose" style="position:absolute;top:8px;right:10px;background:transparent;border:0;color:#9ca3af;font-size:22px;font-weight:700;cursor:pointer;line-height:1;padding:4px">✕</button>'+
    '<div class="promo-form">'+
    '<h4>⏰ Fuera de horario</h4>'+
    '<p style="color:#9ca3af;font-size:14px;margin:0 0 10px;line-height:1.4">En este momento no estamos recibiendo pedidos. Nuestro horario de atención es:</p>'+
    '<div style="background:rgba(255,255,255,.06);border-radius:10px;padding:10px 12px;color:#9ca3af;font-size:13px;line-height:1.5;margin-bottom:14px">'+formatHorarioPedidosHtml()+'</div>'+
    '<p style="color:#9ca3af;font-size:13px;margin:0 0 6px">¿Querés dejarnos tu opinión o consulta?</p>'+
    '<input id="horarioWsp" placeholder="Tu WhatsApp" type="tel" value="'+escapeHtml(state.customerPhone||'')+'">'+
    '<textarea id="horarioMsg" placeholder="Puedes dejar tu opinión..." rows="3" style="width:100%;margin:8px 0;border-radius:10px;border:1px solid #374151;background:#1f2937;color:#fff;font-size:14px;padding:10px 12px;font-family:inherit;resize:vertical;box-sizing:border-box"></textarea>'+
    '<button id="horarioSend">Enviar</button>'+
    '</div>';
}
function abrirHorarioPop(){
  const pop=$('pop');
  if(!pop)return;
  pop.classList.remove('hidden');
  pop.innerHTML=renderHorarioPopHtml();
  $('horarioClose').onclick=()=>{pop.classList.add('hidden')};
  $('horarioSend').onclick=async()=>{
    const wspInput=$('horarioWsp').value.trim();
    const msg=$('horarioMsg').value.trim();
    if(!wspInput){showToast('Ingresá tu WhatsApp');return}
    if(wspInput.replace(/\D/g,'').length<8){showToast('Ingresá un WhatsApp válido (mínimo 8 dígitos)');return}
    if(!msg){showToast('Escribí tu opinión o consulta');return}
    const numLimpio=normalizarWhatsapp(wspInput);
    const btn=$('horarioSend');btn.disabled=true;btn.textContent='Enviando...';
    if(DATA.socioId&&supabaseClient){
      const r=await sbInsert('opiniones',{cliente_id:DATA.socioId,whatsapp:numLimpio,mensaje:msg,mesa:mesaNumero>0?mesaNumero:null});
      if(r.error)console.error('opiniones error:',r.error);
    }
    if(DATA.whatsapp){
      const n=DATA.whatsapp.replace(/\D/g,'');
      let texto='Hola! Quiero dejar una opinión/consulta (intenté pedir fuera de horario):\\n'+msg+'\\nMi WhatsApp: '+numLimpio;
      if(mesaNumero>0)texto+='\\nMesa: '+mesaNumero;
      window.open('https://wa.me/'+n+'?text='+encodeURIComponent(texto),'_blank');
    }
    showToast('¡Gracias! Recibimos tu mensaje');
    pop.classList.add('hidden');
  };
}
function renderInfoHtml(){
  let html='<button id="infoClose" style="position:absolute;top:8px;right:10px;background:transparent;border:0;color:#9ca3af;font-size:22px;font-weight:700;cursor:pointer;line-height:1;padding:4px">✕</button><div class="promo-form"><h4>ℹ️ Información</h4>';
  const hayHorario=hayHorarioPedidosCargado();
  if(hayHorario)html+='<div style="color:#9ca3af;font-size:14px;margin:0 0 14px"><p style="margin:0 0 4px;color:#fff;font-weight:700">🕒 Horario</p>'+formatHorarioPedidosHtml()+'</div>';
  const iconImg=src=>'<img src="'+src+'" style="width:20px;height:20px;object-fit:cover;border-radius:5px;vertical-align:middle;margin-right:6px">';
  if(DATA.whatsapp)html+='<button id="infoWa">'+(DATA.waIcon?iconImg(DATA.waIcon):'📲 ')+'Enviar mensaje</button>';
  if(DATA.instagram)html+='<button id="infoIg">'+(DATA.igIcon?iconImg(DATA.igIcon):'📷 ')+'Instagram</button>';
  if(DATA.address)html+='<button id="infoMap">'+(DATA.mapIcon?iconImg(DATA.mapIcon):'📍 ')+'Ubicación</button>';
  if(!hayHorario&&!DATA.whatsapp&&!DATA.instagram&&!DATA.address)html+='<p style="color:#9ca3af;font-size:16px;margin:0">Sin información cargada</p>';
  html+='</div>';
  return html;
}
const infoHandler=()=>{
  const pop=$('pop');
  if(!pop.classList.contains('hidden')){pop.classList.add('hidden');return}
  pop.classList.remove('hidden');
  pop.innerHTML=renderInfoHtml();
  const closeBtn=$('infoClose');if(closeBtn)closeBtn.onclick=()=>{pop.classList.add('hidden')};
  const waBtn=$('infoWa');if(waBtn)waBtn.onclick=()=>{let n=String(DATA.whatsapp||'').replace(/[^0-9]/g,'');if(n.length===10)n='54'+n;if(!n){showToast('WhatsApp no disponible');return}window.open('https://wa.me/'+n+'?text='+encodeURIComponent('Hola! Quisiera hacer una consulta.'),'_blank')};
  const igBtn=$('infoIg');if(igBtn)igBtn.onclick=()=>{window.open('https://instagram.com/'+DATA.instagram.replace('@',''),'_blank')};
  const mapBtn=$('infoMap');if(mapBtn)mapBtn.onclick=()=>{window.open('https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(DATA.address),'_blank')};
};
const licatBtn=$('logoInfoCategories');if(licatBtn)licatBtn.onclick=infoHandler;const lipBtn=$('logoInfoProducts');if(lipBtn)lipBtn.onclick=infoHandler;const licBtn=$('logoInfoCart');if(licBtn)licBtn.onclick=infoHandler;
function getSuscId(){return localStorage.getItem(suscKey)}
function setSuscId(id){localStorage.setItem(suscKey,id)}
async function fetchMisPromos(suscId){
  const {data:promos}=await sbRpc('mis_promos_activas',{p_suscripcion_id:suscId});
  return promos||[];
}
function renderMisPromosHtml(promos){
  if(!promos||promos.length===0){
    return '<p style="color:#9ca3af;font-size:16px;margin:8px 0 0">Todavía no tenés promociones activas. ¡Te avisamos por WhatsApp cuando tengas una!</p>';
  }
  return promos.map((p,i)=>'<div style="background:rgba(255,255,255,.06);border-radius:10px;padding:12px;margin-bottom:10px"><b style="display:block;margin-bottom:4px">'+p.titulo+'</b><span style="display:block;color:#9ca3af;font-size:14px;margin-bottom:8px">'+p.descripcion+'</span><span style="display:block;text-align:center;font-size:20px;font-weight:800;letter-spacing:1px;background:#00808033;border-radius:8px;padding:8px">'+p.codigo+'</span>'+(p.tipo?'<button class="promoUseBtn" data-promo-idx="'+i+'" style="margin-top:8px;width:100%;padding:8px;border:0;border-radius:8px;background:#22c55e;color:#fff;font-weight:700;cursor:pointer;font-size:14px">🎁 Obtener promo ahora</button>':'')+'</div>').join('');
}
function updatePromoBadge(suscId){
  if(!suscId||!DATA.socioId||!supabaseClient){document.querySelectorAll('.promoDot').forEach(d=>{d.classList.remove('visible');d.textContent=''});return}
  fetchMisPromos(suscId).then(promos=>{
    _promoCount=promos?promos.length:0;
    localStorage.setItem(promoCountKey,String(_promoCount));
    applyPromoDots();
  });
}
function markPromosSeen(suscId){
  if(!suscId||!DATA.socioId||!supabaseClient)return
  localStorage.setItem(promoSeenKey,String(_promoCount));
  _promoCount=0;
  document.querySelectorAll('.promoDot').forEach(d=>{d.classList.remove('visible');d.textContent=''});
}
async function usarPromo(promo){
  if(!promo)return;
  console.log('[PROMO] usando promo:', promo.tipo, promo.producto_id, promo.categoria);
  state.activePromo=promo;
  state.cart={};
  state.draftQty={};
  state.promoProducts={};
  if((promo.tipo==='2x1_mismo'||promo.tipo==='descuento')&&promo.producto_id){
    let ids=[];let names=[];
    try{ids=JSON.parse(promo.producto_id)}catch{ids=[promo.producto_id]}
    try{if(promo.producto_nombre)names=JSON.parse(promo.producto_nombre)}catch{}
    console.log('[PROMO] ids:', ids, 'names:', names);
    // Try to resolve IDs to names via Supabase if we don't have names
    if(ids.length>0&&names.length===0){
      try{
        const {data:prods}=await sbSelect('productos','select=id,nombre&cliente_id=eq.'+DATA.socioId);
        if(prods){
          const idToName={};prods.forEach(p=>{idToName[p.id]=p.nombre});
          names=ids.map(id=>idToName[id]).filter(Boolean);
          console.log('[PROMO] resolved names from DB:', names);
        }
      }catch(e){console.log('[PROMO] DB lookup failed:',e)}
    }
    ids.forEach((pid,i)=>{
      let idx=DATA.rows.findIndex(r=>r.id===pid);
      if(idx<0&&names[i])idx=DATA.rows.findIndex(r=>r.producto===names[i]);
      if(idx<0&&names[i])idx=DATA.rows.findIndex(r=>r.producto&&r.producto.toLowerCase()===names[i].toLowerCase());
      console.log('[PROMO] match pid='+pid+' name='+(names[i]||'')+' idx='+idx);
      if(idx>=0)state.promoProducts[String(idx)]=false;
    });
  }else if(promo.tipo==='2x1_categoria'&&promo.categoria){
    DATA.rows.forEach((r,i)=>{if(r.categoria===promo.categoria)state.promoProducts[String(i)]=false});
  }
  console.log('[PROMO] promoProducts:', state.promoProducts);
  const pop=$('pop');if(pop)pop.classList.add('hidden');
  renderCart();renderCartBadge();setView('cart');
}
function normalizarWhatsapp(wa){
  if(!wa)return'';
  let num=String(wa).replace(/\D/g,'');
  if(num.length===10)num='54'+num;
  return num;
}
async function buscarPorWhatsapp(wa){
  if(!wa||!DATA.socioId)return null;
  const {data:id}=await sbRpc('buscar_suscripcion_por_whatsapp',{p_cliente_id:DATA.socioId,p_whatsapp:wa});
  return id||null;
}
let _misPromos=[];
async function mostrarMisPromos(pop,suscId){
  pop.innerHTML='<button id="promoClose" style="position:absolute;top:8px;right:10px;background:transparent;border:0;color:#9ca3af;font-size:22px;font-weight:700;cursor:pointer;line-height:1;padding:4px">✕</button><div class="promo-form"><h4>🎁 Tus promociones</h4><p id="misPromosBox" style="color:#9ca3af;font-size:18px;margin:0 0 8px">Cargando...</p></div>';
  $('promoClose').onclick=()=>{pop.classList.add('hidden')};
  _misPromos=await fetchMisPromos(suscId);
  const box=$('misPromosBox');if(box)box.outerHTML=renderMisPromosHtml(_misPromos);
  document.querySelectorAll('.promoUseBtn').forEach(btn=>{btn.onclick=()=>{const idx=parseInt(btn.dataset.promoIdx);usarPromo(_misPromos[idx])}});
  markPromosSeen(suscId);
}
function renderFormularioSocio(pop){
  pop.innerHTML='<button id="promoClose" style="position:absolute;top:8px;right:10px;background:transparent;border:0;color:#9ca3af;font-size:22px;font-weight:700;cursor:pointer;line-height:1;padding:4px">✕</button><div class="promo-form"><h4>🎁 '+('Hacete socio')+'</h4><p style="color:#9ca3af;font-size:18px;margin:0 0 8px">'+('Completá tus datos y te contactamos')+'</p><input id="promoName" placeholder="Nombre" type="text"><div class="wsp-group"><select id="promoWspCountry"><option value="54" selected>🇦🇷 +54</option><option value="598">🇺🇾 +598</option><option value="56">🇨🇱 +56</option><option value="57">🇨🇴 +57</option><option value="51">🇵🇪 +51</option><option value="55">🇧🇷 +55</option><option value="52">🇲🇽 +52</option><option value="503">🇸🇻 +503</option><option value="504">🇭🇳 +504</option><option value="505">🇳🇮 +505</option><option value="506">🇨🇷 +506</option><option value="507">🇵🇦 +507</option></select><input id="promoWsp" placeholder="3519876543" type="tel"></div><input id="promoIg" placeholder="Instagram (@usuario)" type="text"><button id="promoSend">'+('Enviar')+'</button><button id="yaSocioLink" type="button" style="background:transparent;border:0;color:#9ca3af;text-decoration:underline;font-size:14px;margin-top:10px;cursor:pointer">Ya soy socio</button></div>';
  $('promoClose').onclick=()=>{pop.classList.add('hidden')};
  $('promoSend').onclick=async()=>{const nombre=$('promoName').value.trim();const whatsapp=$('promoWsp').value.trim();const instagram=$('promoIg').value.trim();if(!nombre||!whatsapp){showToast('Nombre y WhatsApp son requeridos');return}const country=$('promoWspCountry').value;let num=whatsapp.replace(/\D/g,'');if(num.length<8){showToast('Ingresá un WhatsApp válido (mínimo 8 dígitos)');return}if(!DATA.socioId||!supabaseClient){showToast('Error: configuracion incompleta');return}if(!num.startsWith(country))num=country+num;const r=await sbInsert('suscripciones',{cliente_id:DATA.socioId,nombre,whatsapp:num,instagram});if(r.error){console.error('suscripciones error:',r.error);showToast('Error al enviar, intenta de nuevo');return}if(r.data&&r.data[0]){const sid=r.data[0].id;setSuscId(sid);try{await sbRpc('asignar_promos_nuevos',{p_cliente_id:DATA.socioId,p_suscripcion_id:sid})}catch(e){console.log('promo auto error:',e)}updatePromoBadge(sid)}pop.innerHTML='<button id="promoClose" style="position:absolute;top:8px;right:10px;background:transparent;border:0;color:#9ca3af;font-size:22px;font-weight:700;cursor:pointer;line-height:1;padding:4px">✕</button><div class="promo-form"><div class="success-msg">✓ ¡Gracias '+escapeHtml(nombre)+'! Bienvenido socio</div><p style="color:#9ca3af;font-size:14px;margin:10px 0 0;text-align:center">Haz click en el botón 🎁 — si tenés una promo, aparece con punto verde</p></div>';$('promoClose').onclick=()=>{pop.classList.add('hidden')};};
  $('yaSocioLink').onclick=()=>{renderYaSocio(pop)};
}
function renderYaSocio(pop){
  pop.innerHTML='<button id="promoClose" style="position:absolute;top:8px;right:10px;background:transparent;border:0;color:#9ca3af;font-size:22px;font-weight:700;cursor:pointer;line-height:1;padding:4px">✕</button><div class="promo-form"><h4>🎁 Ya soy socio</h4><p style="color:#9ca3af;font-size:18px;margin:0 0 8px">Ingresá el WhatsApp con el que te suscribiste</p><input id="yaSocioWsp" placeholder="WhatsApp" type="tel"><button id="yaSocioBuscar">Buscar</button><button id="volverForm" type="button" style="background:transparent;border:0;color:#9ca3af;text-decoration:underline;font-size:14px;margin-top:10px;cursor:pointer">Todavía no soy socio</button></div>';
  $('promoClose').onclick=()=>{pop.classList.add('hidden')};
  $('volverForm').onclick=()=>{renderFormularioSocio(pop)};
  $('yaSocioBuscar').onclick=async()=>{
    const wa=$('yaSocioWsp').value.trim();
    if(!wa){showToast('Ingresá tu WhatsApp');return}
    if(wa.replace(/\D/g,'').length<8){showToast('Ingresá un WhatsApp válido (mínimo 8 dígitos)');return}
    if(!DATA.socioId||!supabaseClient){showToast('Error: configuracion incompleta');return}
    const id=await buscarPorWhatsapp(wa);
    if(!id){showToast('No encontramos ese número. Completá tus datos para suscribirte');renderFormularioSocio(pop);return}
    setSuscId(id);
    await mostrarMisPromos(pop,id);
  };
}
const promoHandler=async()=>{
  const pop=$('pop');
  if(!pop.classList.contains('hidden')){pop.classList.add('hidden');return}
  pop.classList.remove('hidden');
  const suscId=getSuscId();
  if(suscId&&DATA.socioId&&supabaseClient){
    await mostrarMisPromos(pop,suscId);
    return;
  }
  renderFormularioSocio(pop);
};
const pcatBtn=$('promoCategories');if(pcatBtn)pcatBtn.onclick=promoHandler;const ppBtn=$('promoProducts');if(ppBtn)ppBtn.onclick=promoHandler;const cpBtn=$('cartPromo');if(cpBtn)cpBtn.onclick=promoHandler;
$('send').onclick=async()=>{
  if(!estaDentroDeHorarioPedidos()){abrirHorarioPop();return}
  if(state.activePromo&&state.activePromo.codigo){
    // La promo puede haber salido de su día/horario o agotado su cupo mientras el menú estaba abierto.
    const pv=await sbRpc('promo_validar',{p_codigo:state.activePromo.codigo});
    if(pv.data&&pv.data.ok===false){showToast(pv.data.mensaje||'Esa promo ya no está disponible');state.activePromo=null;state.promoProducts={};renderCart();renderCartBadge();return}
  }
  if(mesaNumero===0&&(!(state.customerName||'').trim()||!(state.customerPhone||'').trim())){showToast('Ingresá tu nombre y teléfono');return}
  if(mesaNumero===0||!supabaseClient){
    if(cartItems().length===0&&promoOrderItems().length===0){showToast('Elegí al menos un producto para el pedido');return}
    let waWin=null;try{waWin=window.open('','_blank')}catch(e){}
    if(state.pickupEnabled)state.pickupCode=String(Math.floor(1000+Math.random()*9000));
    if(mesaNumero===0){
      if(!state.codigoPedido)state.codigoPedido=await generarCodigoPedido(0);
      if(supabaseClient&&DATA.socioId)await enviarPedidoDelivery();
    }
    const n=DATA.whatsapp.replace(/\D/g,'');const waUrl='https://wa.me/'+n+'?text='+encodeURIComponent(orderMessage());if(waWin&&!waWin.closed){waWin.location.href=waUrl}else{window.open(waUrl,'_blank')}
    await marcarPromoUsadaYLimpiar();
    state.cart={};state.draftQty={};state.pickupEnabled=false;state.pickupName='';state.pickupCode='';state.codigoPedido='';
    renderCart();renderProducts();renderCartBadge();
  }else{
    $('send').disabled=true;$('send').textContent='Enviando...';
    const ok=await sendSupabaseOrder();
    $('send').disabled=false;
    if(ok){
      showToast('Pedido enviado! Esperá un momento');
      await marcarPromoUsadaYLimpiar();
      state.cart={};state.draftQty={};state.pickupEnabled=false;state.pickupName='';state.pickupCode='';
      await fetchSentItems();
      $('send').textContent='Enviar Pedido';
      renderCart();renderProducts();renderCartBadge();flushPropina();setView('categories')
    }
    else{showToast('Error al enviar. Intentá de nuevo');$('send').textContent='Reintentar'}
  }
};
$('customerAddress').oninput=e=>state.customerAddress=e.target.value;
const customerNameInput=$('customerName');if(customerNameInput)customerNameInput.oninput=e=>state.customerName=e.target.value;
const customerPhoneInput=$('customerPhone');if(customerPhoneInput)customerPhoneInput.oninput=e=>state.customerPhone=e.target.value;
$('deliveryCheck').onclick=()=>{state.deliveryEnabled=!state.deliveryEnabled;if(state.deliveryEnabled)state.pickupEnabled=false;renderCart()};
const pickupCheckBtn=$('pickupCheck');if(pickupCheckBtn)pickupCheckBtn.onclick=()=>{state.pickupEnabled=!state.pickupEnabled;if(state.pickupEnabled)state.deliveryEnabled=false;renderCart()};
// Llamar mozo (campana)
let mozoPollInterval=null;let mozoPollBusy=false;
// Freno de tráfico: mientras el celular del comensal quede con la página
// abierta (pantalla bloqueada, app en segundo plano, o el teléfono
// abandonado en la mesa sin tocar nada), el polling de "pedido enviado" y
// "llamar mozo" seguía pegándole a Supabase cada 3-6s sin parar. Ahora se
// salta el fetch (no el timer, que el navegador ya frena solo en segundo
// plano) si la pestaña está oculta o si pasaron 20 minutos sin ninguna
// interacción del comensal; en cuanto vuelve a tocar la pantalla o la
// pestaña vuelve a primer plano, el polling se reanuda solo en el
// siguiente tick, sin necesidad de recargar la página.
let ultimaActividadComensalTs=Date.now();
['mousedown','keydown','touchstart','scroll'].forEach(function(ev){document.addEventListener(ev,function(){ultimaActividadComensalTs=Date.now()},{passive:true})});
var LIMITE_INACTIVIDAD_POLLING_MS=20*60*1000;
function debePollComensal(){return !document.hidden&&(Date.now()-ultimaActividadComensalTs)<LIMITE_INACTIVIDAD_POLLING_MS}
function setBellActive(){['callMozoTop','callMozoCats','callMozoCart'].forEach(id=>{const el=$(id);if(el)el.classList.add('active')})}
function setBellInactive(){['callMozoTop','callMozoCats','callMozoCart'].forEach(id=>{const el=$(id);if(el)el.classList.remove('active')})}
function startMozoPolling(){if(mozoPollInterval)return;mozoPollInterval=setInterval(async()=>{
  if(mozoPollBusy||!debePollComensal()||!supabaseClient||!DATA.socioId)return;
  mozoPollBusy=true;
  try{const r=await sbSelect('mesas_operacion','cliente_id=eq.'+DATA.socioId+'&numero=eq.'+mesaNumero+'&select=estado');
    if(r.data&&r.data.length>0&&r.data[0].estado!=='Pendiente'){setBellInactive();clearInterval(mozoPollInterval);mozoPollInterval=null}
  }finally{mozoPollBusy=false}
},3000)}
async function callMozoHandler(){
  if(mesaNumero<=0){showToast('Sin mesa asignada');return}
  if(!supabaseClient){showToast('Error: sin conexion a Supabase');return}
  if(!DATA.socioId){showToast('Error: socioId no encontrado');return}
  const url=supabaseClient.url+'/rest/v1/mesas_operacion?cliente_id=eq.'+DATA.socioId+'&numero=eq.'+mesaNumero;
  const headers={...supabaseClient.headers,'Prefer':'return=representation'};
  const r=await fetch(url,{method:'PATCH',headers,body:JSON.stringify({estado:'Pendiente',updated_at:new Date().toISOString()})});
  if(!r.ok){const err=await r.text();showToast('Error al llamar mozo: '+err);console.error('callMozo PATCH error:',err);return}
  setBellActive();startMozoPolling();showToast('🔔 ¡Mozo llamado! Esperá un momento')
}
const cmBtn=$('callMozoTop');if(cmBtn)cmBtn.onclick=callMozoHandler;const cmcBtn=$('callMozoCats');if(cmcBtn)cmcBtn.onclick=callMozoHandler;const cmcrBtn=$('callMozoCart');if(cmcrBtn)cmcrBtn.onclick=callMozoHandler;
$('exitTop').onclick=()=>{setView('cover')};$('exitMenuCats').onclick=()=>{setView('cover')};const exitCartBtn=$('exitCart');if(exitCartBtn)exitCartBtn.onclick=()=>{setView('cover')};
renderCover();renderCategories();renderCartBadge();renderTopIcons();applyCompactTopTransforms();if(mesaNumero>0){const mb=$('mesaBadge');if(mb){mb.textContent='Mesa '+mesaNumero;mb.style.display='none'}};['promoCategories','promoProducts','cartPromo'].forEach((id,index)=>{const el=$(id);if(!el||!DATA.promoIcon)return;const dot=el.querySelector('.promoDot');el.innerHTML='<img src="'+DATA.promoIcon+'" alt="">';if(dot)el.appendChild(dot);else{const d=document.createElement('span');d.className='promoDot';d.id='promoDot'+index;el.appendChild(d)}});
renderLogoButtonContent($('logoInfoCategories'));renderLogoButtonContent($('logoInfoProducts'));renderLogoButtonContent($('logoInfoCart'));
// Check initial mesa state for bell color
if(mesaNumero>0&&supabaseClient&&DATA.socioId){sbSelect('mesas_operacion','cliente_id=eq.'+DATA.socioId+'&numero=eq.'+mesaNumero+'&select=estado').then(r=>{if(r.data&&r.data.length>0&&r.data[0].estado==='Pendiente'){setBellActive();startMozoPolling()}})}
// Pedido ya enviado (no pagado): se trae al abrir el menú y se refresca
// cada tanto para que, si el cajero cobra o cierra la mesa, desaparezca
// solo de la vista "Mi pedido".
if(supabaseClient&&DATA.socioId){
  fetchSentItems().then(()=>{if(state.screen==='cart')renderCart()});
  setInterval(()=>{if(!debePollComensal())return;fetchSentItems(false).then(()=>{if(state.screen==='cart')renderCart()})},6000);
}
// Mesa 1+ = pedidos van directo a la mesa, sin delivery/retiro (ese flujo es solo para Mesa 0)
if(mesaNumero>0){const ds=$('deliverySection');if(ds)ds.style.display='none';const dr=$('delRow');if(dr)dr.style.display='none'}
setupPropina();
// Mesa 0 = pedidos por WhatsApp, sin llamada al mozo: ocultar campanas
if(mesaNumero<=0){['callMozoTop','callMozoCats','callMozoCart'].forEach(id=>{const el=$(id);if(el)el.style.display='none'})}
if(mesaNumero===0){const pr=$('pickupRow');if(pr)pr.style.display='flex'}
// Check promo badge for returning subscribers
const _initSuscId=getSuscId();if(_initSuscId)updatePromoBadge(_initSuscId);
// Fix: evitar que deslizar hacia abajo haga bounce/pull-to-refresh y vuelva a cover (mesa 0 y todas)
let pullStartY=0;
document.addEventListener('touchstart',e=>{pullStartY=e.touches[0].clientY},{passive:true});
document.addEventListener('touchmove',e=>{
  if(state.screen==='cover') return;
  const scrollers=[$('prodList'),$('catList'),$('cartBody')].filter(Boolean);
  const active=scrollers.find(el=>el.offsetParent!==null);
  if(!active) return;
  // Si el contenido no alcanza a desbordar (todo entra en la pantalla, o
  // desborda por menos de 2px por redondeo de subpíxeles), no hay nada que
  // scrollear: no bloquear el touch, porque si no "atTop" y "atBottom" dan
  // true al mismo tiempo y se termina bloqueando el deslizamiento en
  // cualquier dirección (pantalla "tildada").
  const puedeScrollear=active.scrollHeight - active.clientHeight > 2;
  if(!puedeScrollear) return;
  const deltaY=e.touches[0].clientY - pullStartY;
  const atTop=active.scrollTop<=0;
  const atBottom=active.scrollTop + active.clientHeight >= active.scrollHeight - 1;
  if((atTop && deltaY>0) || (atBottom && deltaY<0)){
    e.preventDefault();
  }
},{passive:false});
document.body.addEventListener('touchmove',e=>{
  if(state.screen!=='cover' && !(e.target.closest && (e.target.closest('#prodList')||e.target.closest('#catList')||e.target.closest('#cartBody')))){
    e.preventDefault();
  }
},{passive:false});
</script>
</body>
</html>`

    return { html, filename: (slugify(state.clientName) || 'menuqr') + '.html' }
  }
}))
