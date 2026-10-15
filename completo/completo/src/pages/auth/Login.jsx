import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useI18n } from '@/lib/i18n'
import toast from 'react-hot-toast'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const { login, getRedirectPath } = useAuth()
  const navigate = useNavigate()
  const { t, lang, toggleLang } = useI18n()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      await login(email, password)
      toast.success(t('exito'))
      navigate(getRedirectPath())
    } catch (error) {
      toast.error(error.message || t('error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-900 px-4">
      {/* Botón idioma */}
      <button
        onClick={toggleLang}
        className="fixed top-4 right-4 px-3 py-1 bg-dark-700 rounded text-sm hover:bg-dark-600 transition"
      >
        {lang === 'es' ? '🇪🇸 ES' : '🇺🇸 EN'}
      </button>
      
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src="/logo.webp" alt="QR Menu" className="w-56 h-56 object-contain mx-auto mb-4" />
          <p className="text-dark-400 mt-2">Menú Digital para Restaurantes</p>
        </div>
        
        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-dark-800 rounded-2xl p-8 shadow-xl border border-dark-700">
          <h2 className="text-xl font-semibold text-white mb-6">{t('login')}</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">
                Usuario o Email
              </label>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-xl text-white placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
                placeholder="admin@ejemplo.com o tu usuario"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">
                {t('password')}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-xl text-white placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
                placeholder="••••••••"
                required
              />
            </div>
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-6 py-3 px-4 bg-primary-500 hover:bg-primary-600 disabled:bg-primary-800 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition duration-200 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                {t('cargando')}
              </>
            ) : (
              t('loginButton')
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
