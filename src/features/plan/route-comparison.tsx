import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Award, ChevronRight, Egg, Gauge, Gem, Layers, Mountain, Target, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useT } from '@/i18n/language-store'
import { cn, formatNumber } from '@/lib/utils'
import { useMobileLayout } from '@/lib/use-mobile-layout'
import { MODE_ORDER } from '@/domain/breeding/cost'
import type { PlannerMode, RouteAlternatives } from '@/domain/types'
import { track } from '@/lib/analytics'

interface RouteComparisonProps {
  routes: RouteAlternatives | null
  activeRouteId: PlannerMode | null
  onSelect: (mode: PlannerMode) => void
}

const MODE_TONES = {
  collection: 'is-collection',
  breeding: 'is-breeding',
  hybrid: 'is-hybrid',
} as const

/**
 * Desktop keeps the full comparison board. Phones render only the selected
 * route summary; the three detailed cards are mounted inside a bottom sheet
 * after the player asks to compare them.
 */
export function RouteComparison({ routes, activeRouteId, onSelect }: RouteComparisonProps) {
  const [open, setOpen] = useState(false)
  const mobile = useMobileLayout()
  const t = useT()

  if (!routes) return null

  if (mobile) {
    const selectedMode = activeRouteId ?? MODE_ORDER.find((mode) => routes[mode].result.ok) ?? MODE_ORDER[0]
    const selected = routes[selectedMode]
    const stats = selected.result.ok ? selected.result.stats : null

    return (
      <section className="route-comparison-mobile" aria-label={t('routeComparison.title')}>
        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Trigger asChild>
            <button type="button" className={cn('route-comparison-mobile__trigger', MODE_TONES[selectedMode])}>
              <span className="route-comparison-mobile__icon"><Gauge aria-hidden="true" /></span>
              <span className="route-comparison-mobile__copy">
                <small>{t('routeComparison.mobileActive')}</small>
                <strong>{t(`routeComparison.mode.${selectedMode}`)}</strong>
              </span>
              {selected.recommended && (
                <Badge className="route-comparison-mobile__recommended"><Award aria-hidden="true" />{t('routeComparison.recommended')}</Badge>
              )}
              {selected.result.ok && <span className="route-comparison-mobile__score">{selected.efficiencyScore}<small>/100</small></span>}
              <ChevronRight className="route-comparison-mobile__chevron" aria-hidden="true" />
              {stats && (
                <span className="route-comparison-mobile__facts" aria-hidden="true">
                  <span><Egg />{formatNumber(stats.totalExpectedEggs)}</span>
                  <span><Target />{formatNumber(stats.capturesNeeded)}</span>
                </span>
              )}
            </button>
          </Dialog.Trigger>

          {open && (
            <Dialog.Portal>
              <Dialog.Overlay className="plan-sheet__overlay" />
              <Dialog.Content className="plan-sheet" aria-describedby="route-comparison-description">
                <header className="plan-sheet__header">
                  <div>
                    <Dialog.Title>{t('routeComparison.title')}</Dialog.Title>
                    <Dialog.Description id="route-comparison-description">{t('routeComparison.mobileDescription')}</Dialog.Description>
                  </div>
                  <Dialog.Close asChild>
                    <Button variant="ghost" size="icon-sm" aria-label={t('routeComparison.close')}><X aria-hidden="true" /></Button>
                  </Dialog.Close>
                </header>
                <div className="plan-sheet__body">
                  <RouteCards
                    routes={routes}
                    activeRouteId={activeRouteId}
                    compact
                    onSelect={(mode) => {
                      onSelect(mode)
                      setOpen(false)
                    }}
                  />
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          )}
        </Dialog.Root>
      </section>
    )
  }

  return (
    <section className="route-comparison" aria-labelledby="route-comparison-title">
      <header className="route-comparison__header">
        <div>
          <div className="route-comparison__eyebrow"><Gauge aria-hidden="true" /> {t('routeComparison.title')}</div>
          <h2 id="route-comparison-title">{t('routeComparison.title')}</h2>
          <p>{t('routeComparison.description')}</p>
        </div>
      </header>
      <RouteCards routes={routes} activeRouteId={activeRouteId} onSelect={onSelect} />
    </section>
  )
}

function RouteCards({ routes, activeRouteId, onSelect, compact = false }: RouteComparisonProps & { compact?: boolean }) {
  const t = useT()
  if (!routes) return null

  return (
    <div className="route-comparison__grid" role="radiogroup" aria-label={t('routeComparison.title')}>
      {MODE_ORDER.map((mode, index) => {
        const route = routes[mode]
        const name = t(`routeComparison.mode.${mode}`)
        const active = mode === activeRouteId
        const available = route.result.ok && route.result.stats

        if (!available) {
          return (
            <div
              key={mode}
              className={cn('route-comparison__card', MODE_TONES[mode], 'is-unavailable')}
              style={{ animationDelay: `${index * 55}ms` }}
            >
              <div className="route-comparison__card-topline">
                <span className="route-comparison__name">{name}</span>
                <Badge variant="muted">{t('routeComparison.unavailable')}</Badge>
              </div>
              <p className="route-comparison__unavailable-reason">{route.result.reason}</p>
            </div>
          )
        }

        const stats = route.result.stats!
        return (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={t('routeComparison.select', { name })}
            className={cn(
              'route-comparison__card',
              MODE_TONES[mode],
              active && 'is-active',
              route.recommended && 'is-recommended',
            )}
            style={{ animationDelay: `${index * 55}ms` }}
            onClick={() => { onSelect(mode); track('route_compared', { route: mode }) }}
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
              {!compact && <div><dt><Layers aria-hidden="true" />{t('routeComparison.generations')}</dt><dd>{stats.generations}</dd></div>}
              <div><dt><Target aria-hidden="true" />{t('routeComparison.captures')}</dt><dd>{stats.capturesNeeded}</dd></div>
              {!compact && <div><dt><Gem aria-hidden="true" />{t('routeComparison.legendary')}</dt><dd>{route.legendaryUsage}</dd></div>}
              {!compact && stats.capturesNeeded > 0 && (
                <div><dt><Mountain aria-hidden="true" />{t('routeComparison.hardestCapture')}</dt><dd>{formatNumber(stats.maxCaptureDifficulty ?? 0)}</dd></div>
              )}
            </dl>

            <div className="route-comparison__effort">
              <span>{t('routeComparison.effort')}</span>
              <strong>{formatNumber(route.expectedEffort)}</strong>
            </div>
          </button>
        )
      })}
    </div>
  )
}
