import { Outlet, NavLink } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

export default function VendedorLayout() {
  const { logout } = useAuth()

  return (
    <div className="min-h-screen bg-dark-900 flex flex-col max-w-md mx-auto relative">
      {/* Header */}
      <header className="bg-dark-800 border-b border-dark-700 px-4 py-2 flex items-center justify-between sticky top-0 z-40">
        <img src="/logo.webp" alt="TuQRMenu" className="h-10 w-auto object-contain" />
        <button
          onClick={logout}
          className="w-8 h-8 flex items-center justify-center text-dark-400 hover:text-red-400 transition"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto pb-20">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-dark-800 border-t border-dark-700 flex z-50">
        <NavLink
          to="/vendedor"
          end
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center py-3 transition ${
              isActive ? 'text-primary-400' : 'text-dark-400'
            }`
          }
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          <span className="text-xs mt-1">Panel</span>
        </NavLink>
        <NavLink
          to="/vendedor/nuevo-cliente"
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center py-3 transition ${
              isActive ? 'text-primary-400' : 'text-dark-400'
            }`
          }
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          <span className="text-xs mt-1">Nuevo Cliente</span>
        </NavLink>
      </nav>
    </div>
  )
}
