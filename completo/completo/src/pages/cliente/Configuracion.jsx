import { useState, useEffect } from 'react'
import { useI18n } from '@/lib/i18n'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

export default function Configuracion() {
  const { t } = useI18n()
  const { profile } = useAuth()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    nombre_restaurante: '',
    whatsapp: '',
    direccion: '',
    bienvenido: '',
    fondo_menu: '',
    fondo_categorias: '',
    fondo_productos: '',
    fondo_carrito: '',
    precio_delivery: 0,
    direccion_delivery: '',
  })

  useEffect(() => {
    if (!profile?.id) return
    let active = true
    supabase.from('clientes').select('nombre_restaurante,whatsapp,direccion,bienvenido,fondo_menu,fondo_categorias,fondo_productos,fondo_carrito,precio_delivery,direccion_delivery').eq('id', profile.id).single().then(({ data, error }) => {
      if (!active) return
      if (error) { toast.error(error.message); return }
      setForm(prev => Object.fromEntries(Object.keys(prev).map(key => [key, data[key] ?? prev[key]])))
    })
    return () => { active = false }
  }, [profile?.id])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    
    const { error } = await supabase
      .from('clientes')
      .update(form)
      .eq('id', profile.id)
    
    setLoading(false)
    
    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Configuración guardada')
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">{t('configuracion')}</h1>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-dark-800 rounded-2xl p-6 border border-dark-700">
          <h2 className="text-lg font-semibold text-white mb-4">Datos del Restaurante</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-dark-400 mb-2">Nombre</label>
              <input
                type="text"
                value={form.nombre_restaurante}
                onChange={(e) => setForm({...form, nombre_restaurante: e.target.value})}
                className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm text-dark-400 mb-2">WhatsApp</label>
              <input
                type="text"
                value={form.whatsapp}
                onChange={(e) => setForm({...form, whatsapp: e.target.value})}
                className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-dark-400 mb-2">Dirección</label>
              <input
                type="text"
                value={form.direccion}
                onChange={(e) => setForm({...form, direccion: e.target.value})}
                className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-dark-400 mb-2">Mensaje de Bienvenida</label>
              <textarea
                value={form.bienvenido}
                onChange={(e) => setForm({...form, bienvenido: e.target.value})}
                rows={3}
                className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              />
            </div>
          </div>
        </div>
        
        <div className="bg-dark-800 rounded-2xl p-6 border border-dark-700">
          <h2 className="text-lg font-semibold text-white mb-4">Delivery</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-dark-400 mb-2">Precio Delivery</label>
              <input
                type="number"
                value={form.precio_delivery}
                onChange={(e) => setForm({...form, precio_delivery: parseFloat(e.target.value) || 0})}
                className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm text-dark-400 mb-2">Dirección Delivery</label>
              <input
                type="text"
                value={form.direccion_delivery}
                onChange={(e) => setForm({...form, direccion_delivery: e.target.value})}
                className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        </div>
        
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-primary-500 hover:bg-primary-600 disabled:bg-primary-800 text-white font-semibold rounded-xl transition"
        >
          {loading ? t('cargando') : t('guardar')}
        </button>
      </form>
    </div>
  )
}
