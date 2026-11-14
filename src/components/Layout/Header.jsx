import { useAuth } from '@/hooks/useAuth'
import LanguageSelector from '@/components/LanguageSelector'
import { useIdiomasApp } from '@/hooks/useIdiomasApp'

export default function Header() {
  const { profile, rol } = useAuth()
  const idiomasPermitidos = useIdiomasApp()

  const getRolLabel = () => {
    switch (rol) {
      case 'superadmin': return 'Super Admin'
      case 'admin': return 'Admin'
      case 'vendedor': return 'Vendedor'
      case 'socio': return 'Socio'
      case 'mozo': return 'Mozo'
      case 'cajero': return 'Cajero'
      case 'cocina': return 'Cocina'
      case 'delivery': return 'Delivery'
      default: return rol
    }
  }

  return (
    <header className="h-16 bg-dark-800 border-b border-dark-700 flex items-center justify-between pl-16 pr-4 md:px-6">
      <div>
        <h2 className="text-lg font-semibold text-white">
          {profile?.nombre || profile?.nombre_restaurante || 'QR Menu'}
        </h2>
        <p className="text-sm text-dark-400">{getRolLabel()}</p>
      </div>
      
      <div className="flex items-center gap-4">
        {/* Selector de idioma: solo los idiomas habilitados para este socio */}
        <LanguageSelector permitidos={idiomasPermitidos} />
        
        {/* Avatar */}
        <div className="w-10 h-10 rounded-full bg-primary-500/20 flex items-center justify-center">
          <span className="text-primary-400 font-semibold">
            {(profile?.nombre || profile?.nombre_restaurante || 'U').charAt(0).toUpperCase()}
          </span>
        </div>
      </div>
    </header>
  )
}
