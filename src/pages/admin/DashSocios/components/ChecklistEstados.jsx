import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { useAuth } from '@/hooks/useAuth'

// ============================================================================
// ChecklistEstados
// ============================================================================
// 4 checks visuales que reflejan el avance del pedido delivery/retiro.
//
//   🟡 Amarillo  (derivado a mozo/cocina)
//       quien lo marca: cajero/admin al pulsar "A Mozo" o "A Cocina"
//       quien lo ve:    todos
//   🔵 Azul      (preparado)
//       quien lo marca: mozo o cocina (segun derivado_area)
//       quien lo ve:    todos
//   🟣 Morado    (entregado / despachado)
//       quien lo marca: cajero/admin
//       quien lo ve:    todos
//   🟢 Verde     (cliente recibio + comentario)
//       quien lo marca: cajero/admin
//       quien lo ve:    todos, queda archivado para caja diaria
//
// Cada check es un boton circular:
//   idle      -> borde del color, fondo transparente, sin check
//   done      -> fondo del color, check blanco
//   disabled  -> gris, sin interaccion
// ============================================================================

const CHECKS = [
  { key: 'amarillo', color: '#f59e0b', label: 'Ingresa menú' },
  { key: 'azul',     color: '#3b82f6', label: 'Cocina' },
  { key: 'morado',   color: '#a855f7', label: 'Delivery' },
  { key: 'verde',    color: '#22c55e', label: 'Pedido entregado' }
]

function checkDone(comensal, key) {
  const ep = comensal.estado_pedido
  const esMesaFisica = Number(comensal.mesa) > 0
  if (esMesaFisica) {
    if (key === 'amarillo') return ['en_preparacion', 'preparado', 'en_delivery', 'entregado', 'cerrado'].includes(ep)
    if (key === 'azul') return ['preparado', 'en_delivery', 'entregado', 'cerrado'].includes(ep)
    if (key === 'morado') return ['en_delivery', 'entregado', 'cerrado'].includes(ep)
    if (key === 'verde') return ['entregado', 'cerrado'].includes(ep)
  }
  if (key === 'amarillo') return ['en_preparacion', 'preparado', 'en_delivery', 'entregado', 'cerrado'].includes(ep)
  if (key === 'azul')     return ['preparado', 'en_delivery', 'entregado', 'cerrado'].includes(ep)
  if (key === 'morado')   return ['en_delivery', 'entregado', 'cerrado'].includes(ep)
  if (key === 'verde')    return ['entregado', 'cerrado'].includes(ep)
  return false
}

function checkDisabled(comensal, key, rol, derivadoArea) {
  const ep = comensal.estado_pedido

  // Si ya esta cerrado, nadie puede tocar nada.
  if (ep === 'cerrado') return true

  if (key === 'amarillo') {
    // Solo cajero/admin lo activan al elegir area. Bloqueado una vez derivado.
    if (!['superadmin', 'admin', 'cajero'].includes(rol)) return true
    return ep !== 'nuevo'
  }

  if (key === 'azul') {
    // Solo si esta en_preparacion y soy el area correcta.
    if (ep !== 'en_preparacion') return true
    if (derivadoArea === 'cocina' && !['cocina', 'superadmin', 'admin', 'cajero'].includes(rol)) return true
    if (derivadoArea === 'mozo'  && !['mozo', 'superadmin', 'admin', 'cajero'].includes(rol)) return true
    if (!derivadoArea) return true
    return false
  }

  if (key === 'morado') {
    // Solo cajero/admin despues de preparado.
    if (!['superadmin', 'admin', 'cajero'].includes(rol)) return true
    return ep !== 'preparado'
  }

  if (key === 'verde') {
    // En mesas físicas el verde confirma la entrega, pero no cobra ni cierra.
    if (Number(comensal.mesa) > 0) {
      if (!['superadmin', 'admin', 'cajero'].includes(rol)) return true
      return !['preparado', 'en_delivery'].includes(ep)
    }
    // Mesa 0: confirma entrega sin cobrar ni cerrar caja.
    if (!['superadmin', 'admin', 'cajero'].includes(rol)) return true
    if (comensal.metodo_entrega === 'retiro') return ep !== 'preparado'
    return ep !== 'en_delivery'
  }

  return true
}

async function marcarVerde(comensalId) {
  // Prompt para comentario del cliente. Si cancela, no avanza.
  // Si comenta vacio a proposito, se guarda string vacio (es valido).
  const comentario = window.prompt('Comentario del cliente al recibir el pedido (opcional):', '') ?? null
  if (comentario === null) return // usuario cancelo

  const { error } = await supabase
    .from('comensales')
    .update({
      estado_pedido: 'cerrado',
      cerrado_at: new Date().toISOString(),
      comentario_cliente: comentario.trim() || null
    })
    .eq('id', comensalId)

  if (error) {
    toast.error('Error al cerrar: ' + error.message)
    return
  }
  toast.success('Pedido cerrado y archivado')
  return true
}

async function marcarEntregadoMesa(comensalId) {
  const { error } = await supabase
    .from('comensales')
    .update({ estado_pedido: 'entregado', entregado_at: new Date().toISOString() })
    .eq('id', comensalId)
  if (error) {
    toast.error('Error al marcar entregado: ' + error.message)
    return false
  }
  toast.success('Pedido entregado. La caja continúa abierta hasta cobrar.')
  return true
}

async function marcarMorado(comensalId, metodo) {
  const { error } = await supabase
    .from('comensales')
    .update({
      estado_pedido: 'en_delivery',
      metodo_entrega: metodo
    })
    .eq('id', comensalId)

  if (error) {
    toast.error('Error al despachar: ' + error.message)
    return false
  }
  toast.success(metodo === 'delivery' ? 'Enviado a delivery' : 'Listo para retirar')
  return true
}

async function marcarEnCaminoMesa(comensalId) {
  const { error } = await supabase
    .from('comensales')
    .update({ estado_pedido: 'en_delivery' })
    .eq('id', comensalId)
  if (error) {
    toast.error('Error al actualizar el pedido: ' + error.message)
    return false
  }
  toast.success('Pedido en camino a la mesa')
  return true
}

async function marcarAzul(comensalId) {
  const { error } = await supabase
    .from('comensales')
    .update({
      estado_pedido: 'preparado',
      preparado_at: new Date().toISOString()
    })
    .eq('id', comensalId)

  if (error) {
    toast.error('Error al marcar preparado: ' + error.message)
    return false
  }
  toast.success('Marcado como preparado')
  return true
}

async function marcarAmarillo(comensalId, area, onDerivar) {
  // El amarillo lo dispara la eleccion de area desde el padre (botones
  // A Mozo / A Cocina). Aqui solo devolvemos info; el padre hace el UPDATE
  // con su propio handler. Se expone por completitud.
  if (onDerivar) await onDerivar(comensalId, area)
  return true
}

export default function ChecklistEstados({ comensal, onUpdate, onCerrar, showLabels = true }) {
  const { rol } = useAuth()
  const [busy, setBusy] = useState(null)
  const derivadoArea = comensal.derivado_area

  const handleClick = async (key) => {
    if (busy) return
    setBusy(key)
    try {
      let ok = false
      if (key === 'amarillo') {
        // Caso borde: si ya esta en en_preparacion, no-op.
        return
      } else if (key === 'azul') {
        ok = await marcarAzul(comensal.id)
      } else if (key === 'morado') {
        if (Number(comensal.mesa) > 0) {
          ok = await marcarEnCaminoMesa(comensal.id)
        } else {
        // Para despacho delivery/retiro pedimos elegir metodo.
        // Si ya hay metodo_entrega previo (caso re-entregado), respetamos.
        const previo = comensal.metodo_entrega
        let metodo = previo
        if (!metodo || (metodo !== 'delivery' && metodo !== 'retiro')) {
          const r = window.confirm('Aceptar = Delivery\nCancelar = Retiro en local')
          metodo = r ? 'delivery' : 'retiro'
        }
        ok = await marcarMorado(comensal.id, metodo)
        }
      } else if (key === 'verde') {
        // En mesa 0 y mesas físicas este check solo confirma la entrega.
        // Nunca marca pagado ni cierra caja.
        ok = await marcarEntregadoMesa(comensal.id)
      }
      if (ok && onUpdate) onUpdate()
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {CHECKS.filter(c => {
        if (Number(comensal.mesa) > 0 && c.key === 'morado') return false
        if (Number(comensal.mesa) <= 0 && comensal.metodo_entrega === 'retiro' && c.key === 'morado') return false
        return true
      }).map(c => {
        const done = checkDone(comensal, c.key)
        const disabled = checkDisabled(comensal, c.key, rol, derivadoArea)
        const isBusy = busy === c.key
        const label = c.key === 'azul' && Number(comensal.mesa) <= 0 && derivadoArea === 'mozo' ? 'Mozo' : c.label

        // Cuadrados chicos (no círculos). Los colores de cada estado no
        // se tocan: siguen siendo los mismos de siempre.
        const style = {
          width: 20,
          height: 20,
          borderRadius: 5,
          border: `2px solid ${done ? c.color : (disabled ? '#374151' : c.color)}`,
          background: done ? c.color : 'transparent',
          color: done ? '#fff' : (disabled ? '#6b7280' : c.color),
          display: 'grid',
          placeItems: 'center',
          cursor: disabled || done ? (done && !disabled ? 'default' : 'not-allowed') : 'pointer',
          fontSize: 12,
          fontWeight: 900,
          lineHeight: 1,
          opacity: disabled && !done ? 0.55 : 1,
          transition: 'all .15s ease',
          flexShrink: 0
        }

        return (
          <div key={c.key} className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={disabled || done}
              onClick={() => handleClick(c.key)}
              title={label}
              style={style}
            >
              {isBusy ? '…' : (done ? '✓' : '')}
            </button>
            {showLabels && (
              <span className="text-[10px] text-dark-400 whitespace-nowrap">{label}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

// Helpers exportados para que MesasAdmin / CocinaPanel reutilicen
// la logica de actualizacion a Supabase sin duplicar codigo.
export { marcarAmarillo, marcarAzul, marcarMorado, marcarVerde, CHECKS }
