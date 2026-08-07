import { Backpack, Clock3, Swords } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { modeHint } from '@/domain/breeding/cost'
import { useT } from '@/i18n/language-store'
import { cn } from '@/lib/utils'
import { usePlannerStore } from '@/state/planner-store'

/**
 * Las 3 identidades de modo SIEMPRE visibles, en su orden fijo -Only My
 * Collection / Easiest / Fastest-, nunca ocultas ni reordenadas: antes
 * "Solo coleccion" desaparecia con la caja vacia; ahora se ve pero
 * deshabilitada, con una pista de por que.
 */
export function ModePanel({ embedded = false }: { embedded?: boolean }) {
  const { state, dispatch } = usePlannerStore()
  const t = useT()
  const routes = [
    { mode: 'collection' as const, icon: Swords, title: t('modePanel.collectionOnly'), description: t('modePanel.collectionOnlyDescription') },
    { mode: 'breeding' as const, icon: Backpack, title: t('modePanel.easyRoute'), description: t('modePanel.easyRouteDescription') },
    { mode: 'hybrid' as const, icon: Clock3, title: t('modePanel.fastRoute'), description: t('modePanel.fastRouteDescription') },
  ]

  return (
    <Card className={cn('route-panel', embedded && 'border-0 bg-transparent shadow-none')}>
      {!embedded && <CardHeader><CardTitle>{t('modePanel.title')}</CardTitle></CardHeader>}
      <CardContent className={cn('space-y-3', embedded && 'p-0')}>
        <p className="route-panel__intro">{t('modePanel.routeIntro')}</p>
        <div className="route-panel__choices" role="radiogroup" aria-label={t('modePanel.title')}>
          {routes.map(({ mode, icon: Icon, title, description }) => {
            const disabled = mode === 'collection' && state.owned.length === 0
            return (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={state.mode === mode}
                aria-disabled={disabled}
                className={cn('route-panel__choice', state.mode === mode && 'is-selected', disabled && 'is-unavailable')}
                onClick={() => !disabled && dispatch({ type: 'setMode', mode })}
              >
                <Icon aria-hidden="true" />
                <span><strong>{title}</strong><small>{disabled ? t('modePanel.collectionOnlyEmptyHint') : description}</small></span>
                <i aria-hidden="true" />
              </button>
            )
          })}
        </div>
        <p className="route-panel__hint">{modeHint(state.mode)}</p>
      </CardContent>
    </Card>
  )
}
