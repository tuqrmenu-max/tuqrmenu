import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { mapaColoresEmpleados } from '@/lib/coloresEmpleados'

const ROLES = [
  { id: 'mozo', label: 'Mozo', emoji: '🧑‍🍳' },
  { id: 'cocina', label: 'Cocina', emoji: '👨‍🍳' },
  { id: 'cajero', label: 'Cajero', emoji: '💰' },
  { id: 'delivery', label: 'Delivery', emoji: '🛵' }
]
const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const dateKey = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
const weekdayIdx = (y, m, d) => (new Date(y, m, d).getDay() + 6) % 7

function semanasDelMes(year, month) {
  const total = new Date(year, month + 1, 0).getDate()
  const semanas = []
  let actual = []
  for (let d = 1; d <= total; d++) {
    if (weekdayIdx(year, month, d) === 0 && actual.length > 0) { semanas.push(actual); actual = [] }
    actual.push(d)
  }
  if (actual.length > 0) semanas.push(actual)
  return semanas
}

// Un turno guardado aplica ese día si tiene "fechas" exactas que lo incluyen, o
// (horarios viejos) si su "dias" semanal recurrente incluye ese día de la semana.
const turnoAplica = (h, y, m, d) => {
  if (h.fechas && h.fechas.length > 0) return h.fechas.includes(dateKey(y, m, d))
  return (h.dias || []).includes(weekdayIdx(y, m, d))
}

// Calendario SOLO LECTURA del mes en curso, con leyenda de empleados y un color
// distinto por empleado. Lo ve el staff que tenga el permiso "Turnos".
export default function TurnosCalendario({ clienteId }) {
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [viewingEmpId, setViewingEmpId] = useState(null)

  const hoy = new Date()
  const year = hoy.getFullYear()
  const month = hoy.getMonth()

  useEffect(() => {
    if (!clienteId) return
    const cargar = async () => {
      setLoading(true)
      setError('')
      // 1) Función SQL (deja ver a los compañeros). 2) Si aún no existe, lectura directa:
      //    el admin / superadmin ven a todos; el staff solo vería su propia fila.
      const { data: rpcData, error: rpcError } = await supabase.rpc('turnos_equipo', { p_cliente_id: clienteId })
      if (!rpcError && Array.isArray(rpcData)) {
        setUsuarios(rpcData)
      } else {
        const { data, error: e2 } = await supabase
          .from('cliente_usuarios')
          .select('id, nombre, rol, activo, horarios, created_at')
          .eq('cliente_id', clienteId)
          .order('nombre')
        if (e2) setError('No se pudieron cargar los turnos: ' + e2.message)
        else {
          setUsuarios(data || [])
          if (rpcError) console.warn('turnos_equipo no disponible (¿corriste supabase/turnos_equipo.sql?):', rpcError.message)
        }
      }
      setLoading(false)
    }
    cargar()
  }, [clienteId])

  const colores = mapaColoresEmpleados(usuarios)
  const activos = usuarios.filter(u => u.activo !== false)
  const semanas = semanasDelMes(year, month)

  const empleadosDelDia = (d) => activos.filter(u =>
    (viewingEmpId ? u.id === viewingEmpId : true) &&
    (u.horarios || []).some(h => turnoAplica(h, year, month, d))
  )
  const textoTurnos = (u, d) => (u.horarios || [])
    .filter(h => turnoAplica(h, year, month, d))
    .map(t => `${t.nombre ? t.nombre + ': ' : ''}${t.desde}-${t.hasta}${t.desde2 && t.hasta2 ? ` / ${t.desde2}-${t.hasta2}` : ''}`)
    .join(' • ')

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  return (
    <div className="bg-dark-800 rounded-2xl border border-dark-700 p-4 print-calendar-area">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-calendar-area, .print-calendar-area * { visibility: visible; }
          .print-calendar-area { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <h2 className="text-xl font-bold text-white">📅 Turnos · {MESES[month]} {year}</h2>
        {viewingEmpId && (
          <span className="no-print flex items-center gap-2 text-sm bg-primary-500/20 text-primary-400 border border-primary-500/40 rounded-xl px-3 py-1.5">
            Viendo turnos de: <b>{usuarios.find(u => u.id === viewingEmpId)?.nombre}</b>
            <button onClick={() => setViewingEmpId(null)} className="hover:text-white">✕ Ver todos</button>
          </span>
        )}
        <button
          onClick={() => window.print()}
          className="no-print flex items-center gap-1 px-3 py-1.5 bg-dark-700 hover:bg-dark-600 text-white rounded-lg text-sm transition"
        >
          🖨️ Imprimir
        </button>
      </div>

      {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

      <div className="overflow-x-auto">
        <div className="min-w-[700px] bg-dark-700/50 rounded-xl p-3 border border-dark-600">
          <div className="flex items-center gap-1 mb-1">
            {DIAS.map(d => <div key={d} className="flex-1 text-center text-[10px] text-dark-400 font-semibold">{d}</div>)}
          </div>
          <div className="space-y-1">
            {semanas.map((semana, wi) => (
              <div key={wi} className="flex items-stretch gap-1">
                {/* Relleno para alinear la primera semana con su día de la semana */}
                {wi === 0 && Array.from({ length: weekdayIdx(year, month, semana[0]) }).map((_, i) => (
                  <div key={'pre' + i} className="flex-1 min-w-0"></div>
                ))}
                {semana.map(d => {
                  const emps = empleadosDelDia(d)
                  const esHoy = d === hoy.getDate()
                  return (
                    <div
                      key={d}
                      className={`flex-1 min-w-0 min-h-[6.5rem] rounded-lg p-1 border flex flex-col items-center gap-0.5 bg-dark-800 ${esHoy ? 'border-primary-500' : 'border-dark-600'}`}
                    >
                      <span className={`text-xs font-bold ${esHoy ? 'text-primary-400' : 'text-white'}`}>{d}</span>
                      <div className="flex flex-col gap-0.5 w-full">
                        {emps.map(e => {
                          const t = textoTurnos(e, d)
                          return (
                            <span
                              key={e.id}
                              title={`${e.nombre} (${t})`}
                              style={{ backgroundColor: colores[e.id] }}
                              className="text-[10px] leading-tight px-1 py-0.5 rounded text-white truncate"
                            >
                              {e.nombre}
                              <span className="opacity-80"> ({t})</span>
                            </span>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
                {/* Relleno al final de la última semana */}
                {wi === semanas.length - 1 && Array.from({ length: 6 - weekdayIdx(year, month, semana[semana.length - 1]) }).map((_, i) => (
                  <div key={'post' + i} className="flex-1 min-w-0"></div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-dark-600">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-white font-semibold text-sm">Leyenda de empleados</h4>
          {viewingEmpId && (
            <button onClick={() => setViewingEmpId(null)} className="no-print text-xs text-primary-400 hover:underline">Ver todos</button>
          )}
        </div>
        {activos.length === 0 && <p className="text-dark-400 text-sm">Todavía no hay empleados cargados.</p>}
        <div className="flex flex-wrap gap-4">
          {ROLES.map(r => {
            const emps = activos.filter(u => u.rol === r.id)
            if (emps.length === 0) return null
            return (
              <div key={r.id} className="flex flex-col gap-1">
                <span className="text-dark-400 text-xs font-semibold">{r.emoji} {r.label}</span>
                {emps.map(e => (
                  <button
                    key={e.id}
                    onClick={() => setViewingEmpId(prev => prev === e.id ? null : e.id)}
                    className={`flex items-center gap-2 text-left rounded-lg px-1.5 py-0.5 transition ${viewingEmpId === e.id ? 'bg-primary-500/20 ring-1 ring-primary-500' : 'hover:bg-dark-700'}`}
                    title={`Ver solo los turnos de ${e.nombre}`}
                  >
                    <span style={{ backgroundColor: colores[e.id] }} className="w-2.5 h-2.5 rounded-full flex-shrink-0"></span>
                    <span className="text-dark-300 text-xs">{e.nombre}</span>
                  </button>
                ))}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
