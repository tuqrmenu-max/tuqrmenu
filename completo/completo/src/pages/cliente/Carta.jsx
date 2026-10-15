import { useState, useEffect } from 'react'
import { useI18n } from '@/lib/i18n'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

export default function Carta() {
  const { t } = useI18n()
  const { profile } = useAuth()
  const [categorias, setCategorias] = useState([])
  const [productos, setProductos] = useState([])
  const [showCategoriaModal, setShowCategoriaModal] = useState(false)
  const [showProductoModal, setShowProductoModal] = useState(false)
  const [editingCategoria, setEditingCategoria] = useState(null)
  const [editingProducto, setEditingProducto] = useState(null)
  const [formCategoria, setFormCategoria] = useState({ nombre: '', imagen: '' })
  const [formProducto, setFormProducto] = useState({ nombre: '', precio: 0, descripcion: '', imagen: '', categoria_id: '' })

  useEffect(() => {
    if (profile?.id) {
      fetchCategorias()
      fetchProductos()
    }
  }, [profile])

  const fetchCategorias = async () => {
    const { data } = await supabase
      .from('categorias')
      .select('*')
      .eq('cliente_id', profile.id)
      .order('orden')
    if (data) setCategorias(data)
  }

  const fetchProductos = async () => {
    const { data } = await supabase
      .from('productos')
      .select('*, categorias(nombre)')
      .eq('cliente_id', profile.id)
    if (data) setProductos(data)
  }

  const saveCategoria = async (e) => {
    e.preventDefault()
    
    if (editingCategoria) {
      const { error } = await supabase
        .from('categorias')
        .update(formCategoria)
        .eq('id', editingCategoria.id)
      if (error) return toast.error(error.message)
    } else {
      const { error } = await supabase
        .from('categorias')
        .insert({ ...formCategoria, cliente_id: profile.id, orden: categorias.length })
      if (error) return toast.error(error.message)
    }
    
    toast.success('Categoría guardada')
    setShowCategoriaModal(false)
    setEditingCategoria(null)
    setFormCategoria({ nombre: '', imagen: '' })
    fetchCategorias()
  }

  const saveProducto = async (e) => {
    e.preventDefault()
    
    if (editingProducto) {
      const { error } = await supabase
        .from('productos')
        .update(formProducto)
        .eq('id', editingProducto.id)
      if (error) return toast.error(error.message)
    } else {
      const { error } = await supabase
        .from('productos')
        .insert({ ...formProducto, cliente_id: profile.id })
      if (error) return toast.error(error.message)
    }
    
    toast.success('Producto guardado')
    setShowProductoModal(false)
    setEditingProducto(null)
    setFormProducto({ nombre: '', precio: 0, descripcion: '', imagen: '', categoria_id: '' })
    fetchProductos()
  }

  const deleteItem = async (table, id) => {
    if (!confirm('¿Eliminar?')) return
    
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (!error) {
      toast.success('Eliminado')
      if (table === 'categorias') fetchCategorias()
      else fetchProductos()
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">{t('carta')}</h1>
      </div>
      
      {/* Categorías */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Categorías</h2>
          <button
            onClick={() => { setEditingCategoria(null); setFormCategoria({ nombre: '', imagen: '' }); setShowCategoriaModal(true) }}
            className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-xl transition text-sm"
          >
            + Nueva Categoría
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {categorias.map((cat) => (
            <div key={cat.id} className="bg-dark-800 rounded-xl p-4 border border-dark-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {cat.imagen && <img src={cat.imagen} alt="" className="w-10 h-10 rounded-lg object-cover" />}
                <span className="text-white font-medium">{cat.nombre}</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setEditingCategoria(cat); setFormCategoria({ nombre: cat.nombre, imagen: cat.imagen }); setShowCategoriaModal(true) }} className="text-dark-400 hover:text-white">✏️</button>
                <button onClick={() => deleteItem('categorias', cat.id)} className="text-dark-400 hover:text-red-400">🗑️</button>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Productos */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Productos</h2>
          <button
            onClick={() => { setEditingProducto(null); setFormProducto({ nombre: '', precio: 0, descripcion: '', imagen: '', categoria_id: categorias[0]?.id || '' }); setShowProductoModal(true) }}
            className="px-4 py-2 bg-accent-500 hover:bg-accent-600 text-white rounded-xl transition text-sm"
          >
            + Nuevo Producto
          </button>
        </div>
        
        <div className="bg-dark-800 rounded-2xl border border-dark-700 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-dark-700">
                <th className="text-left px-6 py-4 text-dark-400 font-medium">Producto</th>
                <th className="text-left px-6 py-4 text-dark-400 font-medium">Categoría</th>
                <th className="text-left px-6 py-4 text-dark-400 font-medium">Precio</th>
                <th className="text-left px-6 py-4 text-dark-400 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {productos.map((p) => (
                <tr key={p.id} className="border-b border-dark-700 last:border-0">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {p.imagen && <img src={p.imagen} alt="" className="w-10 h-10 rounded-lg object-cover" />}
                      <div>
                        <p className="text-white font-medium">{p.nombre}</p>
                        {p.descripcion && <p className="text-dark-400 text-sm truncate max-w-xs">{p.descripcion}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-dark-300">{p.categorias?.nombre}</td>
                  <td className="px-6 py-4 text-accent-400 font-semibold">${p.precio}</td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button onClick={() => { setEditingProducto(p); setFormProducto({ nombre: p.nombre, precio: p.precio, descripcion: p.descripcion, imagen: p.imagen, categoria_id: p.categoria_id }); setShowProductoModal(true) }} className="text-dark-400 hover:text-white">✏️</button>
                      <button onClick={() => deleteItem('productos', p.id)} className="text-dark-400 hover:text-red-400">🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Modal Categoría */}
      {showCategoriaModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-dark-800 rounded-2xl p-6 w-full max-w-md border border-dark-700">
            <h3 className="text-xl font-semibold text-white mb-4">{editingCategoria ? 'Editar' : 'Nueva'} Categoría</h3>
            <form onSubmit={saveCategoria} className="space-y-4">
              <input
                type="text"
                placeholder="Nombre"
                value={formCategoria.nombre}
                onChange={(e) => setFormCategoria({...formCategoria, nombre: e.target.value})}
                className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-xl text-white"
                required
              />
              <input
                type="text"
                placeholder="URL imagen (opcional)"
                value={formCategoria.imagen}
                onChange={(e) => setFormCategoria({...formCategoria, imagen: e.target.value})}
                className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-xl text-white"
              />
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowCategoriaModal(false)} className="flex-1 py-3 bg-dark-700 text-white rounded-xl">Cancelar</button>
                <button type="submit" className="flex-1 py-3 bg-primary-500 text-white rounded-xl">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Modal Producto */}
      {showProductoModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-dark-800 rounded-2xl p-6 w-full max-w-md border border-dark-700">
            <h3 className="text-xl font-semibold text-white mb-4">{editingProducto ? 'Editar' : 'Nuevo'} Producto</h3>
            <form onSubmit={saveProducto} className="space-y-4">
              <select
                value={formProducto.categoria_id}
                onChange={(e) => setFormProducto({...formProducto, categoria_id: e.target.value})}
                className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-xl text-white"
                required
              >
                <option value="">Seleccionar categoría</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Nombre"
                value={formProducto.nombre}
                onChange={(e) => setFormProducto({...formProducto, nombre: e.target.value})}
                className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-xl text-white"
                required
              />
              <input
                type="number"
                placeholder="Precio"
                value={formProducto.precio}
                onChange={(e) => setFormProducto({...formProducto, precio: parseFloat(e.target.value) || 0})}
                className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-xl text-white"
                required
              />
              <textarea
                placeholder="Descripción"
                value={formProducto.descripcion}
                onChange={(e) => setFormProducto({...formProducto, descripcion: e.target.value})}
                className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-xl text-white resize-none"
                rows={2}
              />
              <input
                type="text"
                placeholder="URL imagen (opcional)"
                value={formProducto.imagen}
                onChange={(e) => setFormProducto({...formProducto, imagen: e.target.value})}
                className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-xl text-white"
              />
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowProductoModal(false)} className="flex-1 py-3 bg-dark-700 text-white rounded-xl">Cancelar</button>
                <button type="submit" className="flex-1 py-3 bg-primary-500 text-white rounded-xl">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
