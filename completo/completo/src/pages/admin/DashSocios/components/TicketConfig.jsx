import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

const defaultConfig = {
  header: '',
  showLogo: true,
  showName: true,
  showAddress: true,
  showPhone: true,
  showHorario: false,
  horarioTexto: '',
  showCuit: false,
  cuit: '',
  showMesa: true,
  showFecha: true,
  showHora: true,
  showTicketNumber: true,
  ticketNumberStart: 1,
  showDetalle: true,
  showSubtotal: true,
  showTotal: true,
  showFooter: true,
  footerText: '¡Gracias por su compra!',
  footerText2: '',
  showQr: false,
  columnas: '3-20',
  fontSize: 'normal',
  printMethod: 'sistema',
  printerIp: '',
  printerPort: '9100',
  printerName: '',
}

export default function TicketConfig({ clienteId }) {
  const [config, setConfig] = useState(defaultConfig)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (clienteId) fetchConfig()
  }, [clienteId])

  const fetchConfig = async () => {
    const { data, error } = await supabase
      .from('clientes')
      .select('ticket_config')
      .eq('id', clienteId)
      .single()

    if (error) {
      console.error('[TicketConfig] Error cargando config:', error)
      toast.error('No se pudo cargar la config del ticket: ' + error.message)
    }
    if (data?.ticket_config) {
      setConfig({ ...defaultConfig, ...data.ticket_config })
    }
    setLoading(false)
  }

  const handleSave = async () => {
    setSaving(true)
    const { error } = await supabase
      .from('clientes')
      .update({ ticket_config: config })
      .eq('id', clienteId)

    if (error) {
      toast.error('Error al guardar: ' + error.message)
    } else {
      toast.success('Configuración guardada')
    }
    setSaving(false)
  }

  const update = (field, value) => {
    setConfig(prev => ({ ...prev, [field]: value }))
  }

  const Toggle = ({ label, field, description }) => (
    <div className="flex items-center justify-between py-2">
      <div>
        <span className="text-white text-sm">{label}</span>
        {description && <p className="text-dark-400 text-xs">{description}</p>}
      </div>
      <button
        onClick={() => update(field, !config[field])}
        className={`w-12 h-6 rounded-full transition-colors relative ${config[field] ? 'bg-green-500' : 'bg-dark-600'}`}
      >
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${config[field] ? 'left-6' : 'left-0.5'}`} />
      </button>
    </div>
  )

  const Preview = () => {
    const fontSize = config.fontSize === 'grande' ? 14 : config.fontSize === 'pequeño' ? 10 : 12
    const ahora = new Date()
    const fecha = ahora.toLocaleDateString('es-AR')
    const hora = ahora.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })

    return (
      <div className="bg-white rounded-xl p-4 max-w-[280px] mx-auto text-black font-mono" style={{ fontSize }}>
        <div className="text-center border-b border-dashed border-gray-300 pb-2 mb-2">
          {config.showLogo && <div className="text-2xl mb-1">🍽️</div>}
          {config.showName && <div className="font-bold text-base">Restaurante Ejemplo</div>}
          {config.showAddress && <div className="text-xs">Av. Principal 123</div>}
          {config.showPhone && <div className="text-xs">Tel: 1234-5678</div>}
          {config.showHorario && config.horarioTexto && <div className="text-xs">{config.horarioTexto}</div>}
          {config.showCuit && config.cuit && <div className="text-xs">CUIT: {config.cuit}</div>}
          {config.showMesa && <div className="font-bold mt-1">Mesa N° 1</div>}
          {config.showTicketNumber && <div className="text-xs font-bold">Ticket N° {String(config.ticketNumberStart || 1).padStart(4, '0')}</div>}
          {config.showFecha && <div className="text-xs">{fecha}</div>}
          {config.showHora && <div className="text-xs">{hora}</div>}
        </div>

        {config.showDetalle && (
          <div className="border-b border-dashed border-gray-300 pb-2 mb-2">
            <div className="flex justify-between text-xs font-bold">
              <span>Cant</span><span>Producto</span><span>$</span>
            </div>
            <div className="flex justify-between text-xs mt-1">
              <span>2x</span><span className="flex-1 mx-2">Milanesa napolitana</span><span>$8.500</span>
            </div>
            <div className="flex justify-between text-xs">
              <span>1x</span><span className="flex-1 mx-2">Coca cola 500ml</span><span>$1.200</span>
            </div>
          </div>
        )}

        {config.showSubtotal && (
          <div className="flex justify-between text-xs border-b border-dashed border-gray-300 pb-2 mb-2">
            <span>Subtotal</span><span>$9.700</span>
          </div>
        )}

        {config.showTotal && (
          <div className="flex justify-between font-bold text-sm">
            <span>TOTAL</span><span>$9.700</span>
          </div>
        )}

        {config.showFooter && (
          <div className="text-center mt-3 border-t border-dashed border-gray-300 pt-2">
            {config.footerText && <div className="text-xs font-bold">{config.footerText}</div>}
            {config.footerText2 && <div className="text-xs text-gray-500">{config.footerText2}</div>}
          </div>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Configuración */}
        <div className="space-y-4">
          <h3 className="text-white font-bold text-lg mb-4">Configuración del Ticket</h3>

          {/* Encabezado */}
          <div className="bg-dark-800 rounded-xl p-4 border border-dark-700 space-y-1">
            <h4 className="text-primary-400 font-semibold text-sm mb-2">📄 Encabezado</h4>
            <Toggle label="Mostrar logo" field="showLogo" />
            <Toggle label="Mostrar nombre" field="showName" />
            <Toggle label="Mostrar dirección" field="showAddress" />
            <Toggle label="Mostrar teléfono" field="showPhone" />
            <Toggle label="Mostrar horario de atención" field="showHorario" />
            {config.showHorario && (
              <div className="pt-1 pb-1">
                <input
                  type="text"
                  value={config.horarioTexto}
                  onChange={e => update('horarioTexto', e.target.value)}
                  placeholder="Lun a Dom 11:00 a 23:00"
                  className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm mt-1"
                />
              </div>
            )}
            <Toggle label="Mostrar CUIT" field="showCuit" />
            {config.showCuit && (
              <div className="pt-1">
                <label className="text-dark-400 text-xs">CUIT / DNI</label>
                <input
                  type="text"
                  value={config.cuit}
                  onChange={e => update('cuit', e.target.value)}
                  placeholder="20-12345678-9"
                  className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm mt-1"
                />
              </div>
            )}
          </div>

          {/* Información de venta */}
          <div className="bg-dark-800 rounded-xl p-4 border border-dark-700 space-y-1">
            <h4 className="text-primary-400 font-semibold text-sm mb-2">🛒 Información de venta</h4>
            <Toggle label="Mostrar mesa" field="showMesa" />
            <Toggle label="Número de ticket" field="showTicketNumber" description="Se incrementa automáticamente con cada venta" />
            {config.showTicketNumber && (
              <div className="pt-1 pb-1">
                <label className="text-dark-400 text-xs">Empezar a contar desde</label>
                <input
                  type="number"
                  min={1}
                  value={config.ticketNumberStart}
                  onChange={e => update('ticketNumberStart', parseInt(e.target.value) || 1)}
                  className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm mt-1"
                />
              </div>
            )}
            <Toggle label="Mostrar fecha" field="showFecha" />
            <Toggle label="Mostrar hora" field="showHora" />
            <Toggle label="Detalle de productos" field="showDetalle" description="Lista de items comprados" />
            <Toggle label="Mostrar subtotal" field="showSubtotal" />
            <Toggle label="Mostrar total" field="showTotal" />
          </div>

          {/* Pie de página */}
          <div className="bg-dark-800 rounded-xl p-4 border border-dark-700 space-y-1">
            <h4 className="text-primary-400 font-semibold text-sm mb-2">📎 Pie de página</h4>
            <Toggle label="Mostrar pie de página" field="showFooter" />
            {config.showFooter && (
              <div className="space-y-2 pt-1">
                <div>
                  <label className="text-dark-400 text-xs">Mensaje principal</label>
                  <input
                    type="text"
                    value={config.footerText}
                    onChange={e => update('footerText', e.target.value)}
                    className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm mt-1"
                  />
                </div>
                <div>
                  <label className="text-dark-400 text-xs">Mensaje secundario</label>
                  <input
                    type="text"
                    value={config.footerText2}
                    onChange={e => update('footerText2', e.target.value)}
                    placeholder="Redes sociales, etc."
                    className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm mt-1"
                  />
                </div>
              </div>
            )}
            <Toggle label="Mostrar QR" field="showQr" description="Código QR del restaurante" />
          </div>

          {/* Impresora */}
          <div className="bg-dark-800 rounded-xl p-4 border border-dark-700">
            <h4 className="text-primary-400 font-semibold text-sm mb-3">🖨️ Impresora</h4>
            <p className="text-dark-400 text-xs mb-3">Por dónde sale el ticket al confirmar una venta.</p>
            <div className="space-y-2">
              {[
                { id: 'sistema', label: 'Impresora del sistema', desc: 'Abre el diálogo de impresión del navegador/tablet (USB o la que tengas configurada como predeterminada en el dispositivo)' },
                { id: 'red', label: 'Impresora de red (IP)', desc: 'Impresora térmica ESC/POS conectada por WiFi/Ethernet' },
                { id: 'compartir', label: 'Compartir / WhatsApp', desc: 'Genera el ticket como imagen para enviarlo o guardarlo, sin imprimir' }
              ].map(opt => (
                <label key={opt.id} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${config.printMethod === opt.id ? 'border-primary-500 bg-primary-500/10' : 'border-dark-600 hover:border-dark-500'}`}>
                  <input
                    type="radio"
                    name="printMethod"
                    checked={config.printMethod === opt.id}
                    onChange={() => update('printMethod', opt.id)}
                    className="mt-1 accent-primary-500"
                  />
                  <div>
                    <div className="text-white text-sm font-medium">{opt.label}</div>
                    <div className="text-dark-400 text-xs">{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>
            {config.printMethod === 'red' && (
              <div className="grid grid-cols-2 gap-2 mt-3">
                <div>
                  <label className="text-dark-400 text-xs">IP de la impresora</label>
                  <input
                    type="text"
                    value={config.printerIp}
                    onChange={e => update('printerIp', e.target.value)}
                    placeholder="192.168.1.50"
                    className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm mt-1"
                  />
                </div>
                <div>
                  <label className="text-dark-400 text-xs">Puerto</label>
                  <input
                    type="text"
                    value={config.printerPort}
                    onChange={e => update('printerPort', e.target.value)}
                    placeholder="9100"
                    className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm mt-1"
                  />
                </div>
                <p className="col-span-2 text-dark-500 text-[11px]">Puerto 9100 es el estándar en la mayoría de las impresoras térmicas de red.</p>
              </div>
            )}
          </div>

          {/* Formato */}
          <div className="bg-dark-800 rounded-xl p-4 border border-dark-700">
            <h4 className="text-primary-400 font-semibold text-sm mb-3">⚙️ Formato</h4>
            <div className="space-y-3">
              <div>
                <label className="text-dark-400 text-xs">Tamaño de letra</label>
                <div className="flex gap-2 mt-1">
                  {['pequeño', 'normal', 'grande'].map(size => (
                    <button
                      key={size}
                      onClick={() => update('fontSize', size)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                        config.fontSize === size
                          ? 'bg-primary-500 text-white'
                          : 'bg-dark-700 text-dark-300 hover:bg-dark-600'
                      }`}
                    >
                      {size.charAt(0).toUpperCase() + size.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-green-600 hover:bg-green-500 text-white py-3 rounded-xl font-bold transition disabled:opacity-50"
          >
            {saving ? 'Guardando...' : '💾 Guardar configuración'}
          </button>
        </div>

        {/* Vista previa */}
        <div>
          <h3 className="text-white font-bold text-lg mb-4">Vista Previa</h3>
          <div className="bg-dark-800 rounded-xl p-4 border border-dark-700">
            <Preview />
          </div>
        </div>
      </div>
    </div>
  )
}
