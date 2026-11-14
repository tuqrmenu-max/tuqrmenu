// Idiomas disponibles para traducir el menú del cliente y la app.
// El español siempre está activo y no se puede quitar.
export const IDIOMAS = [
  { code: 'en', nombre: 'Inglés', nativo: 'English', bandera: '🇬🇧' },
  { code: 'pt', nombre: 'Portugués', nativo: 'Português', bandera: '🇧🇷' },
  { code: 'fr', nombre: 'Francés', nativo: 'Français', bandera: '🇫🇷' },
  { code: 'it', nombre: 'Italiano', nativo: 'Italiano', bandera: '🇮🇹' },
  { code: 'de', nombre: 'Alemán', nativo: 'Deutsch', bandera: '🇩🇪' },
  { code: 'ru', nombre: 'Ruso', nativo: 'Русский', bandera: '🇷🇺' },
  { code: 'zh', nombre: 'Chino', nativo: '中文', bandera: '🇨🇳' },
  { code: 'ja', nombre: 'Japonés', nativo: '日本語', bandera: '🇯🇵' },
]

export const CODIGOS_IDIOMAS = IDIOMAS.map(i => i.code)

// Normaliza lo guardado en la base: siempre incluye 'es' primero y descarta códigos desconocidos.
export function normalizarIdiomas(lista) {
  const extra = Array.isArray(lista) ? lista.filter(c => CODIGOS_IDIOMAS.includes(c)) : []
  return ['es', ...CODIGOS_IDIOMAS.filter(c => extra.includes(c))]
}
