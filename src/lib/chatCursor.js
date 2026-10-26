const sequence = row => BigInt(row.qr_sequence || 0)
export const chatOrder = (a, b) => sequence(a) < sequence(b) ? -1 : sequence(a) > sequence(b) ? 1 : a.created_at.localeCompare(b.created_at) || String(a.id).localeCompare(String(b.id))
export function mergeMessages(current, incoming) {
  const map = new Map(current.map(row => [row.id, row]))
  incoming.forEach(row => map.set(row.id, row))
  return [...map.values()].sort(chatOrder)
}
// Sequence is assigned under a transactional row lock, not by browser clocks.
export function afterMessage(row) {
  return `qr_sequence.gt.${row.qr_sequence || 0}`
}
export function beforeMessage(row) {
  const seq = row.qr_sequence || 0
  return `qr_sequence.lt.${seq},and(qr_sequence.eq.${seq},created_at.lt.${row.created_at}),and(qr_sequence.eq.${seq},created_at.eq.${row.created_at},id.lt.${row.id})`
}
