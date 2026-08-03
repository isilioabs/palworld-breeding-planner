import { Backpack, Clock3, Swords } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { modeHint } from '@/domain/breeding/cost'
import { useT } from '@/i18n/language-store'
import { cn } from '@/lib/utils'
import { usePlannerStore } from '@/state/planner-store'

/**
 * Dos rutas con propositos claros. Ambas siguen usando los pesos existentes
 * del planificador: Facil limita las capturas a Pals accesibles y Rapida
 * permite Pals complejos para reducir generaciones. La opcion de inventario
 * puro continua disponible cuando el jugador ya tiene una coleccion.
 */
export function ModePanel({ embedded = false }: { embedded?: boolean }) {
  const { state, dispatch } = usePlannerStore()
  const t = useT()
  const routes = [
    { mode: 'breeding' as const, icon: Backpack, title: t('modePanel.easyRoute'), description: t('modePanel.easyRouteDescription') },
    { mode: 'hybrid' as const, icon: Clock3, title: t('modePanel.fastRoute'), description: t('modePanel.fastRouteDescription') },
  ]

  return (
    <Card className={cn('route-panel', embedded && 'border-0 bg-transparent shadow-none')}>
      {!embedded && <CardHeader><CardTitle>{t('modePanel.title')}</CardTitle></CardHeader>}
      <CardContent className={cn('space-y-3', embedded && 'p-0')}>
        <p className="route-panel__intro">{t('modePanel.routeIntro')}</p>
        <div className="route-panel__choices" role="radiogroup" aria-label={t('modePanel.title')}>
          {routes.map(({ mode, icon: Icon, title, description }) => (
            <button key={mode} type="button" role="radio" aria-checked={state.mode === mode} className={cn('route-panel__choice', state.mode === mode && 'is-selected')} onClick={() => dispatch({ type: 'setMode', mode })}>
              <Icon aria-hidden="true" />
              <span><strong>{title}</strong><small>{description}</small></span>
              <i aria-hidden="true" />
            </button>
          ))}
        </div>
        {state.owned.length > 0 && <Button variant={state.mode === 'collection' ? 'secondary' : 'ghost'} size="sm" className="w-full gap-1.5" onClick={() => dispatch({ type: 'setMode', mode: 'collection' })}><Swords className="size-3.5" aria-hidden="true" />{t('modePanel.collectionOnly')}</Button>}
        <p className="route-panel__hint">{modeHint(state.mode)}</p>
      </CardContent>
    </Card>
  )
}
