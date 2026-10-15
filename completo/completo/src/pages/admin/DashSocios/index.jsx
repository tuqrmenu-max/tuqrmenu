import { useState, useEffect } from 'react'
import { useI18n } from '@/lib/i18n'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import MesasAdmin from './components/MesasAdmin'
import CartaAdmin from './components/CartaAdmin'
import DisenoMenu from './components/DisenoMenu'
import CajaReportes from './components/CajaReportes'
import CocinaPanel from './components/CocinaPanel'
import PromocionesAdmin from './components/PromocionesAdmin'
import SuscripcionesAdmin from './components/SuscripcionesAdmin'
import TicketConfig from './components/TicketConfig'
import UsuariosStaff from './components/UsuariosStaff'
import HorarioUsuarios from './components/HorarioUsuarios'
import { useParams, useNavigate } from 'react-router-dom'

const tabs = [
  { id: 'mesas', label: 'Mesas', icon: '🍽️' },
  { id: 'carta', label: 'Carta', icon: '📋' },
  { id: 'diseno', label: 'Diseño', icon: '🎨' },
  { id: 'caja', label: 'Caja', icon: '💰' },
  { id: 'cocina', label: 'Cocina', icon: '👨‍🍳' },
  { id: 'promociones', label: 'Promos', icon: '🎁' },
  { id: 'suscripciones', label: 'Suscriptos', icon: '👥' },
  { id: 'ticket', label: 'Ticket', icon: '🧾' },
  { id: 'horario', label: 'Horario', icon: '🕐' },
  { id: 'usuarios', label: 'Usuarios', icon: '🔑' }
]

export default function DashboardSocios() {
  const { t } = useI18n()
  const { user, rol } = useAuth()
  const { tab: tabParam } = useParams()
  const navigate = useNavigate()
  const [activeTab, setActiveTabState] = useState(tabParam || 'mesas')
  const [socios, setSocios] = useState([])
  const [clienteId, setClienteId] = useState(null)
  const [socioSeleccionado, setSocioSeleccionado] = useState(null)
  const [loading, setLoading] = useState(true)

  const [permisosRol, setPermisosRol] = useState(null)
  const isStaff = ['mozo', 'cajero', 'cocina', 'delivery'].includes(rol)

  // Cuando el dueño entra por un link directo del sidebar (/admin/dash-socios/carta),
  // la pestaña activa la marca la URL en vez de un estado interno con default fijo.
  useEffect(() => {
    if (tabParam && tabParam !== activeTab) setActiveTabState(tabParam)
  }, [tabParam])

  const setActiveTab = (id) => {
    setActiveTabState(id)
    if (rol === 'admin' || isStaff) navigate(`/admin/dash-socios/${id}`)
  }

  useEffect(() => {
    if (rol === 'superadmin') {
      fetchSocios()
    } else if (rol === 'admin') {
      fetchSocioPropio()
    } else if (isStaff) {
      fetchSocioComoStaff()
    }
  }, [rol, user])

  const fetchSocios = async () => {
    const { data, error } = await supabase
      .from('clientes')
      .select('id, nombre_restaurante, user_id')
      .order('nombre_restaurante')

    if (!error && data) {
      setSocios(data)
    }
    setLoading(false)
  }

  const fetchSocioPropio = async () => {
    const { data: cliente } = await supabase
      .from('clientes')
      .select('id, nombre_restaurante')
      .eq('user_id', user.id)
      .single()

    if (cliente) {
      setClienteId(cliente.id)
      setSocioSeleccionado(cliente)
    }
    setLoading(false)
  }

  const fetchSocioComoStaff = async () => {
    const { data: cu } = await supabase
      .from('cliente_usuarios')
      .select('cliente_id, clientes(id, nombre_restaurante, permisos_roles)')
      .eq('user_id', user.id)
      .single()

    if (cu?.cliente_id) {
      setClienteId(cu.cliente_id)
      setSocioSeleccionado(cu.clientes)
      const permisos = cu.clientes?.permisos_roles?.[rol] || []
      setPermisosRol(permisos)
      // Si la pestaña de la URL no está permitida para este rol, lo mandamos
      // a la primera que sí tenga habilitada.
      if (permisos.length > 0 && !permisos.includes(tabParam || 'mesas')) {
        const first = tabs.find(t => permisos.includes(t.id))
        if (first) {
          setActiveTabState(first.id)
          navigate(`/admin/dash-socios/${first.id}`, { replace: true })
        }
      }
    }
    setLoading(false)
  }

  const handleSelectSocio = (socio) => {
    setClienteId(socio.id)
    setSocioSeleccionado(socio)
  }

  const renderContent = () => {
    if (!clienteId) return null
    if (isStaff && permisosRol && !permisosRol.includes(activeTab)) {
      return <p className="text-dark-400 p-6">No tenés permiso para ver esta sección. Pedile al dueño que te lo habilite en "Usuarios".</p>
    }

    switch (activeTab) {
      case 'mesas':
        return <MesasAdmin clienteId={clienteId} />
      case 'carta':
        return <CartaAdmin clienteId={clienteId} socio={socioSeleccionado} />
      case 'diseno':
        return <DisenoMenu clienteId={clienteId} />
      case 'caja':
        return <CajaReportes clienteId={clienteId} />
      case 'cocina':
        return <CocinaPanel clienteId={clienteId} />
      case 'promociones':
        return <PromocionesAdmin clienteId={clienteId} />
      case 'suscripciones':
        return <SuscripcionesAdmin clienteId={clienteId} />
      case 'ticket':
        return <TicketConfig clienteId={clienteId} />
      case 'horario':
        return <HorarioUsuarios clienteId={clienteId} />
      case 'usuarios':
        return <UsuariosStaff clienteId={clienteId} />
      default:
        return <MesasAdmin clienteId={clienteId} />
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  // Super admin: mostrar selector de socio
  if (rol === 'superadmin' && !clienteId) {
    return (
      <div className="min-h-screen bg-dark-900">
        <div className="bg-dark-800 border-b border-dark-700 px-6 py-4">
          <h1 className="text-2xl font-bold text-white">{t('dashSocios') || 'Dash Socios'}</h1>
          <p className="text-dark-400 text-sm mt-1">Seleccioná un socio para gestionar</p>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {socios.map((socio) => (
              <button
                key={socio.id}
                onClick={() => handleSelectSocio(socio)}
                className="bg-dark-800 border border-dark-700 rounded-xl p-6 text-left hover:border-primary-500 transition"
              >
                <div className="text-white font-bold text-lg mb-2">
                  🍽️ {socio.nombre_restaurante || 'Sin nombre'}
                </div>
                <div className="text-dark-400 text-sm">
                  ID: {socio.id.slice(0, 8)}...
                </div>
              </button>
            ))}
            {socios.length === 0 && (
              <div className="col-span-full text-center py-12">
                <p className="text-dark-400 text-lg">No hay socios creados aún</p>
                <p className="text-dark-500 text-sm mt-2">Creá un socio desde la sección "Crear Socios"</p>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={(rol === 'admin' || isStaff) ? '' : 'min-h-screen bg-dark-900'}>
      {!(rol === 'admin' || isStaff) && (
        <>
          {/* Header */}
          <div className="bg-dark-800 border-b border-dark-700 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-white">
                  {socioSeleccionado?.nombre_restaurante || 'Dash Socios'}
                </h1>
                <p className="text-dark-400 text-sm mt-1">Panel de gestión del restaurante</p>
              </div>
              {rol === 'superadmin' && (
                <button
                  onClick={() => { setClienteId(null); setSocioSeleccionado(null) }}
                  className="bg-dark-700 hover:bg-dark-600 text-white px-4 py-2 rounded-lg text-sm transition"
                >
                  ← Cambiar socio
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-dark-800 border-b border-dark-700 px-6">
            <nav className="flex space-x-1 overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-primary-500 text-primary-400'
                      : 'border-transparent text-dark-400 hover:text-white hover:border-dark-600'
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </nav>
          </div>
        </>
      )}

      {/* Content */}
      <div className={(rol === 'admin' || isStaff) ? '' : 'p-6'}>
        {renderContent()}
      </div>
    </div>
  )
}
