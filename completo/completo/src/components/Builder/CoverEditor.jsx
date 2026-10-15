import { useBuilderState } from './useBuilderState'
import { useI18n } from '@/lib/i18n'

function TransformControls({ label, transformField, resetAction, maxW = 1080, maxH = 1920 }) {
  const state = useBuilderState()
  const { t } = useI18n()
  const transform = state[transformField] || { x: 0, y: 0, scale: 1, rotation: 0 }

  const update = (prop, value) => {
    state.setTransform(transformField, { [prop]: value })
  }

  const effectiveMaxW = typeof maxW === 'function' ? maxW() : maxW
  const dynamicMaxX = Math.round(1080 - effectiveMaxW * (transform.scale || 1))
  const dynamicMaxY = Math.round(1920 - maxH * (transform.scale || 1))

  return (
    <div className="bg-dark-700/50 rounded-xl p-3 border border-dark-600">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-white">{label}</span>
        <button
          onClick={() => state[resetAction]()}
          className="text-xs px-2 py-1 bg-dark-600 text-dark-300 rounded-lg hover:bg-dark-500"
        >
          Centrar
        </button>
      </div>
      <div className="grid grid-cols-4 gap-2">
        <div>
          <label className="text-[10px] text-dark-400">X (0-{dynamicMaxX})</label>
          <input
            type="range" min="0" max={dynamicMaxX}
            value={Math.round(transform.x)}
            onChange={e => update('x', Math.min(dynamicMaxX, Math.max(0, Number(e.target.value))))}
            className="w-full h-1 accent-primary-500"
          />
          <input
            type="number" min="0" max={dynamicMaxX}
            value={Math.round(transform.x)}
            onChange={e => update('x', Math.min(dynamicMaxX, Math.max(0, Number(e.target.value))))}
            className="w-full bg-dark-800 text-[10px] text-white rounded px-1 py-0.5 mt-0.5"
          />
        </div>
        <div>
          <label className="text-[10px] text-dark-400">Y (0-{dynamicMaxY})</label>
          <input
            type="range" min="0" max={dynamicMaxY}
            value={Math.round(transform.y)}
            onChange={e => update('y', Math.min(dynamicMaxY, Math.max(0, Number(e.target.value))))}
            className="w-full h-1 accent-primary-500"
          />
          <input
            type="number" min="0" max={dynamicMaxY}
            value={Math.round(transform.y)}
            onChange={e => update('y', Math.min(dynamicMaxY, Math.max(0, Number(e.target.value))))}
            className="w-full bg-dark-800 text-[10px] text-white rounded px-1 py-0.5 mt-0.5"
          />
        </div>
        <div>
            <label className="text-[10px] text-dark-400">{t('tamLetra')} (30-300%)</label>
            <input
              type="range" min="30" max="300"
              value={Math.round((transform.scale || 1) * 100)}
              onChange={e => {
                const newScale = Number(e.target.value) / 100
                const newMaxX = Math.round(1080 - maxW * newScale)
                const newMaxY = Math.round(1920 - maxH * newScale)
                update('scale', newScale)
                update('x', Math.min(transform.x, newMaxX))
                update('y', Math.min(transform.y, newMaxY))
              }}
              className="w-full h-1 accent-primary-500"
            />
            <input
              type="number" min="30" max="300"
              value={Math.round((transform.scale || 1) * 100)}
              onChange={e => {
                const newScale = Math.min(300, Math.max(30, Number(e.target.value))) / 100
                const newMaxX = Math.round(1080 - maxW * newScale)
                const newMaxY = Math.round(1920 - maxH * newScale)
                update('scale', newScale)
                update('x', Math.min(transform.x, newMaxX))
                update('y', Math.min(transform.y, newMaxY))
              }}
              className="w-full bg-dark-800 text-[10px] text-white rounded px-1 py-0.5 mt-0.5"
            />
          </div>
        <div>
          <label className="text-[10px] text-dark-400">Rotar (-180° a 180°)</label>
          <input
            type="range" min="-180" max="180"
            value={Math.round(transform.rotation || 0)}
            onChange={e => update('rotation', Number(e.target.value))}
            className="w-full h-1 accent-primary-500"
          />
          <input
            type="number" min="-180" max="180"
            value={Math.round(transform.rotation || 0)}
            onChange={e => update('rotation', Math.min(180, Math.max(-180, Number(e.target.value))))}
            className="w-full bg-dark-800 text-[10px] text-white rounded px-1 py-0.5 mt-0.5"
          />
        </div>
      </div>
    </div>
  )
}

export default function CoverEditor() {
  const state = useBuilderState()
  const { t } = useI18n()

  const handleFileUpload = async (field, file, size = null) => {
    if (!file) return
    if (size) {
      const dataUrl = await state.normalizeSquareImage(file, size)
      state.setField(field, dataUrl)
    } else {
      const reader = new FileReader()
      reader.onload = () => state.setField(field, reader.result)
      reader.readAsDataURL(file)
    }
  }

  return (
    <div className="space-y-4">
      {/* Nombre */}
      <div>
        <label className="text-sm text-dark-400 mb-1 block">{t('clientName') || 'Nombre del cliente'}</label>
        <input
          type="text"
          value={state.clientName}
          onChange={e => state.setField('clientName', e.target.value)}
          placeholder="Ej: Café de María"
          className="w-full bg-dark-700 border border-dark-600 rounded-xl px-3 py-2 text-white text-sm"
        />
      </div>

      {/* Fondo y Logo */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm text-dark-400 mb-1 block">{t('fondoPortada')}</label>
          <label className="flex flex-col items-center justify-center w-full h-20 bg-dark-700 border border-dashed border-dark-500 rounded-xl cursor-pointer hover:border-primary-500 transition">
            <span className="text-xs text-dark-400">{state.coverBg ? '✓ Cargado' : 'Subir imagen'}</span>
            <input
              type="file" accept="image/*" className="hidden"
              onChange={e => handleFileUpload('coverBg', e.target.files[0])}
            />
          </label>
        </div>
        <div>
          <label className="text-sm text-dark-400 mb-1 block">{t('logoPng')} (portada)</label>
          <label className="flex flex-col items-center justify-center w-full h-20 bg-dark-700 border border-dashed border-dark-500 rounded-xl cursor-pointer hover:border-primary-500 transition">
            <span className="text-xs text-dark-400">{state.logo ? '✓ Cargado' : 'Subir logo'}</span>
            <input
              type="file" accept="image/*" className="hidden"
              onChange={e => handleFileUpload('logo', e.target.files[0], 500)}
            />
          </label>
        </div>
      </div>

      {/* Logo de la barra negra (Categorías / Productos / Mi pedido): imagen
          independiente de la de portada, cuadrada, 700x700px. Si no se sube,
          el botón usa como respaldo el logo de portada. */}
      <div>
        <label className="text-sm text-dark-400 mb-1 block">Logo botón barra negra (700×700px)</label>
        <label className="flex flex-col items-center justify-center w-full h-20 bg-dark-700 border border-dashed border-dark-500 rounded-xl cursor-pointer hover:border-primary-500 transition">
          <span className="text-xs text-dark-400">{state.logoBar ? '✓ Cargado' : 'Subir imagen'}</span>
          <input
            type="file" accept="image/*" className="hidden"
            onChange={e => handleFileUpload('logoBar', e.target.files[0], 700)}
          />
        </label>
        <p className="text-[11px] text-dark-400 mt-1">Se usa en Categorías, Productos y Mi pedido. Si no se carga, se usa el logo de portada.</p>
      </div>

      {/* Blur */}
      <div>
        <label className="text-sm text-dark-400 mb-1 block">{t('desenfoque')} <b className="text-white">{state.blur}%</b></label>
        <input
          type="range" min="0" max="100"
          value={state.blur}
          onChange={e => state.setField('blur', Number(e.target.value))}
          className="w-full h-2 accent-primary-500"
        />
      </div>

      {/* Texto bienvenida */}
      <div>
        <label className="text-sm text-dark-400 mb-1 block">{t('textoBienvenida')}</label>
        <input
          type="text"
          value={state.welcomeText}
          onChange={e => state.setField('welcomeText', e.target.value)}
          placeholder="Ej: ¡Bienvenidos!"
          className="w-full bg-dark-700 border border-dark-600 rounded-xl px-3 py-2 text-white text-sm"
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-sm text-dark-400 mb-1 block">{t('colorTexto')}</label>
          <input
            type="color"
            value={state.welcomeColor}
            onChange={e => state.setField('welcomeColor', e.target.value)}
            className="w-full h-10 rounded-xl cursor-pointer"
          />
        </div>
        <div>
          <label className="text-sm text-dark-400 mb-1 block">{t('fondoTexto')}</label>
          <input
            type="color"
            value={state.welcomeBg}
            onChange={e => state.setField('welcomeBg', e.target.value)}
            className="w-full h-10 rounded-xl cursor-pointer"
          />
        </div>
        <div>
          <label className="text-sm text-dark-400 mb-1 block">{t('tamLetra')}</label>
          <input
            type="range" min="10" max="40"
            value={state.welcomeSize}
            onChange={e => state.setField('welcomeSize', Number(e.target.value))}
            className="w-full h-2 accent-primary-500 mt-2"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={state.welcomeBgNone}
          onChange={e => state.setField('welcomeBgNone', e.target.checked)}
          className="rounded"
        />
        <label className="text-sm text-dark-300">{t('sinFondo')}</label>
      </div>

      {/* Transform controls */}
      <TransformControls label="Logo" transformField="logoTransform" resetAction="resetLogoTransform" maxW={518} maxH={730} />
      <TransformControls label={t('textoBienvenida')} transformField="welcomeTransform" resetAction="resetWelcomeTransform" maxW={400} maxH={60} />

      {/* Botón */}
      <div>
        <label className="text-sm text-dark-400 mb-1 block">{t('textoBoton')}</label>
        <input
          type="text"
          value={state.buttonText}
          onChange={e => state.setField('buttonText', e.target.value)}
          className="w-full bg-dark-700 border border-dark-600 rounded-xl px-3 py-2 text-white text-sm"
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-sm text-dark-400 mb-1 block">{t('colorBoton')}</label>
          <input type="color" value={state.buttonBg} onChange={e => state.setField('buttonBg', e.target.value)} className="w-full h-10 rounded-xl cursor-pointer" />
        </div>
        <div>
          <label className="text-sm text-dark-400 mb-1 block">{t('bordeBoton')}</label>
          <input type="color" value={state.buttonBorder} onChange={e => state.setField('buttonBorder', e.target.value)} className="w-full h-10 rounded-xl cursor-pointer" />
        </div>
        <div>
          <label className="text-sm text-dark-400 mb-1 block">{t('textoBotonColor')}</label>
          <input type="color" value={state.buttonColor} onChange={e => state.setField('buttonColor', e.target.value)} className="w-full h-10 rounded-xl cursor-pointer" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-sm text-dark-400 mb-1 block">{t('tamLetra')} botón <b className="text-white">{state.buttonFontSize}px</b></label>
          <input
            type="range" min="8" max="30"
            value={state.buttonFontSize}
            onChange={e => state.setField('buttonFontSize', Number(e.target.value))}
            className="w-full h-2 accent-primary-500"
          />
        </div>
        <div>
          <label className="text-sm text-dark-400 mb-1 block">Padding botón <b className="text-white">{state.buttonPadding}px</b></label>
          <input
            type="range" min="5" max="40"
            value={state.buttonPadding}
            onChange={e => state.setField('buttonPadding', Number(e.target.value))}
            className="w-full h-2 accent-primary-500"
          />
        </div>
        <div>
          <label className="text-sm text-dark-400 mb-1 block">Ancho botón <b className="text-white">{state.buttonWidth}%</b></label>
          <input
            type="range" min="30" max="100"
            value={state.buttonWidth}
            onChange={e => state.setField('buttonWidth', Number(e.target.value))}
            className="w-full h-2 accent-primary-500"
          />
        </div>
      </div>

      <TransformControls label={t('textoBoton')} transformField="buttonTransform" resetAction="resetButtonTransform" maxW={() => (state.buttonWidth / 100) * 1080} maxH={50 + (state.buttonPadding || 15) * 2} />
    </div>
  )
}
