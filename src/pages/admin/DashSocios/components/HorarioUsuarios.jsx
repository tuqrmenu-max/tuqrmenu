import { startVisiblePolling } from '@/lib/visiblePolling'
import { createRevisionRefresh } from '@/lib/revisionRefresh'
import { applyDateBounds } from '@/lib/readPages'
import { reportBounds } from '@/lib/reportBounds'
import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'

const mostrar = value => value ? new Date(value).toLocaleString('es-AR') : '—'
// Clave de fecha en huso horario LOCAL (no UTC), para que "Desde/Hasta"
// coincida con el dia que el usuario ve en pantalla.
const claveLocal = value => value ? new Date(value).toLocaleDateString('en-CA') : null

// 60 minutos = 1 hora. Redondeamos al minuto para evitar milisegundos sueltos.
function formatDuracion(ms) {
  if (!ms || ms <= 0) return '0h 00m'
  const totalMin = Math.round(ms / 60000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return `${h}h ${String(m).padStart(2, '0')}m`
}

async function leerTodo(crearConsulta) {
  const registros = []
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await crearConsulta().range(offset, offset + 499)
    if (error) throw error
    registros.push(...(data || []))
    if (!data || data.length < 500) return registros
  }
}

function cargarOcultos(clienteId) {
  try {
    const raw = localStorage.getItem('horario_ocultos_' + clienteId)
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch {
    return new Set()
  }
}

export default function HorarioUsuarios({ clienteId }) {
  const { user, rol } = useAuthStore()
  const [datos, setDatos] = useState({ usuarios: [], registros: [], resumen: [], abiertos: [] })
  // Activar/desactivar a mano: solo admin y superadmin (el servidor lo vuelve a verificar).
  const puedeGestionar = rol === 'admin' || rol === 'superadmin'
  const [procesando, setProcesando] = useState(() => new Set())
  const recargarRef = useRef(null)
  // Reloj para el contador "en curso" de quien está activo (verde).
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 15000)
    return () => clearInterval(t)
  }, [])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [desde, setDesde] = useState(() => claveLocal(new Date()))
  const [hasta, setHasta] = useState(() => claveLocal(new Date()))
  const [pagina, setPagina] = useState(0)
  const PAGE_SIZE = 50
  const [ocultos, setOcultos] = useState(() => new Set())

  useEffect(() => {
    setOcultos(clienteId ? cargarOcultos(clienteId) : new Set())
  }, [clienteId])

  const toggleOculto = (userId) => {
    setOcultos(prev => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      if (clienteId) {
        try { localStorage.setItem('horario_ocultos_' + clienteId, JSON.stringify([...next])) } catch { /* noop */ }
      }
      return next
    })
  }

  useEffect(() => {
    let activo = true
    setDatos({ usuarios: [], registros: [], resumen: [], abiertos: [] })
    setLoading(true)
    setError('')
    const filters = { fecha_desde: desde, fecha_hasta: hasta }
    const bounds = reportBounds(filters)
    const check = createRevisionRefresh(async () => {
      const { data, error } = await supabase.from('clientes').select('qr_horario_version').eq('id', clienteId).single()
      if (error) throw error
      return data?.qr_horario_version
    }, async () => {
      const [usuarios, registros, resumen, abiertos] = await Promise.all([
        leerTodo(() => supabase.rpc('horario_personal', { p_cliente_id: clienteId }).order('nombre').order('id')),
        applyDateBounds(supabase.from('horario_usuarios')
          .select('*').eq('cliente_id', clienteId), 'entrada_at', filters)
          .order('entrada_at', { ascending: false }).order('id').range(pagina * PAGE_SIZE, (pagina + 1) * PAGE_SIZE - 1),
        supabase.rpc('qr_horario_resumen_v2', { p_cliente_id: clienteId, p_desde: bounds.desde, p_hasta: bounds.hasta }),
        // Registros abiertos (verde / contando) sin importar el filtro de fecha ni la página.
        supabase.from('horario_usuarios').select('*').eq('cliente_id', clienteId).is('salida_at', null)
      ])
      if (registros.error) throw registros.error
      if (resumen.error) throw resumen.error
      if (abiertos.error) throw abiertos.error
      if (activo) setDatos({ usuarios, registros: registros.data || [], resumen: resumen.data || [], abiertos: abiertos.data || [] })
    })
    const cargar = async () => {
      if (!activo || !clienteId || !user?.id || document.hidden) return
      try { await check(); if (activo) setError('') }
      catch (e) { if (activo) setError('No se pudo actualizar Horario: ' + e.message) }
      finally { if (activo) setLoading(false) }
    }
    recargarRef.current = cargar
    const stop = startVisiblePolling(cargar, 30000)
    window.addEventListener('focus', cargar)
    const canal = supabase.channel(`horario-usuarios-${clienteId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'horario_usuarios', filter: `cliente_id=eq.${clienteId}` }, cargar)
      .subscribe()
    return () => { activo = false; stop(); window.removeEventListener('focus', cargar); supabase.removeChannel(canal) }
  }, [clienteId, user?.id, rol, desde, hasta, pagina])

  const toggleManual = async (u, activar) => {
    if (!u.user_id) { toast.error('Este usuario no tiene cuenta vinculada'); return }
    const nombre = u.nombre || u.usuario
    if (!activar && !window.confirm(`¿Desactivar el horario de ${nombre}? Se cierra su registro abierto ahora y las horas se suman al total.`)) return
    setProcesando(prev => new Set(prev).add(u.user_id))
    try {
      const { error } = await supabase.rpc('horario_manual', { p_cliente_id: clienteId, p_user_id: u.user_id, p_activo: activar })
      if (error) throw error
      toast.success(activar ? `Horario activado: ${nombre}` : `Horario desactivado: ${nombre}`)
      await recargarRef.current?.()
    } catch (e) {
      const falta = e?.code === 'PGRST202' || /horario_manual/.test(e?.message || '')
      toast.error('No se pudo ' + (activar ? 'activar' : 'desactivar') + ' el horario: ' + e.message + (falta ? ' (¿ejecutaste supabase/horario_manual_y_permiso.sql?)' : ''), { duration: 8000 })
    } finally {
      setProcesando(prev => { const n = new Set(prev); n.delete(u.user_id); return n })
    }
  }

  const hayFiltro = Boolean(desde || hasta)
  const dentroDelRango = (registro) => {
    if (!hayFiltro) return true
    const clave = claveLocal(registro.entrada_at)
    if (!clave) return false
    if (desde && clave < desde) return false
    if (hasta && clave > hasta) return false
    return true
  }
  const limpiarFiltro = () => { setPagina(0); setDesde(''); setHasta('') }

  const personas = new Map(datos.usuarios.map(u => [u.user_id || u.id, u]))
  // Conserva el historial aunque un usuario sea eliminado de Usuarios.
  datos.resumen.forEach(r => { if (!personas.has(r.user_id)) personas.set(r.user_id, { ...r, id: r.user_id }) })
  datos.registros.forEach(r => { if (!personas.has(r.user_id)) personas.set(r.user_id, { ...r, id: r.user_id }) })

  // Precalculamos todo por persona para poder armar el total del final.
  const filas = [...personas.values()].map(u => {
    const historial = datos.registros.filter(r => r.user_id === u.user_id)
    // Conexion/estado actual siempre segun el historial completo, nunca segun el filtro de fecha.
    // Verde = tiene un registro sin salida (logueado). Negro = ya cerró
    // sesión y quedó su salida guardada. No hay vencimiento por tiempo:
    // el único evento que lo cambia es Cerrar sesión.
    const abiertos = datos.abiertos.filter(r => r.user_id === u.user_id)
    const resumen = datos.resumen.find(r => r.user_id === u.user_id)
    const conectado = abiertos.length > 0 || Boolean(resumen?.conectado)
    const manualActivo = abiertos.some(r => r.manual)
    // Tiempo corriendo del registro abierto más antiguo (no se suma al total hasta cerrarse).
    const inicioEnCurso = abiertos.length ? Math.min(...abiertos.map(r => new Date(r.entrada_at).getTime())) : null
    const enCursoMs = inicioEnCurso ? Math.max(0, ahora - inicioEnCurso) : 0
    const historialFiltrado = hayFiltro ? historial.filter(dentroDelRango) : historial
    const totalMs = Number(resumen?.total_ms || 0)
    const oculto = ocultos.has(u.user_id)
    return { u, historial, abiertos, conectado, manualActivo, enCursoMs, historialFiltrado, totalMs, oculto, resumen }
  })
  const totalGeneralMs = filas.reduce((acc, f) => f.oculto ? acc : acc + f.totalMs, 0)
  const hayOcultos = filas.some(f => f.oculto)

  return <div className="bg-dark-800 border border-dark-700 rounded-xl overflow-hidden">
    <div className="p-4 border-b border-dark-700">
      <h2 className="text-xl text-white font-bold">🕐 Horario</h2>
      <p className="text-dark-300 text-sm mt-2">Ingreso al iniciar sesión y salida con Cerrar sesión. El verde se mantiene hasta que cierra sesión (no se vence solo con el tiempo). El Admin y el Superadmin también pueden activar o desactivar el horario de cada usuario con el botón al lado de su nombre: queda en verde y cuenta el tiempo hasta desactivarlo o hasta que el usuario cierre sesión; entonces se suma al total.</p>
      <div className="flex flex-wrap items-end gap-3 mt-4">
        <label className="text-xs text-dark-300 flex flex-col gap-1">
          Desde
          <input type="date" value={desde} onChange={e => { setPagina(0); setDesde(e.target.value) }}
            className="bg-dark-700 border border-dark-600 rounded-lg text-white text-sm px-2 py-1.5" />
        </label>
        <label className="text-xs text-dark-300 flex flex-col gap-1">
          Hasta
          <input type="date" value={hasta} onChange={e => { setPagina(0); setHasta(e.target.value) }}
            className="bg-dark-700 border border-dark-600 rounded-lg text-white text-sm px-2 py-1.5" />
        </label>
        {hayFiltro && (
          <button onClick={limpiarFiltro} className="text-xs text-dark-300 hover:text-white underline mb-1.5">
            Limpiar filtro
          </button>
        )}
        {hayFiltro && (
          <span className="text-xs text-dark-400 mb-1.5">Horas totales calculadas solo con turnos ya cerrados dentro del rango.</span>
        )}
      </div>
    </div>
    {error && <p role="alert" className="p-4 text-red-400">{error}</p>}
    {loading && <p className="p-4 text-dark-300">Cargando…</p>}
    <div className="flex flex-wrap items-center gap-3 p-4 text-white text-sm">
      <button disabled={pagina === 0} className="bg-dark-700 px-3 py-2 rounded disabled:opacity-40" onClick={() => setPagina(p => p - 1)}>Anterior</button>
      <span>Página {pagina + 1} · Horas de todo el rango; estado actual sin filtro de fecha</span>
      <button disabled={(pagina + 1) * PAGE_SIZE >= datos.resumen.reduce((n, r) => n + Number(r.registros), 0)} className="bg-dark-700 px-3 py-2 rounded disabled:opacity-40" onClick={() => setPagina(p => p + 1)}>Siguiente</button>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="bg-dark-700 text-white">{['Ver', 'Nombre', 'Usuario', 'Estado actual', 'Ingreso', 'Salida', 'Horas'].map(t => <th key={t} className="p-3 text-left">{t}</th>)}</tr></thead>
        {filas.map(({ u, historial, abiertos, conectado, manualActivo, enCursoMs, historialFiltrado, totalMs, oculto, resumen }) => {
          if (oculto) {
            return <tbody key={u.id}>
              <tr className="border-t border-dark-700 opacity-50">
                <td className="p-3">
                  <input type="checkbox" checked={false} onChange={() => toggleOculto(u.user_id)} title="Mostrar de nuevo" />
                </td>
                <td className="p-3 text-dark-400 italic">{u.nombre || u.usuario}</td>
                <td className="p-3 text-dark-500 italic" colSpan={5}>Oculto — tildá el check para volver a verlo</td>
              </tr>
            </tbody>
          }
          const filasHist = historialFiltrado.length ? historialFiltrado : [null]
          return <tbody key={u.id} style={conectado ? { outline: '2px solid #22c55e', outlineOffset: '-2px', backgroundColor: 'rgba(34,197,94,0.08)' } : undefined}>
            {filasHist.map((r, index) => {
              const duracionFila = r?.salida_at ? formatDuracion(new Date(r.salida_at) - new Date(r.entrada_at)) : null
              return <tr key={r?.id || u.id} className="border-t border-dark-700 align-top">
                {index === 0 && <>
                  <td rowSpan={filasHist.length} className="p-3">
                    <input type="checkbox" checked={true} onChange={() => toggleOculto(u.user_id)} title="Ocultar este usuario" />
                  </td>
                  <td rowSpan={filasHist.length} className={`p-3 font-bold ${conectado ? 'text-green-400' : 'text-white'}`}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span>{u.nombre || u.usuario}</span>
                      {puedeGestionar && u.user_id && (
                        <button
                          type="button"
                          onClick={() => toggleManual(u, !conectado)}
                          disabled={procesando.has(u.user_id)}
                          title={conectado ? 'Desactivar el horario de este usuario (cierra su registro abierto)' : 'Activar el horario de este usuario (queda en verde y empieza a contar)'}
                          className={`text-xs font-semibold px-2 py-1 rounded border disabled:opacity-50 whitespace-nowrap ${conectado ? 'border-red-500/60 text-red-400 hover:bg-red-500/10' : 'border-green-500/60 text-green-400 hover:bg-green-500/10'}`}
                        >
                          {procesando.has(u.user_id) ? '…' : conectado ? '⏹ Desactivar' : '▶ Activar'}
                        </button>
                      )}
                    </div>
                  </td>
                  <td rowSpan={filasHist.length} className="p-3 text-dark-300">{u.usuario}</td>
                  <td rowSpan={filasHist.length} className={`p-3 ${conectado ? 'text-green-400' : 'text-dark-300'}`}>{conectado ? (manualActivo ? 'Activo (manual)' : 'Logueado') : resumen?.registros_total > 0 ? 'Sesión cerrada' : 'Sin ingresos'}</td>
                </>}
                <td className="p-3 text-dark-300 whitespace-nowrap">{mostrar(r?.entrada_at)}{r?.manual && <span className="ml-1 text-xs text-amber-400" title="Activado a mano por el administrador">✋ manual</span>}</td>
                <td className="p-3 text-dark-300 whitespace-nowrap">
                  {r && !r.salida_at ? <span className="text-green-400">En curso (sin salida)</span> : mostrar(r?.salida_at)}
                  {duracionFila && <span className="text-dark-500"> ({duracionFila})</span>}
                </td>
                {index === 0 && (
                  <td rowSpan={filasHist.length} className="p-3 text-white font-semibold whitespace-nowrap">
                    {resumen?.registros > 0 ? formatDuracion(totalMs) : '—'}
                    {conectado && <div className="text-green-400 text-xs font-normal mt-1" title="Se suma al total cuando se cierra el horario">⏱ en curso: {formatDuracion(enCursoMs)}</div>}
                  </td>
                )}
              </tr>
            })}
          </tbody>
        })}
        {!loading && !error && personas.size > 0 && (
          <tfoot>
            <tr className="border-t-2 border-dark-600 bg-dark-700/60">
              <td className="p-3" colSpan={6}>
                <span className="text-white font-bold">Total {hayOcultos ? '(usuarios visibles)' : ''}</span> <span className="text-dark-400 text-xs">(solo horarios cerrados; el tiempo en curso se suma al cerrarse)</span>
              </td>
              <td className="p-3 text-white font-bold whitespace-nowrap">{formatDuracion(totalGeneralMs)}</td>
            </tr>
          </tfoot>
        )}
      </table>
      {!loading && !error && !personas.size && <p className="p-4 text-dark-300">No hay usuarios registrados.</p>}
    </div>
  </div>
}
