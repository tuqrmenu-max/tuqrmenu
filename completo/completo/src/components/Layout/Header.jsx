import { useAuth } from '@/hooks/useAuth'
import { useI18n } from '@/lib/i18n'

export default function Header() {
  const { profile, rol } = useAuth()
  const { t, lang, toggleLang } = useI18n()

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
        {/* Toggle Idioma */}
        <button
          onClick={toggleLang}
          className="px-3 py-1.5 bg-dark-700 rounded-lg text-sm hover:bg-dark-600 transition flex items-center gap-2"
        >
          <span>{lang === 'es' ? '🇪🇸' : '🇺🇸'}</span>
          <span className="text-dark-300">{lang.toUpperCase()}</span>
        </button>
        
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
