import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '@/lib/i18n'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

export default function FormularioCliente() {
  const { t } = useI18n()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    nombre_restaurante: '',
    whatsapp: '',
    direccion: '',
    horario: '',
    observaciones: '',
  })
  const [imagenes, setImagenes] = useState([])

  const handleInputChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleImageCapture = async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.capture = 'environment'
    input.onchange = async (e) => {
      const file = e.target.files[0]
      if (!file) return

      const fileName = `solicitud_${profile.id}_${Date.now()}`
      const { data, error } = await supabase.storage
        .from('solicitudes-imagenes')
        .upload(fileName, file)

      if (!error) {
        const { data: urlData } = supabase.storage
          .from('solicitudes-imagenes')
          .getPublicUrl(fileName)
        setImagenes([...imagenes, urlData.publicUrl])
        toast.success('Foto cargada')
      } else {
        toast.error('Error al subir imagen')
      }
    }
    input.click()
  }

  const handleImageUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    const fileName = `solicitud_${profile.id}_${Date.now()}`
    const { data, error } = await supabase.storage
      .from('solicitudes-imagenes')
      .upload(fileName, file)

    if (!error) {
      const { data: urlData } = supabase.storage
        .from('solicitudes-imagenes')
        .getPublicUrl(fileName)
      setImagenes([...imagenes, urlData.publicUrl])
      toast.success('Foto cargada')
    } else {
      toast.error('Error al subir imagen')
    }
  }

  const removeImage = (index) => {
    setImagenes(imagenes.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const imagenesObj = {}
      imagenes.forEach((img, i) => {
        imagenesObj[`imagen_${i + 1}`] = img
      })

      const { error } = await supabase
        .from('solicitudes_cliente')
        .insert({
          vendedor_id: profile.id,
          nombre_restaurante: form.nombre_restaurante,
          whatsapp: form.whatsapp,
          direccion: form.direccion,
          horario: form.horario,
          observaciones: form.observaciones,
          ...imagenesObj,
          estado: 'pendiente'
        })

      if (error) throw error

      toast.success('Solicitud enviada al admin')
      navigate('/vendedor')
    } catch (error) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="px-4 py-6">
      <h1 className="text-xl font-bold text-white mb-6">Nuevo Cliente</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-dark-800 rounded-2xl p-5 border border-dark-700">
          <h2 className="text-base font-semibold text-white mb-4">Datos del Restaurante</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-dark-400 mb-1">Nombre del Cliente *</label>
              <input
                type="text"
                name="nombre_restaurante"
                value={form.nombre_restaurante}
                onChange={handleInputChange}
                className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Ej: Donde Carlos"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-dark-400 mb-1">WhatsApp *</label>
              <input
                type="text"
                name="whatsapp"
                value={form.whatsapp}
                onChange={handleInputChange}
                className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="+54 9 11 1234-5678"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-dark-400 mb-1">Ubicación *</label>
              <input
                type="text"
                name="direccion"
                value={form.direccion}
                onChange={handleInputChange}
                className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Dirección del local"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-dark-400 mb-1">Horario *</label>
              <input
                type="text"
                name="horario"
                value={form.horario}
                onChange={handleInputChange}
                className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Ej: Lun-Dom 11:00 - 23:00"
                required
              />
            </div>
          </div>
        </div>

        <div className="bg-dark-800 rounded-2xl p-5 border border-dark-700">
          <h2 className="text-base font-semibold text-white mb-1">Fotos del Local</h2>
          <p className="text-xs text-dark-400 mb-4">Tomá o subí fotos del restaurante</p>

          <div className="grid grid-cols-3 gap-3 mb-4">
            {imagenes.map((img, index) => (
              <div key={index} className="relative aspect-square rounded-xl overflow-hidden bg-dark-700">
                <img src={img} alt={`Foto ${index + 1}`} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  className="absolute top-1 right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white text-xs"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleImageCapture}
              className="flex-1 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-xl transition text-sm font-medium flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Cámara
            </button>
            <label className="flex-1 py-3 bg-dark-600 hover:bg-dark-500 text-white rounded-xl transition text-sm font-medium flex items-center justify-center gap-2 cursor-pointer">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Galería
              <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            </label>
          </div>
        </div>

        <div className="bg-dark-800 rounded-2xl p-5 border border-dark-700">
          <h2 className="text-base font-semibold text-white mb-3">Observaciones</h2>
          <textarea
            name="observaciones"
            value={form.observaciones}
            onChange={handleInputChange}
            rows={3}
            className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            placeholder="Comentario adicional..."
          />
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => navigate('/vendedor')}
            className="flex-1 py-3 bg-dark-700 hover:bg-dark-600 text-white rounded-xl transition text-sm"
          >
            {t('cancelar')}
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 py-3 bg-accent-500 hover:bg-accent-600 disabled:bg-accent-800 text-white font-semibold rounded-xl transition text-sm flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Enviando...
              </>
            ) : (
              'Enviar Datos'
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
