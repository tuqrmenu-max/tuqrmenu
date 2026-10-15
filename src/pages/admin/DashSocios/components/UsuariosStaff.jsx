import { useState, useEffect } from 'react'
import { supabase, createIsolatedClient } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { mapaColoresEmpleados } from '@/lib/coloresEmpleados'
import toast from 'react-hot-toast'

const ROLES = [
  { id: 'mozo', label: 'Mozo', emoji: '🧑‍🍳' },
  { id: 'cocina', label: 'Cocina', emoji: '👨‍🍳' },
  { id: 'cajero', label: 'Cajero', emoji: '💰' },
  { id: 'delivery', label: 'Delivery', emoji: '🛵' }
]

// Dominio interno de Supabase Auth según el rol del empleado.
// El staff nunca ve este email: se loguea con "usuario" (ver resolver_login_usuario en useAuth.js).
const DOMINIO_POR_ROL = {
  mozo: 'mozo.qrmenu.com',
  cocina: 'cocina.qrmenu.com',
  cajero: 'caja.qrmenu.com',
  delivery: 'delivery.qrmenu.com'
}

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

function rolInfo(rol) {
  return ROLES.find(r => r.id === rol) || { label: rol, emoji: '👤' }
}

const SECCIONES = [
  { id: 'mesas', label: 'Mesas' },
  { id: 'carta', label: 'Carta' },
  { id: 'diseno', label: 'Diseño' },
  { id: 'caja', label: 'Caja' },
  { id: 'cocina', label: 'Cocina' },
  { id: 'promociones', label: 'Promos' },
  { id: 'suscripciones', label: 'Suscriptos' },
  { id: 'ticket', label: 'Ticket' },
  { id: 'horario', label: 'Horario (registros propios)' },
  { id: 'usuarios', label: 'Usuarios' }
]

// Acciones puntuales dentro de la sección "Mesas". Independiente de si
// el rol puede ver la sección (tabla de arriba); esto decide qué botones
// concretos aparecen dentro de Mesas para cada rol.
const MESA_ACCIONES = [
  { id: 'agregar_mesa', label: 'Agregar mesas (crear mesas)' },
  { id: 'chat', label: 'Chat' },
  { id: 'descargar_qr', label: 'Descargar todos los QR' },
  { id: 'borrar_mesa', label: 'Borrar mesa' }
]

// Botones de la sección Carta que el superadmin puede mostrar u ocultar para el
// admin del restaurante. Se guardan en clientes.permisos_carta_admin.
const CARTA_ACCIONES = [
  { id: 'importar_excel', label: 'Importar Excel' },
  { id: 'descargar_imagenes', label: 'Descargar imágenes' },
  { id: 'imagenes_categorias', label: 'Imágenes categorías' },
  { id: 'imagenes_productos', label: 'Imágenes productos' },
  { id: 'eliminar_categorias', label: 'Eliminar categorías (botón ×)' },
  { id: 'eliminar_productos', label: 'Eliminar productos (botón 🗑️)' }
]

export default function UsuariosStaff({ clienteId }) {
  const { rol } = useAuth()
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ nombre: '', usuario: '', password: '', rol: 'mozo' })
  const [permisos, setPermisos] = useState({ mozo: ['mesas'], cajero: ['mesas', 'caja'], cocina: ['cocina'], delivery: ['mesas'] })
  const [permisosMesas, setPermisosMesas] = useState({ mozo: ['chat'], cajero: ['agregar_mesa', 'chat', 'descargar_qr'], cocina: ['chat'], delivery: ['chat'] })
  const [mesasExpandido, setMesasExpandido] = useState(false)
  const [cajaExpandido, setCajaExpandido] = useState(false)
  const [promosExpandido, setPromosExpandido] = useState(false)
  const [turnosExpandido, setTurnosExpandido] = useState(false)
  const [horarioExpandido, setHorarioExpandido] = useState(false)
  const [cartaExpandido, setCartaExpandido] = useState(false)
  const [permisosCarta, setPermisosCarta] = useState({})
  const [savingCarta, setSavingCarta] = useState(false)
  const [savingPermisos, setSavingPermisos] = useState(false)

  // Horarios (turnos por lote, similar a "Horarios de Usuarios")
  const [turnos, setTurnos] = useState([{ id: 't1', nombre: 'Turno 1', guardado: false, activo: true, desde: '09:00', hasta: '13:00', desde2: '', hasta2: '', dias: [0, 1, 2, 3, 4] }])
  const [turnoCounter, setTurnoCounter] = useState(2)
  const [selected, setSelected] = useState([])
  const [savingHorarios, setSavingHorarios] = useState(false)

  // Calendario
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear())
  const [expandedMonth, setExpandedMonth] = useState(new Date().getMonth())
  const [calendarDays, setCalendarDays] = useState({})
  // Empleado cuyo horario guardado se está mirando en el calendario grande
  // (se activa haciendo click en su nombre en la leyenda). null = ver todos.
  const [viewingEmpId, setViewingEmpId] = useState(null)

  useEffect(() => {
    if (clienteId) { fetchUsuarios(); fetchPermisos() }
  }, [clienteId])

  const fetchPermisos = async () => {
    const { data } = await supabase.from('clientes').select('permisos_roles, permisos_mesas_acciones').eq('id', clienteId).single()
    if (data?.permisos_roles) setPermisos(prev => ({ ...prev, ...data.permisos_roles }))
    if (data?.permisos_mesas_acciones) setPermisosMesas(prev => ({ ...prev, ...data.permisos_mesas_acciones }))
    // Consulta aparte: si la columna todavía no existe no rompe el resto de permisos.
    const { data: dc, error: ec } = await supabase.from('clientes').select('permisos_carta_admin, ocultar_excel_imagenes').eq('id', clienteId).single()
    if (!ec && dc) {
      const legacy = !!dc.ocultar_excel_imagenes
      const base = {}
      CARTA_ACCIONES.forEach(a => {
        base[a.id] = ['eliminar_categorias', 'eliminar_productos'].includes(a.id) ? true : !legacy
      })
      setPermisosCarta({ ...base, ...(dc.permisos_carta_admin || {}) })
    }
  }

  const toggleAccionCarta = (accionId) => {
    setPermisosCarta(prev => ({ ...prev, [accionId]: !prev[accionId] }))
  }

  const guardarPermisosCarta = async () => {
    setSavingCarta(true)
    const { error } = await supabase.from('clientes').update({ permisos_carta_admin: permisosCarta }).eq('id', clienteId)
    setSavingCarta(false)
    if (error) toast.error('Error: ' + error.message + ' (¿corriste supabase/permisos_carta_admin.sql?)')
    else toast.success('Permisos de Carta guardados')
  }

  const toggleSeccion = (rol, seccionId) => {
    setPermisos(prev => {
      const actual = prev[rol] || []
      const nuevo = actual.includes(seccionId) ? actual.filter(s => s !== seccionId) : [...actual, seccionId]
      return { ...prev, [rol]: nuevo }
    })
  }

  const toggleAccionMesa = (rol, accionId) => {
    setPermisosMesas(prev => {
      const actual = prev[rol] || []
      const nuevo = actual.includes(accionId) ? actual.filter(a => a !== accionId) : [...actual, accionId]
      return { ...prev, [rol]: nuevo }
    })
  }

  const guardarPermisos = async () => {
    setSavingPermisos(true)
    const { error } = await supabase.from('clientes').update({ permisos_roles: permisos, permisos_mesas_acciones: permisosMesas }).eq('id', clienteId)
    setSavingPermisos(false)
    if (error) toast.error('Error: ' + error.message)
    else toast.success('Permisos guardados')
  }

  const fetchUsuarios = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('cliente_usuarios')
      .select('*')
      .eq('cliente_id', clienteId)
      .order('nombre')
    setUsuarios(data || [])
    setLoading(false)
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!form.nombre.trim() || !form.usuario.trim() || form.password.length < 6) {
      toast.error('Completá nombre, usuario y una contraseña de al menos 6 caracteres')
      return
    }
    setCreating(true)
    try {
      const usuario = form.usuario.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '')
      if (!usuario) {
        toast.error('El usuario solo puede tener letras, números, puntos, guiones y guiones bajos')
        setCreating(false)
        return
      }
      // Email interno: nunca lo ve el staff, solo lo usamos para Supabase Auth.
      // Se loguean con su "usuario" (ver resolver_login_usuario en useAuth.js).
      // Formato: usuario@caja.qrmenu.com / @mozo.qrmenu.com / @cocina.qrmenu.com según el rol.
      // "usuario" ya es único en toda la plataforma (índice único en cliente_usuarios),
      // así que el email queda único sin necesitar el id del cliente.
      const dominio = DOMINIO_POR_ROL[form.rol] || 'staff.qrmenu.com'
      const syntheticEmail = `${usuario}@${dominio}`

      // Cliente aislado: crea la cuenta sin pisar la sesion del dueño logueado.
      const isolated = createIsolatedClient()
      const { data: authData, error: authError } = await isolated.auth.signUp({
        email: syntheticEmail,
        password: form.password
      })
      if (authError) {
        if (authError.message?.includes('already registered')) {
          toast.error('Ese usuario ya existe, elegí otro')
        } else {
          toast.error(authError.message)
        }
        setCreating(false)
        return
      }

      const { error } = await supabase.from('cliente_usuarios').insert({
        cliente_id: clienteId,
        user_id: authData.user.id,
        nombre: form.nombre.trim(),
        email: syntheticEmail,
        usuario,
        rol: form.rol,
        activo: true,
        horarios: []
      })
      if (error) {
        // El login en Supabase Auth ya se creó (arriba) aunque esto falle,
        // así que si el admin reintenta con el mismo "usuario" va a chocar
        // con "ya existe". Se lo avisamos explícitamente para que sepa que
        // tiene que borrar esa cuenta huérfana desde Authentication > Users
        // antes de volver a intentar.
        toast.error(
          `Se creó el login pero no se pudo guardar el perfil (${error.message}). ` +
          `Borrá el usuario "${syntheticEmail}" desde Supabase → Authentication → Users y volvé a intentar.`,
          { duration: 8000 }
        )
        setCreating(false)
        return
      }

      toast.success(`Usuario "${usuario}" creado`)
      setShowModal(false)
      setForm({ nombre: '', usuario: '', password: '', rol: 'mozo' })
      fetchUsuarios()
    } finally {
      setCreating(false)
    }
  }

  const toggleActivo = async (u) => {
    const { error } = await supabase.from('cliente_usuarios').update({ activo: !u.activo }).eq('id', u.id)
    if (error) return toast.error(error.message)
    fetchUsuarios()
  }

  const handleDelete = async (u) => {
    if (!confirm(`¿Borrar a ${u.nombre}? No va a poder loguearse más.`)) return
    const { error } = await supabase.from('cliente_usuarios').delete().eq('id', u.id)
    if (error) return toast.error(error.message)
    toast.success('Usuario eliminado')
    fetchUsuarios()
  }

  // ---- Turnos ----
  const addTurno = () => {
    const newId = 't' + turnoCounter
    // Se agrega al final del array existente (spread de "prev"), así que la
    // configuración de los turnos ya creados nunca se toca ni se pisa.
    setTurnos(prev => [...prev, { id: newId, nombre: 'Turno ' + turnoCounter, guardado: false, activo: true, desde: '09:00', hasta: '13:00', desde2: '', hasta2: '', dias: [0, 1, 2, 3, 4] }])
    setTurnoCounter(prev => prev + 1)
  }
  const removeTurno = (id) => setTurnos(prev => prev.filter(t => t.id !== id))
  const updateTurno = (id, patch) => setTurnos(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t))
  // Bloquea el turno para que sus campos dejen de poder editarse (se
  // desbloquea de nuevo con "Modificar"). No guarda nada en la base por sí
  // solo: eso lo sigue haciendo el botón "Guardar y aplicar" de más abajo.
  const guardarTurno = (id) => {
    const t = turnos.find(t => t.id === id)
    if (!t?.nombre?.trim()) {
      toast.error('Ponele un nombre al turno antes de guardarlo')
      return
    }
    if (!t.desde || !t.hasta) {
      toast.error('Completá el horario (desde/hasta) antes de guardarlo')
      return
    }
    updateTurno(id, { guardado: true })
  }
  const modificarTurno = (id) => updateTurno(id, { guardado: false })
  const toggleDia = (turnoId, diaIdx) => {
    setTurnos(prev => prev.map(t => {
      if (t.id !== turnoId) return t
      const dias = t.dias.includes(diaIdx) ? t.dias.filter(d => d !== diaIdx) : [...t.dias, diaIdx].sort()
      return { ...t, dias }
    }))
  }

  const toggleSelected = (id) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }
  const selectAllRol = (rol) => {
    const ids = usuarios.filter(u => u.rol === rol).map(u => u.id)
    const allIn = ids.every(id => selected.includes(id))
    setSelected(prev => allIn ? prev.filter(id => !ids.includes(id)) : [...new Set([...prev, ...ids])])
  }

  // Guarda y aplica: si hay días tildados en el calendario de abajo, se usan
  // esas fechas EXACTAS (no un patrón de día de la semana — antes convertía
  // "1, 2, 3 y 9 de septiembre" en "todos los lunes/martes/miércoles del
  // calendario", que estaba mal); si no tildaste ningún día, se usan los
  // días configurados en cada turno (semanal recurrente, como antes).
  const guardarHorarios = async () => {
    if (selected.length === 0) {
      toast.error('Seleccioná al menos un empleado')
      return
    }
    setSavingHorarios(true)
    try {
      // "guardado" es solo un flag de la pantalla (bloquea la edición mientras
      // se arma el turno); no tiene sentido guardarlo en la base.
      const activos = turnos.filter(t => t.activo).map(({ guardado, ...rest }) => rest)
      const selectedDayKeys = Object.entries(calendarDays).filter(([_, v]) => v).map(([k]) => k)

      let horariosParaGuardar = activos
      if (selectedDayKeys.length > 0) {
        // Guardamos las fechas puntuales tal cual ("2026-09-01", "2026-09-09",
        // etc.), reemplazando cualquier "dias" recurrente anterior de este turno.
        horariosParaGuardar = activos.map(t => ({ ...t, fechas: selectedDayKeys, dias: undefined }))
      }

      for (const id of selected) {
        const { error } = await supabase.from('cliente_usuarios').update({ horarios: horariosParaGuardar }).eq('id', id)
        if (error) throw error
      }
      toast.success('Horarios aplicados a ' + selected.length + ' empleado(s)')
      // Recargamos los usuarios para que el calendario grande (que ahora se arma
      // con el horario ya GUARDADO de cada empleado) refleje el cambio al toque.
      await fetchUsuarios()
    } catch (err) {
      toast.error('Error: ' + err.message)
    } finally {
      setSavingHorarios(false)
    }
  }

  const MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
  const MONTHS_FULL = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

  function getWeeksInMonth(year, month) {
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const weeks = []
    let currentWeek = []
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day)
      const dayOfWeek = (date.getDay() + 6) % 7
      if (dayOfWeek === 0 && currentWeek.length > 0) {
        weeks.push(currentWeek)
        currentWeek = []
      }
      currentWeek.push(day)
    }
    if (currentWeek.length > 0) weeks.push(currentWeek)
    return weeks
  }

  function formatDateKey(year, month, day) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  const isDaySelected = (year, month, day) => {
    return !!calendarDays[formatDateKey(year, month, day)]
  }

  const toggleDay = (year, month, day) => {
    const key = formatDateKey(year, month, day)
    setCalendarDays(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const toggleWeek = (year, month, weekIndex) => {
    const weeks = getWeeksInMonth(year, month)
    const week = weeks[weekIndex]
    setCalendarDays(prev => {
      const newState = { ...prev }
      const allSelected = week.every(d => newState[formatDateKey(year, month, d)])
      week.forEach(d => {
        const key = formatDateKey(year, month, d)
        newState[key] = !allSelected
      })
      return newState
    })
  }

  const isWeekFullySelected = (year, month, weekIndex) => {
    const weeks = getWeeksInMonth(year, month)
    const week = weeks[weekIndex]
    return week.every(d => calendarDays[formatDateKey(year, month, d)])
  }

  const isWeekPartial = (year, month, weekIndex) => {
    const weeks = getWeeksInMonth(year, month)
    const week = weeks[weekIndex]
    const some = week.some(d => calendarDays[formatDateKey(year, month, d)])
    const all = week.every(d => calendarDays[formatDateKey(year, month, d)])
    return some && !all
  }

  const getSelectedEmployees = () => {
    return usuarios.filter(u => selected.includes(u.id))
  }

  // ---- Lectura del horario ya guardado (lo que trae cada usuario de la base) ----
  const weekdayIdx = (year, month, day) => (new Date(year, month, day).getDay() + 6) % 7

  // Un turno guardado "aplica" ese día si:
  // - tiene "fechas" (guardado por el calendario) y esa fecha exacta está en la lista, o
  // - tiene "dias" (guardado sin tildar calendario, semanal recurrente por día
  //   de semana — se mantiene por compatibilidad con horarios guardados antes
  //   de este arreglo).
  const turnoAplicaEseDia = (h, year, month, day) => {
    if (h.fechas && h.fechas.length > 0) {
      return h.fechas.includes(formatDateKey(year, month, day))
    }
    return (h.dias || []).includes(weekdayIdx(year, month, day))
  }

  // Empleados activos que, según su horario GUARDADO, trabajan ese día puntual.
  // Si hay un empleado "en foco" (viewingEmpId), solo se devuelve ese.
  const empleadosGuardadosDelDia = (year, month, day) => {
    return usuarios.filter(u =>
      u.activo !== false &&
      (viewingEmpId ? u.id === viewingEmpId : true) &&
      (u.horarios || []).some(h => turnoAplicaEseDia(h, year, month, day))
    )
  }

  // Turnos guardados de un empleado puntual que caen ese día.
  const turnosGuardadosDelDia = (empleado, year, month, day) => {
    return (empleado.horarios || []).filter(h => turnoAplicaEseDia(h, year, month, day))
  }

  // ---- Borrar turnos definidos (paso 1, solo el borrador en pantalla) ----
  const borrarTurnosDefinidos = () => {
    if (!confirm('¿Borrar los turnos definidos arriba? Esto no toca lo que ya está guardado para los empleados.')) return
    const newId = 't' + turnoCounter
    setTurnos([{ id: newId, nombre: 'Turno ' + turnoCounter, guardado: false, activo: true, desde: '09:00', hasta: '13:00', desde2: '', hasta2: '', dias: [0, 1, 2, 3, 4] }])
    setTurnoCounter(prev => prev + 1)
    setCalendarDays({})
  }

  // ---- Borrar el horario guardado de los empleados tildados en el paso 2 ----
  const borrarHorariosEmpleados = async () => {
    if (selected.length === 0) {
      toast.error('Seleccioná al menos un empleado')
      return
    }
    if (!confirm(`¿Borrar el horario guardado de ${selected.length} empleado(s)? Van a quedar sin turnos asignados.`)) return
    setSavingHorarios(true)
    try {
      for (const id of selected) {
        const { error } = await supabase.from('cliente_usuarios').update({ horarios: [] }).eq('id', id)
        if (error) throw error
      }
      toast.success('Horario borrado para ' + selected.length + ' empleado(s)')
      if (viewingEmpId && selected.includes(viewingEmpId)) setViewingEmpId(null)
      fetchUsuarios()
    } catch (err) {
      toast.error('Error: ' + err.message)
    } finally {
      setSavingHorarios(false)
    }
  }

  // Un color distinto por empleado (no por rol): dos mozos nunca comparten color.
  const coloresEmp = mapaColoresEmpleados(usuarios)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Permisos por rol: por ahora solo la sección Mesas, configurada como
          acordeón (clic para desplegar sus botones puntuales). El resto de
          las secciones (Carta, Caja, Promos, etc.) se va a ir migrando a
          este mismo formato una por una más adelante — por eso no se
          muestran acá todavía, no se borró nada, solo se ocultó. */}
      <div className="bg-dark-800 rounded-2xl border border-dark-700 p-4">
        <h2 className="text-xl font-bold text-white mb-1">🔒 Permisos por rol</h2>
        <p className="text-dark-400 text-sm mb-4">Elegí qué puede hacer cada rol dentro de cada sección. Vamos a ir sumando secciones de a una.</p>

        <button
          onClick={() => setMesasExpandido(v => !v)}
          className="w-full flex items-center justify-between bg-dark-700 hover:bg-dark-600 transition rounded-lg px-4 py-3 text-white font-bold"
        >
          <span>🍽️ Mesas</span>
          <span className="text-dark-400 text-sm font-normal">{mesasExpandido ? '▲' : '▼'}</span>
        </button>

        {mesasExpandido && (
          <div className="mt-4 pl-1">
            <p className="text-dark-400 text-sm mb-3">Tildá para habilitar cada botón puntual dentro de la pantalla Mesas. Admin y Superadmin siempre los ven todos.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-dark-400">
                    <th className="py-2 pr-4">Acción</th>
                    {ROLES.map(r => <th key={r.id} className="py-2 px-3 text-center">{r.emoji} {r.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {MESA_ACCIONES.map(acc => (
                    <tr key={acc.id} className="border-t border-dark-700">
                      <td className="py-2 pr-4 text-white">{acc.label}</td>
                      {ROLES.map(r => (
                        <td key={r.id} className="py-2 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={(permisosMesas[r.id] || []).includes(acc.id)}
                            onChange={() => toggleAccionMesa(r.id, acc.id)}
                            className="accent-primary-500 w-4 h-4"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              onClick={guardarPermisos}
              disabled={savingPermisos}
              className="mt-4 px-4 py-2 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition"
            >
              {savingPermisos ? 'Guardando...' : '💾 Guardar permisos'}
            </button>
          </div>
        )}

        {/* Carta: solo el superadmin decide qué botones de Carta ve el admin. */}
        {rol === 'superadmin' && (
          <>
            <button
              onClick={() => setCartaExpandido(v => !v)}
              className="w-full mt-3 flex items-center justify-between bg-dark-700 hover:bg-dark-600 transition rounded-lg px-4 py-3 text-white font-bold"
            >
              <span>📋 Carta</span>
              <span className="text-dark-400 text-sm font-normal">{cartaExpandido ? '▲' : '▼'}</span>
            </button>

            {cartaExpandido && (
              <div className="mt-4 pl-1">
                <p className="text-dark-400 text-sm mb-3">Tildá para que el admin vea cada botón dentro de Carta. Destildado = el botón se oculta. El Superadmin siempre los ve todos.</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-dark-400">
                        <th className="py-2 pr-4">Botón</th>
                        <th className="py-2 px-3 text-center">👤 Admin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {CARTA_ACCIONES.map(acc => (
                        <tr key={acc.id} className="border-t border-dark-700">
                          <td className="py-2 pr-4 text-white">{acc.label}</td>
                          <td className="py-2 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={!!permisosCarta[acc.id]}
                              onChange={() => toggleAccionCarta(acc.id)}
                              className="accent-primary-500 w-4 h-4"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button
                  onClick={guardarPermisosCarta}
                  disabled={savingCarta}
                  className="mt-4 px-4 py-2 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition"
                >
                  {savingCarta ? 'Guardando...' : '💾 Guardar permisos'}
                </button>
              </div>
            )}
          </>
        )}

        {/* Caja: habilita la pestaña Caja (consulta de tickets cobrados, con
            filtros por mozo y por delivery) para cada rol. Usa el mismo
            permisos_roles que ya lee el sidebar y el panel. */}
        <button
          onClick={() => setCajaExpandido(v => !v)}
          className="w-full mt-3 flex items-center justify-between bg-dark-700 hover:bg-dark-600 transition rounded-lg px-4 py-3 text-white font-bold"
        >
          <span>💰 Caja</span>
          <span className="text-dark-400 text-sm font-normal">{cajaExpandido ? '▲' : '▼'}</span>
        </button>

        {cajaExpandido && (
          <div className="mt-4 pl-1">
            <p className="text-dark-400 text-sm mb-3">Tildá para que ese rol vea la pestaña Caja y pueda consultar movimientos (tickets cobrados, propinas y delivery) filtrando por mozo o por delivery. Admin y Superadmin siempre la ven.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-dark-400">
                    <th className="py-2 pr-4">Sección</th>
                    {ROLES.map(r => <th key={r.id} className="py-2 px-3 text-center">{r.emoji} {r.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-dark-700">
                    <td className="py-2 pr-4 text-white">Ver Caja (consulta de movimientos)</td>
                    {ROLES.map(r => (
                      <td key={r.id} className="py-2 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={(permisos[r.id] || []).includes('caja')}
                          onChange={() => toggleSeccion(r.id, 'caja')}
                          className="accent-primary-500 w-4 h-4"
                        />
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
            <button
              onClick={guardarPermisos}
              disabled={savingPermisos}
              className="mt-4 px-4 py-2 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition"
            >
              {savingPermisos ? 'Guardando...' : '💾 Guardar permisos'}
            </button>
          </div>
        )}

        {/* Promos: habilita la pestaña Promos para cada rol. Es solo de consulta:
            el staff ve las promociones pero no puede crear ni eliminar
            (lo resuelve PromocionesAdmin según el rol). Usa el mismo
            permisos_roles que ya lee el sidebar y el panel. */}
        <button
          onClick={() => setPromosExpandido(v => !v)}
          className="w-full mt-3 flex items-center justify-between bg-dark-700 hover:bg-dark-600 transition rounded-lg px-4 py-3 text-white font-bold"
        >
          <span>🎁 Promos</span>
          <span className="text-dark-400 text-sm font-normal">{promosExpandido ? '▲' : '▼'}</span>
        </button>

        {promosExpandido && (
          <div className="mt-4 pl-1">
            <p className="text-dark-400 text-sm mb-3">Tildá para que ese rol vea la pestaña Promos. Es solo de consulta: no pueden crear ni eliminar promociones (los botones "Nueva Promo" y "Eliminar" quedan ocultos). Admin y Superadmin siempre las ven y las gestionan.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-dark-400">
                    <th className="py-2 pr-4">Sección</th>
                    {ROLES.map(r => <th key={r.id} className="py-2 px-3 text-center">{r.emoji} {r.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-dark-700">
                    <td className="py-2 pr-4 text-white">Ver Promos (solo consulta)</td>
                    {ROLES.map(r => (
                      <td key={r.id} className="py-2 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={(permisos[r.id] || []).includes('promociones')}
                          onChange={() => toggleSeccion(r.id, 'promociones')}
                          className="accent-primary-500 w-4 h-4"
                        />
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
            <button
              onClick={guardarPermisos}
              disabled={savingPermisos}
              className="mt-4 px-4 py-2 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition"
            >
              {savingPermisos ? 'Guardando...' : '💾 Guardar permisos'}
            </button>
          </div>
        )}

        {/* Horario del equipo: permite que un rol (ej. cajero) vea el Horario de TODOS los
            usuarios. Sin tildar, ve solo sus propios registros (si tiene "Horario" arriba).
            Activar/desactivar el horario a mano es solo de Admin y Superadmin. */}
        <button
          onClick={() => setHorarioExpandido(v => !v)}
          className="w-full mt-3 flex items-center justify-between bg-dark-700 hover:bg-dark-600 transition rounded-lg px-4 py-3 text-white font-bold"
        >
          <span>🕐 Horario del equipo</span>
          <span className="text-dark-400 text-sm font-normal">{horarioExpandido ? '▲' : '▼'}</span>
        </button>

        {horarioExpandido && (
          <div className="mt-4 pl-1">
            <p className="text-dark-400 text-sm mb-3">Tildá para que ese rol vea en la pestaña Horario a TODO el equipo (quién está activo, ingresos, salidas y horas). Sin tildar, cada rol ve solo sus propios registros. Es solo de consulta: activar o desactivar el horario de un usuario lo hacen únicamente Admin y Superadmin. Requiere haber ejecutado supabase/horario_manual_y_permiso.sql.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-dark-400">
                    <th className="py-2 pr-4">Sección</th>
                    {ROLES.map(r => <th key={r.id} className="py-2 px-3 text-center">{r.emoji} {r.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-dark-700">
                    <td className="py-2 pr-4 text-white">Ver el Horario de todo el equipo</td>
                    {ROLES.map(r => (
                      <td key={r.id} className="py-2 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={(permisos[r.id] || []).includes('horario_equipo')}
                          onChange={() => toggleSeccion(r.id, 'horario_equipo')}
                          className="accent-primary-500 w-4 h-4"
                        />
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
            <button
              onClick={guardarPermisos}
              disabled={savingPermisos}
              className="mt-4 px-4 py-2 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition"
            >
              {savingPermisos ? 'Guardando...' : '💾 Guardar permisos'}
            </button>
          </div>
        )}

        {/* Turnos: habilita la pestaña Turnos para cada rol. Muestra SOLO el
            calendario del mes en curso con la leyenda de empleados y sus
            colores (un color por empleado), en modo consulta. */}
        <button
          onClick={() => setTurnosExpandido(v => !v)}
          className="w-full mt-3 flex items-center justify-between bg-dark-700 hover:bg-dark-600 transition rounded-lg px-4 py-3 text-white font-bold"
        >
          <span>📅 Turnos</span>
          <span className="text-dark-400 text-sm font-normal">{turnosExpandido ? '▲' : '▼'}</span>
        </button>

        {turnosExpandido && (
          <div className="mt-4 pl-1">
            <p className="text-dark-400 text-sm mb-3">Tildá para que ese rol vea la pestaña Turnos: solo el calendario del mes en curso con la leyenda de empleados y sus colores. Es solo de consulta. Admin y Superadmin lo gestionan desde Usuarios.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-dark-400">
                    <th className="py-2 pr-4">Sección</th>
                    {ROLES.map(r => <th key={r.id} className="py-2 px-3 text-center">{r.emoji} {r.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-dark-700">
                    <td className="py-2 pr-4 text-white">Ver Turnos (calendario del mes)</td>
                    {ROLES.map(r => (
                      <td key={r.id} className="py-2 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={(permisos[r.id] || []).includes('turnos')}
                          onChange={() => toggleSeccion(r.id, 'turnos')}
                          className="accent-primary-500 w-4 h-4"
                        />
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
            <button
              onClick={guardarPermisos}
              disabled={savingPermisos}
              className="mt-4 px-4 py-2 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition"
            >
              {savingPermisos ? 'Guardando...' : '💾 Guardar permisos'}
            </button>
          </div>
        )}
      </div>

      {/* Lista de usuarios */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">👥 Usuarios del restaurante</h2>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-xl transition text-sm font-medium"
          >
            + Nuevo usuario
          </button>
        </div>

        <div className="bg-dark-800 rounded-2xl border border-dark-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dark-700 text-left text-dark-400">
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Usuario</th>
                <th className="px-4 py-3">Rol</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Turnos</th>
                <th className="px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map(u => (
                <tr key={u.id} className="border-b border-dark-700 last:border-0">
                  <td className="px-4 py-3 text-white">{u.nombre}</td>
                  <td className="px-4 py-3 text-dark-300 font-mono">{u.usuario || '—'}</td>
                  <td className="px-4 py-3 text-dark-300">{rolInfo(u.rol).emoji} {rolInfo(u.rol).label}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleActivo(u)}
                      className={`px-2 py-1 rounded-full text-xs font-medium ${u.activo !== false ? 'bg-accent-500/20 text-accent-400' : 'bg-dark-600 text-dark-400'}`}
                    >
                      {u.activo !== false ? 'Activo' : 'Inactivo'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-dark-400 text-xs">
                    {(u.horarios || []).length > 0 ? `${u.horarios.length} turno(s)` : 'Sin asignar'}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleDelete(u)} className="text-red-400 hover:text-red-300 text-xs">
                      🗑️ Eliminar
                    </button>
                  </td>
                </tr>
              ))}
              {usuarios.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-dark-500">Todavía no creaste usuarios</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Horarios de usuarios */}
      <div>
        <style>{`
          @media print {
            body * { visibility: hidden; }
            .print-calendar-area, .print-calendar-area * { visibility: visible; }
            .print-calendar-area { position: absolute; left: 0; top: 0; width: 100%; }
            .no-print { display: none !important; }
          }
        `}</style>
        <h2 className="text-xl font-bold text-white mb-1">🕐 Horarios de usuarios</h2>
        <p className="text-dark-400 text-sm mb-4">Definí turnos y aplicalos a varios empleados a la vez.</p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* 1. Turnos */}
          <div className="bg-dark-800 rounded-2xl border border-dark-700 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-semibold text-sm">1. Definir turnos</h3>
              <button onClick={addTurno} className="text-xs px-2 py-1 bg-dark-700 text-dark-300 rounded-lg hover:bg-dark-600">+ Turno</button>
            </div>
            <div className="flex flex-col gap-3 max-h-80 overflow-y-auto pr-1">
               {turnos.map((t, i) => (
                  <div key={t.id} className={`bg-dark-700/50 rounded-xl p-3 border ${t.guardado ? 'border-green-600/50' : 'border-dark-600'}`}>
                   <div className="flex items-center justify-between mb-2 gap-2">
                     <label className="flex items-center gap-2 text-sm text-white flex-1 min-w-0">
                       <input type="checkbox" checked={t.activo} onChange={e => updateTurno(t.id, { activo: e.target.checked })} className="accent-primary-500 shrink-0" />
                       <input
                         type="text"
                         value={t.nombre ?? `Turno ${i + 1}`}
                         disabled={t.guardado}
                         onChange={e => updateTurno(t.id, { nombre: e.target.value })}
                         placeholder={`Turno ${i + 1}`}
                         className="bg-dark-800 border border-dark-600 rounded px-2 py-1 text-white text-sm w-full min-w-0 disabled:opacity-70 disabled:border-transparent disabled:bg-transparent disabled:px-0"
                       />
                     </label>
                     {t.guardado && <span className="text-green-400 text-[10px] font-semibold shrink-0">✅ Guardado</span>}
                   </div>

                   {/* Bloque horario 1 (siempre) e independiente del bloque 2 */}
                   <p className="text-dark-500 text-[10px] uppercase font-semibold mb-1">Horario</p>
                   <div className="flex items-center gap-2 mb-2 text-xs">
                     <span className="text-dark-400">Desde</span>
                     <input type="time" value={t.desde} disabled={t.guardado} onChange={e => updateTurno(t.id, { desde: e.target.value })} className="bg-dark-800 border border-dark-600 rounded px-2 py-1 text-white disabled:opacity-60" />
                     <span className="text-dark-400">Hasta</span>
                     <input type="time" value={t.hasta} disabled={t.guardado} onChange={e => updateTurno(t.id, { hasta: e.target.value })} className="bg-dark-800 border border-dark-600 rounded px-2 py-1 text-white disabled:opacity-60" />
                   </div>

                   {/* Bloque horario 2, totalmente independiente del bloque 1 — para
                       turnos partidos (ej: mañana y noche). Es opcional. */}
                   <p className="text-dark-500 text-[10px] uppercase font-semibold mb-1">Corte / 2do bloque (opcional)</p>
                   <div className="flex items-center gap-2 text-xs mb-3">
                     <span className="text-dark-400">Desde</span>
                     <input type="time" value={t.desde2} disabled={t.guardado} onChange={e => updateTurno(t.id, { desde2: e.target.value })} className="bg-dark-800 border border-dark-600 rounded px-2 py-1 text-white disabled:opacity-60" />
                     <span className="text-dark-400">Hasta</span>
                     <input type="time" value={t.hasta2} disabled={t.guardado} onChange={e => updateTurno(t.id, { hasta2: e.target.value })} className="bg-dark-800 border border-dark-600 rounded px-2 py-1 text-white disabled:opacity-60" />
                    </div>

                   {/* Guardar bloquea la edición del turno; Modificar la reabre;
                       Eliminar lo borra del borrador (no toca lo ya aplicado a empleados). */}
                   <div className="flex items-center gap-2">
                     {!t.guardado ? (
                       <button onClick={() => guardarTurno(t.id)} className="text-xs px-2 py-1 bg-green-600/20 text-green-400 border border-green-600/40 rounded-lg hover:bg-green-600/30">💾 Guardar</button>
                     ) : (
                       <button onClick={() => modificarTurno(t.id)} className="text-xs px-2 py-1 bg-dark-700 text-dark-200 border border-dark-600 rounded-lg hover:bg-dark-600">✏️ Modificar</button>
                     )}
                     {turnos.length > 1 && (
                       <button onClick={() => removeTurno(t.id)} className="text-xs px-2 py-1 bg-red-600/20 text-red-400 border border-red-600/40 rounded-lg hover:bg-red-600/30">🗑️ Eliminar</button>
                     )}
                   </div>
                 </div>
              ))}
            </div>
          </div>

          {/* 2. Asignar a empleados */}
          <div className="bg-dark-800 rounded-2xl border border-dark-700 p-4">
            <h3 className="text-white font-semibold text-sm mb-3">2. Asignar a empleados</h3>
            <div className="space-y-4 max-h-80 overflow-auto">
              {ROLES.map(r => {
                const list = usuarios.filter(u => u.rol === r.id)
                if (list.length === 0) return null
                return (
                  <div key={r.id}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-dark-300">{r.emoji} {r.label.toUpperCase()}S</span>
                      <button onClick={() => selectAllRol(r.id)} className="text-[10px] text-primary-400 hover:underline">SELECCIONAR TODOS</button>
                    </div>
                    {list.map(u => (
                      <label key={u.id} className="flex items-center gap-2 text-sm text-white py-1">
                        <input type="checkbox" checked={selected.includes(u.id)} onChange={() => toggleSelected(u.id)} className="accent-primary-500" />
                        {u.nombre} <span className="text-dark-500 text-xs">({u.usuario})</span>
                      </label>
                    ))}
                  </div>
                )
              })}
              {usuarios.length === 0 && <p className="text-dark-500 text-sm">Creá usuarios primero.</p>}
            </div>
          </div>

          {/* 3. Calendario: solo el selector de mes (el mes abierto se ve más abajo) */}
          <div className="bg-dark-800 rounded-2xl border border-dark-700 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-semibold text-sm">3. Calendario</h3>
              <span className="text-white text-sm font-bold">{calendarYear}</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {MONTHS.map((m, i) => (
                <button
                  key={i}
                  onClick={() => setExpandedMonth(expandedMonth === i ? null : i)}
                  className={`px-2 py-2 rounded-lg text-xs font-medium transition ${expandedMonth === i ? 'bg-primary-500 text-white' : 'bg-dark-700 text-dark-300 hover:bg-dark-600'}`}
                >
                  {m}
                </button>
              ))}
            </div>
            <p className="text-dark-500 text-xs mt-3">
              {expandedMonth !== null
                ? 'Tildá los días del mes abierto más abajo. Si no tildás ninguno, se usan los días de cada turno.'
                : 'Elegí un mes para tildar días puntuales (opcional).'}
            </p>
          </div>
        </div>

        {/* Botón principal: guarda turnos + días tildados (si hay) para los empleados seleccionados.
            Al lado, dos acciones de borrado: los turnos del borrador de arriba, o el
            horario ya guardado de los empleados tildados en el paso 2. */}
        <div className="flex flex-col sm:flex-row gap-2 mt-4">
          <button
            onClick={guardarHorarios}
            disabled={savingHorarios}
            className="flex-1 py-3 bg-accent-500 hover:bg-accent-600 disabled:opacity-50 text-white font-semibold rounded-xl transition"
          >
            {savingHorarios ? 'Guardando...' : '✅ Guardar y aplicar'}
          </button>
          <button
            onClick={borrarTurnosDefinidos}
            disabled={savingHorarios}
            title="Borra los turnos definidos en el paso 1 (no toca lo ya guardado)"
            className="py-3 px-4 bg-dark-700 hover:bg-dark-600 disabled:opacity-50 text-white font-medium rounded-xl transition text-sm"
          >
            🗑️ Borrar turnos
          </button>
          <button
            onClick={borrarHorariosEmpleados}
            disabled={savingHorarios}
            title="Borra el horario ya guardado de los empleados tildados en el paso 2"
            className="py-3 px-4 bg-red-600/20 hover:bg-red-600/30 border border-red-600/40 disabled:opacity-50 text-red-400 font-medium rounded-xl transition text-sm"
          >
            🗑️ Borrar horario de empleados
          </button>
        </div>
      </div>

      {/* Mes abierto: calendario grande de días, con los usuarios de colores e impresión */}
      {expandedMonth !== null && (
        <div className="bg-dark-800 rounded-2xl border border-dark-700 p-4 mt-6 print-calendar-area">
          <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
            <h2 className="text-xl font-bold text-white">📅 {MONTHS_FULL[expandedMonth]} {calendarYear}</h2>
            {viewingEmpId && (
              <span className="no-print flex items-center gap-2 text-sm bg-primary-500/20 text-primary-400 border border-primary-500/40 rounded-xl px-3 py-1.5">
                Viendo horario de: <b>{usuarios.find(u => u.id === viewingEmpId)?.nombre}</b>
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
          <p className="no-print text-dark-500 text-xs mb-3">
            Acá se muestra el horario ya <b>guardado</b> de cada empleado (colores). Tildar un día es solo para elegir en qué días aplicar cambios nuevos con "Guardar y aplicar".
          </p>

          {(() => {
            const year = calendarYear
            const mi = expandedMonth
            const weeks = getWeeksInMonth(year, mi)
            return (
              <div className="bg-dark-700/50 rounded-xl p-3 border border-dark-600">
                <div className="flex items-center gap-1 mb-1">
                  <div className="w-8 flex-shrink-0"></div>
                  {DIAS.map((d, idx) => (
                    <div key={idx} className="flex-1 text-center text-[10px] text-dark-400 font-semibold">{d}</div>
                  ))}
                </div>
                <div className="space-y-1">
                  {weeks.map((weekDays, wi) => {
                    const allSel = weekDays.every(d => isDaySelected(year, mi, d))
                    const someSel = weekDays.some(d => isDaySelected(year, mi, d))
                    return (
                      <div key={wi} className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={allSel}
                          ref={el => { if (el) el.indeterminate = someSel && !allSel }}
                          onChange={() => toggleWeek(year, mi, wi)}
                          className="no-print accent-primary-500 w-3.5 h-3.5 flex-shrink-0"
                        />
                        {weekDays.map(d => {
                          const key = formatDateKey(year, mi, d)
                          const sel = isDaySelected(year, mi, d)
                          // Empleados que, según su horario ya GUARDADO, trabajan este día
                          // (si hay uno "en foco" por la leyenda, solo se muestra ese)
                          const empOfDay = empleadosGuardadosDelDia(year, mi, d)
                          return (
                            <button
                              key={d}
                              onClick={() => toggleDay(year, mi, d)}
                              className={`w-28 h-28 rounded-lg text-[10px] font-medium transition flex-shrink-0 flex flex-col items-center justify-center gap-0.5 p-1 border ${sel ? 'border-primary-500 bg-primary-500/20' : 'border-dark-600 bg-dark-800'}`}
                              title={key}
                            >
                              <span className="text-xs font-bold text-white">{d}</span>
                              {empOfDay.length > 0 && (
                                <div className="flex flex-col gap-0.5 w-full">
                                  {empOfDay.map(e => {
                                    const turnosStr = turnosGuardadosDelDia(e, year, mi, d)
                                      .map(t => `${t.nombre ? t.nombre + ': ' : ''}${t.desde}-${t.hasta}${t.desde2 && t.hasta2 ? ` / ${t.desde2}-${t.hasta2}` : ''}`)
                                      .join(' • ')
                                    return (
                                      <span key={e.id} title={`${e.nombre} (${turnosStr})`} style={{ backgroundColor: coloresEmp[e.id] || '#6b7280' }} className="text-[10px] leading-tight px-1 py-0.5 rounded text-white truncate">
                                        {e.nombre}
                                        <span className="opacity-75"> ({turnosStr})</span>
                                      </span>
                                    )
                                  })}
                                </div>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}

          {/* Leyenda: cada nombre es un botón. Al clickearlo, el calendario de arriba
              se filtra para mostrar solo el horario guardado de esa persona. */}
          <div className="mt-4 pt-3 border-t border-dark-600">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-white font-semibold text-sm">Leyenda de empleados</h4>
              {viewingEmpId && (
                <button onClick={() => setViewingEmpId(null)} className="no-print text-xs text-primary-400 hover:underline">Ver todos</button>
              )}
            </div>
            <div className="flex flex-wrap gap-4">
              {ROLES.map(r => {
                const emps = usuarios.filter(u => u.rol === r.id)
                if (emps.length === 0) return null
                return (
                  <div key={r.id} className="flex flex-col gap-1">
                    <span className="text-dark-400 text-xs font-semibold">{r.emoji} {r.label}</span>
                    {emps.map(e => (
                      <button
                        key={e.id}
                        onClick={() => setViewingEmpId(prev => prev === e.id ? null : e.id)}
                        className={`no-print flex items-center gap-2 text-left rounded-lg px-1.5 py-0.5 transition ${viewingEmpId === e.id ? 'bg-primary-500/20 ring-1 ring-primary-500' : 'hover:bg-dark-700'}`}
                        title={`Ver el horario guardado de ${e.nombre}`}
                      >
                        <span style={{ backgroundColor: coloresEmp[e.id] || '#6b7280' }} className="w-2.5 h-2.5 rounded-full flex-shrink-0"></span>
                        <span className="text-dark-300 text-xs">{e.nombre}</span>
                      </button>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modal crear usuario */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 rounded-2xl p-6 w-full max-w-md border border-dark-700">
            <h3 className="text-xl font-semibold text-white mb-4">Nuevo usuario</h3>
            <form onSubmit={handleCreate} className="space-y-3">
              <select
                value={form.rol}
                onChange={e => setForm({ ...form, rol: e.target.value })}
                className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-xl text-white"
              >
                {ROLES.map(r => <option key={r.id} value={r.id}>{r.emoji} {r.label}</option>)}
              </select>
              <input type="text" placeholder="Nombre completo" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-xl text-white" required />
              <input type="text" placeholder="Usuario (para loguearse, sin espacios)" value={form.usuario} onChange={e => setForm({ ...form, usuario: e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, '') })} className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-xl text-white" required />
              <input type="password" placeholder="Contraseña (mínimo 6 caracteres)" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-xl text-white" required minLength={6} />
              <p className="text-dark-400 text-xs">Se va a loguear en /login con este "Usuario" y esta contraseña.</p>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 bg-dark-700 text-white rounded-xl">Cancelar</button>
                <button type="submit" disabled={creating} className="flex-1 py-3 bg-primary-500 disabled:opacity-50 text-white rounded-xl">{creating ? 'Creando...' : 'Crear'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
