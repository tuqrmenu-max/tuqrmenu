import { useI18n } from '@/lib/i18n'

export default function Promociones() {
  const { t } = useI18n()
  
  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">{t('promociones')}</h1>
      <div className="bg-dark-800 rounded-2xl p-8 border border-dark-700 text-center">
        <p className="text-dark-400">Próximamente: Gestión de promociones</p>
      </div>
    </div>
  )
}
