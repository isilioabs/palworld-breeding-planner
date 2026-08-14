import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Info, Sparkles } from 'lucide-react'
import { PalaxisMark } from '@/components/palaxis-mark'
import { PassiveBadge } from '@/components/passive-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { modeLabel } from '@/domain/breeding/cost'
import { buildDirectPreviewNode, getResolver, pickDirectPreviewPair, type DirectPreviewResult } from '@/domain/breeding'
import { loadDatabase } from '@/domain/database'
import type { PlanResult, PlannerMode } from '@/domain/types'
import { PokedexProvider } from '@/features/pokedex/pokedex-panel'
import { Sidebar } from '@/features/layout/sidebar'
import { AppHeader } from '@/features/layout/app-header'
import { usePlanner } from '@/hooks/use-planner'
import { useT } from '@/i18n/language-store'
import { useMobileLayout } from '@/lib/use-mobile-layout'
import { cn } from '@/lib/utils'
import { usePlannerStore } from '@/state/planner-store'
import { BreedingTree } from './breeding-tree'
import { DirectRecipes } from './direct-recipes'
import { PlanSummary } from './plan-summary'
import { ProjectSummary } from './project-summary'
import { RouteComparison } from './route-comparison'
import { RouteImprovementToast } from './route-improvement-toast'
import { diffStats, type StatDelta } from './plan-utils'

function SwitchModeButton({ mode }: { mode: PlannerMode }) {
  const { dispatch } = usePlannerStore()
  const t = useT()
  return <Button size="sm" variant="outline" onClick={() => dispatch({ type: 'setMode', mode })}>{t('switchMode.button', { label: modeLabel(mode) })}</Button>
}

function focusTargetPicker() {
  const trigger = document.getElementById('target-pal-trigger')
  if (trigger) {
    trigger.scrollIntoView({ behavior: 'smooth', block: 'center' })
    trigger.click()
    return
  }
  document.querySelector<HTMLElement>('[data-rail-key="target"]')?.click()
}

function EmptyState() {
  const t = useT()
  return (
    <div className="empty-state mx-auto flex w-full max-w-[110rem] flex-col items-center justify-center gap-6 px-4 py-16 text-center sm:py-24">
      <span className="empty-state__emblem relative flex size-24 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/20">
        <span className="empty-state__ring absolute inset-0 rounded-full bg-primary/10" aria-hidden="true" />
        <PalaxisMark className="relative size-12 text-primary" />
      </span>
      <div className="max-w-md space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">{t('emptyState.title')}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{t('emptyState.description')}</p>
      </div>
      <Button size="lg" className="gap-2" onClick={focusTargetPicker}><Sparkles className="size-4" aria-hidden="true" />{t('emptyState.cta')}</Button>
    </div>
  )
}

function LoadingState() {
  const t = useT()
  return (
    <Card className="loading-card loading-state" role="status" aria-live="polite">
      <CardContent className="flex flex-col items-center justify-center gap-3 p-8 text-center">
        <PalaxisMark className="loading-state__egg size-7 text-primary" />
        <p className="text-sm font-medium text-foreground">{t('loadingState.text')}</p>
        <span className="flex items-center gap-1.5" aria-hidden="true">
          <span className="loading-dot" style={{ animationDelay: '0ms' }} /><span className="loading-dot" style={{ animationDelay: '150ms' }} /><span className="loading-dot" style={{ animationDelay: '300ms' }} />
        </span>
      </CardContent>
    </Card>
  )
}

function OptimizingIndicator() {
  const t = useT()
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed bottom-[calc(4.35rem+env(safe-area-inset-bottom))] right-3 z-40 flex items-center gap-2 rounded-full border border-border/70 bg-card px-3.5 py-2 text-xs font-semibold text-muted-foreground shadow-lg sm:bottom-5 sm:right-5 sm:bg-card/95 sm:backdrop-blur-sm">
      <span className="flex items-center gap-1" aria-hidden="true"><span className="loading-dot" /><span className="loading-dot" style={{ animationDelay: '150ms' }} /><span className="loading-dot" style={{ animationDelay: '300ms' }} /></span>
      {t('plan.optimizing')}
    </div>
  )
}

function DirectPreviewUnavailableCard({ reason }: { reason: 'no-parents' | 'no-owned-pair' }) {
  const t = useT()
  return <Card className="border-dashed"><CardContent className="flex items-start gap-2 p-4 text-sm text-muted-foreground"><Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" /><p>{t(reason === 'no-owned-pair' ? 'directPreview.unavailableCollection' : 'directPreview.unavailableNoParents')}</p></CardContent></Card>
}

function PlanArea() {
  const { state } = usePlannerStore()
  const { result, routes, project, computing, recalculating } = usePlanner()
  const [activeRouteId, setActiveRouteId] = useState<PlannerMode | null>(null)
  const db = loadDatabase()
  const t = useT()
  const isMobile = useMobileLayout()
  const primaryTargetId = state.targetPalIds[0] ?? state.targetPalId

  useEffect(() => { setActiveRouteId(state.mode) }, [primaryTargetId, state.mode])

  const activeRoute = routes && activeRouteId ? routes[activeRouteId] : null
  const activeResult = activeRoute?.result ?? result
  const showDirectFirst = state.targetPalIds.length === 1 && state.desiredPassives.length === 0 && state.owned.length === 0
  const hasRealRoute = !!(activeResult?.ok && activeResult.root)
  const directPreview: DirectPreviewResult | null = useMemo(() => {
    if (!primaryTargetId || hasRealRoute) return null
    return pickDirectPreviewPair(primaryTargetId, state.mode, state.owned, getResolver(), db.palById)
  }, [primaryTargetId, hasRealRoute, state.mode, state.owned, db.palById])

  const [improvementDeltas, setImprovementDeltas] = useState<StatDelta[]>([])
  const prevStatsRef = useRef<{ signature: string; stats: NonNullable<PlanResult['stats']> | null }>({ signature: '', stats: null })
  useEffect(() => {
    if (!activeResult?.ok || !activeResult.stats) return
    const signature = `${primaryTargetId ?? ''}:${state.mode}`
    setImprovementDeltas(prevStatsRef.current.signature === signature ? diffStats(state.mode, prevStatsRef.current.stats, activeResult.stats) : [])
    prevStatsRef.current = { signature, stats: activeResult.stats }
  }, [activeResult, primaryTargetId, state.mode])

  if (!primaryTargetId) return <EmptyState />

  return (
    <div className="mx-auto w-full max-w-[110rem] space-y-2.5 min-[1920px]:max-w-[130rem] min-[2560px]:max-w-[160rem]">
      {showDirectFirst && !isMobile && <DirectRecipes targetPalId={primaryTargetId} />}
      <div className={cn('space-y-2.5 transition-opacity duration-150', recalculating && 'pointer-events-none opacity-60')}>
        {!hasRealRoute && directPreview && (
          <div className="space-y-1.5">
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground"><Sparkles className="size-3" aria-hidden="true" />{t('directPreview.title')}</p>
            {directPreview.kind === 'pair' ? <BreedingTree root={buildDirectPreviewNode(primaryTargetId, directPreview)} /> : <DirectPreviewUnavailableCard reason={directPreview.reason} />}
          </div>
        )}
        {!computing && project && !project.ok && <Card className="border-amber-500/40 bg-amber-500/5"><CardContent className="flex items-start gap-2 p-4 text-sm"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-400" aria-hidden="true" /><p>{project.reason}</p></CardContent></Card>}
        {!computing && !project && activeResult && !activeResult.ok && (
          <Card className="border-amber-500/40 bg-amber-500/5"><CardContent className="flex items-start gap-2 p-4 text-sm"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-400" aria-hidden="true" /><div className="space-y-2"><p>{activeResult.reason}</p>{activeResult.missingPassives?.length ? <ul className="flex flex-wrap gap-1.5">{activeResult.missingPassives.map((id) => <li key={id}><PassiveBadge passive={db.passiveById.get(id)} interactive /></li>)}</ul> : null}{activeResult.suggestMode && <SwitchModeButton mode={activeResult.suggestMode} />}</div></CardContent></Card>
        )}
        {!computing && project?.ok && project.roots && project.roots.length > 1 && <><ProjectSummary project={project} /><BreedingTree roots={project.roots} /></>}
        {!computing && !project && activeResult?.ok && activeResult.root && (isMobile
          ? <><RouteComparison routes={routes} activeRouteId={activeRoute?.id ?? null} onSelect={setActiveRouteId} /><BreedingTree root={activeResult.root} /><PlanSummary result={activeResult} /></>
          : <><RouteComparison routes={routes} activeRouteId={activeRoute?.id ?? null} onSelect={setActiveRouteId} /><PlanSummary result={activeResult} /><BreedingTree root={activeResult.root} /></>)}
        {computing && !directPreview && <LoadingState />}
      </div>
      {(computing || recalculating) && <OptimizingIndicator />}
      <RouteImprovementToast deltas={improvementDeltas} />
      {state.targetPalIds.length === 1 && (!showDirectFirst || isMobile) && <DirectRecipes targetPalId={primaryTargetId} />}
    </div>
  )
}

export function PlannerWorkspace({ onHome, route, onNavigate }: { onHome: () => void; route: string; onNavigate: (path: string) => void }) {
  const t = useT()
  return (
    <PokedexProvider>
      <div className="flex h-screen flex-col bg-background">
        <a href="#plan-main" className="skip-link">{t('layout.skipLink')}</a>
        <AppHeader onHome={onHome} route={route} onNavigate={onNavigate} />
        <div className="flex min-h-0 flex-1">
          <Sidebar />
          <main id="plan-main" className="min-w-0 flex-1 overflow-y-auto scroll-smooth pb-[calc(4rem+env(safe-area-inset-bottom))] sm:pb-0">
            <h1 className="sr-only">{t('nav.breedingPlanner')}</h1>
            <div className="px-3 py-3 sm:px-6 sm:py-5 lg:px-8"><PlanArea /></div>
            <footer className="mx-auto max-w-[110rem] px-3 pb-8 pt-2 text-[11px] leading-relaxed text-muted-foreground min-[1920px]:max-w-[130rem] min-[2560px]:max-w-[160rem] sm:px-6 lg:px-8">{t('layout.footer')}</footer>
          </main>
        </div>
      </div>
    </PokedexProvider>
  )
}
