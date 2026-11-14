import { useState, useRef, useEffect } from 'react'
import { useI18n } from '@/lib/i18n'
import { IDIOMAS } from '@/lib/idiomas'

const TODOS = [{ code: 'es', nombre: 'Español', nativo: 'Español', bandera: '🇪🇸' }, ...IDIOMAS]

// Selector de idioma. `permitidos` = códigos habilitados (siempre incluye 'es').
// Si solo hay español no muestra nada.
export default function LanguageSelector({ permitidos, className = '', alinear = 'right' }) {
  const { lang, setLang, t } = useI18n()
  const [abierto, setAbierto] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!abierto) return
    const cerrar = (e) => { if (ref.current && !ref.current.contains(e.target)) setAbierto(false) }
    document.addEventListener('mousedown', cerrar)
    return () => document.removeEventListener('mousedown', cerrar)
  }, [abierto])

  const lista = TODOS.filter(i => !permitidos || permitidos.includes(i.code))
  if (lista.length <= 1) return null
  const actual = TODOS.find(i => i.code === lang) || TODOS[0]

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setAbierto(o => !o)}
        aria-label={t('idioma')}
        aria-expanded={abierto}
        className="px-3 py-1.5 bg-dark-700 rounded-lg text-sm hover:bg-dark-600 transition flex items-center gap-2"
      >
        <span>{actual.bandera}</span>
        <span className="text-dark-300">{actual.code.toUpperCase()}</span>
      </button>
      {abierto && (
        <ul className={`absolute ${alinear === 'right' ? 'right-0' : 'left-0'} mt-2 w-48 bg-dark-800 border border-dark-700 rounded-xl shadow-xl overflow-hidden z-50`}>
          {lista.map(i => (
            <li key={i.code}>
              <button
                type="button"
                onClick={() => { setLang(i.code); setAbierto(false) }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition ${
                  i.code === lang ? 'bg-primary-500/20 text-primary-400' : 'text-dark-200 hover:bg-dark-700 hover:text-white'
                }`}
              >
                <span className="text-lg">{i.bandera}</span>
                <span>{i.nativo}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
