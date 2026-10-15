import { supabase } from './supabase'
import toast from 'react-hot-toast'

function esperar(ms){return new Promise(r=>setTimeout(r,ms))}

// PGRST303 ("JWT issued at future") es un desfasaje de reloj momentáneo entre
// el servicio de Auth y PostgREST del lado de Supabase, no un error real de
// sesión: reintenta unas pocas veces con espera antes de darlo por fallido,
// porque para el segundo o tercer intento el desfasaje ya suele desaparecer.
export async function registrarEntradaHorarioConReintento(intentos=3,esperaMs=4000){
  let ultimo
  for(let i=0;i<intentos;i++){
    const {error}=await supabase.rpc('registrar_entrada_horario')
    if(!error)return {error:null}
    ultimo=error
    if(error.code!=='PGRST303')return {error}
    if(i<intentos-1)await esperar(esperaMs)
  }
  return {error:ultimo}
}

// Horario ya no depende de un "sigo conectado" repetido: el verde/negro de
// la pantalla Horario se define solo por dos eventos reales (login y
// logout, ver registrar_salida_horario y el trigger de auth.sessions), no
// por un vencimiento de tiempo. Por eso esta función se llama una sola vez
// por sesión (no en un intervalo): es un respaldo idempotente del trigger
// de servidor, por si esa sesión puntual no llegó a registrarse (ej. se
// creó antes de correr la migración, o hubo un corte de red justo al
// loguearse). Repetirla más de una vez no aporta nada porque la fila ya
// quedó escrita con UNIQUE(cliente_id, sesion_id).
let yaRegistrado=false,pendiente=false,ultimoError=''
async function registrarUnaVez(){
  if(yaRegistrado||pendiente)return
  pendiente=true
  try{
    const {data:{session}}=await supabase.auth.getSession()
    if(!session)return
    const {error}=await registrarEntradaHorarioConReintento()
    if(error)throw error
    yaRegistrado=true
    ultimoError=''
  }catch(e){
    const mensaje=e.message||'Sin conexión'
    if(mensaje!==ultimoError){
      ultimoError=mensaje
      toast.error('No se pudo registrar la conexión en Horario: '+mensaje,{duration:10000})
    }
  }finally{pendiente=false}
}
const {data:{subscription}}=supabase.auth.onAuthStateChange((event)=>{
  // INITIAL_SESSION cubre recargar la página con una sesión ya abierta
  // (useAuth.login ya registra el login fresco por su cuenta, así que no
  // hace falta escuchar SIGNED_IN acá y duplicar el llamado).
  if(event==='INITIAL_SESSION')setTimeout(registrarUnaVez,0)
  if(event==='SIGNED_OUT')yaRegistrado=false
})
// Único caso de red que vale la pena reintentar sin ser un intervalo: si el
// primer intento falló por falta de conexión, reintentar apenas vuelve el
// internet (evento puntual, no polling).
function alReconectar(){if(!yaRegistrado)registrarUnaVez()}
window.addEventListener('online',alReconectar)
registrarUnaVez()
if(import.meta.hot)import.meta.hot.dispose(()=>{
  subscription.unsubscribe()
  window.removeEventListener('online',alReconectar)
})
