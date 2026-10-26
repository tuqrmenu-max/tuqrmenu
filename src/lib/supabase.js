import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Cliente aislado (no comparte ni persiste sesión) para operaciones como
// crear una cuenta de staff (mozo/cajero/cocina) via supabase.auth.signUp():
// si usaramos el cliente `supabase` normal, signUp() reemplazaria la sesion
// del admin logueado por la del usuario recien creado. Con un cliente
// nuevo y persistSession:false, el signUp igual crea la cuenta en el
// backend pero no toca la sesion actual del admin en este navegador.
export function createIsolatedClient() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      // Storage key distinto al del cliente principal ("sb-<ref>-auth-token").
      // Sin esto, aunque persistSession sea false, el GoTrueClient interno
      // igual queda registrado bajo la MISMA storage key que `supabase`,
      // y ambos compiten por el mismo lock de refresh de token. Eso es lo
      // que dispara el warning "Multiple GoTrueClient instances detected
      // ... under the same storage key" y puede terminar invalidando el
      // refresh token de la sesion del admin logueado (error 400 en
      // /auth/v1/token), rompiendo guardados posteriores como el de
      // "Datos de contacto y delivery".
      storageKey: 'sb-isolated-client-auth-token'
    }
  })
}

// Helper para verificar si Supabase está configurado
export const isConfigured = () => {
  return supabaseUrl && supabaseAnonKey && 
         !supabaseUrl.includes('TU-PROYECTO') && 
         !supabaseAnonKey.includes('TU-ANON-KEY')
}
