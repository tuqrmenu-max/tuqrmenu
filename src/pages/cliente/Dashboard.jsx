import { useState, useEffect } from 'react'
import { useI18n } from '@/lib/i18n'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'

export default function ClienteDashboard() {
  const { t } = useI18n()
  const { profile } = useAuth()
  const [stats, setStats] = useState({
    mesas: 0,
    productos: 0,
    categorias: 0,
    pedidos: 0
  })

  // Para el dueño, profile.id es el id del restaurante. Para mozo/cajero/cocina,
  // profile es su fila de cliente_usuarios: el restaurante está en cliente_id.
  const clienteId = profile?.cliente_id || profile?.id
  // El link público del menú usa el user_id del restaurante (no el id de la fila).
  const [menuToken, setMenuToken] = useState(null)

  useEffect(() => {
    if (clienteId) {
      fetchStats()
      fetchMenuToken()
    }
  }, [clienteId])

  const fetchMenuToken = async () => {
    const { data } = await supabase.from('clientes').select('id, user_id').eq('id', clienteId).maybeSingle()
    setMenuToken(data ? (data.user_id || data.id) : null)
  }

  const menuLink = menuToken ? `${window.location.origin}/menu/${menuToken}?mesa=0` : ''

  const fetchStats = async () => {
    const [mesas, productos, categorias, pedidos] = await Promise.all([
      supabase.from('mesas').select('id', { count: 'exact', head: true }).eq('cliente_id', clienteId),
      supabase.from('productos').select('id', { count: 'exact', head: true }).eq('cliente_id', clienteId),
      supabase.from('categorias').select('id', { count: 'exact', head: true }).eq('cliente_id', clienteId),
      supabase.from('pedidos').select('id', { count: 'exact', head: true }).eq('cliente_id', clienteId),
    ])
    
    setStats({
      mesas: mesas.count || 0,
      productos: productos.count || 0,
      categorias: categorias.count || 0,
      pedidos: pedidos.count || 0
    })
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">{t('dashboard')}</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-dark-800 rounded-2xl p-6 border border-dark-700">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary-500/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
              </svg>
            </div>
            <div>
              <p className="text-dark-400 text-sm">{t('mesas')}</p>
              <p className="text-2xl font-bold text-white">{stats.mesas}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-dark-800 rounded-2xl p-6 border border-dark-700">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-accent-500/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-accent-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <p className="text-dark-400 text-sm">{t('carta')}</p>
              <p className="text-2xl font-bold text-white">{stats.productos}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-dark-800 rounded-2xl p-6 border border-dark-700">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-yellow-500/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
            </div>
            <div>
              <p className="text-dark-400 text-sm">Categorías</p>
              <p className="text-2xl font-bold text-white">{stats.categorias}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-dark-800 rounded-2xl p-6 border border-dark-700">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <p className="text-dark-400 text-sm">Pedidos Hoy</p>
              <p className="text-2xl font-bold text-white">{stats.pedidos}</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Link del menú */}
      {menuLink && (
        <div className="mt-8 bg-dark-800 rounded-2xl p-6 border border-dark-700">
          <h2 className="text-lg font-semibold text-white mb-4">Link de tu Menú</h2>
          <div className="flex items-center gap-4">
            <input
              type="text"
              value={menuLink}
              readOnly
              className="flex-1 px-4 py-3 bg-dark-700 border border-dark-600 rounded-xl text-white"
            />
            <button
              onClick={() => {
                navigator.clipboard.writeText(menuLink)
                alert('Link copiado!')
              }}
              className="px-4 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-xl transition"
            >
              Copiar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
