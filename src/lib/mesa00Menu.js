// Link de Mesa 00 (/menu/<token>?mesa=00).
//
// Es el MISMO menú que Mesa 0 (nombre, teléfono, delivery / retiro, promos...), con dos diferencias:
//   1) el pedido NO se manda por WhatsApp: solo se guarda y llega a Mesas (sección "Mesa 00");
//   2) se identifica como Mesa 00 (comensales.mesa = -1, código DDMMYYYY-NN-M00) para poder
//      cobrarlo y verlo en Caja por separado de Mesa 0.
//
// El HTML del menú se genera y guarda en Storage una sola vez y trae la lógica de Mesa 0 grabada
// (mesaNumero === 0). Para no tocar esa plantilla ni obligar a re-exportar cada menú, MenuView le
// inyecta estos dos scripts SOLO cuando el link es ?mesa=00:
//   · PRE  (antes del script del menú): intercepta fetch / localStorage / window.open, que son lo
//     único que el menú usa para hablar con Supabase y con WhatsApp. Así funciona igual con menús
//     exportados antes o después de este cambio.
//   · POST (después del script del menú): confirma el envío con un aviso y, si falla, devuelve el
//     carrito (en Mesa 0 el WhatsApp era el respaldo; acá no existe).

export const PRE_SCRIPT_MESA00 = `<script>(function(){
var M=window.__mesa00={intento:false,ok:false};
try{
  var P=Storage.prototype,g=P.getItem,s=P.setItem,r=P.removeItem;
  var k=function(x){return x==='mesa_0_sesion'?'mesa_00_sesion':x};
  P.getItem=function(x){return g.call(this,k(x))};
  P.setItem=function(x,v){return s.call(this,k(x),v)};
  P.removeItem=function(x){return r.call(this,k(x))};
}catch(e){}
var f=window.fetch;
if(typeof f==='function'){
  window.fetch=function(input,init){
    var url='',method='GET',esPedidos=false;
    try{
      url=typeof input==='string'?input:((input&&input.url)||'');
      method=String((init&&init.method)||(input&&input.method)||'GET').toUpperCase();
      if(url.indexOf('/rest/v1/')>-1){
        if(method==='POST'&&/\\/rest\\/v1\\/comensales(\\?|$)/.test(url)&&init&&typeof init.body==='string'){
          var row=JSON.parse(init.body);
          if(row&&!Array.isArray(row)&&row.mesa===0){
            row.mesa=-1;
            if(row.codigo_pedido)row.codigo_pedido=String(row.codigo_pedido).replace(/-M0$/,'-M00');
            init=Object.assign({},init,{body:JSON.stringify(row)});
            M.intento=true;M.ok=false;
          }
        }else if(method==='POST'&&/\\/rpc\\/qr_pedido_estado_v2$/.test(url)&&init&&typeof init.body==='string'){
          var p=JSON.parse(init.body);
          if(p&&p.p_mesa===0){p.p_mesa=-1;init=Object.assign({},init,{body:JSON.stringify(p)})}
        }else if(typeof input==='string'&&/\\/rest\\/v1\\/comensales\\?/.test(url)&&/[?&]mesa=eq\\.0(&|$)/.test(url)){
          input=url.replace(/([?&])mesa=eq\\.0(&|$)/,'$1mesa=eq.-1$2');
        }
        esPedidos=method==='POST'&&/\\/rest\\/v1\\/pedidos_qr(\\?|$)/.test(url);
      }
    }catch(e){}
    var res=f.call(window,input,init);
    if(esPedidos&&M.intento){res.then(function(r){if(r&&r.ok)M.ok=true},function(){})}
    return res;
  };
}
var o=window.open;
var stub={closed:false,close:function(){},focus:function(){},location:{href:''}};
window.open=function(u){
  if(!u||/wa\\.me\\/[^?]*\\?text=Pedido/i.test(String(u)))return stub;
  return o.apply(window,arguments);
};
})();</script>`

export const POST_SCRIPT_MESA00 = `<script>(function(){
var M=window.__mesa00;if(!M)return;
var btn=document.getElementById('send');
if(!btn||typeof btn.onclick!=='function')return;
var orig=btn.onclick;
btn.onclick=async function(ev){
  var snap=null;
  try{snap=JSON.stringify({cart:state.cart,draftQty:state.draftQty,activePromo:state.activePromo,promoProducts:state.promoProducts,pickupEnabled:state.pickupEnabled,deliveryEnabled:state.deliveryEnabled})}catch(e){}
  M.intento=false;M.ok=false;
  var r=await orig.call(this,ev);
  if(M.intento){
    if(M.ok){showToast('¡Pedido enviado! Esperá un momento')}
    else{
      try{if(snap){var s=JSON.parse(snap);state.cart=s.cart||{};state.draftQty=s.draftQty||{};state.activePromo=s.activePromo||null;state.promoProducts=s.promoProducts||{};state.pickupEnabled=!!s.pickupEnabled;state.deliveryEnabled=!!s.deliveryEnabled}}catch(e){}
      try{renderCart();renderProducts();renderCartBadge()}catch(e){}
      showToast('No se pudo enviar el pedido. Intentá de nuevo');
    }
  }
  return r;
};
})();</script>`

// Inserta el modo Mesa 00 en el HTML del menú. Si el HTML no tiene <head> o </body> (no debería
// pasar) se agrega al principio / al final, que también funciona en un documento HTML.
export function aplicarModoMesa00(html) {
  let out = String(html)
  const head = out.match(/<head[^>]*>/i)
  out = head
    ? out.slice(0, head.index + head[0].length) + PRE_SCRIPT_MESA00 + out.slice(head.index + head[0].length)
    : PRE_SCRIPT_MESA00 + out
  const fin = out.toLowerCase().lastIndexOf('</body>')
  return fin >= 0 ? out.slice(0, fin) + POST_SCRIPT_MESA00 + out.slice(fin) : out + POST_SCRIPT_MESA00
}
