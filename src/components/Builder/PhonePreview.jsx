import { useBuilderState } from './useBuilderState'

const CANVAS_W = 1080
const CANVAS_H = 1920

function pctX(x) { return (Number(x || 0) / CANVAS_W * 100) + '%' }
function pctY(y) { return (Number(y || 0) / CANVAS_H * 100) + '%' }

function hexAlpha(hex, a) {
  const h = String(hex).replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16)
  if (!Number.isFinite(n)) return hex
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}

function money(n) { return '$' + Number(n || 0).toLocaleString('es-AR', { maximumFractionDigits: 2 }) }
function price(v) { const n = parseFloat(String(v || '').replace(',', '.')); return Number.isFinite(n) ? n : 0 }
function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim() }
function slug(s) { return norm(s).replace(/[^a-z0-9]/g, '') }

export default function PhonePreview() {
  const state = useBuilderState()

  const topIconStyle = (key) => {
    const defaults = { back: 20, logo: 420, promo: 560, bell: 700, mesa: 760, cart: 820, exit: 900 }
    const t = state.topTransforms?.[key] || {}
    const dx = Math.max(-8, Math.min(8, (Number(t.x ?? defaults[key]) - defaults[key]) / 20))
    const dy = Math.max(-6, Math.min(6, Number(t.y || 0) / 10))
    return { position: 'relative', inset: 'auto', transform: `translate(${dx}px, ${dy}px)`, flex: '0 1 auto', minWidth: 0 }
  }

  const topIconImageStyle = (key) => {
    const zoom = Math.max(0.25, Math.min(1.25, Number(state.topTransforms?.[key]?.scale || 1)))
    const size = Math.round(32 * zoom)
    return { width: size, height: size, maxWidth: 40, maxHeight: 40, borderRadius: 6, objectFit: 'cover' }
  }

  const categories = state.categories()
  const cartItems = Object.entries(state.cart)
    .filter(([, q]) => q > 0)
    .map(([i, q]) => ({ ...state.rows[i], idx: i, qty: q }))
  const cartTotal = cartItems.reduce((s, i) => s + price(i.precio) * i.qty, 0)
  const deliveryCost = state.deliveryEnabled ? price(state.delivery) : 0

  const bgImage = state.screen === 'cover'
    ? state.coverBg
    : state.screen === 'categories'
      ? (state.categoriesBg || state.coverBg)
      : state.screen === 'products'
        ? (state.productsBg || state.categoriesBg || state.coverBg)
        : (state.cartBg || state.productsBg || state.categoriesBg || state.coverBg)

  const blurVal = state.screen === 'cover'
    ? state.blur
    : state.screen === 'categories'
      ? (state.categoriesBlur || state.blur)
      : state.screen === 'products'
        ? (state.productsBlur || state.blur)
        : (state.cartBlur || state.blur)

  const bgStyle = bgImage
    ? { backgroundImage: `url(${bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', filter: `blur(${(blurVal / 100) * 18}px)` }
    : { background: 'linear-gradient(160deg, #1b2027, #0b0d10)' }

  const shadeBg = state.screen === 'cover' ? 'rgba(0,0,0,.1)' : 'rgba(0,0,0,.45)'

  // El lienzo se muestra a su tamaño real (1080x1920, formato 9:16), sin
  // achicar. Son las mismas coordenadas que usa el HTML final, así que
  // íconos, botones y ubicaciones quedan igual que en el QR menú final
  // (Mesa 0 y Mesa 1+); si no entra completo en la pantalla, hace scroll.
  return (
    <div className="flex flex-col items-center">
      <div className="text-xs text-dark-400 mb-2">📱 Vista previa 1:1 · 9:16</div>
      <div
        className="relative overflow-auto border-2 border-dark-600 bg-black shadow-2xl max-w-full"
        style={{ width: CANVAS_W, maxHeight: 'calc(100vh - 220px)', borderRadius: 16 }}
      >
        <div
          style={{
            width: CANVAS_W,
            height: CANVAS_H,
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          {/* Background */}
          <div style={{ position: 'absolute', inset: 0, ...bgStyle }}></div>
          <div style={{ position: 'absolute', inset: 0, background: shadeBg }}></div>

          {/* COVER VIEW */}
          {state.screen === 'cover' && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 2 }}>
              {/* Welcome text */}
              {state.welcomeText && (
                <div
                  style={{
                    position: 'absolute',
                    transformOrigin: 'top left',
                    whiteSpace: 'nowrap',
                    borderRadius: 999,
                    padding: '8px 14px',
                    fontWeight: 800,
                    textShadow: '0 2px 8px #000',
                    color: state.welcomeColor,
                    background: !state.welcomeBgNone ? state.welcomeBg + '99' : 'transparent',
                    fontSize: state.welcomeSize + 'px',
                    left: pctX(state.welcomeTransform.x),
                    top: pctY(state.welcomeTransform.y),
                    transform: `rotate(${state.welcomeTransform.rotation || 0}deg) scale(${state.welcomeTransform.scale || 1})`
                  }}
                >
                  {state.welcomeText}
                </div>
              )}
              {/* Logo */}
              {state.logo && (() => {
                const lt = state.logoTransform || { x: 280, y: 670, scale: 1, rotation: 0 }
                return (
                  <img
                    style={{
                      position: 'absolute',
                      width: '48.3871%',
                      maxHeight: '38%',
                      transformOrigin: 'top left',
                      objectFit: 'contain',
                      filter: 'drop-shadow(0 10px 20px rgba(0,0,0,.55))',
                      left: pctX(lt.x),
                      top: pctY(lt.y),
                      transform: `rotate(${lt.rotation || 0}deg) scale(${lt.scale || 1})`
                    }}
                    src={state.logo}
                    alt="logo"
                  />
                )
              })()}
              {/* Button */}
              <button
                style={{
                  position: 'absolute',
                  width: (state.buttonWidth || 82) + '%',
                  transformOrigin: 'top left',
                  borderRadius: 16,
                  padding: (state.buttonPadding || 15) + 'px',
                  border: '1.5px solid ' + (state.buttonBorder || '#2f6fed'),
                  background: hexAlpha(state.buttonBg || '#008080', 0.3),
                  color: state.buttonColor || '#fff',
                  fontWeight: 900,
                  fontSize: (state.buttonFontSize || 14) + 'px',
                  letterSpacing: '.08em',
                  backdropFilter: 'blur(6px)',
                  cursor: 'pointer',
                  left: pctX(state.buttonTransform.x),
                  top: pctY(state.buttonTransform.y),
                  transform: `rotate(${state.buttonTransform.rotation || 0}deg) scale(${state.buttonTransform.scale || 1})`
                }}
              >
                {state.buttonText || 'VER MENÚ'}
              </button>
            </div>
          )}

          {/* CATEGORIES VIEW */}
          {state.screen === 'categories' && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 2, display: 'flex', flexDirection: 'column' }}>
              {/* Misma barra compacta que la pantalla Productos */}
              <div style={{ position: 'sticky', top: 0, zIndex: 8, minHeight: 94, padding: '6px 12px', background: '#000', display: 'grid', gridTemplateColumns: 'minmax(44px, 1fr) auto', gridTemplateRows: '28px 54px', alignItems: 'center', gap: '0 6px', overflow: 'hidden' }}>
                <div style={{ display: 'contents' }}>
                  <h3 style={{ gridColumn: '1 / -1', gridRow: 1, padding: 0, margin: 0, fontSize: 15, lineHeight: 1.15, textShadow: '0 3px 10px rgba(0,0,0,.85)', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Categorías</h3>
                  <button style={{ ...topIconStyle('back'), gridColumn: 1, gridRow: 2, justifySelf: 'start', border: 0, background: 'transparent', color: 'white', width: 54, height: 54, fontSize: 42, fontWeight: 900, lineHeight: 1 }}>←</button>
                </div>
                <div style={{ gridColumn: 2, gridRow: 2, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, overflow: 'hidden' }}>
                  <button style={{ ...topIconStyle('logo'), width: 40, height: 40, border: 0, background: 'transparent', color: '#fff' }}>{(state.logoBar || state.logo) ? <img style={topIconImageStyle('logo')} src={state.logoBar || state.logo} alt="Información" /> : 'ℹ️'}</button>
                  <button style={{ ...topIconStyle('promo'), width: 40, height: 40, border: 0, background: 'transparent', color: '#fff' }}>{state.promoIcon ? <img style={topIconImageStyle('promo')} src={state.promoIcon} alt="Promoción" /> : '🎁'}</button>
                  {state.forceSupabaseOrders && <button style={{ ...topIconStyle('bell'), width: 44, height: 44, borderRadius: '50%', border: '2px solid #f59e0b', background: 'rgba(245,158,11,.15)', color: '#f59e0b', fontSize: 24 }}>🔔</button>}
                  {state.forceSupabaseOrders && <span style={{ ...topIconStyle('mesa'), minWidth: 44, height: 34, padding: '0 5px', borderRadius: 8, background: '#2f6fed', color: '#fff', fontSize: 11, fontWeight: 800, display: 'grid', placeItems: 'center', whiteSpace: 'nowrap' }}>Mesa 1</span>}
                  <button style={{ ...topIconStyle('cart'), width: 40, height: 40, border: 0, background: 'transparent', color: '#fff', fontSize: 24 }}>🛒<span style={{ position: 'absolute', top: -4, right: -4, background: cartItems.length > 0 ? '#22c55e' : '#f59e0b', color: '#fff', fontSize: 12, fontWeight: 700, minWidth: 18, height: 18, borderRadius: 9, display: 'grid', placeItems: 'center', padding: '0 3px' }}>{cartItems.reduce((sum, item) => sum + item.qty, 0)}</span></button>
                  <button style={{ ...topIconStyle('exit'), height: 40, border: 0, background: 'transparent', color: '#fff', padding: '0 4px', borderRadius: 10, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>✕ Salir</button>
                </div>
              </div>
              {/* Controles antiguos conservados ocultos para no alterar la configuración guardada */}
              <div style={{ display: 'none' }}>
                {/* Marco que abarca todos los iconos superiores */}
                {(() => {
                  const ft = state.topTransforms?.frame || { x: 8, y: 20, scale: 1, rotation: 0 }
                  return (
                    <div
                      style={{
                        position: 'absolute',
                        left: ft.x,
                        top: ft.y,
                        width: 1064 * ft.scale,
                        height: 72 * ft.scale,
                        border: state.topBarFrameBorderTransparent ? 'none' : `1px solid ${state.topBarFrameBorderColor || 'rgba(156,163,175,0.55)'}`,
                        borderRadius: 14 * ft.scale,
                        background: state.topBarFrameBgTransparent ? 'transparent' : (state.topBarFrameBgColor || 'transparent'),
                        zIndex: 2,
                        pointerEvents: 'none',
                        transform: `rotate(${ft.rotation || 0}deg)`,
                        transformOrigin: 'top left'
                      }}
                    />
                  )
                })()}
                {/* Back arrow */}
                <div
                  style={{
                    position: 'absolute',
                    transformOrigin: 'top left',
                    zIndex: 3,
                    left: pctX(state.topTransforms.back?.x || 30),
                    top: pctY(state.topTransforms.back?.y || 40),
                    transform: `rotate(${state.topTransforms.back?.rotation || 0}deg) scale(${state.topTransforms.back?.scale || 1})`
                  }}
                >
                  <button style={{ width: 48, height: 48, border: 0, background: 'transparent', color: 'white', display: 'grid', placeItems: 'center', fontSize: 38, fontWeight: 900, lineHeight: 1, filter: 'drop-shadow(0 5px 12px rgba(0,0,0,.8))' }}>←</button>
                </div>

                {/* Promo */}
                <div
                  style={{
                    position: 'absolute',
                    transformOrigin: 'top left',
                    zIndex: 3,
                    left: pctX(state.topTransforms.promo?.x || 620),
                    top: pctY(state.topTransforms.promo?.y || 40),
                    transform: `rotate(${state.topTransforms.promo?.rotation || 0}deg) scale(${state.topTransforms.promo?.scale || 1})`
                  }}
                >
                  {state.promoIcon ? <img style={{ width: 48, height: 48, borderRadius: 10 }} src={state.promoIcon} alt="Promo" /> : <button style={{ width: 48, height: 48, border: 0, background: 'transparent', color: 'white', display: 'grid', placeItems: 'center', fontSize: 38, fontWeight: 900, filter: 'drop-shadow(0 5px 12px rgba(0,0,0,.8))' }}>🎁</button>}
                </div>
                {/* Info (logo -> horario / whatsapp / instagram / ubicacion) */}
                <div
                  style={{
                    position: 'absolute',
                    transformOrigin: 'top left',
                    zIndex: 3,
                    left: pctX(state.topTransforms.logo?.x || 770),
                    top: pctY(state.topTransforms.logo?.y || 40),
                    transform: `rotate(${state.topTransforms.logo?.rotation || 0}deg) scale(${state.topTransforms.logo?.scale || 1})`
                  }}
                >
                  {(state.logoBar || state.logo) ? <img style={{ width: 48, height: 48, borderRadius: 10, objectFit: 'cover' }} src={state.logoBar || state.logo} alt="Info" /> : <button style={{ width: 48, height: 48, border: 0, background: 'transparent', color: 'white', display: 'grid', placeItems: 'center', fontSize: 38, fontWeight: 900, filter: 'drop-shadow(0 5px 12px rgba(0,0,0,.8))' }}>ℹ️</button>}
                </div>
                {/* Bell - llamar mozo (solo Socio Builder) */}
                {state.forceSupabaseOrders && (
                  <div
                    style={{
                      position: 'absolute',
                      transformOrigin: 'top left',
                      zIndex: 3,
                      left: pctX(state.topTransforms.bell?.x || 1020),
                      top: pctY(state.topTransforms.bell?.y || 40),
                      transform: `rotate(${state.topTransforms.bell?.rotation || 0}deg) scale(${state.topTransforms.bell?.scale || 1})`
                    }}
                  >
                    <button style={{ width: 48, height: 48, border: '2px solid #f59e0b', borderRadius: '50%', background: 'rgba(245,158,11,.15)', color: '#f59e0b', display: 'grid', placeItems: 'center', fontSize: 28, cursor: 'pointer', filter: 'drop-shadow(0 5px 12px rgba(0,0,0,.8))' }}>🔔</button>
                  </div>
                )}
                {/* Exit */}
                <div
                  style={{
                    position: 'absolute',
                    transformOrigin: 'top left',
                    zIndex: 3,
                    left: pctX(state.topTransforms.exit?.x || 1100),
                    top: pctY(state.topTransforms.exit?.y || 40),
                    transform: `rotate(${state.topTransforms.exit?.rotation || 0}deg) scale(${state.topTransforms.exit?.scale || 1})`
                  }}
                >
                  <button style={{ background: 'transparent', border: 0, color: '#fff', padding: '10px 16px', borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer', filter: 'drop-shadow(0 5px 12px rgba(0,0,0,.8))' }}>✕ Salir</button>
                </div>
              </div>
              {/* Category grid / Anillo */}
              {state.categoriesLayout === 'anillo' && categories.length > 0 ? (
                <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                  {(() => {
                    const N = categories.length
                    const cyc = N >= 5
                    const STEP = cyc ? 360 / N : 34
                    const R = 120, S = 150, tilt = 40
                    return categories.map(([cat], i) => {
                      const a = (i * STEP) * Math.PI / 180
                      const t = (Math.cos(a) + 1) / 2
                      const x = Math.sin(a) * R
                      const y = tilt * (t - 0.65)
                      const sc = 0.48 + 0.52 * Math.pow(t, 1.25)
                      const img = state.findCategoryImage(cat)
                      return (
                        <div
                          key={cat}
                          style={{ position: 'absolute', left: '50%', top: '38%', width: S, height: S, marginLeft: -S / 2, marginTop: -S / 2, transform: `translate3d(${x}px, ${y}px, 0) scale(${sc})`, opacity: 0.28 + 0.72 * Math.pow(t, 1.4), zIndex: Math.round(t * 100) }}
                        >
                          {img
                            ? <img style={{ width: '100%', height: '100%', objectFit: 'contain', filter: 'drop-shadow(0 12px 14px rgba(0,0,0,.6))' }} src={img} alt="" />
                            : <span style={{ fontSize: 72, display: 'grid', placeItems: 'center', height: '100%' }}>🍽️</span>}
                        </div>
                      )
                    })
                  })()}
                  <div style={{ position: 'absolute', left: 0, right: 0, bottom: 14, textAlign: 'center', padding: '0 12px' }}>
                    <div style={{ color: '#fff', fontSize: 20, fontWeight: 800, textShadow: '0 3px 12px rgba(0,0,0,.9)' }}>{categories[0][0]}</div>
                    <div style={{ color: 'rgba(255,255,255,.7)', fontSize: 10, marginTop: 6 }}>Anillo: el cliente desliza para girar y toca la del centro para entrar</div>
                  </div>
                </div>
              ) : (
              <div style={{ flex: 1, overflow: 'auto', padding: '0 14px 20px', position: 'relative', overscrollBehavior: 'contain', touchAction: 'pan-y', WebkitOverflowScrolling: 'touch' }}>
                {categories.map(([cat, count], idx) => {
                  const img = state.findCategoryImage(cat)
                  const t = state.getCategoryTransform(cat, idx)
                  return (
                    <div
                      key={cat}
                      style={{
                        position: 'absolute',
                        cursor: 'pointer',
                        textAlign: 'center',
                        left: pctX(t.x),
                        top: pctY(t.y),
                        transform: `rotate(${t.rotation || 0}deg) scale(${t.scale || 1})`,
                        transformOrigin: 'top left'
                      }}
                    >
                      <div style={{ width: 96, height: 96, overflow: 'hidden', display: 'grid', placeItems: 'center', margin: '0 auto 4px' }}>
                        {img ? <img style={{ width: '100%', height: '100%', objectFit: 'cover' }} src={img} alt="" /> : <span style={{ fontSize: 48 }}>🍽️</span>}
                      </div>
                      <b style={{ color: '#fff', fontSize: 11, display: 'block', maxWidth: 96, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat}</b>
                    </div>
                  )
                })}
              </div>
              )}
            </div>
          )}

          {/* PRODUCTS VIEW */}
          {state.screen === 'products' && (() => {
            const activeCategory = state.selectedCategory || (categories.length > 0 ? categories[0][0] : '')
            const filteredProducts = state.rows.filter(r => (r.categoria || 'Sin categoría') === activeCategory)
            const cartCount = cartItems.reduce((s, i) => s + i.qty, 0)
            return (
              <div style={{ position: 'absolute', inset: 0, zIndex: 2, display: 'flex', flexDirection: 'column' }}>
                {/* Top bar */}
                <div style={{ position: 'sticky', top: 0, zIndex: 8, minHeight: 94, padding: '6px 12px', background: '#000', display: 'grid', gridTemplateColumns: 'minmax(44px, 1fr) auto', gridTemplateRows: '28px 54px', alignItems: 'center', gap: '0 6px', overflow: 'hidden' }}>
                  <div style={{ display: 'contents' }}>
                    <h3 style={{ gridColumn: '1 / -1', gridRow: 1, padding: 0, margin: 0, fontSize: 15, lineHeight: 1.15, textShadow: '0 3px 10px rgba(0,0,0,.85)', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeCategory || 'Productos'}</h3>
                    <button style={{ ...topIconStyle('back'), gridColumn: 1, gridRow: 2, justifySelf: 'start', border: 0, background: 'transparent', color: 'white', width: 54, height: 54, fontSize: 42, fontWeight: 900, lineHeight: 1 }}>←</button>
                  </div>
                  {/* Actions: promo | bell | cart | exit (alineados con el titulo) */}
                  <div style={{ gridColumn: 2, gridRow: 2, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, overflow: 'hidden' }}>
                    <button style={{ ...topIconStyle('logo'), width: 40, height: 40, borderRadius: 10, border: 0, background: 'transparent', color: '#fff', display: 'grid', placeItems: 'center' }}>{(state.logoBar || state.logo) ? <img style={topIconImageStyle('logo')} src={state.logoBar || state.logo} alt="info" /> : 'ℹ️'}</button>
                    <button style={{ ...topIconStyle('promo'), width: 40, height: 40, borderRadius: 10, border: 0, background: 'transparent', color: '#fff', fontSize: 20, display: 'grid', placeItems: 'center' }}>{state.promoIcon ? <img style={topIconImageStyle('promo')} src={state.promoIcon} alt="promo" /> : '🎁'}</button>
                    {state.forceSupabaseOrders && <button style={{ ...topIconStyle('bell'), width: 44, height: 44, borderRadius: '50%', border: '2px solid #f59e0b', background: 'rgba(245,158,11,.15)', color: '#f59e0b', fontSize: 24, cursor: 'pointer', display: 'grid', placeItems: 'center' }}>🔔</button>}
                    {state.forceSupabaseOrders && <span style={{ ...topIconStyle('mesa'), minWidth: 44, height: 34, padding: '0 5px', borderRadius: 8, background: '#2f6fed', color: '#fff', fontSize: 11, fontWeight: 800, display: 'grid', placeItems: 'center', whiteSpace: 'nowrap' }}>Mesa 1</span>}
                    <button style={{ ...topIconStyle('cart'), width: 40, height: 40, borderRadius: 10, border: 0, background: 'transparent', color: '#fff', fontSize: 24, cursor: 'pointer', display: 'grid', placeItems: 'center', filter: 'drop-shadow(0 2px 6px rgba(0,0,0,.7))' }}>🛒<span style={{ position: 'absolute', top: -4, right: -4, background: cartCount > 0 ? '#22c55e' : '#f59e0b', color: '#fff', fontSize: 12, fontWeight: 700, minWidth: 18, height: 18, borderRadius: 9, display: 'grid', placeItems: 'center', padding: '0 3px' }}>{cartCount}</span></button>
                    <button style={{ ...topIconStyle('exit'), height: 40, border: 0, background: 'transparent', color: '#fff', padding: '0 4px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>✕ Salir</button>
                  </div>
                </div>
                {/* Product list */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '0 10px 40px', overscrollBehavior: 'contain', touchAction: 'pan-y', WebkitOverflowScrolling: 'touch' }}>
                  {filteredProducts.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#6b7280', fontSize: 14, padding: '40px 0' }}>Sin productos</div>
                  ) : filteredProducts.map((r, i) => {
                    const realIdx = state.rows.indexOf(r)
                    const img = state.findProductImage(r, realIdx)
                    const q = state.draftQty[realIdx] || 0
                    const inCart = Number(state.cart[realIdx] || 0) > 0
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'stretch', gap: 0, padding: 0, background: 'rgba(31,41,55,.7)', borderRadius: 16, marginBottom: 8, border: '1px solid rgba(55,65,81,.5)', overflow: 'hidden', minHeight: 110 }}>
                        {img ? <img style={{ width: 110, height: 110, minHeight: 110, borderRadius: 12, objectFit: 'cover', flexShrink: 0, alignSelf: 'stretch' }} src={img} alt="" /> : <div style={{ width: 110, height: 110, minHeight: 110, borderRadius: 12, background: '#1f2937', display: 'grid', placeItems: 'center', fontSize: 34, flexShrink: 0, alignSelf: 'stretch' }}>🍽️</div>}
                        <div style={{ flex: 1, minWidth: 0, padding: '10px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                          <h4 style={{ margin: 0, color: '#fff', fontSize: 14, lineHeight: 1.3 }}>{r.producto}</h4>
                          {r.detalle && r.detalle.trim() && (
                            <p style={{ margin: '2px 0 0', color: '#9ca3af', fontSize: 11, lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{r.detalle}</p>
                          )}
                          <div style={{ color: '#5fd8c4', fontWeight: 700, fontSize: 14, marginTop: 2 }}>{money(price(r.precio))}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, paddingRight: 12, alignSelf: 'center' }}>
                          <button onClick={() => { const s = useBuilderState.getState(); s.draftQty[realIdx] = Math.max(0, (s.draftQty[realIdx] || 0) - 1); useBuilderState.setState({ draftQty: { ...s.draftQty } }) }} style={{ width: 32, height: 32, borderRadius: 8, border: 0, background: '#166534', color: '#fff', fontSize: 18, cursor: 'pointer', display: 'grid', placeItems: 'center' }}>−</button>
                          <span style={{ minWidth: 24, textAlign: 'center', fontWeight: 700, color: '#fff', fontSize: 16 }}>{q}</span>
                          <button onClick={() => { const s = useBuilderState.getState(); s.draftQty[realIdx] = (s.draftQty[realIdx] || 0) + 1; useBuilderState.setState({ draftQty: { ...s.draftQty } }) }} style={{ width: 32, height: 32, borderRadius: 8, border: 0, background: '#166534', color: '#fff', fontSize: 18, cursor: 'pointer', display: 'grid', placeItems: 'center' }}>+</button>
                          <button onClick={() => { const s = useBuilderState.getState(); const qty = s.draftQty[realIdx] || 1; if (s.cart[realIdx]) { const nc = { ...s.cart }; delete nc[realIdx]; const nd = { ...s.draftQty }; delete nd[realIdx]; useBuilderState.setState({ cart: nc, draftQty: nd }) } else { useBuilderState.setState({ cart: { ...s.cart, [realIdx]: qty }, draftQty: { ...s.draftQty } }) } }} style={{ width: 36, height: 36, borderRadius: 8, border: inCart ? 0 : '2.5px solid #3b82f6', background: inCart ? '#22c55e' : 'transparent', color: '#fff', display: 'grid', placeItems: 'center', padding: 0, cursor: 'pointer' }}>
                            <span style={{ fontSize: 20, lineHeight: 1 }}>{inCart ? '✓' : ''}</span>
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}

          {false && state.screen !== 'cover' && state.forceSupabaseOrders && (() => {
            const mt = state.topTransforms?.mesa || { x: 30, y: 100, scale: 1, rotation: 0 }
            return <div style={{ position: 'absolute', zIndex: 12, left: mt.x, top: mt.y, transformOrigin: 'top left', transform: `rotate(${mt.rotation || 0}deg) scale(${mt.scale || 1})`, background: 'rgba(0,0,0,.82)', border: '1px solid rgba(255,255,255,.25)', borderRadius: 999, padding: '6px 12px', color: '#fff', fontSize: 13, fontWeight: 700 }}>Mesa 1</div>
          })()}

          {/* CART VIEW */}
          {state.screen === 'cart' && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 2, display: 'flex', flexDirection: 'column' }}>
              <div style={{ position: 'sticky', top: 0, zIndex: 8, minHeight: 94, padding: '6px 12px', background: '#000', display: 'grid', gridTemplateColumns: 'minmax(44px, 1fr) auto', gridTemplateRows: '28px 54px', alignItems: 'center', gap: '0 6px', overflow: 'hidden' }}>
                <div style={{ display: 'contents' }}>
                  <h3 style={{ gridColumn: '1 / -1', gridRow: 1, padding: 0, margin: 0, fontSize: 15, lineHeight: 1.15, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Mi pedido</h3>
                  <button style={{ ...topIconStyle('back'), gridColumn: 1, gridRow: 2, justifySelf: 'start', border: 0, background: 'transparent', color: 'white', width: 54, height: 54, fontSize: 42, fontWeight: 900, lineHeight: 1 }}>←</button>
                </div>
                <div style={{ gridColumn: 2, gridRow: 2, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, overflow: 'hidden' }}>
                  <button style={{ ...topIconStyle('logo'), width: 40, height: 40, border: 0, background: 'transparent', color: '#fff' }}>{(state.logoBar || state.logo) ? <img style={topIconImageStyle('logo')} src={state.logoBar || state.logo} alt="Información" /> : 'ℹ️'}</button>
                  <button style={{ ...topIconStyle('promo'), width: 40, height: 40, border: 0, background: 'transparent', color: '#fff' }}>{state.promoIcon ? <img style={topIconImageStyle('promo')} src={state.promoIcon} alt="Promoción" /> : '🎁'}</button>
                  {state.forceSupabaseOrders && <button style={{ ...topIconStyle('bell'), width: 44, height: 44, borderRadius: '50%', border: '2px solid #f59e0b', background: 'rgba(245,158,11,.15)', color: '#f59e0b', fontSize: 24 }}>🔔</button>}
                  {state.forceSupabaseOrders && <span style={{ ...topIconStyle('mesa'), minWidth: 44, height: 34, padding: '0 5px', borderRadius: 8, background: '#2f6fed', color: '#fff', fontSize: 11, fontWeight: 800, display: 'grid', placeItems: 'center', whiteSpace: 'nowrap' }}>Mesa 1</span>}
                  <button style={{ ...topIconStyle('cart'), width: 40, height: 40, border: 0, background: 'transparent', color: '#fff', fontSize: 24 }}>🛒<span style={{ position: 'absolute', top: -4, right: -4, background: cartItems.length > 0 ? '#22c55e' : '#f59e0b', color: '#fff', fontSize: 12, fontWeight: 700, minWidth: 18, height: 18, borderRadius: 9, display: 'grid', placeItems: 'center', padding: '0 3px' }}>{cartItems.reduce((sum, item) => sum + item.qty, 0)}</span></button>
                  <button style={{ ...topIconStyle('exit'), height: 40, border: 0, background: 'transparent', color: '#fff', padding: '0 4px', borderRadius: 10, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>✕ Salir</button>
                </div>
              </div>
              <div style={{ flex: 1, overflow: 'auto', padding: 14 }}>
                {cartItems.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#6b7280', fontSize: 14, padding: '40px 0' }}>Carrito vacío</div>
                ) : cartItems.map((item) => (
                  <div key={item.idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, background: 'rgba(31,41,55,.7)', borderRadius: 12, marginBottom: 8 }}>
                    <span style={{ color: '#fff', fontSize: 14, lineHeight: 1.5 }}>{item.qty} x {item.producto}<br /><b style={{ color: '#5fd8c4' }}>{money(price(item.precio) * item.qty)}</b></span>
                    <button style={{ background: 'rgba(239,68,68,.2)', color: '#ef4444', border: 0, padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12 }}>Quitar</button>
                  </div>
                ))}
              </div>
              <div style={{ padding: 14, borderTop: '1px solid #374151' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', margin: '6px 0', color: '#9ca3af', fontSize: 14 }}>
                  <span>Subtotal</span><b style={{ color: '#fff' }}>{money(cartTotal)}</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', margin: '6px 0', color: '#9ca3af', fontSize: 14 }}>
                  <span>Delivery</span><b style={{ color: '#fff' }}>{money(deliveryCost)}</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', margin: '6px 0', color: '#9ca3af', fontSize: 14 }}>
                  <span>Total</span><b style={{ color: '#fff' }}>{money(cartTotal + deliveryCost)}</b>
                </div>
                <button style={{ width: 'calc(100% - 28px)', margin: 14, border: 0, borderRadius: 16, padding: 16, background: '#008080', color: '#fff', fontWeight: 900, fontSize: 15, cursor: 'pointer' }}>
                  Enviar Pedido
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
