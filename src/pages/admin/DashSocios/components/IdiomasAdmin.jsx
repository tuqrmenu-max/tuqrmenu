import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { IDIOMAS, normalizarIdiomas } from '@/lib/idiomas'
import TraduccionesPendientes from './TraduccionesPendientes'
import toast from 'react-hot-toast'

function BloqueIdiomas({ titulo, descripcion, seleccion, onToggle, onTodos }) {
  const activos = seleccion.filter(c => c !== 'es').length
  return (
    <div className="bg-dark-800 rounded-2xl p-6 border border-dark-700">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white">{titulo}</h2>
          <p className="text-dark-400 text-sm mt-1">{descripcion}</p>
        </div>
        <button
          type="button"
          onClick={onTodos}
          className="bg-dark-700 hover:bg-dark-600 text-white px-3 py-2 rounded-lg text-sm transition whitespace-nowrap"
        >
          {activos === IDIOMAS.length ? 'Quitar todos' : 'Marcar todos'}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <label className="flex items-center gap-3 px-4 py-3 rounded-xl border border-dark-600 bg-dark-700/50 opacity-70 cursor-not-allowed">
          <input type="checkbox" checked disabled className="w-4 h-4" />
          <span className="text-xl">🇪🇸</span>
          <span className="text-white text-sm">Español <span className="text-dark-400">(siempre activo)</span></span>
        </label>
        {IDIOMAS.map(({ code, nombre, nativo, bandera }) => {
          const marcado = seleccion.includes(code)
          return (
            <label
              key={code}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition ${
                marcado ? 'border-primary-500 bg-primary-500/10' : 'border-dark-600 bg-dark-700 hover:border-dark-500'
              }`}
            >
              <input
                type="checkbox"
                checked={marcado}
                onChange={() => onToggle(code)}
                className="w-4 h-4"
              />
              <span className="text-xl">{bandera}</span>
              <span className="text-white text-sm">{nombre} <span className="text-dark-400">· {nativo}</span></span>
            </label>
          )
        })}
      </div>
    </div>
  )
}

export default function IdiomasAdmin({ clienteId }) {
  const [menu, setMenu] = useState(['es'])
  const [app, setApp] = useState(['es'])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [original, setOriginal] = useState(null)
  // Idiomas del menú ya guardados: sobre estos se calcula qué falta traducir.
  const [menuGuardado, setMenuGuardado] = useState(['es'])

  useEffect(() => {
    if (!clienteId) return
    let activo = true
    setLoading(true)
    supabase
      .from('clientes')
      .select('idiomas_menu, idiomas_app')
      .eq('id', clienteId)
      .single()
      .then(({ data, error }) => {
        if (!activo) return
        if (error) {
          toast.error('No se pudieron cargar los idiomas: ' + error.message)
        } else {
          const m = normalizarIdiomas(data?.idiomas_menu)
          const a = normalizarIdiomas(data?.idiomas_app)
          setMenu(m); setApp(a); setMenuGuardado(m)
          setOriginal(JSON.stringify([m, a]))
        }
        setLoading(false)
      })
    return () => { activo = false }
  }, [clienteId])

  const alternar = (setter) => (code) =>
    setter(prev => normalizarIdiomas(prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]))

  const todos = (setter) => () =>
    setter(prev => (prev.length - 1 === IDIOMAS.length ? ['es'] : normalizarIdiomas(IDIOMAS.map(i => i.code))))

  const hayCambios = original !== JSON.stringify([menu, app])

  const guardar = async () => {
    setSaving(true)
    const { error } = await supabase
      .from('clientes')
      .update({ idiomas_menu: menu, idiomas_app: app })
      .eq('id', clienteId)
    setSaving(false)
    if (error) {
      toast.error('Error al guardar: ' + error.message)
    } else {
      setOriginal(JSON.stringify([menu, app]))
      setMenuGuardado(menu)
      toast.success('Idiomas guardados')
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl space-y-6">
      <BloqueIdiomas
        titulo="Idiomas del menú del cliente"
        descripcion="Idiomas que el comensal podrá elegir al abrir el menú por QR."
        seleccion={menu}
        onToggle={alternar(setMenu)}
        onTodos={todos(setMenu)}
      />
      <BloqueIdiomas
        titulo="Idiomas de la app"
        descripcion="Idiomas que podrán usar el dueño y el equipo (mozo, cajero, cocina) en el panel."
        seleccion={app}
        onToggle={alternar(setApp)}
        onTodos={todos(setApp)}
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={guardar}
          disabled={saving || !hayCambios}
          className="bg-primary-500 hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl font-medium transition"
        >
          {saving ? 'Guardando...' : 'Guardar idiomas'}
        </button>
        {hayCambios && <span className="text-dark-400 text-sm">Hay cambios sin guardar</span>}
      </div>

      <TraduccionesPendientes clienteId={clienteId} idiomas={menuGuardado} />
    </div>
  )
}
