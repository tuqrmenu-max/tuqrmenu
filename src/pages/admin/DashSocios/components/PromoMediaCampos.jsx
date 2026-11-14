import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import {
  ANIMACIONES, POSICIONES, LIMITE_IMAGENES, MAX_VIDEO_SEG,
  normalizarConfig, validarArchivo, subirArchivoPromo, borrarArchivosPromo
} from '@/lib/promoMedia'

const KEYFRAMES = `
@keyframes pmFundido{from{opacity:0}to{opacity:1}}
@keyframes pmZoom{from{transform:scale(1)}to{transform:scale(1.12)}}
@keyframes pmDeslizar{from{transform:translateX(8%);opacity:.2}to{transform:none;opacity:1}}
@keyframes pmResaltar{0%,100%{text-shadow:none}50%{text-shadow:0 0 14px #fde68a}}
`
const animMedia = a => a === 'fundido' ? 'pmFundido .8s both' : a === 'zoom' ? 'pmZoom 6s ease-out both' : a === 'deslizar' ? 'pmDeslizar .7s both' : 'none'

// Vista previa: pasa por los archivos con la duración elegida, en bucle.
function Vista({ items, config }) {
  const [i, setI] = useState(0)
  const [pausa, setPausa] = useState(false)
  const c = normalizarConfig(config)
  useEffect(() => { if (i >= items.length) setI(0) }, [items.length, i])
  useEffect(() => {
    if (pausa || items.length < 2) return
    const t = setTimeout(() => setI(n => (n + 1) % items.length), c.duracion * 1000)
    return () => clearTimeout(t)
  }, [i, pausa, items.length, c.duracion])
  if (!items.length) return null
  const m = items[Math.min(i, items.length - 1)]
  const pos = c.posicion === 'arriba' ? { top: 0 } : c.posicion === 'centro' ? { top: '50%', transform: 'translateY(-50%)' } : { bottom: 0 }
  return (
    <div className="relative w-full max-w-sm aspect-[16/10] rounded-xl overflow-hidden bg-black cursor-pointer" onClick={() => setPausa(p => !p)}>
      <style>{KEYFRAMES}</style>
      <div key={i + m.url} className="absolute inset-0" style={{ animation: animMedia(c.animacion) }}>
        {m.tipo === 'video'
          ? <video src={m.url} muted autoPlay loop playsInline className="w-full h-full object-cover" />
          : <img src={m.url} alt="" className="w-full h-full object-cover" />}
      </div>
      {(c.texto1 || c.texto2) && (
        <div className="absolute left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent" style={pos}>
          {c.texto1 && <div className="text-white font-extrabold text-xl leading-tight" style={c.animacion === 'resaltar' ? { animation: 'pmResaltar 2s infinite' } : undefined}>{c.texto1}</div>}
          {c.texto2 && <div className="text-gray-100 text-xs mt-1">{c.texto2}</div>}
        </div>
      )}
      {items.length > 1 && (
        <div className="absolute top-2 left-2 right-2 flex gap-1">
          {items.map((_, k) => <span key={k} className={`flex-1 h-[3px] rounded ${k === i ? 'bg-white' : 'bg-white/40'}`} />)}
        </div>
      )}
      {pausa && <span className="absolute right-2 top-5 text-xs bg-black/60 text-white px-2 py-1 rounded">⏸ pausa</span>}
    </div>
  )
}

export default function PromoMediaCampos({ clienteId, items, onItems, config, onConfig, className = '' }) {
  const [subiendo, setSubiendo] = useState(false)
  const c = normalizarConfig(config)
  const setC = patch => onConfig({ ...c, ...patch })

  const agregar = async (files) => {
    const lista = Array.from(files || [])
    if (!lista.length) return
    if (items.length + lista.length > LIMITE_IMAGENES) {
      toast.error(`Máximo ${LIMITE_IMAGENES} archivos por promo`)
      return
    }
    setSubiendo(true)
    const nuevos = []
    for (const f of lista) {
      const err = validarArchivo(f)
      if (err) { toast.error(`${f.name}: ${err}`); continue }
      try { nuevos.push(await subirArchivoPromo(clienteId, f)) }
      catch (e) { toast.error(`${f.name}: ${e.message || 'no se pudo subir'}`) }
    }
    if (nuevos.length) onItems([...items, ...nuevos])
    setSubiendo(false)
  }

  const quitar = async (idx) => {
    const m = items[idx]
    onItems(items.filter((_, k) => k !== idx))
    borrarArchivosPromo([m.path]).catch(() => {})
  }
  const mover = (idx, d) => {
    const j = idx + d
    if (j < 0 || j >= items.length) return
    const a = [...items]; [a[idx], a[j]] = [a[j], a[idx]]
    onItems(a)
  }

  return (
    <div className={`border border-dark-600 rounded-lg p-3 bg-dark-900/50 ${className}`}>
      <p className="text-white text-sm font-bold mb-1">🖼 Imágenes y videos (opcional)</p>
      <p className="text-[10px] text-dark-400 mb-3">Hasta {LIMITE_IMAGENES} archivos. Fotos JPG/PNG/WebP (se achican solas), videos MP4/WebM de hasta 8 MB y {MAX_VIDEO_SEG} s.</p>

      <label className={`block border-2 border-dashed border-dark-600 rounded-lg p-4 text-center text-sm text-dark-300 cursor-pointer hover:border-primary-500/60 ${subiendo ? 'opacity-60 pointer-events-none' : ''}`}>
        {subiendo ? 'Subiendo…' : 'Tocá para elegir fotos o videos'}
        <input type="file" multiple accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" className="hidden"
          onChange={e => { agregar(e.target.files); e.target.value = '' }} />
      </label>

      {items.length > 0 && (
        <>
          <div className="flex flex-wrap gap-2 mt-3">
            {items.map((m, idx) => (
              <div key={m.path} className="relative w-20 h-20 rounded-lg overflow-hidden bg-black border border-dark-600">
                {m.tipo === 'video'
                  ? <video src={m.url} muted preload="metadata" className="w-full h-full object-cover" />
                  : <img src={m.url} alt="" className="w-full h-full object-cover" />}
                <span className="absolute bottom-0 left-0 bg-black/70 text-[10px] text-white px-1">{m.tipo === 'video' ? '🎬' : idx + 1}</span>
                <button type="button" onClick={() => quitar(idx)} aria-label="Quitar" className="absolute top-0 right-0 bg-black/70 text-white w-5 h-5 text-xs">×</button>
                <div className="absolute bottom-0 right-0 flex">
                  <button type="button" onClick={() => mover(idx, -1)} aria-label="Mover antes" className="bg-black/70 text-white w-5 h-5 text-[10px]">←</button>
                  <button type="button" onClick={() => mover(idx, 1)} aria-label="Mover después" className="bg-black/70 text-white w-5 h-5 text-[10px]">→</button>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-dark-400 text-sm mb-1">Texto principal</label>
              <input value={c.texto1} maxLength={60} onChange={e => setC({ texto1: e.target.value })} placeholder="Ej: 2x1 en Hamburguesas"
                className="w-full bg-dark-900 border border-dark-600 rounded-lg px-3 py-2 text-white" />
            </div>
            <div>
              <label className="block text-dark-400 text-sm mb-1">Texto secundario</label>
              <input value={c.texto2} maxLength={120} onChange={e => setC({ texto2: e.target.value })} placeholder="Ej: Lunes a jueves"
                className="w-full bg-dark-900 border border-dark-600 rounded-lg px-3 py-2 text-white" />
            </div>
            <div>
              <label className="block text-dark-400 text-sm mb-1">Animación</label>
              <div className="flex flex-wrap gap-2">
                {ANIMACIONES.map(a => (
                  <button key={a.id} type="button" aria-pressed={c.animacion === a.id} onClick={() => setC({ animacion: a.id })}
                    className={`px-3 py-1.5 rounded-lg text-sm border ${c.animacion === a.id ? 'bg-primary-600/30 border-primary-500 text-primary-300' : 'bg-dark-900 border-dark-600 text-dark-300'}`}>{a.label}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-dark-400 text-sm mb-1">Posición del texto</label>
              <div className="flex gap-2">
                {POSICIONES.map(p => (
                  <button key={p.id} type="button" aria-pressed={c.posicion === p.id} onClick={() => setC({ posicion: p.id })}
                    className={`px-3 py-1.5 rounded-lg text-sm border ${c.posicion === p.id ? 'bg-primary-600/30 border-primary-500 text-primary-300' : 'bg-dark-900 border-dark-600 text-dark-300'}`}>{p.label}</button>
                ))}
              </div>
              <label className="block text-dark-400 text-sm mt-3 mb-1">Duración por imagen: {c.duracion} s</label>
              <input type="range" min="2" max="8" step="1" value={c.duracion} onChange={e => setC({ duracion: Number(e.target.value) })} className="w-full" />
            </div>
          </div>

          <p className="text-dark-400 text-sm mt-4 mb-2">Vista previa (tocá para pausar)</p>
          <Vista items={items} config={c} />
        </>
      )}
    </div>
  )
}
