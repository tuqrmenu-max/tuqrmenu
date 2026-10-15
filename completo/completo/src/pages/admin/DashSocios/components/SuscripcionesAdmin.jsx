import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

export default function SuscripcionesAdmin({ clienteId }) {
  const [suscripciones, setSuscripciones] = useState([])
  const [promociones, setPromociones] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedPromo, setSelectedPromo] = useState('')
  const [selectedClients, setSelectedClients] = useState([])

  useEffect(() => {
    if (clienteId) fetchData()
  }, [clienteId])

  const fetchData = async () => {
    const [subsRes, promosRes] = await Promise.all([
      supabase.from('suscripciones').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false }),
      supabase.from('promociones').select('*').eq('cliente_id', clienteId).order('titulo')
    ])

    if (!subsRes.error) {
      // Enriquecer con conteo de promos
      const subs = subsRes.data || []
      for (const sub of subs) {
        const { count } = await supabase
          .from('promociones_cliente')
          .select('*', { count: 'exact', head: true })
          .eq('suscripcion_id', sub.id)
          .eq('usada', false)
          .eq('activa', true)
        
        sub.promos_count = count || 0
      }
      setSuscripciones(subs)
    }
    
    if (!promosRes.error) setPromociones(promosRes.data || [])
    setLoading(false)
  }

  const filteredSuscripciones = suscripciones.filter(s =>
    s.nombre?.toLowerCase().includes(search.toLowerCase()) ||
    s.whatsapp?.includes(search)
  )

  const toggleSelectClient = (id) => {
    setSelectedClients(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const selectAll = () => {
    const allIds = filteredSuscripciones.map(s => s.id)
    setSelectedClients(allIds)
  }

  const assignPromo = async () => {
    if (!selectedPromo) {
      toast.error('Seleccioná una promoción')
      return
    }
    if (selectedClients.length === 0) {
      toast.error('Seleccioná al menos un cliente')
      return
    }

    let count = 0
    for (const clientId of selectedClients) {
      const { data: existing } = await supabase
        .from('promociones_cliente')
        .select('id')
        .eq('promocion_id', selectedPromo)
        .eq('suscripcion_id', clientId)
        .single()

      if (!existing) {
        await supabase.from('promociones_cliente').insert({
          promocion_id: selectedPromo,
          suscripcion_id: clientId
        })
        count++
      }
    }

    toast.success(`Promo asignada a ${count} cliente(s)`)
    setSelectedClients([])
    setSelectedPromo('')
    fetchData()
  }

  const sendWhatsApp = (suscripcion) => {
    const numero = suscripcion.whatsapp?.replace('+', '').replace(/\s/g, '')
    const mensaje = `🎉 Hola ${suscripcion.nombre}! Tenemos una promoción especial esperándote. ¡Te esperamos! 🎊`
    window.open(`https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`, '_blank')
  }

  const deleteSubscription = async (id) => {
    if (!confirm('¿Eliminar esta suscripción?')) return
    
    await supabase.from('promociones_cliente').delete().eq('suscripcion_id', id)
    const { error } = await supabase.from('suscripciones').delete().eq('id', id)

    if (!error) {
      toast.success('Suscripción eliminada')
      fetchData()
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="bg-dark-800 rounded-xl p-4 mb-6 border border-dark-700">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-white font-bold text-lg">👥 Suscriptos ({suscripciones.length})</h2>
          
          {/* Asignación rápida */}
          <div className="flex items-center gap-2">
            <select
              value={selectedPromo}
              onChange={e => setSelectedPromo(e.target.value)}
              className="bg-dark-900 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm"
            >
              <option value="">Seleccionar promo</option>
              {promociones.map(p => (
                <option key={p.id} value={p.id}>{p.titulo}</option>
              ))}
            </select>
            <button
              onClick={assignPromo}
              disabled={!selectedPromo || selectedClients.length === 0}
              className="bg-green-600 hover:bg-green-500 disabled:bg-dark-600 disabled:text-dark-400 text-white px-4 py-2 rounded-lg text-sm font-bold transition"
            >
              Asignar a {selectedClients.length || ''}
            </button>
            <button
              onClick={selectAll}
              className="bg-dark-700 hover:bg-dark-600 text-white px-3 py-2 rounded-lg text-sm transition"
            >
              Todos
            </button>
          </div>
        </div>
      </div>

      {/* Búsqueda */}
      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre o WhatsApp..."
          className="w-full md:w-96 px-4 py-2 bg-dark-800 border border-dark-700 rounded-xl text-white placeholder-dark-400 focus:outline-none focus:border-primary-500"
        />
      </div>

      {/* Lista */}
      {filteredSuscripciones.length === 0 ? (
        <div className="bg-dark-800 rounded-xl p-12 border border-dark-700 text-center">
          <p className="text-dark-400">
            {search ? 'No se encontraron suscriptos' : 'No hay suscriptos aún'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSuscripciones.map(sub => (
            <div
              key={sub.id}
              className="bg-dark-800 rounded-xl border border-dark-700 p-4 hover:border-primary-500/50 transition"
            >
              <div className="flex items-center gap-4">
                <input
                  type="checkbox"
                  checked={selectedClients.includes(sub.id)}
                  onChange={() => toggleSelectClient(sub.id)}
                  className="w-4 h-4 accent-primary-500"
                />
                
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-white font-semibold">{sub.nombre}</h3>
                    {sub.promos_count > 0 && (
                      <span className="bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded text-xs">
                        {sub.promos_count} promos
                      </span>
                    )}
                  </div>
                  <p className="text-dark-400 text-sm">
                    📱 {sub.whatsapp || 'Sin WhatsApp'}
                    {sub.instagram && <span className="ml-3">📷 {sub.instagram}</span>}
                  </p>
                  <p className="text-dark-500 text-xs mt-1">
                    Mesa: {sub.mesa || '-'} • {new Date(sub.created_at).toLocaleDateString('es-AR')}
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => sendWhatsApp(sub)}
                    className="bg-green-600/20 text-green-400 hover:bg-green-600/30 px-3 py-2 rounded-lg text-sm transition"
                    title="Enviar WhatsApp"
                  >
                    📱
                  </button>
                  <button
                    onClick={() => deleteSubscription(sub.id)}
                    className="bg-red-500/20 text-red-400 hover:bg-red-500/30 px-3 py-2 rounded-lg text-sm transition"
                    title="Eliminar"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
