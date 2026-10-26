// Mesa 00 = clientes que NO se quedan en el local (mostrador / para llevar) pero cuyo pedido
// hay que facturar. No es una mesa física: nunca aparece como cuadradito en Mesas.
//
// En la base se guarda como mesa = -1 (comensales.mesa, tickets_caja.mesa son integer y "00" no se
// distingue de "0"). Todo lo que se muestra al usuario usa etiquetaMesa(), que devuelve "00".
// Mesa 0 (delivery / retiro por WhatsApp) y las mesas 1+ no cambian en nada.
export const MESA_00 = -1

export const esMesa00 = n => Number(n) === MESA_00

// -1 → "00"; cualquier otra mesa se muestra tal cual.
export const etiquetaMesa = n => (esMesa00(n) ? '00' : String(n ?? ''))

// Valor escrito en el filtro de Mesa de Caja: "00" → -1, el resto se comporta como siempre.
export const mesaDesdeTexto = v => (String(v ?? '').trim() === '00' ? MESA_00 : Number(v))

// generar_codigo_pedido(p_mesa = 0) devuelve DDMMYYYY-NN-M0; para Mesa 00 el sufijo es -M00.
export const codigoMesa00 = codigo => String(codigo || '').replace(/-M0$/, '-M00')
