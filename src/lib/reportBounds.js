export function reportBounds(filters) {
  const desde = filters.fecha_desde ? new Date(filters.fecha_desde + 'T00:00:00').toISOString() : null
  let hasta = null
  if (filters.fecha_hasta) {
    const end = new Date(filters.fecha_hasta + 'T00:00:00')
    end.setDate(end.getDate() + 1)
    hasta = end.toISOString()
  }
  return { desde, hasta }
}
