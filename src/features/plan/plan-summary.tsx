import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { BarChart3, Egg, GitBranch, Layers, Percent, Target, Timer, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { formatNumber, formatPercent } from '@/lib/utils'
import { useT } from '@/i18n/language-store'
import { useMobileLayout } from '@/lib/use-mobile-layout'
import type { PlanResult } from '@/domain/types'
import { SharePlan } from '@/features/plan/share-plan'
import { loadDatabase, palName } from '@/domain/database'

const ITEMS = [
  { key: 'generations', icon: Layers, labelKey: 'planSummary.generations.label', helpKey: 'planSummary.generations.help', tone: 'text-violet-500 bg-violet-500/10 border-violet-500/20' },
  { key: 'steps', icon: GitBranch, labelKey: 'planSummary.steps.label', helpKey: 'planSummary.steps.help', tone: 'text-sky-500 bg-sky-500/10 border-sky-500/20' },
  { key: 'eggs', icon: Egg, labelKey: 'planSummary.eggs.label', helpKey: 'planSummary.eggs.help', tone: 'text-amber-500 bg-amber-500/10 border-amber-500/20' },
  { key: 'captures', icon: Target, labelKey: 'planSummary.captures.label', helpKey: 'planSummary.captures.help', tone: 'text-rose-500 bg-rose-500/10 border-rose-500/20' },
  { key: 'success', icon: Percent, labelKey: 'planSummary.success.label', helpKey: 'planSummary.success.help', tone: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' },
  { key: 'time', icon: Timer, labelKey: 'planSummary.time.label', helpKey: 'planSummary.time.help', tone: 'text-primary bg-primary/10 border-primary/20' },
] as const

const MOBILE_ITEMS = ITEMS.filter(({ key }) => key === 'eggs' || key === 'captures' || key === 'success')

export function PlanSummary({ result }: { result: PlanResult }) {
  const [open, setOpen] = useState(false)
  const mobile = useMobileLayout()
  const t = useT()
  if (!result.ok || !result.stats) return null
  const stats = result.stats
  const values: Record<(typeof ITEMS)[number]['key'], string> = {
    generations: String(stats.generations),
    steps: String(stats.steps),
    eggs: formatNumber(stats.totalExpectedEggs),
    captures: String(stats.capturesNeeded),
    success: formatPercent(stats.combinedChance, 2),
    time: `${stats.elapsedMs} ms`,
  }
  const title = palName(loadDatabase().palById.get(result.root?.palId ?? ''))
  const shareMetrics = ITEMS.slice(0, 4).map(({ key, labelKey }) => ({ label: t(labelKey), value: values[key] }))

  if (mobile) {
    return (
      <section className="plan-mobile-actions" aria-label={t('planSummary.ariaLabel')}>
        <SharePlan title={title} metrics={shareMetrics} />
        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Trigger asChild>
            <Button variant="outline" size="sm"><BarChart3 aria-hidden="true" />{t('planSummary.mobileDetails')}</Button>
          </Dialog.Trigger>
          {open && (
            <Dialog.Portal>
              <Dialog.Overlay className="plan-sheet__overlay" />
              <Dialog.Content className="plan-sheet plan-sheet--compact" aria-describedby="plan-summary-description">
                <header className="plan-sheet__header">
                  <div>
                    <Dialog.Title>{t('planSummary.mobileTitle')}</Dialog.Title>
                    <Dialog.Description id="plan-summary-description">{t('planSummary.mobileDescription')}</Dialog.Description>
                  </div>
                  <Dialog.Close asChild>
                    <Button variant="ghost" size="icon-sm" aria-label={t('planSummary.mobileClose')}><X aria-hidden="true" /></Button>
                  </Dialog.Close>
                </header>
                <div className="plan-sheet__body">
                  <dl className="plan-mobile-metrics">
                    {MOBILE_ITEMS.map(({ key, icon: Icon, labelKey, helpKey, tone }) => (
                      <div key={key}>
                        <span className={`plan-mobile-metrics__icon border ${tone}`}><Icon aria-hidden="true" /></span>
                        <dt>{t(labelKey)}</dt>
                        <dd>{values[key]}</dd>
                        <small>{t(helpKey)}</small>
                      </div>
                    ))}
                  </dl>
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          )}
        </Dialog.Root>
      </section>
    )
  }

  return (
    <section aria-label={t('planSummary.ariaLabel')} className="space-y-2">
      <div className="flex justify-end"><SharePlan title={title} metrics={shareMetrics} /></div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">{ITEMS.map(({ key, icon: Icon, labelKey, tone, helpKey }, index) => (
        <Card
          key={key}
          className="metric-card group overflow-hidden border-border/80 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
          style={{ animationDelay: `${index * 45}ms` }}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{t(labelKey)}</p>
              <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg border ${tone}`}>
                <Icon className="size-4" aria-hidden="true" />
              </span>
            </div>
            <p className="mt-4 text-2xl font-bold tracking-tight tabular-nums">{values[key]}</p>
            <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-muted-foreground opacity-80 transition-opacity group-hover:opacity-100">
              {t(helpKey)}
            </p>
          </CardContent>
        </Card>
      ))}</div>
    </section>
  )
}
