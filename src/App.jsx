import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useAuth } from '@/hooks/useAuth'

// Auth
import Login from '@/pages/auth/Login'

// Admin
import AdminDashboard from '@/pages/admin/Dashboard'
import Vendedores from '@/pages/admin/Vendedores'
import NuevosClientes from '@/pages/admin/NuevosClientes'
import Socios from '@/pages/admin/Socios'
import DashSocios from '@/pages/admin/DashSocios'
import Builder from '@/pages/admin/Builder'

// Vendedor
import VendedorDashboard from '@/pages/vendedor/Dashboard'
import FormularioCliente from '@/pages/vendedor/FormularioCliente'

// Cliente
import ClienteDashboard from '@/pages/cliente/Dashboard'
import Configuracion from '@/pages/cliente/Configuracion'
import Carta from '@/pages/cliente/Carta'
import Mesas from '@/pages/cliente/Mesas'
import Usuarios from '@/pages/cliente/Usuarios'
import Caja from '@/pages/cliente/Caja'
import Reportes from '@/pages/cliente/Reportes'
import Promociones from '@/pages/cliente/Promociones'

// Menu Publico
import MenuPublico from '@/pages/menu-publico/MenuView'

// Layouts
import AdminLayout from '@/components/Layout/AdminLayout'
import ClienteLayout from '@/components/Layout/ClienteLayout'
import VendedorLayout from '@/components/Layout/VendedorLayout'

function ProtectedRoute({ children, allowedRoles }) {
  const { user, rol, loading } = useAuth()
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    )
  }
  
  if (!user) {
    return <Navigate to="/login" replace />
  }
  
  if (allowedRoles && !allowedRoles.includes(rol)) {
    return <Navigate to="/login" replace />
  }
  
  return children
}

function PublicRoute({ children }) {
  const { user, rol, loading } = useAuth()
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    )
  }
  
  if (user) {
    if (rol === 'superadmin' || rol === 'admin') return <Navigate to="/admin" replace />
    if (rol === 'vendedor') return <Navigate to="/vendedor" replace />
    if (['socio', 'mozo', 'cajero'].includes(rol)) return <Navigate to="/cliente" replace />
  }
  
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <Toaster 
        position="top-right"
        toastOptions={{
          style: {
            background: '#1f2937',
            color: '#f8fafc',
            border: '1px solid #374151'
          }
        }}
      />
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        } />
        
        {/* Menu Publico - Sin auth */}
        <Route path="/menu/:token" element={<MenuPublico />} />
        
        {/* Admin Routes */}
        <Route path="/admin" element={
          <ProtectedRoute allowedRoles={['superadmin', 'admin', 'mozo', 'cajero', 'cocina', 'delivery']}>
            <AdminLayout />
          </ProtectedRoute>
        }>
          <Route index element={<AdminDashboard />} />
          <Route path="vendedores" element={<Vendedores />} />
          <Route path="nuevos-clientes" element={<NuevosClientes />} />
          <Route path="dash-socios" element={<DashSocios />} />
          <Route path="dash-socios/:tab" element={<DashSocios />} />
          <Route path="socios" element={<Socios />} />
          <Route path="builder/:socioId" element={<Builder />} />
        </Route>
        
        {/* Socio Routes */}
        <Route path="/socio" element={
          <ProtectedRoute allowedRoles={['superadmin', 'admin', 'socio']}>
            <AdminLayout />
          </ProtectedRoute>
        }>
          <Route path="builder" element={<Builder />} />
        </Route>
        
        {/* Vendedor Routes */}
        <Route path="/vendedor" element={
          <ProtectedRoute allowedRoles={['vendedor']}>
            <VendedorLayout />
          </ProtectedRoute>
        }>
          <Route index element={<VendedorDashboard />} />
          <Route path="nuevo-cliente" element={<FormularioCliente />} />
        </Route>
        
        {/* Cliente Routes */}
        <Route path="/cliente" element={
          <ProtectedRoute allowedRoles={['socio', 'mozo', 'cajero']}>
            <ClienteLayout />
          </ProtectedRoute>
        }>
          <Route index element={<ClienteDashboard />} />
          <Route path="configuracion" element={<Configuracion />} />
          <Route path="carta" element={<Carta />} />
          <Route path="mesas" element={<Mesas />} />
          <Route path="usuarios" element={<Usuarios />} />
          <Route path="caja" element={<Caja />} />
          <Route path="reportes" element={<Reportes />} />
          <Route path="promociones" element={<Promociones />} />
        </Route>
        
        {/* Catch all */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
