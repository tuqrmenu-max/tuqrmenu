import { create } from 'zustand'
import es from './traducciones/es'
import { CODIGOS_IDIOMAS } from './idiomas'

// El español va incluido en el bundle; los demás idiomas se descargan solo cuando se eligen.
const cargadores = {
  en: () => import('./traducciones/en'),
  pt: () => import('./traducciones/pt'),
  fr: () => import('./traducciones/fr'),
  it: () => import('./traducciones/it'),
  de: () => import('./traducciones/de'),
  ru: () => import('./traducciones/ru'),
  zh: () => import('./traducciones/zh'),
  ja: () => import('./traducciones/ja'),
}

const CLAVE_LS = 'tuqrmenu:lang'

function leerGuardado() {
  try {
    const v = localStorage.getItem(CLAVE_LS)
    return v && (v === 'es' || CODIGOS_IDIOMAS.includes(v)) ? v : 'es'
  } catch { return 'es' }
}

export const useI18n = create((set, get) => ({
  lang: 'es',
  bundles: { es },

  // Cambia el idioma: primero descarga el diccionario y recién después lo aplica (sin parpadeos).
  setLang: async (lang) => {
    if (lang !== 'es' && !cargadores[lang]) return
    try {
      if (!get().bundles[lang]) {
        const mod = await cargadores[lang]()
        set(s => ({ bundles: { ...s.bundles, [lang]: mod.default } }))
      }
    } catch {
      return // sin conexión al descargar: se queda en el idioma actual
    }
    set({ lang })
    try { localStorage.setItem(CLAVE_LS, lang) } catch { /* sin almacenamiento */ }
  },

  // Al iniciar la app: recupera el último idioma elegido en este dispositivo.
  restaurarLang: () => {
    const guardado = leerGuardado()
    if (guardado !== get().lang) get().setLang(guardado)
  },

  t: (key) => {
    const { lang, bundles } = get()
    return bundles[lang]?.[key] || es[key] || key
  },
}))

useI18n.getState().restaurarLang()
