import { mergeMessages, afterMessage, beforeMessage } from '@/lib/chatCursor'
import { startVisiblePolling } from '@/lib/visiblePolling'
import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { useAuth } from '@/hooks/useAuth'

const ROLE_LABEL = { admin: 'Admin', mozo: 'Mozo', cajero: 'Cajero', cocina: 'Cocina', delivery: 'Delivery' }
export const ROLE_COLOR = {
  admin: 'bg-amber-500',
  mozo: 'bg-blue-500',
  cajero: 'bg-purple-500',
  cocina: 'bg-green-500',
  delivery: 'bg-orange-500'
}

// Chat interno del equipo (admin, cajero, mozo, cocina) para un restaurante.
// Se muestra/oculta con el botón "💬 Chat" de MesasAdmin, y cuando está
// abierto empuja el contenido de abajo (no tapa nada, es flujo normal,
// no position:fixed/absolute).
export default function ChatEquipo({ clienteId, open, onClose }) {
  const { user, profile, rol } = useAuth()
  const [mensajes, setMensajes] = useState([])
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [subiendoImagen, setSubiendoImagen] = useState(false)
  const [usuarios, setUsuarios] = useState([])
  const [showParticipantes, setShowParticipantes] = useState(false)
  const [destinatario, setDestinatario] = useState(null) // null = Todos
  const [errorLectura, setErrorLectura] = useState('')
  const bottomRef = useRef(null)
  const cursorRef = useRef(null)
  const generationRef = useRef(0)
  const [hasOlder, setHasOlder] = useState(true)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const prependRef = useRef(false)
  const fileInputRef = useRef(null)

  const esAdmin = rol === 'admin' || rol === 'superadmin'
  const nombreAutor = esAdmin ? 'Admin' : (profile?.nombre || 'Usuario')

  const fetchMensajes = useCallback(async () => {
    if (!clienteId) return
    const generation = generationRef.current
    try {
      // The cursor advances ONLY on confirmed database reads, never Realtime.
      // Realtime can arrive out of order or miss events during a disconnect.
      do {
        const cursor = cursorRef.current
        let query = supabase.from('chat_mensajes').select('*').eq('cliente_id', clienteId)
        if (cursor) query = query.or(afterMessage(cursor))
        const { data, error } = await query.order('qr_sequence', { ascending: Boolean(cursor) }).order('created_at', { ascending: Boolean(cursor) }).order('id', { ascending: Boolean(cursor) }).limit(50)
        if (generation !== generationRef.current) return
        if (error) throw error
        if (!cursor) setHasOlder((data || []).length === 50)
        if (!data?.length) break
        const sorted = mergeMessages([], data)
        setMensajes(prev => mergeMessages(prev, sorted))
        cursorRef.current = sorted[sorted.length - 1]
        if (!cursor || data.length < 50) break
      } while (generation === generationRef.current)
      setErrorLectura('')
    } catch (e) { if (generation === generationRef.current) setErrorLectura(e.message) }
  }, [clienteId])

  const cargarAnteriores = async () => {
    if (loadingOlder || !mensajes.length) return
    setLoadingOlder(true)
    const generation = generationRef.current
    const { data, error } = await supabase.from('chat_mensajes').select('*').eq('cliente_id', clienteId)
      .or(beforeMessage(mensajes[0])).order('qr_sequence', { ascending: false }).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(50)
    if (generation !== generationRef.current) return
    if (error) setErrorLectura(error.message)
    else {
      prependRef.current = true
      setMensajes(prev => mergeMessages(prev, data || []))
      setHasOlder((data || []).length === 50)
    }
    setLoadingOlder(false)
  }

  const fetchUsuarios = useCallback(async () => {
    if (!clienteId) return
    const { data } = await supabase
      .from('cliente_usuarios')
      .select('id, nombre, rol, activo, chat_activo')
      .eq('cliente_id', clienteId)
      .order('nombre')
    setUsuarios(data || [])
  }, [clienteId])

  useEffect(() => {
    if (!open || !clienteId) return
    generationRef.current++
    cursorRef.current = null
    setMensajes([]); setHasOlder(true); setLoadingOlder(false)
    fetchUsuarios()
    // Polling simple mientras el chat está abierto (evita quemar cuota
    // de requests cuando está cerrado). Si el proyecto tiene Realtime
    // habilitado para chat_mensajes (ver supabase/chat_equipo.sql) esto
    // igual sirve de respaldo.
    const stopPolling = startVisiblePolling(fetchMensajes, 15000)
    const channel = supabase
      .channel(`chat-equipo-${clienteId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_mensajes', filter: `cliente_id=eq.${clienteId}` },
        ({ new: nuevo }) => setMensajes(prev => mergeMessages(prev, [nuevo]))
      )
      .subscribe()
    return () => {
      generationRef.current++
      stopPolling()
      supabase.removeChannel(channel)
    }
  }, [open, clienteId, fetchMensajes, fetchUsuarios])

  useEffect(() => {
    if (prependRef.current) { prependRef.current = false; return }
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajes, open])

  const enviarMensaje = async (imagen_url = null) => {
    if (!texto.trim() && !imagen_url) return
    setEnviando(true)
    try {
      const { data: nuevo, error } = await supabase.from('chat_mensajes').insert({
        cliente_id: clienteId,
        autor_user_id: user?.id || null,
        autor_nombre: nombreAutor,
        autor_rol: esAdmin ? 'admin' : (rol || 'usuario'),
        texto: texto.trim() || null,
        imagen_url,
        // El admin no vive en cliente_usuarios y no tiene un UUID de esa tabla.
        // Guardar el texto "admin" en esta columna uuid impedía enviar el mensaje.
        destinatario_id: destinatario?.id === 'admin' ? null : (destinatario?.id || null),
        destinatario_nombre: destinatario?.nombre || null,
        destinatario_rol: destinatario?.rol || null
      }).select().single()
      if (error) throw error
      setTexto('')
      if (nuevo) setMensajes(prev => mergeMessages(prev, [nuevo]))
    } catch (err) {
      toast.error('Error al enviar: ' + err.message)
    } finally {
      setEnviando(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      enviarMensaje()
    }
  }

  const handleImagen = async (file) => {
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error('Solo se pueden subir imágenes'); return }
    if (file.size > 5 * 1024 * 1024) { toast.error('La imagen no puede pesar más de 5MB'); return }
    setSubiendoImagen(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `${clienteId}/chat/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('productos').upload(path, file)
      if (upErr) throw upErr
      const { data: pub } = supabase.storage.from('productos').getPublicUrl(path)
      await enviarMensaje(pub.publicUrl)
    } catch (err) {
      toast.error('Error al subir imagen: ' + err.message)
    } finally {
      setSubiendoImagen(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const toggleParticipante = async (u) => {
    const { error } = await supabase.from('cliente_usuarios').update({ chat_activo: !u.chat_activo }).eq('id', u.id)
    if (error) { toast.error('Error: ' + error.message); return }
    setUsuarios(prev => prev.map(x => x.id === u.id ? { ...x, chat_activo: !u.chat_activo } : x))
  }

  if (!open) return null

  const participantesActivos = usuarios.filter(u => u.chat_activo !== false && u.activo !== false)

  return (
    <div className="bg-dark-800 rounded-xl border border-dark-700 mb-6 overflow-hidden">
      {/* Header del chat */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-dark-700 bg-dark-900/40">
        <div className="flex items-center gap-2">
          <span className="text-white font-bold">💬 Chat del equipo</span>
          <span className="text-dark-400 text-xs">{participantesActivos.length + 1} participante{participantesActivos.length !== 0 ? 's' : ''}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowParticipantes(prev => !prev)}
            className="text-xs bg-dark-700 hover:bg-dark-600 text-white px-3 py-1.5 rounded-lg transition"
          >
            👥 Participantes
          </button>
          <button
            onClick={onClose}
            title="Cerrar chat"
            className="w-7 h-7 flex items-center justify-center bg-dark-700 hover:bg-red-600/40 text-dark-300 hover:text-white rounded-lg transition"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Panel de participantes: check para agregar/sacar gente del chat.
          Solo el admin (dueño) puede tocar los checks; el staff lo ve
          de solo lectura para saber quién está. */}
      {showParticipantes && (
        <div className="px-4 py-3 border-b border-dark-700 bg-dark-900/20">
          <div className="flex flex-wrap gap-2 mb-1">
            <span className="flex items-center gap-1.5 bg-dark-700 rounded-lg px-2.5 py-1 text-xs text-white">
              <span className={`w-2 h-2 rounded-full ${ROLE_COLOR.admin}`}></span>
              Admin <span className="text-dark-500">(siempre)</span>
            </span>
            {usuarios.map(u => (
              <label
                key={u.id}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs cursor-pointer transition ${u.chat_activo !== false ? 'bg-dark-700 text-white' : 'bg-dark-900 text-dark-500'} ${!esAdmin ? 'cursor-default' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={u.chat_activo !== false}
                  onChange={() => esAdmin && toggleParticipante(u)}
                  disabled={!esAdmin}
                  className="accent-primary-500 w-3.5 h-3.5"
                />
                <span className={`w-2 h-2 rounded-full ${ROLE_COLOR[u.rol] || 'bg-gray-500'}`}></span>
                {u.nombre} <span className="text-dark-500">({ROLE_LABEL[u.rol] || u.rol})</span>
              </label>
            ))}
            {usuarios.length === 0 && <span className="text-dark-500 text-xs">Todavía no creaste usuarios (mozo/cajero/cocina) en la pestaña Usuarios.</span>}
          </div>
          {!esAdmin && <p className="text-dark-500 text-[10px] mt-1">Solo el admin puede sumar o sacar gente del chat.</p>}
        </div>
      )}

      {/* Mensajes */}
      <div className="h-80 overflow-y-auto px-4 py-3 space-y-3">
        {hasOlder && mensajes.length > 0 && <button className="text-primary-400 text-sm" disabled={loadingOlder} onClick={cargarAnteriores}>{loadingOlder ? 'Cargando…' : 'Cargar mensajes anteriores'}</button>}
        {errorLectura ? (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-center">
            <p className="text-red-300 text-sm">No se pudieron cargar los mensajes.</p>
            <p className="text-red-400/80 text-xs mt-1">Ejecutá el archivo supabase/chat_equipo.sql actualizado.</p>
          </div>
        ) : mensajes.length === 0 ? (
          <p className="text-dark-500 text-sm italic text-center py-8">Todavía no hay mensajes. Escribí el primero 👋</p>
        ) : (
          mensajes.map(m => {
            const propio = m.autor_user_id && user?.id && m.autor_user_id === user.id
            return (
              <div key={m.id} className={`flex ${propio ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] rounded-xl px-3 py-2 ${propio ? 'bg-primary-500/20 border border-primary-500/40' : 'bg-dark-700'}`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className={`w-2 h-2 rounded-full ${ROLE_COLOR[m.autor_rol] || 'bg-gray-500'}`}></span>
                    <span className="text-white text-xs font-semibold">{m.autor_nombre}</span>
                    <span className="text-dark-500 text-[10px]">
                      {new Date(m.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  {m.destinatario_nombre && (
                    <div className="flex items-center gap-1 mb-1">
                      <span className="text-dark-500 text-[10px]">Para:</span>
                      <span className={`w-1.5 h-1.5 rounded-full ${ROLE_COLOR[m.destinatario_rol] || 'bg-gray-500'}`}></span>
                      <span className="text-dark-400 text-[10px] font-medium">{m.destinatario_nombre}</span>
                    </div>
                  )}
                  {m.imagen_url && (
                    <img
                      src={m.imagen_url}
                      alt="imagen"
                      className="max-w-full max-h-56 rounded-lg mb-1 cursor-pointer"
                      onClick={() => window.open(m.imagen_url, '_blank')}
                    />
                  )}
                  {m.texto && <p className="text-dark-200 text-sm whitespace-pre-wrap break-words">{m.texto}</p>}
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Selector de destinatario: a quién va dirigido el próximo mensaje.
          Sigue siendo un chat grupal (todos ven el mensaje), esto solo
          lo etiqueta con "Para: X" para que se note a quién apunta. */}
      <div className="flex items-center gap-1.5 px-4 pt-2 overflow-x-auto">
        <span className="text-dark-500 text-[10px] flex-shrink-0">Para:</span>
        <button
          onClick={() => setDestinatario(null)}
          className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded-full flex-shrink-0 transition ${!destinatario ? 'bg-primary-500/30 text-primary-300 ring-1 ring-primary-500' : 'bg-dark-700 text-dark-300 hover:bg-dark-600'}`}
        >
          Todos
        </button>
        <button
          onClick={() => setDestinatario({ id: 'admin', nombre: 'Admin', rol: 'admin' })}
          className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded-full flex-shrink-0 transition ${destinatario?.id === 'admin' ? 'bg-primary-500/30 text-primary-300 ring-1 ring-primary-500' : 'bg-dark-700 text-dark-300 hover:bg-dark-600'}`}
        >
          <span className={`w-2 h-2 rounded-full ${ROLE_COLOR.admin}`}></span>
          Admin
        </button>
        {participantesActivos.map(u => (
          <button
            key={u.id}
            onClick={() => setDestinatario({ id: u.id, nombre: u.nombre, rol: u.rol })}
            className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded-full flex-shrink-0 transition ${destinatario?.id === u.id ? 'bg-primary-500/30 text-primary-300 ring-1 ring-primary-500' : 'bg-dark-700 text-dark-300 hover:bg-dark-600'}`}
          >
            <span className={`w-2 h-2 rounded-full ${ROLE_COLOR[u.rol] || 'bg-gray-500'}`}></span>
            {u.nombre}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 px-4 py-3 border-t border-dark-700">
        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          className="hidden"
          onChange={e => handleImagen(e.target.files[0])}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={subiendoImagen}
          title="Enviar imagen"
          className="flex-shrink-0 w-9 h-9 flex items-center justify-center bg-dark-700 hover:bg-dark-600 disabled:opacity-50 text-white rounded-lg transition"
        >
          {subiendoImagen ? '⏳' : '🖼️'}
        </button>
        <input
          type="text"
          value={texto}
          onChange={e => setTexto(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escribí un mensaje para el equipo..."
          className="flex-1 bg-dark-900 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm placeholder-dark-500 focus:outline-none focus:border-primary-500"
        />
        <button
          onClick={() => enviarMensaje()}
          disabled={enviando || !texto.trim()}
          className="flex-shrink-0 bg-primary-500 hover:bg-primary-600 disabled:opacity-40 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          Enviar
        </button>
      </div>
    </div>
  )
}
