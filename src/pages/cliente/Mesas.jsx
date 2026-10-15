import { useState, useEffect } from 'react'
import { useI18n } from '@/lib/i18n'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

export default function Mesas() {
  const { t } = useI18n()
  const { profile } = useAuth()
  const [mesas, setMesas] = useState([])
  const [nuevaMesa, setNuevaMesa] = useState('')

  useEffect(() => {
    if (profile?.id) fetchMesas()
  }, [profile])

  const fetchMesas = async () => {
    const { data } = await supabase
      .from('mesas')
      .select('*')
      .eq('cliente_id', profile.id)
      .order('numero')
    if (data) setMesas(data)
  }

  const addMesa = async () => {
    const numero = parseInt(nuevaMesa)
    if (isNaN(numero)) return toast.error('Número inválido')
    if (mesas.find(m => m.numero === numero)) return toast.error('Mesa ya existe')
    
    const { error } = await supabase
      .from('mesas')
      .insert({ cliente_id: profile.id, numero })
    
    if (error) return toast.error(error.message)
    toast.success(`Mesa ${numero} creada`)
    setNuevaMesa('')
    fetchMesas()
  }

  const toggleMesa = async (id, activa) => {
    const { error } = await supabase
      .from('mesas')
      .update({ activa: !activa })
      .eq('id', id)
    if (!error) fetchMesas()
  }

  const deleteMesa = async (id, numero) => {
    if (numero === 0) return toast.error('No se puede eliminar la mesa 0')
    if (!confirm('¿Eliminar esta mesa?')) return
    
    const { error } = await supabase.from('mesas').delete().eq('id', id)
    if (!error) {
      toast.success('Mesa eliminada')
      fetchMesas()
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">{t('mesas')}</h1>
      
      {/* Agregar mesa */}
      <div className="bg-dark-800 rounded-2xl p-6 border border-dark-700 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">Agregar Mesa</h2>
        <div className="flex gap-4">
          <input
            type="number"
            value={nuevaMesa}
            onChange={(e) => setNuevaMesa(e.target.value)}
            placeholder="Número de mesa"
            className="flex-1 px-4 py-3 bg-dark-700 border border-dark-600 rounded-xl text-white"
          />
          <button
            onClick={addMesa}
            className="px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-xl transition"
          >
            + Agregar
          </button>
        </div>
        <p className="text-sm text-dark-400 mt-2">
          La mesa 0 es para delivery (clientes desde afuera)
        </p>
      </div>
      
      {/* Lista de mesas */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {mesas.map((mesa) => (
          <div
            key={mesa.id}
            className={`bg-dark-800 rounded-2xl p-6 border border-dark-700 text-center relative ${!mesa.activa ? 'opacity-50' : ''}`}
          >
            <button
              onClick={() => deleteMesa(mesa.id, mesa.numero)}
              className="absolute top-2 right-2 text-dark-500 hover:text-red-400"
            >
              ×
            </button>
            <p className="text-4xl font-bold text-white mb-2">{mesa.numero}</p>
            <span className={`px-2 py-1 rounded-full text-xs ${mesa.activa ? 'bg-accent-500/20 text-accent-400' : 'bg-dark-600 text-dark-400'}`}>
              {mesa.activa ? 'Activa' : 'Inactiva'}
            </span>
            <button
              onClick={() => toggleMesa(mesa.id, mesa.activa)}
              className="mt-4 w-full py-2 bg-dark-700 hover:bg-dark-600 rounded-lg text-sm text-dark-300 transition"
            >
              {mesa.activa ? 'Desactivar' : 'Activar'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
