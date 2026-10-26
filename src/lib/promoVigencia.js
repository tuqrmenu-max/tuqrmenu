// Cupo de usos, días y horario de las promociones (panel). Replica exactamente promo_en_horario() del SQL
// (supabase/promociones_limites_horario.sql), que es la que cumple las reglas en el servidor; acá solo se usa
// para mostrar estados y validar el formulario.

export const DIAS_PROMO = [
  { id: 1, label: 'Lun' }, { id: 2, label: 'Mar' }, { id: 3, label: 'Mié' }, { id: 4, label: 'Jue' },
  { id: 5, label: 'Vie' }, { id: 6, label: 'Sáb' }, { id: 7, label: 'Dom' }
]
export const ZONA_DEFAULT = 'America/Argentina/Buenos_Aires'

// Zona horaria del navegador de quien carga la promo (el dueño está en el local).
export const zonaLocal = () => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ZONA_DEFAULT } catch { return ZONA_DEFAULT }
}

export const hhmm = t => (t ? String(t).slice(0, 5) : '')

// Día ISO (1 = lunes ... 7 = domingo) y minutos del día en la zona indicada.
function enZona(date, zona) {
  const opts = { weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }
  let fmt
  try { fmt = new Intl.DateTimeFormat('en-US', { ...opts, timeZone: zona || ZONA_DEFAULT }) } catch { fmt = new Intl.DateTimeFormat('en-US', { ...opts, timeZone: ZONA_DEFAULT }) }
  const p = Object.fromEntries(fmt.formatToParts(date).map(x => [x.type, x.value]))
  return { dia: { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[p.weekday], min: Number(p.hour) * 60 + Number(p.minute) }
}
const aMin = t => { const [h, m] = hhmm(t).split(':').map(Number); return h * 60 + m }

export function promoEnHorario(promo, date = new Date()) {
  const dias = promo?.dias_semana || []
  const todos = dias.length === 0
  const desde = promo?.hora_desde, hasta = promo?.hora_hasta
  const { dia, min } = enZona(date, promo?.zona_horaria)
  const ayer = dia === 1 ? 7 : dia - 1
  if (!desde || !hasta || aMin(desde) === aMin(hasta)) return todos || dias.includes(dia)
  const d = aMin(desde), h = aMin(hasta)
  if (d < h) return (todos || dias.includes(dia)) && min >= d && min < h
  return (min >= d && (todos || dias.includes(dia))) || (min < h && (todos || dias.includes(ayer)))
}

// "Lun, Mar, Vie de 18:00 a 22:00" / "todos los días"
export function textoHorarioPromo(promo) {
  const dias = promo?.dias_semana || []
  const diasTxt = dias.length === 0 || dias.length === 7 ? 'todos los días' : [...dias].sort((a, b) => a - b).map(d => DIAS_PROMO[d - 1]?.label).join(', ')
  const d = promo?.hora_desde, h = promo?.hora_hasta
  return diasTxt + (d && h && aMin(d) !== aMin(h) ? ` de ${hhmm(d)} a ${hhmm(h)}` : '')
}

// Restringe por día (algunos, no todos) o por franja horaria.
export const tieneHorario = promo => {
  const dias = promo?.dias_semana || []
  return (dias.length > 0 && dias.length < 7) || Boolean(promo?.hora_desde && promo?.hora_hasta)
}
export const tieneLimite = promo => promo?.usos_max != null && promo.usos_max !== ''

// 'agendada' | 'agotada' | 'fuera_de_horario' | 'activa'
export function estadoPromo(promo, usados = 0, ahora = new Date()) {
  if (promo?.fecha_envio && new Date(promo.fecha_envio).getTime() > ahora.getTime()) return 'agendada'
  if (tieneLimite(promo) && usados >= Number(promo.usos_max)) return 'agotada'
  if (!promoEnHorario(promo, ahora)) return 'fuera_de_horario'
  return 'activa'
}

// Valida los campos del formulario. Devuelve un mensaje de error o '' si está bien.
export function validarLimitesHorario({ usos_max, hora_desde, hora_hasta }) {
  if (usos_max !== '' && usos_max != null && (!Number.isInteger(Number(usos_max)) || Number(usos_max) < 1)) return 'El límite de usos debe ser un número entero mayor a 0'
  if (Boolean(hora_desde) !== Boolean(hora_hasta)) return 'Completá “Desde” y “Hasta” del horario (o dejá ambos vacíos para todo el día)'
  return ''
}

// Campos para guardar en la tabla (solo los que se configuraron; así no se rompe si falta el SQL).
export function camposLimitesHorario({ usos_max, dias_semana, hora_desde, hora_hasta }) {
  const out = {}
  const conLimite = usos_max !== '' && usos_max != null
  const conDias = (dias_semana || []).length > 0 && dias_semana.length < 7
  const conHora = Boolean(hora_desde && hora_hasta)
  out.usos_max = conLimite ? Number(usos_max) : null
  out.dias_semana = conDias ? [...dias_semana].sort((a, b) => a - b) : null
  out.hora_desde = conHora ? hhmm(hora_desde) : null
  out.hora_hasta = conHora ? hhmm(hora_hasta) : null
  if (conLimite || conDias || conHora) out.zona_horaria = zonaLocal()
  return out
}
