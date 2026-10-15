import { NavLink } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useI18n } from '@/lib/i18n'
import { supabase } from '@/lib/supabase'

const adminLinks = [
  { path: '/admin', label: 'dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { path: '/admin/vendedores', label: 'vendedores', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
  { path: '/admin/socios', label: 'crearSocios', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
  { path: '/admin/nuevos-clientes', label: 'nuevosClientes', icon: 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z' },
  { path: '/admin/dash-socios', label: 'dashSocios', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
]

const vendedorLinks = [
  { path: '/vendedor', label: 'dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { path: '/vendedor/nuevo-cliente', label: 'crearCliente', icon: 'M12 6v6m0 0v6m0-6h6m-6 0H6' },
]

const ownerLinks = [
  { path: '/admin/dash-socios/mesas', label: 'mesas', icon: 'M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z' },
  { path: '/admin/dash-socios/carta', label: 'carta', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
  { path: '/admin/dash-socios/diseno', label: 'diseno', icon: 'M7 21a4 4 0 01-4-4V5a2 2 0 012-2h9l5 5v9a4 4 0 01-4 4H7zM12 12a3 3 0 100-6 3 3 0 000 6z' },
  { path: '/admin/dash-socios/caja', label: 'caja', icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z' },
  { path: '/admin/dash-socios/promociones', label: 'promociones', icon: 'M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7' },
  { path: '/admin/dash-socios/suscripciones', label: 'suscriptos', icon: 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z' },
  { path: '/admin/dash-socios/ticket', label: 'ticket', icon: 'M9 5H7a2 2 0 00-2 2v12l3-2 3 2 3-2 3 2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
  { path: '/admin/dash-socios/horario', label: 'horario', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
  { path: '/admin/dash-socios/usuarios', label: 'usuarios', icon: 'M12 4.354a4 4 0 110 7.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
]

const clienteLinks = [
  { path: '/cliente', label: 'dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { path: '/cliente/configuracion', label: 'configuracion', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
  { path: '/cliente/carta', label: 'carta', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
  { path: '/cliente/mesas', label: 'mesas', icon: 'M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z' },
  { path: '/cliente/usuarios', label: 'usuarios', icon: 'M12 4.354a4 4 0 110 7.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
  { path: '/cliente/promociones', label: 'promociones', icon: 'M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7' },
  { path: '/cliente/caja', label: 'caja', icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z' },
  { path: '/cliente/reportes', label: 'reportes', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
]

export default function Sidebar() {
  const { rol, logout, user } = useAuth()
  const { t } = useI18n()
  const [pendientes, setPendientes] = useState(0)
  const [staffLinks, setStaffLinks] = useState(ownerLinks)
  // Solo afecta a pantallas angostas (celular): en desktop el sidebar
  // sigue exactamente igual que antes, siempre visible. En mobile arranca
  // cerrado (afuera de la pantalla) y se abre con el botón ☰.
  const [mobileOpen, setMobileOpen] = useState(false)

  const isStaff = ['mozo', 'cajero', 'cocina', 'delivery'].includes(rol)

  let links = adminLinks
  if (rol === 'admin') links = ownerLinks
  if (rol === 'vendedor') links = vendedorLinks
  if (rol === 'socio') links = clienteLinks
  if (isStaff) links = staffLinks

  // Mozo/cajero/cocina: el dueño elige que secciones puede ver cada rol
  // (pestaña "Usuarios" del panel del dueño). Filtramos el sidebar acorde.
  useEffect(() => {
    if (!isStaff || !user) return

    const fetchPermisos = async () => {
      const { data: cu } = await supabase
        .from('cliente_usuarios')
        .select('clientes(permisos_roles)')
        .eq('user_id', user.id)
        .single()
      const permitidos = cu?.clientes?.permisos_roles?.[rol]
      if (Array.isArray(permitidos)) {
        const idFromPath = (p) => p.split('/').pop()
        setStaffLinks(ownerLinks.filter(l => permitidos.includes(idFromPath(l.path))))
      }
    }
    fetchPermisos()
  }, [isStaff, rol, user])

  // Cantidad de solicitudes de "Nuevos Clientes" pendientes de aprobar,
  // en vivo: baja solo a medida que se van aprobando/rechazando.
  useEffect(() => {
    if (rol !== 'superadmin') return

    const fetchPendientes = async () => {
      const { count } = await supabase
        .from('solicitudes_cliente')
        .select('*', { count: 'exact', head: true })
        .eq('estado', 'pendiente')
      setPendientes(count || 0)
    }
    fetchPendientes()

    const channel = supabase
      .channel('solicitudes_cliente_badge')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'solicitudes_cliente' }, fetchPendientes)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [rol])

  return (
    <>
      {/* Botón ☰: solo visible en celular (md:hidden), abre/cierra el menú.
          En desktop no se renderiza nada distinto: el <aside> de abajo
          queda exactamente igual que como estaba. */}
      <button
        onClick={() => setMobileOpen(true)}
        className={`md:hidden fixed top-3 left-3 z-40 w-10 h-10 rounded-lg bg-dark-800 border border-dark-700 text-white flex items-center justify-center ${mobileOpen ? 'hidden' : ''}`}
        aria-label="Abrir menú"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Fondo oscuro atrás del menú, solo en celular y solo si está abierto */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/60 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed left-0 top-0 h-full w-64 bg-dark-800 border-r border-dark-700 flex flex-col z-50 transition-transform duration-300 ease-in-out ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0`}
      >
        {/* Botón ✕ para cerrar, solo en celular */}
        <button
          onClick={() => setMobileOpen(false)}
          className="md:hidden absolute top-3 right-3 w-8 h-8 rounded-lg bg-dark-700 text-white flex items-center justify-center"
          aria-label="Cerrar menú"
        >
          ✕
        </button>

      {/* Logo */}
      <div className="p-6 border-b border-dark-700 flex justify-center">
        <img src="/logo.webp" alt="QR Menu" className="w-40 h-40 object-contain" />
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4 space-y-1">
        {links.map((link) => (
          <NavLink
            key={link.path}
            to={link.path}
            end={link.path === '/admin' || link.path === '/vendedor' || link.path === '/cliente'}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl transition duration-200 ${
                isActive
                  ? 'bg-primary-500/20 text-primary-400'
                  : 'text-dark-300 hover:bg-dark-700 hover:text-white'
              }`
            }
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={link.icon} />
            </svg>
            <span className="font-medium flex-1">{t(link.label)}</span>
            {link.path === '/admin/nuevos-clientes' && pendientes > 0 && (
              <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
                {pendientes > 99 ? '99+' : pendientes}
              </span>
            )}
          </NavLink>
        ))}
      </nav>
      
      {/* Logout */}
      <div className="p-4 border-t border-dark-700">
        <button
          onClick={logout}
          className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-dark-300 hover:bg-red-500/20 hover:text-red-400 transition duration-200"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span className="font-medium">{t('cerrarSesion')}</span>
        </button>
      </div>
      </aside>
    </>
  )
}
