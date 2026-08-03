import { Award, Egg, Gauge, Gem, Layers, Target } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useT } from '@/i18n/language-store'
import { cn, formatNumber } from '@/lib/utils'
import type { RouteAlternative } from '@/domain/types'
import { track } from '@/lib/analytics'

interface RouteComparisonProps {
  routes: RouteAlternative[]
  activeRouteId: string | null
  onSelect: (routeId: string) => void
}

const MODE_TONES = {
  collection: 'is-collection',
  breeding: 'is-breeding',
  hybrid: 'is-hybrid',
} as const

export function RouteComparison({ routes, activeRouteId, onSelect }: RouteComparisonProps) {
  const t = useT()

  if (routes.length < 2) return null

  return (
    <section className="route-comparison" aria-labelledby="route-comparison-title">
      <header className="route-comparison__header">
        <div>
          <div className="route-comparison__eyebrow"><Gauge aria-hidden="true" /> {t('routeComparison.title')}</div>
          <h2 id="route-comparison-title">{t('routeComparison.title')}</h2>
          <p>{t('routeComparison.description')}</p>
        </div>
      </header>

      <div className="route-comparison__grid" role="radiogroup" aria-label={t('routeComparison.title')}>
        {routes.map((route, index) => {
          const stats = route.result.stats!
          const name = t(`routeComparison.mode.${route.mode}`)
          const active = route.id === activeRouteId
          return (
            <button
              key={route.id}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={t('routeComparison.select', { name })}
              className={cn(
                'route-comparison__card',
                MODE_TONES[route.mode],
                active && 'is-active',
                route.recommended && 'is-recommended',
              )}
              style={{ animationDelay: `${index * 55}ms` }}
              onClick={() => { onSelect(route.id); track('route_compared', { route: route.mode }) }}
            >
              <div className="route-comparison__card-topline">
                <span className="route-comparison__name">{name}</span>
                {route.recommended && (
                  <Badge className="route-comparison__recommended"><Award aria-hidden="true" />{t('routeComparison.recommended')}</Badge>
                )}
                {active && <span className="route-comparison__active">{t('routeComparison.selected')}</span>}
              </div>

              <div className="route-comparison__score">
                <span>{t('routeComparison.score')}</span>
                <strong>{route.efficiencyScore}</strong>
                <small>/100</small>
              </div>

              <dl className="route-comparison__metrics">
                <div><dt><Egg aria-hidden="true" />{t('routeComparison.eggs')}</dt><dd>{formatNumber(stats.totalExpectedEggs)}</dd></div>
                <div><dt><Layers aria-hidden="true" />{t('routeComparison.generations')}</dt><dd>{stats.generations}</dd></div>
                <div><dt><Target aria-hidden="true" />{t('routeComparison.captures')}</dt><dd>{stats.capturesNeeded}</dd></div>
                <div><dt><Gem aria-hidden="true" />{t('routeComparison.legendary')}</dt><dd>{route.legendaryUsage}</dd></div>
              </dl>

              <div className="route-comparison__effort">
                <span>{t('routeComparison.effort')}</span>
                <strong>{formatNumber(route.expectedEffort)}</strong>
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}
