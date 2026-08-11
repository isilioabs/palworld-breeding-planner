import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle, Crown, Database, Info, Languages, MessageCircle, Sparkles, SlidersHorizontal, Zap } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { PalaxisMark } from '@/components/palaxis-mark'
import { PassiveBadge } from '@/components/passive-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { RichTooltip } from '@/components/rich-tooltip'
import { TooltipProvider } from '@/components/ui/tooltip'
import { modeLabel } from '@/domain/breeding/cost'
import { getResolver, pickDirectPreviewPair, buildDirectPreviewNode, type DirectPreviewResult } from '@/domain/breeding'
import type { PlanResult, PlannerMode } from '@/domain/types'
import { Sidebar } from '@/features/layout/sidebar'
import { PlanSummary } from '@/features/plan/plan-summary'
import { ProjectSummary } from '@/features/plan/project-summary'
import { RouteComparison } from '@/features/plan/route-comparison'
import { BreedingTree } from '@/features/plan/breeding-tree'
import { DirectRecipes } from '@/features/plan/direct-recipes'
import { RouteImprovementToast } from '@/features/plan/route-improvement-toast'
import { diffStats, type StatDelta } from '@/features/plan/plan-utils'
import { PokedexProvider } from '@/features/pokedex/pokedex-panel'
import { LandingPage } from '@/features/launch/landing-page'
import { QuickPathFinder } from '@/features/quick-path/quick-path-finder'
import { PalPage } from '@/features/pals/pal-page'
import { PalsIndexPage } from '@/features/pals/pals-index-page'
import { TierListPage } from '@/features/tiers/tier-list-page'
import { FeedbackPage } from '@/features/launch/feedback-page'
import { Onboarding } from '@/features/launch/onboarding'
import { TrackingConsent } from '@/features/launch/tracking-consent'
import { usePlanner } from '@/hooks/use-planner'
import { useMobileLayout } from '@/lib/use-mobile-layout'
import { useLang, useT } from '@/i18n/language-store'
import { PlannerProvider, usePlannerStore } from '@/state/planner-store'
import { loadDatabase } from '@/domain/database'
import { listProjects, saveProject, type ProjectDraft } from '@/domain/projects'
import { track } from '@/lib/analytics'
import { cn } from '@/lib/utils'

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

const NAV_TABS = [
  { path: '/planner', labelKey: 'nav.breedingPlanner', icon: SlidersHorizontal } as const,
  { path: '/pals', labelKey: 'nav.pals', icon: Database } as const,
  { path: '/tiers', labelKey: 'nav.tiers', icon: Crown } as const,
  { path: '/rapido', labelKey: 'nav.quickPath', icon: Zap } as const,
  { path: '/feedback', labelKey: 'nav.feedback', icon: MessageCircle } as const,
]

function isNavActive(route: string, path: string) {
  if (path === '/pals') return route === '/pals' || route.startsWith('/pals/')
  return route === path
}

function HeaderNav({ route, onNavigate }: { route: string; onNavigate: (path: string) => void }) {
  const t = useT()
  return (
    <nav aria-label="Palaxis" className="flex items-center gap-0.5 overflow-x-auto">
      {NAV_TABS.map(({ path, labelKey, icon: Icon }) => {
        const active = isNavActive(route, path)
        return (
          <a
            key={path}
            href={path}
            aria-current={active ? 'page' : undefined}
            onClick={(event) => {
              if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
              event.preventDefault()
              onNavigate(path)
            }}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold no-underline transition-colors sm:px-2.5',
              active ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <Icon className="size-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">{t(labelKey)}</span>
          </a>
        )
      })}
    </nav>
  )
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

function Header({ onHome, route, onNavigate }: { onHome: () => void; route: string; onNavigate: (path: string) => void }) {
  const { mechanics } = loadDatabase()
  const t = useT()
  const [lang] = useLang()
  const locale = lang === 'en' ? 'en-US' : 'es-ES'
  return (
    <header className="relative z-30 flex min-h-16 shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-border/90 bg-card/80 px-3 shadow-[0_8px_30px_rgba(0,0,0,0.18)] backdrop-blur-xl sm:px-5">
      <button
        type="button"
        className="app-brand flex min-w-0 items-center gap-2.5 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={t('header.home')}
        onClick={onHome}
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-primary/35 bg-primary/10 shadow-[0_0_24px_color-mix(in_oklch,var(--primary)_26%,transparent)]">
          <PalaxisMark className="size-5 text-primary" />
        </span>
        <div className="min-w-0">
          <h1 className="truncate font-[Anton] text-xl uppercase leading-none tracking-wide sm:text-2xl">{t('header.title')}</h1>
          <p className="mt-1 hidden text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground sm:block">
            {t('header.subtitle')}
          </p>
        </div>
      </button>
      <HeaderNav route={route} onNavigate={onNavigate} />
      <RichTooltip
        asChild={false}
        title={t('header.datasetTitle', { version: mechanics.sourceVersion })}
        description={t('header.datasetDescription', { count: mechanics.counts.verifiedPairs.toLocaleString(locale) })}
        detail={t('header.datasetDetail')}
      >
        <Badge variant="muted" className="hidden gap-1 lg:inline-flex">
          <Database className="size-3" aria-hidden="true" />
          {t('header.badge', { pals: mechanics.counts.pals, combos: mechanics.counts.uniqueCombos + mechanics.counts.genderCombos })}
        </Badge>
      </RichTooltip>
      <span className="ml-auto hidden text-[11px] text-muted-foreground xl:inline">
        {t('header.footerLine', { version: mechanics.sourceVersion, count: mechanics.counts.verifiedPairs.toLocaleString(locale) })}
      </span>
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
        <PalaxisMark className="relative size-12 text-primary" />
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
        <PalaxisMark className="loading-state__egg size-7 text-primary" />
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

/**
 * Indicador de recalculo no bloqueante: nunca reemplaza el arbol ni el
 * resumen -solo avisa de que hay un plan nuevo en camino mientras el actual
 * sigue en pantalla (atenuado por el contenedor que lo envuelve en PlanArea).
 */
function OptimizingIndicator() {
  const t = useT()
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed bottom-[calc(4.35rem+env(safe-area-inset-bottom))] right-3 z-40 flex items-center gap-2 rounded-full border border-border/70 bg-card px-3.5 py-2 text-xs font-semibold text-muted-foreground shadow-lg sm:bottom-5 sm:right-5 sm:bg-card/95 sm:backdrop-blur-sm"
    >
      <span className="flex items-center gap-1" aria-hidden="true">
        <span className="loading-dot" style={{ animationDelay: '0ms' }} />
        <span className="loading-dot" style={{ animationDelay: '150ms' }} />
        <span className="loading-dot" style={{ animationDelay: '300ms' }} />
      </span>
      {t('plan.optimizing')}
    </div>
  )
}

/** Vista previa directa cuando "Only My Collection" no tiene ninguna pareja
 * propia todavia, o cuando la especie objetivo no se cria de ninguna pareja. */
function DirectPreviewUnavailableCard({ reason }: { reason: 'no-parents' | 'no-owned-pair' }) {
  const t = useT()
  return (
    <Card className="border-dashed">
      <CardContent className="flex items-start gap-2 p-4 text-sm text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <p>{t(reason === 'no-owned-pair' ? 'directPreview.unavailableCollection' : 'directPreview.unavailableNoParents')}</p>
      </CardContent>
    </Card>
  )
}

function PlanArea() {
  const { state } = usePlannerStore()
  const { result, routes, project, computing, recalculating } = usePlanner()
  const [activeRouteId, setActiveRouteId] = useState<PlannerMode | null>(null)
  const db = loadDatabase()
  const t = useT()
  const isMobile = useMobileLayout()
  const primaryTargetId = state.targetPalIds[0] ?? state.targetPalId

  // El modo activo del sidebar es la ruta que se ve por defecto; las otras
  // dos tarjetas del comparador (Fase E) dejan previsualizar sin cambiar el
  // modo global -swap local, instantaneo, porque el worker ya calculo las 3.
  useEffect(() => {
    setActiveRouteId(state.mode)
  }, [primaryTargetId, state.mode])

  const activeRoute = routes && activeRouteId ? routes[activeRouteId] : null
  const activeResult = activeRoute?.result ?? result
  // Before the player adds constraints, surface real two-parent recipes right
  // away. Once passives or owned Pals enter the plan, the generated tree takes
  // priority and the direct recipes remain available below it.
  const showDirectFirst = state.targetPalIds.length === 1 && state.desiredPassives.length === 0 && state.owned.length === 0
  const hasRealRoute = !!(activeResult?.ok && activeResult.root)

  // Vista previa directa: sin pasar por el worker, para que elegir un
  // objetivo se sienta instantaneo (estado B/C de la maquina de estados).
  // Deja de calcularse en cuanto hay una ruta real que mostrar en su lugar.
  const directPreview: DirectPreviewResult | null = useMemo(() => {
    if (!primaryTargetId || hasRealRoute) return null
    return pickDirectPreviewPair(primaryTargetId, state.mode, state.owned, getResolver(), db.palById)
  }, [primaryTargetId, hasRealRoute, state.mode, state.owned, db.palById])

  // Aviso de "ruta mejorada": compara contra la ultima ruta valida del MISMO
  // objetivo+modo (cambiar de objetivo o de modo no cuenta como "mejora",
  // son cosas distintas que comparar).
  const [improvementDeltas, setImprovementDeltas] = useState<StatDelta[]>([])
  const prevStatsRef = useRef<{ signature: string; stats: NonNullable<PlanResult['stats']> | null }>({ signature: '', stats: null })
  useEffect(() => {
    if (!activeResult?.ok || !activeResult.stats) return
    const signature = `${primaryTargetId ?? ''}:${state.mode}`
    setImprovementDeltas(
      prevStatsRef.current.signature === signature ? diffStats(state.mode, prevStatsRef.current.stats, activeResult.stats) : [],
    )
    prevStatsRef.current = { signature, stats: activeResult.stats }
  }, [activeResult, primaryTargetId, state.mode])

  if (!primaryTargetId) return <EmptyState />

  return (
    <div className="mx-auto w-full max-w-[110rem] space-y-2.5 min-[1920px]:max-w-[130rem] min-[2560px]:max-w-[160rem]">
      {showDirectFirst && !isMobile && <DirectRecipes targetPalId={primaryTargetId} />}

      {/* Nunca se desmonta durante un recalculo: solo se atenua levemente y
          un indicador pequeno (fuera de este contenedor) avisa aparte. La
          pantalla de carga completa solo aparece para el PRIMER plan de un
          objetivo, cuando todavia no hay nada -ni siquiera la vista previa-
          que mostrar en su lugar. */}
      <div className={cn('space-y-2.5 transition-opacity duration-150', recalculating && 'pointer-events-none opacity-60')}>
        {!hasRealRoute && directPreview && (
          <div className="space-y-1.5">
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              <Sparkles className="size-3" aria-hidden="true" />
              {t('directPreview.title')}
            </p>
            {directPreview.kind === 'pair' ? (
              <BreedingTree root={buildDirectPreviewNode(primaryTargetId, directPreview)} />
            ) : (
              <DirectPreviewUnavailableCard reason={directPreview.reason} />
            )}
          </div>
        )}

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
          isMobile ? (
            <>
              <RouteComparison routes={routes} activeRouteId={activeRoute?.id ?? null} onSelect={setActiveRouteId} />
              <BreedingTree root={activeResult.root} />
              <PlanSummary result={activeResult} />
            </>
          ) : (
            <>
              <RouteComparison routes={routes} activeRouteId={activeRoute?.id ?? null} onSelect={setActiveRouteId} />
              <PlanSummary result={activeResult} />
              <BreedingTree root={activeResult.root} />
            </>
          )
        )}

        {computing && !directPreview && <LoadingState />}
      </div>

      {(computing || recalculating) && <OptimizingIndicator />}
      <RouteImprovementToast deltas={improvementDeltas} />

      {state.targetPalIds.length === 1 && (!showDirectFirst || isMobile) && <DirectRecipes targetPalId={primaryTargetId} />}
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
function Layout({ onHome, route, onNavigate }: { onHome: () => void; route: string; onNavigate: (path: string) => void }) {
  const t = useT()
  return (
    <div className="flex h-screen flex-col bg-background">
      <a
        href="#plan-main"
        className="sr-only rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50"
      >
        {t('layout.skipLink')}
      </a>
      <Header onHome={onHome} route={route} onNavigate={onNavigate} />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main id="plan-main" className="min-w-0 flex-1 overflow-y-auto scroll-smooth pb-[calc(4rem+env(safe-area-inset-bottom))] sm:pb-0">
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

const QUICK_PATH_PATH = '/rapido'
const PAL_PATH_PREFIX = '/pals/'
const PLANNER_PATH = '/planner'
const PALS_INDEX_PATH = '/pals'
const TIERS_PATH = '/tiers'
const FEEDBACK_PATH = '/feedback'

/**
 * Ruta minima con la History API real (sin dependencia de router): solo hace
 * falta un unico path fijo para la busqueda rapida, asi que un router
 * completo seria peso muerto. `popstate` cubre atras/adelante del navegador.
 */
function useRoute() {
  const [path, setPath] = useState(() => window.location.pathname)
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  const navigate = (next: string) => {
    if (next !== window.location.pathname) window.history.pushState({}, '', next)
    setPath(next)
  }
  return [path, navigate] as const
}

function ExperienceGate() {
  const { state, dispatch } = usePlannerStore()
  const [plannerOpen, setPlannerOpen] = useState(() => localStorage.getItem(LAUNCHED_KEY) === 'true')
  const [onboardingOpen, setOnboardingOpen] = useState(false)
  const [route, navigate] = useRoute()

  const openQuick = () => {
    navigate(QUICK_PATH_PATH)
    track('quick_path_opened')
  }
  const exitQuick = () => navigate('/')
  const exitPalPage = () => navigate(PALS_INDEX_PATH)
  const navigateToPal = (slug: string) => navigate(`${PAL_PATH_PREFIX}${slug}`)
  const openTargetFromPalPage = () => {
    localStorage.setItem(LAUNCHED_KEY, 'true')
    setPlannerOpen(true)
    navigate('/')
  }

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
    navigate('/')
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

  // Entrar directo a /planner (nav, bookmark, link externo) debe abrir el
  // planner de una, igual que el boton "Launch" de la landing -sin esto, un
  // usuario que nunca "lanzo" antes veria la landing en vez de la pagina que
  // pidio por URL.
  useEffect(() => {
    if (route === PLANNER_PATH && !plannerOpen) launch()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- launch() se redefine cada render; solo importa reaccionar a cambios de ruta/estado.
  }, [route, plannerOpen])

  // El header con las pestañas es el MISMO componente en todas las pantallas
  // -salvo el planner, que ya lo integra dentro de su propio shell de alto
  // fijo (Layout), y la landing, que tiene su propia nav de marketing (con
  // el CTA "Launch") y no debe llevar un segundo header encima.
  let content: ReactNode
  let showGlobalHeader = true
  if (route === QUICK_PATH_PATH) {
    content = <QuickPathFinder onExit={exitQuick} />
  } else if (route.startsWith(PAL_PATH_PREFIX)) {
    const slug = route.slice(PAL_PATH_PREFIX.length)
    content = <PalPage slug={slug} onExit={exitPalPage} onOpenTarget={openTargetFromPalPage} onNavigate={navigateToPal} />
  } else if (route === PALS_INDEX_PATH) {
    content = <PalsIndexPage onNavigate={navigateToPal} />
  } else if (route === TIERS_PATH) {
    content = <TierListPage onNavigate={navigateToPal} />
  } else if (route === FEEDBACK_PATH) {
    content = <FeedbackPage />
  } else if (!plannerOpen && route !== PLANNER_PATH) {
    content = <LandingPage onLaunch={launch} onLoadDemo={loadDemo} onOpenQuick={openQuick} onNavigate={navigate} />
    showGlobalHeader = false
  } else {
    content = <><Layout onHome={goHome} route={route} onNavigate={navigate} /><Onboarding open={onboardingOpen} onStart={finishOnboarding} /></>
    showGlobalHeader = false
  }

  return showGlobalHeader ? <><Header onHome={goHome} route={route} onNavigate={navigate} />{content}</> : content
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
