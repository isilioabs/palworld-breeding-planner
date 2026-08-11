import { useEffect, useState } from 'react'
import { TrendingDown } from 'lucide-react'
import { useT } from '@/i18n/language-store'
import type { TranslationKey } from '@/i18n/translations'
import type { StatDelta } from './plan-utils'

const AUTO_DISMISS_MS = 4200

/**
 * Aviso temporal de "ruta mejorada". `deltas` ya viene filtrado por
 * `diffStats` -solo llega aqui cuando la ruta nueva es mejor que la anterior
 * bajo el modo activo, nunca en un empate. Se autodescarta solo; no bloquea
 * nada (pointer-events-none) y nunca se solapa con el indicador de
 * "Optimizando ruta..." porque vive en la esquina opuesta.
 */
export function RouteImprovementToast({ deltas }: { deltas: StatDelta[] }) {
  const t = useT()
  const [visible, setVisible] = useState(false)
  const key = deltas.map((d) => `${d.key}:${d.delta}`).join('|')

  useEffect(() => {
    if (!key) {
      setVisible(false)
      return
    }
    setVisible(true)
    const timer = window.setTimeout(() => setVisible(false), AUTO_DISMISS_MS)
    return () => window.clearTimeout(timer)
  }, [key])

  if (!visible || deltas.length === 0) return null

  return (
    <div
      role="status"
      className="pointer-events-none fixed bottom-[calc(4.35rem+env(safe-area-inset-bottom))] left-3 z-40 flex max-w-[calc(100vw-1.5rem)] items-start gap-2.5 rounded-xl border border-emerald-500/30 bg-card px-3.5 py-3 text-xs shadow-lg sm:bottom-5 sm:left-5 sm:max-w-xs sm:bg-card/95 sm:backdrop-blur-sm"
    >
      <TrendingDown className="mt-0.5 size-4 shrink-0 text-emerald-400" aria-hidden="true" />
      <div className="space-y-0.5">
        <strong className="block text-foreground">{t('plan.routeImproved')}</strong>
        <p className="text-muted-foreground">
          {deltas
            .map((d) => t(`plan.delta.${d.key}` as TranslationKey, { value: d.delta > 0 ? `+${d.delta}` : String(d.delta) }))
            .join(' · ')}
        </p>
      </div>
    </div>
  )
}
