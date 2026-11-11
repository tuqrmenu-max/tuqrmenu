// Edge Function: alta/baja de cuentas de acceso desde el servidor.
// Reemplaza a auth.signUp() en el navegador, para poder cerrar el registro publico.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { procesar } from './core.js'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const out = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return out(405, { error: 'Metodo no permitido' })

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
  const { data: u } = jwt ? await admin.auth.getUser(jwt) : { data: null }
  let body: unknown = null
  try { body = await req.json() } catch (_) { return out(400, { error: 'JSON invalido' }) }

  const r = await procesar(body, u?.user?.id ?? null, admin)
  return out(r.status, r.body)
})
