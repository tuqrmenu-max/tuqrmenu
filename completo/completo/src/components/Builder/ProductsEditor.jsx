import { useBuilderState } from './useBuilderState'
import { useI18n } from '@/lib/i18n'

function money(n) { return '$' + Number(n || 0).toLocaleString('es-AR', { maximumFractionDigits: 2 }) }
function price(v) { const n = parseFloat(String(v || '').replace(',', '.')); return Number.isFinite(n) ? n : 0 }

export default function ProductsEditor({ showDelivery = true }) {
  const state = useBuilderState()
  const { t } = useI18n()

  const categories = state.categories()
  const cartItems = Object.entries(state.cart)
    .filter(([, q]) => q > 0)
    .map(([i, q]) => ({ ...state.rows[i], idx: i, qty: q }))
  const cartTotal = cartItems.reduce((s, i) => s + price(i.precio) * i.qty, 0)
  const deliveryCost = state.deliveryEnabled ? price(state.delivery) : 0

  const handleBulkProductImages = async (files) => {
    for (const file of files) {
      const dataUrl = await state.normalizeSquareImage(file, 300)
      const key = file.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')
      state.setProductImage(key, dataUrl)
      // Also try to match by product index
      const idx = state.rows.findIndex(r => {
        const pName = (r.producto || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')
        return pName === key || key.includes(pName) || pName.includes(key)
      })
      if (idx >= 0) {
        state.setProductImage('__row_' + idx, dataUrl)
        state.syncProductImageToDB(state.rows[idx].producto, dataUrl)
      }
    }
  }

  const addToCart = (idx) => {
    const newCart = { ...state.cart }
    if (newCart[idx]) {
      delete newCart[idx]
    } else {
      newCart[idx] = 1
    }
    state.setCart(newCart)
  }

  const incrementQty = (idx) => {
    const newCart = { ...state.cart }
    newCart[idx] = (newCart[idx] || 0) + 1
    state.setCart(newCart)
  }

  const decrementQty = (idx) => {
    const newCart = { ...state.cart }
    if (newCart[idx] > 1) {
      newCart[idx]--
    } else {
      delete newCart[idx]
    }
    state.setCart(newCart)
  }

  const generateWhatsAppLink = () => {
    if (!state.whatsapp) return '#'
    const lines = cartItems.map(i => `${i.qty} x ${i.producto} — ${money(price(i.precio) * i.qty)}`)
    const deliveryLine = showDelivery ? `\nDelivery: ${money(deliveryCost)}` : ''
    const msg = `Pedido:\n${lines.join('\n')}\n\nSubtotal: ${money(cartTotal)}${deliveryLine}\nTotal: ${money(showDelivery ? cartTotal + deliveryCost : cartTotal)}`
    return `https://wa.me/${state.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`
  }

  const autoArrangeTopIcons = () => {
    const positions = {
      back: 20,
      logo: 420,
      promo: 560,
      bell: 700,
      cart: 820,
      exit: 900
    }
    Object.entries(positions).forEach(([key, x]) => {
      const current = state.topTransforms[key] || {}
      state.setTopTransform(key, {
        x,
        y: 0,
        scale: 1,
        rotation: 0
      })
    })
    state.setTopTransform('mesa', { x: 30, y: 100, scale: 1, rotation: 0 })
  }

  return (
    <div className="space-y-4">
      {/* Posición de iconos superiores */}
      <div className="bg-dark-700/50 rounded-xl p-3 border border-dark-600">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm text-dark-400 font-semibold">📍 Posición iconos superiores</label>
          <button
            onClick={autoArrangeTopIcons}
            title="Acomodar todos los controles dentro de la barra negra"
            className="text-[10px] px-2 py-1 bg-green-500/20 text-green-400 border border-green-500/40 rounded-lg hover:bg-green-500/30 transition"
          >
            ✓ Orden automático
          </button>
        </div>
        <p className="text-[10px] text-dark-400 mb-2">Mesa 0: Volver, Logo, Promo, Carrito y Salir. Mesa 1+: además Campana y Nº de mesa.</p>
        <div className="space-y-2">
          {[
            { key: 'back', label: '← Volver', emoji: '←' },
            { key: 'logo', label: 'Logo', emoji: '🖼️' },
            { key: 'promo', label: 'Promo', emoji: '🎁', iconField: 'promoIcon' },
            { key: 'bell', label: '🔔 Campana M1+', emoji: '🔔' },
            { key: 'cart', label: '🛒 Carrito', emoji: '🛒' },
            { key: 'mesa', label: '🏷️ Mesa M1+', emoji: '🏷️' },
            { key: 'exit', label: 'Salir', emoji: '✕' }
          ].map(({ key, label, iconField }) => {
            const t = state.topTransforms[key] || { x: 0, y: 0, scale: 1, rotation: 0 }
            const iconValue = iconField ? state[iconField] : null
            return (
              <div key={key} className="flex items-center gap-2 text-[10px]">
                <span className="text-dark-300 w-16 truncate">{label}</span>
                <span className="text-dark-500">X</span>
                <input
                  type="number"
                  value={Math.round(t.x)}
                  onChange={e => state.setTopTransform(key, { x: Number(e.target.value) })}
                  className="w-14 bg-dark-800 border border-dark-600 rounded px-1.5 py-1 text-white text-center"
                />
                <span className="text-dark-500">Y</span>
                <input
                  type="number"
                  value={Math.round(t.y)}
                  onChange={e => state.setTopTransform(key, { y: Number(e.target.value) })}
                  className="w-14 bg-dark-800 border border-dark-600 rounded px-1.5 py-1 text-white text-center"
                />
                <span className="text-dark-500">{key === 'logo' || key === 'promo' ? 'Zoom' : '%'}</span>
                <input
                  type="number"
                  value={Math.round((t.scale || 1) * 100)}
                  min={key === 'logo' || key === 'promo' ? 25 : 50}
                  max={key === 'logo' || key === 'promo' ? 125 : 150}
                  onChange={e => state.setTopTransform(key, { scale: Math.max(key === 'logo' || key === 'promo' ? 0.25 : 0.5, Math.min(key === 'logo' || key === 'promo' ? 1.25 : 1.5, Number(e.target.value) / 100)) })}
                  className="w-14 bg-dark-800 border border-dark-600 rounded px-1.5 py-1 text-white text-center"
                  step="10"
                />
                {iconField && (
                  <label
                    title={`Cargar imagen para ${label}`}
                    className="flex items-center gap-1 px-1.5 py-1 bg-dark-800 border border-dark-600 rounded cursor-pointer hover:border-primary-500 transition flex-shrink-0"
                  >
                    {iconValue ? (
                      <img src={iconValue} alt="" className="w-4 h-4 rounded object-cover" />
                    ) : (
                      <span className="text-dark-400">🖼️</span>
                    )}
                    <span className="text-dark-300">{iconValue ? 'Cambiar' : 'Subir'}</span>
                    <input
                      type="file" accept="image/*" className="hidden"
                      onChange={async e => {
                        const file = e.target.files[0]
                        if (!file) return
                        const dataUrl = await state.normalizeSquareImage(file, 100)
                        state.setField(iconField, dataUrl)
                      }}
                    />
                  </label>
                )}
              </div>
            )
          })}
          <div className="border-t border-dark-600 pt-3 mt-3">
            <span className="text-[11px] font-semibold text-white block mb-2">ℹ️ Iconos dentro de Información</span>
            <div className="grid grid-cols-3 gap-2">
              {[
                { field: 'waIcon', label: 'WhatsApp', fallback: '💬' },
                { field: 'igIcon', label: 'Instagram', fallback: '📷' },
                { field: 'mapIcon', label: 'Ubicación', fallback: '📍' }
              ].map(({ field, label, fallback }) => (
                <label key={field} className="flex flex-col items-center gap-1 p-2 bg-dark-800 border border-dark-600 rounded-lg cursor-pointer hover:border-primary-500 transition">
                  {state[field] ? <img src={state[field]} alt="" className="w-6 h-6 rounded object-cover" /> : <span className="text-lg">{fallback}</span>}
                  <span className="text-[9px] text-dark-300">{label}</span>
                  <span className="text-[9px] text-primary-400">{state[field] ? 'Cambiar' : 'Subir'}</span>
                  <input type="file" accept="image/*" className="hidden" onChange={async e => {
                    const file = e.target.files[0]
                    if (!file) return
                    state.setField(field, await state.normalizeSquareImage(file, 100))
                  }} />
                </label>
              ))}
            </div>
            <p className="text-[10px] text-dark-500 mt-2">WhatsApp, Instagram y Ubicación aparecen al tocar Logo/Información; por eso no necesitan posición X/Y propia.</p>
          </div>

          {/* Estilo del marco superior */}
          <div className="border-t border-dark-600 pt-3 mt-3 space-y-2">
            <span className="text-[11px] font-semibold text-white block">🎨 Estilo del Marco Superior</span>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-dark-400 block mb-1">Color del marco</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    disabled={state.topBarFrameBorderTransparent}
                    value={state.topBarFrameBorderColor || '#9ca3af'}
                    onChange={e => state.setField('topBarFrameBorderColor', e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer bg-transparent border-0 disabled:opacity-50"
                  />
                  <label className="flex items-center gap-1 text-[10px] text-dark-300 select-none">
                    <input
                      type="checkbox"
                      checked={state.topBarFrameBorderTransparent}
                      onChange={e => state.setField('topBarFrameBorderTransparent', e.target.checked)}
                      className="rounded"
                    />
                    Transparente
                  </label>
                </div>
              </div>
              
              <div>
                <label className="text-[10px] text-dark-400 block mb-1">Color de fondo</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    disabled={state.topBarFrameBgTransparent}
                    value={state.topBarFrameBgColor || '#000000'}
                    onChange={e => state.setField('topBarFrameBgColor', e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer bg-transparent border-0 disabled:opacity-50"
                  />
                  <label className="flex items-center gap-1 text-[10px] text-dark-300 select-none">
                    <input
                      type="checkbox"
                      checked={state.topBarFrameBgTransparent}
                      onChange={e => state.setField('topBarFrameBgTransparent', e.target.checked)}
                      className="rounded"
                    />
                    Transparente
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Redes y contacto */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm text-dark-400 mb-1 block">{t('whastapp')}</label>
          <input
            type="text"
            value={state.whatsapp}
            onChange={e => state.setField('whatsapp', e.target.value)}
            placeholder="3518766202"
            className="w-full bg-dark-700 border border-dark-600 rounded-xl px-3 py-2 text-white text-sm"
          />
        </div>
        <div>
          <label className="text-sm text-dark-400 mb-1 block">{t('instagram')}</label>
          <input
            type="text"
            value={state.instagram}
            onChange={e => state.setField('instagram', e.target.value)}
            placeholder="@menuqr"
            className="w-full bg-dark-700 border border-dark-600 rounded-xl px-3 py-2 text-white text-sm"
          />
        </div>
      </div>

      <div>
        <label className="text-sm text-dark-400 mb-1 block">{t('direccion')}</label>
        <input
          type="text"
          value={state.address}
          onChange={e => state.setField('address', e.target.value)}
          placeholder="Dirección del local"
          className="w-full bg-dark-700 border border-dark-600 rounded-xl px-3 py-2 text-white text-sm"
        />
        <p className="text-[10px] text-dark-500 mt-1">WhatsApp, Instagram y ubicación se muestran al tocar el ícono ℹ️ del menú (ya no aparecen sueltos en la barra superior).</p>
      </div>

      <div>
        <label className="text-sm text-dark-400 mb-1 block">{t('horario')}</label>
        <input
          type="text"
          value={state.hours}
          onChange={e => state.setField('hours', e.target.value)}
          placeholder="Lun a Sáb de 9 a 20 hs"
          className="w-full bg-dark-700 border border-dark-600 rounded-xl px-3 py-2 text-white text-sm"
        />
      </div>

      <div>
        <label className="text-sm text-dark-400 mb-1 block">{t('promocion')}</label>
        <textarea
          value={state.promo}
          onChange={e => state.setField('promo', e.target.value)}
          placeholder="Ej: 2x1 en cafés los lunes"
          rows={2}
          className="w-full bg-dark-700 border border-dark-600 rounded-xl px-3 py-2 text-white text-sm resize-none"
        />
        <label className="text-[10px] text-dark-400 mt-1 block">Icono Promoción</label>
        <label className="flex items-center gap-2 w-full h-10 bg-dark-700 border border-dashed border-dark-500 rounded-lg cursor-pointer hover:border-primary-500 transition">
          <span className="text-[10px] text-dark-400 px-2">{state.promoIcon ? '✓ Icono cargado' : 'Subir icono'}</span>
          <input type="file" accept="image/*" className="hidden" onChange={async e => {
            const file = e.target.files[0]
            if (!file) return
            const dataUrl = await state.normalizeSquareImage(file, 100)
            state.setField('promoIcon', dataUrl)
          }} />
        </label>
        {!showDelivery && (
          <label className="flex items-center gap-2 mt-2 text-xs text-dark-400">
            <input
              type="checkbox"
              checked={state.sharePromoWithMesaZero || false}
              onChange={e => state.setField('sharePromoWithMesaZero', e.target.checked)}
              className="rounded"
            />
            <span>Compartir esta promoción con Mesa 0</span>
          </label>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm text-dark-400 mb-1 block">{t('alias')}</label>
          <input
            type="text"
            value={state.alias}
            onChange={e => state.setField('alias', e.target.value)}
            placeholder="mi.negocio.mp"
            className="w-full bg-dark-700 border border-dark-600 rounded-xl px-3 py-2 text-white text-sm"
          />
        </div>
        {showDelivery && (
          <div>
            <label className="text-sm text-dark-400 mb-1 block">{t('costoDelivery')}</label>
            <input
              type="number"
              value={state.delivery}
              onChange={e => state.setField('delivery', Number(e.target.value))}
              placeholder="800"
              className="w-full bg-dark-700 border border-dark-600 rounded-xl px-3 py-2 text-white text-sm"
            />
          </div>
        )}
      </div>

      {/* Imágenes de productos masivas */}
      <div>
        <label className="text-sm text-dark-400 mb-1 block">{t('subirImagenes')} productos</label>
        <label className="flex flex-col items-center justify-center w-full h-16 bg-dark-700 border border-dashed border-dark-500 rounded-xl cursor-pointer hover:border-primary-500 transition">
          <span className="text-xs text-dark-400">Múltiples imágenes</span>
          <input type="file" accept="image/*" multiple className="hidden" onChange={e => handleBulkProductImages(e.target.files)} />
        </label>
      </div>

      {/* Lista de productos */}
      {state.rows.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-white">Productos ({state.rows.length})</h4>
          <div className="space-y-2 max-h-60 overflow-auto">
            {state.rows.map((r, i) => {
              const img = state.findProductImage(r, i)
              const inCart = !!state.cart[i]
              const qty = state.cart[i] || 0
              return (
                <div key={i} className="flex gap-2 bg-dark-700/50 rounded-xl p-2 border border-dark-600">
                  <label className="w-12 h-12 rounded-lg bg-dark-600 flex-shrink-0 flex items-center justify-center overflow-hidden cursor-pointer hover:border-primary-500 border border-transparent transition">
                    {img ? <img className="w-full h-full object-cover" src={img} alt="" /> : <span className="text-lg">📷</span>}
                    <input type="file" accept="image/*" className="hidden" onChange={async e => {
                      const file = e.target.files[0]
                      if (!file) return
                      const dataUrl = await state.normalizeSquareImage(file, 300)
                      state.setProductImage('__row_' + i, dataUrl)
                      state.syncProductImageToDB(r.producto, dataUrl)
                    }} />
                  </label>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-white truncate">{r.producto}</div>
                    <div className="text-[10px] text-dark-400 truncate">{r.detalle}</div>
                    <div className="text-xs text-accent-400 font-bold">{money(price(r.precio))}</div>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => decrementQty(i)}
                        className="w-5 h-5 rounded bg-dark-600 text-white text-xs flex items-center justify-center"
                      >
                        −
                      </button>
                      <span className="text-white text-xs w-4 text-center">{qty}</span>
                      <button
                        onClick={() => incrementQty(i)}
                        className="w-5 h-5 rounded bg-primary-500 text-white text-xs flex items-center justify-center"
                      >
                        +
                      </button>
                    </div>
                    <button
                      onClick={() => addToCart(i)}
                      className={`text-[10px] px-2 py-0.5 rounded ${inCart ? 'bg-accent-500 text-white' : 'bg-dark-600 text-dark-300'}`}
                    >
                      {inCart ? '✓' : 'Agregar'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Resumen del carrito */}
      {cartItems.length > 0 && (
        <div className="bg-dark-700/50 rounded-xl p-3 border border-dark-600">
          <h4 className="text-sm font-semibold text-white mb-2">🛒 Mi pedido</h4>
          <div className="space-y-1 mb-2">
            {cartItems.map(item => (
              <div key={item.idx} className="flex justify-between text-xs">
                <span className="text-dark-300">{item.qty}x {item.producto}</span>
                <span className="text-white font-bold">{money(price(item.precio) * item.qty)}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-dark-600 pt-2 space-y-1">
            <div className="flex justify-between text-xs text-dark-400">
              <span>Subtotal</span><span>{money(cartTotal)}</span>
            </div>
            {showDelivery && (
              <div className="flex justify-between text-xs text-dark-400">
                <span>Delivery</span><span>{money(deliveryCost)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm text-white font-bold">
              <span>Total</span><span>{money(showDelivery ? cartTotal + deliveryCost : cartTotal)}</span>
            </div>
          </div>
          <a
            href={generateWhatsAppLink()}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full mt-3 py-2 rounded-xl bg-accent-500 text-white text-sm font-bold text-center hover:bg-accent-600 transition"
          >
            {t('pedirPorWhatsApp')}
          </a>
        </div>
      )}
    </div>
  )
}
