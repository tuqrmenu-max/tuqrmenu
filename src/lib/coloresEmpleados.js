// Colores del calendario de turnos: uno distinto por EMPLEADO (no por rol),
// así dos mozos nunca comparten color. Se asignan por orden de alta
// (created_at, luego id), por lo que son estables mientras no se borre
// a alguien anterior en la lista.
const PALETA = [
  '#2563eb', '#16a34a', '#9333ea', '#ea580c', '#dc2626', '#0891b2',
  '#db2777', '#0d9488', '#4d7c0f', '#4f46e5', '#be123c', '#0284c7',
  '#c026d3', '#047857', '#d97706', '#7c3aed', '#64748b', '#a16207'
]

export function mapaColoresEmpleados(usuarios) {
  const ordenados = [...(usuarios || [])].sort((a, b) =>
    String(a.created_at || '').localeCompare(String(b.created_at || '')) ||
    String(a.id).localeCompare(String(b.id))
  )
  const mapa = {}
  ordenados.forEach((u, i) => {
    // Pasada la paleta, se generan tonos separados por el "ángulo áureo"
    // para que sigan siendo todos distintos entre sí.
    mapa[u.id] = i < PALETA.length ? PALETA[i] : `hsl(${Math.round((i * 137.508) % 360)}, 65%, 42%)`
  })
  return mapa
}
