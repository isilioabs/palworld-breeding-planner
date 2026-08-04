import { useEffect, useState } from 'react'
import { AlertTriangle, Database, Egg, Languages, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { PassiveBadge } from '@/components/passive-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { RichTooltip } from '@/components/rich-tooltip'
import { TooltipProvider } from '@/components/ui/tooltip'
import { modeLabel } from '@/domain/breeding/cost'
import type { PlannerMode } from '@/domain/types'
import { Sidebar } from '@/features/layout/sidebar'
import { PlanSummary } from '@/features/plan/plan-summary'
import { ProjectSummary } from '@/features/plan/project-summary'
import { RouteComparison } from '@/features/plan/route-comparison'
import { BreedingTree } from '@/features/plan/breeding-tree'
import { DirectRecipes } from '@/features/plan/direct-recipes'
import { PokedexProvider } from '@/features/pokedex/pokedex-panel'
import { LandingPage } from '@/features/launch/landing-page'
import { Onboarding } from '@/features/launch/onboarding'
import { ProductMenu } from '@/features/launch/product-menu'
import { TrackingConsent } from '@/features/launch/tracking-consent'
import { usePlanner } from '@/hooks/use-planner'
import { useLang, useT } from '@/i18n/language-store'
import { PlannerProvider, usePlannerStore } from '@/state/planner-store'
import { loadDatabase } from '@/domain/database'
import { listProjects, saveProject, type ProjectDraft } from '@/domain/projects'
import { track } from '@/lib/analytics'

const LAUNCHED_KEY = 'pbp:experience:launched'
const ONBOARDING_KEY = 'pbp:experience:onboarding-seen'
const DEMO_NAME = 'Perfect Anubis Worker'
const DEMO_DRAFT: ProjectDraft = {
  targetPalId: 'Anubis',
  targetPalIds: ['Anubis'],
  desiredPassives: ['CraftSpeed_up3', 'CraftSpeed_up2', 'PAL_CorporateSlave', 'CraftSpeed_up1'],
  owned: [],
  mode: 'hybrid',
}

function DocumentLanguageSync() {
  const [lang] = useLang()

  useEffect(() => {
    const spanish = lang === 'es'
    document.documentElement.lang = lang
    document.title = spanish
      ? 'Palaxis — Planificador de breeding para Palworld'
      : 'Palaxis — Palworld Breeding Nexus'

    const description = spanish
      ? 'Palaxis es el companion offline para planificar Pals perfectos, comparar rutas de breeding y gestionar tu colección de Palworld.'
      : 'Palaxis is the offline companion for planning perfect Pals, comparing breeding routes, and managing your Palworld collection.'

    document.querySelector<HTMLMetaElement>('meta[name="description"]')?.setAttribute('content', description)
    document.querySelector<HTMLMetaElement>('meta[property="og:description"]')?.setAttribute('content', description)
    document.querySelector<HTMLMetaElement>('meta[name="twitter:description"]')?.setAttribute('content', description)
  }, [lang])

  return null
}

function LanguageToggle() {
  const [lang, setLang] = useLang()
  const t = useT()
  const next = lang === 'es' ? 'en' : 'es'
  return (
    <RichTooltip title={t(lang === 'es' ? 'header.langToggle' : 'header.langToggleToEs')} description="ES / EN">
      <Button variant="ghost" size="icon-sm" aria-label={t(lang === 'es' ? 'header.langToggle' : 'header.langToggleToEs')} onClick={() => setLang(next)}>
        <Languages className="size-4" aria-hidden="true" />
      </Button>
    </RichTooltip>
  )
}

function Header({ onHome }: { onHome: () => void }) {
  const { mechanics } = loadDatabase()
  const t = useT()
  const [lang] = useLang()
  const locale = lang === 'en' ? 'en-US' : 'es-ES'
  return (
    <header className="relative z-30 flex min-h-16 shrink-0 items-center gap-x-3 gap-y-1 border-b border-border/90 bg-card/80 px-3 shadow-[0_8px_30px_rgba(0,0,0,0.18)] backdrop-blur-xl sm:px-5">
      <button
        type="button"
        className="app-brand flex min-w-0 items-center gap-2.5 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={t('header.home')}
        onClick={onHome}
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-primary/35 bg-primary/10 shadow-[0_0_24px_color-mix(in_oklch,var(--primary)_26%,transparent)]">
          <Egg className="size-5 text-primary" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h1 className="truncate font-[Anton] text-xl uppercase leading-none tracking-wide sm:text-2xl">{t('header.title')}</h1>
          <p className="mt-1 hidden text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground sm:block">
            {t('header.subtitle')}
          </p>
        </div>
      </button>
      <RichTooltip
        asChild={false}
        title={t('header.datasetTitle', { version: mechanics.sourceVersion })}
        description={t('header.datasetDescription', { count: mechanics.counts.verifiedPairs.toLocaleString(locale) })}
        detail={t('header.datasetDetail')}
      >
        <Badge variant="muted" className="hidden gap-1 sm:inline-flex">
          <Database className="size-3" aria-hidden="true" />
          {t('header.badge', { pals: mechanics.counts.pals, combos: mechanics.counts.uniqueCombos + mechanics.counts.genderCombos })}
        </Badge>
      </RichTooltip>
      <span className="ml-auto hidden text-[11px] text-muted-foreground xl:inline">
        {t('header.footerLine', { version: mechanics.sourceVersion, count: mechanics.counts.verifiedPairs.toLocaleString(locale) })}
      </span>
      <ProductMenu />
      <LanguageToggle />
    </header>
  )
}

function SwitchModeButton({ mode }: { mode: PlannerMode }) {
  const { dispatch } = usePlannerStore()
  const t = useT()
  return (
    <Button size="sm" variant="outline" onClick={() => dispatch({ type: 'setMode', mode })}>
      {t('switchMode.button', { label: modeLabel(mode) })}
    </Button>
  )
}

/**
 * Intenta abrir el selector de Pal objetivo desde fuera del sidebar. Si el
 * sidebar esta colapsado (movil), ese boton no existe todavia en el DOM: en
 * ese caso solo lo expandimos y el usuario elige a mano, en vez de fallar.
 * El riel colapsado se identifica por `data-rail-key` (estable en cualquier
 * idioma), no por el texto de su aria-label (que ahora se traduce).
 */
function focusTargetPicker() {
  const trigger = document.getElementById('target-pal-trigger')
  if (trigger) {
    trigger.scrollIntoView({ behavior: 'smooth', block: 'center' })
    trigger.click()
    return
  }
  const railButton = document.querySelector<HTMLElement>('[data-rail-key="target"]')
  railButton?.click()
}

function EmptyState() {
  const t = useT()
  return (
    <div className="empty-state mx-auto flex w-full max-w-[110rem] flex-col items-center justify-center gap-6 px-4 py-16 text-center sm:py-24">
      <span className="empty-state__emblem relative flex size-24 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/20">
        <span className="empty-state__ring absolute inset-0 rounded-full bg-primary/10" aria-hidden="true" />
        <Egg className="relative size-12 text-primary" aria-hidden="true" />
      </span>
      <div className="max-w-md space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">{t('emptyState.title')}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{t('emptyState.description')}</p>
      </div>
      <Button size="lg" className="gap-2" onClick={focusTargetPicker}>
        <Sparkles className="size-4" aria-hidden="true" />
        {t('emptyState.cta')}
      </Button>
    </div>
  )
}

function LoadingState() {
  const t = useT()
  return (
    <Card className="loading-card loading-state" role="status" aria-live="polite">
      <CardContent className="flex flex-col items-center justify-center gap-3 p-8 text-center">
        <Egg className="loading-state__egg size-7 text-primary" aria-hidden="true" />
        <p className="text-sm font-medium text-foreground">{t('loadingState.text')}</p>
        <span className="flex items-center gap-1.5" aria-hidden="true">
          <span className="loading-dot" style={{ animationDelay: '0ms' }} />
          <span className="loading-dot" style={{ animationDelay: '150ms' }} />
          <span className="loading-dot" style={{ animationDelay: '300ms' }} />
        </span>
      </CardContent>
    </Card>
  )
}

function PlanArea() {
  const { state } = usePlannerStore()
  const { result, routes, project, computing } = usePlanner()
  const [activeRouteId, setActiveRouteId] = useState<string | null>(null)
  const routeKey = routes.map((route) => {
    const stats = route.result.stats
    return `${route.id}:${route.result.root?.palId ?? ''}:${route.result.root?.passives.join(',') ?? ''}:${route.expectedEffort}:${stats?.steps ?? 0}:${stats?.capturesNeeded ?? 0}`
  }).join('|')

  useEffect(() => {
    setActiveRouteId(routes.find((route) => route.recommended)?.id ?? routes[0]?.id ?? null)
  }, [routeKey, routes])

  const activeRoute = routes.find((route) => route.id === activeRouteId) ?? routes.find((route) => route.recommended)
  const activeResult = activeRoute?.result ?? result
  const primaryTargetId = state.targetPalIds[0] ?? state.targetPalId
  // Before the player adds constraints, surface real two-parent recipes right
  // away. Once passives or owned Pals enter the plan, the generated tree takes
  // priority and the direct recipes remain available below it.
  const showDirectFirst = state.targetPalIds.length === 1 && state.desiredPassives.length === 0 && state.owned.length === 0

  if (!primaryTargetId) return <EmptyState />

  return (
    <div className="mx-auto w-full max-w-[110rem] space-y-2.5 min-[1920px]:max-w-[130rem] min-[2560px]:max-w-[160rem]">
      {showDirectFirst && <DirectRecipes targetPalId={primaryTargetId} />}

      {computing && <LoadingState />}

      {!computing && project && !project.ok && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="flex items-start gap-2 p-4 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-400" aria-hidden="true" />
            <p>{project.reason}</p>
          </CardContent>
        </Card>
      )}

      {!computing && !project && activeResult && !activeResult.ok && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="flex items-start gap-2 p-4 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-400" aria-hidden="true" />
            <div className="space-y-2">
              <p>{activeResult.reason}</p>
              {activeResult.missingPassives && activeResult.missingPassives.length > 0 && (
                <ul className="flex flex-wrap gap-1.5">
                  {activeResult.missingPassives.map((id) => (
                    <li key={id}>
                      <PassiveBadge passive={loadDatabase().passiveById.get(id)} interactive />
                    </li>
                  ))}
                </ul>
              )}
              {activeResult.suggestMode && <SwitchModeButton mode={activeResult.suggestMode} />}
            </div>
          </CardContent>
        </Card>
      )}

      {!computing && project?.ok && project.roots && project.roots.length > 1 && (
        <>
          <ProjectSummary project={project} />
          <BreedingTree roots={project.roots} />
        </>
      )}

      {!computing && !project && activeResult?.ok && activeResult.root && (
        <>
          <RouteComparison routes={routes} activeRouteId={activeRoute?.id ?? null} onSelect={setActiveRouteId} />
          <PlanSummary result={activeResult} />
          <BreedingTree root={activeResult.root} />
        </>
      )}

      {!showDirectFirst && state.targetPalIds.length === 1 && <DirectRecipes targetPalId={primaryTargetId} />}
    </div>
  )
}

/**
 * App-shell de escritorio: cabecera fija arriba, y debajo una fila que ocupa
 * el resto de la pantalla con dos columnas de scroll independiente. Asi el
 * sidebar puede redimensionarse/colapsarse sin que el arbol pierda su
 * posicion de scroll, y el arbol siempre recibe todo el espacio que el
 * sidebar deja libre (`flex-1 min-w-0`).
 */
function Layout({ onHome }: { onHome: () => void }) {
  const t = useT()
  return (
    <div className="flex h-screen flex-col bg-background">
      <a
        href="#plan-main"
        className="sr-only rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50"
      >
        {t('layout.skipLink')}
      </a>
      <Header onHome={onHome} />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main id="plan-main" className="min-w-0 flex-1 overflow-y-auto scroll-smooth pb-[calc(4.5rem+env(safe-area-inset-bottom))] sm:pb-0">
          <div className="px-3 py-3 sm:px-6 sm:py-5 lg:px-8">
            <PlanArea />
          </div>
          <footer className="mx-auto max-w-[110rem] px-3 pb-8 pt-2 text-[11px] leading-relaxed text-muted-foreground min-[1920px]:max-w-[130rem] min-[2560px]:max-w-[160rem] sm:px-6 lg:px-8">
            {t('layout.footer')}
          </footer>
        </main>
      </div>
    </div>
  )
}

function ExperienceGate() {
  const { state, dispatch } = usePlannerStore()
  const [plannerOpen, setPlannerOpen] = useState(() => localStorage.getItem(LAUNCHED_KEY) === 'true')
  const [onboardingOpen, setOnboardingOpen] = useState(false)

  const launch = () => {
    localStorage.setItem(LAUNCHED_KEY, 'true')
    setPlannerOpen(true)
    track('planner_launched')
    if (localStorage.getItem(ONBOARDING_KEY) !== 'true') setOnboardingOpen(true)
  }

  const finishOnboarding = () => {
    localStorage.setItem(ONBOARDING_KEY, 'true')
    setOnboardingOpen(false)
  }

  const goHome = () => {
    setOnboardingOpen(false)
    setPlannerOpen(false)
    track('landing_opened')
  }

  const loadDemo = () => {
    const existingDemo = listProjects().find((project) => project.name === DEMO_NAME)
    if (!existingDemo) saveProject(DEMO_NAME, DEMO_DRAFT)
    // La demo enseña el flujo sin borrar la colección personal ya creada.
    dispatch({ type: 'loadDraft', draft: { ...DEMO_DRAFT, owned: state.owned } })
    localStorage.setItem(LAUNCHED_KEY, 'true')
    localStorage.setItem(ONBOARDING_KEY, 'true')
    setOnboardingOpen(false)
    setPlannerOpen(true)
    track('demo_loaded')
  }

  if (!plannerOpen) return <LandingPage onLaunch={launch} onLoadDemo={loadDemo} />
  return <><Layout onHome={goHome} /><Onboarding open={onboardingOpen} onStart={finishOnboarding} /></>
}

export default function App() {
  return (
    <PlannerProvider>
      <PokedexProvider>
        <TooltipProvider delayDuration={350}>
          <DocumentLanguageSync />
          <ExperienceGate />
          <TrackingConsent />
        </TooltipProvider>
      </PokedexProvider>
    </PlannerProvider>
  )
}
