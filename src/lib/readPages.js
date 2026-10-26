export async function readPages(makeQuery, isCurrent = () => true) {
  const rows = []
  while (isCurrent()) {
    const { data, error } = await makeQuery().range(rows.length, rows.length + 499)
    if (error) throw error
    if (!isCurrent()) return null
    if (!data?.length) return rows
    rows.push(...data)
  }
  return null
}
export function applyDateBounds(query, column, filters, shift) {
  if (filters.fecha_desde) query = query.gte(column, new Date(filters.fecha_desde + 'T00:00:00').toISOString())
  if (filters.fecha_hasta) {
    const end = new Date(filters.fecha_hasta + 'T00:00:00')
    end.setDate(end.getDate() + 1)
    query = query.lt(column, end.toISOString())
  }
  if (shift?.rangos?.length) {
    query = query.or(shift.rangos.map(([start,end]) => `and(${column}.gte.${start},${column}.lt.${end})`).join(','))
  }
  return query
}
