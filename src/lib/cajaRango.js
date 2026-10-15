// Fechas y turnos de "Caja por usuario y turno".
// - Fecha desde es obligatoria; Fecha hasta es opcional (vacía = solo el día de Fecha desde).
// - Un día va de 00:00 a 00:00 del día siguiente (hora local).
// - Un turno se aplica en cada día del período donde el usuario lo tiene asignado.

export const hoyLocal = () => {
  const d = new Date()
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-')
}

// Lista de días 'YYYY-MM-DD' entre desde y hasta (inclusive), con tope de seguridad.
export function diasEntre(desde, hasta, max = 62) {
  if (!desde) return []
  const fin = hasta && hasta >= desde ? hasta : desde
  const out = []
  const d = new Date(desde + 'T12:00:00')
  while (out.length < max) {
    const s = [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-')
    if (s > fin) break
    out.push(s)
    d.setDate(d.getDate() + 1)
  }
  return out
}

// ¿El turno corresponde a ese día? Por fechas puntuales o, si no hay, por día de la semana (0 = lunes).
export function turnoAplica(h, dia) {
  if (!h || h.activo === false) return false
  if (h.fechas?.length) return h.fechas.includes(dia)
  return (h.dias || []).includes((new Date(dia + 'T12:00:00').getDay() + 6) % 7)
}

// Rangos [inicio, fin] ISO de un turno para cada día aplicable (turno nocturno y partido incluidos).
// Devuelve null si algún horario es inválido.
export function rangosDeTurno(h, dias) {
  const rangos = []
  for (const dia of dias) {
    if (!turnoAplica(h, dia)) continue
    let previousEnd = null
    for (const [desde, hasta] of [[h.desde, h.hasta], [h.desde2, h.hasta2]]) {
      if (!desde || !hasta) continue
      const start = new Date(dia + 'T' + desde + ':00')
      if (previousEnd && start < previousEnd) start.setDate(start.getDate() + 1)
      const end = new Date(start)
      const [hh, mm] = hasta.split(':').map(Number)
      end.setHours(hh, mm, 0, 0)
      if (end <= start) end.setDate(end.getDate() + 1)
      if (!Number.isFinite(+start) || !Number.isFinite(+end)) return null
      rangos.push([start.toISOString(), end.toISOString()])
      previousEnd = end
    }
  }
  return rangos
}
