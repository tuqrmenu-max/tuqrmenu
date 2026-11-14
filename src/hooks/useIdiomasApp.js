import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useI18n } from '@/lib/i18n'
import { CODIGOS_IDIOMAS, normalizarIdiomas } from '@/lib/idiomas'

const TODOS = ['es', ...CODIGOS_IDIOMAS]

// Idiomas de la app que puede usar la persona logueada.
// Super admin y vendedores: todos. Dueño y equipo de un local: los que el super admin
// habilitó para ese socio (clientes.idiomas_app). Si algo falla, queda solo español.
export function useIdiomasApp() {
  const { profile, rol } = useAuth()
  const { lang, setLang } = useI18n()
  const [permitidos, setPermitidos] = useState(['es'])

  useEffect(() => {
    if (!rol) return
    if (rol === 'superadmin' || rol === 'vendedor') { setPermitidos(TODOS); return }
    const clienteId = profile?.cliente_id || (profile?.nombre_restaurante ? profile.id : null)
    if (!clienteId) { setPermitidos(['es']); return }
    let activo = true
    supabase.from('clientes').select('idiomas_app').eq('id', clienteId).maybeSingle()
      .then(({ data, error }) => {
        if (!activo) return
        setPermitidos(error ? ['es'] : normalizarIdiomas(data?.idiomas_app))
      })
    return () => { activo = false }
  }, [rol, profile?.id, profile?.cliente_id, profile?.nombre_restaurante])

  // Si el idioma activo ya no está habilitado para este socio, vuelve a español.
  useEffect(() => {
    if (rol && !permitidos.includes(lang)) setLang('es')
  }, [permitidos, lang, rol])

  return permitidos
}
