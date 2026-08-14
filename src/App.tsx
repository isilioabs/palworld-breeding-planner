import { lazy, startTransition, Suspense, useEffect, useState, type ReactNode } from 'react'
import { PalaxisMark } from '@/components/palaxis-mark'
import { AppErrorBoundary } from '@/components/app-error-boundary'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AppHeader } from '@/features/layout/app-header'
import { useLang, useT } from '@/i18n/language-store'
import { getLang } from '@/i18n/lang'
import { PlannerProvider, usePlannerStore } from '@/state/planner-store'
import { listProjects, saveProject, type ProjectDraft } from '@/domain/projects'
import { track } from '@/lib/analytics'
import { localizedPath, stripLocalePrefix, syncDocumentSeo } from '@/lib/seo'

const LandingPage = lazy(() => import('@/features/launch/landing-page').then((module) => ({ default: module.LandingPage })))
const QuickPathFinder = lazy(() => import('@/features/quick-path/quick-path-finder').then((module) => ({ default: module.QuickPathFinder })))
const PalPage = lazy(() => import('@/features/pals/pal-page').then((module) => ({ default: module.PalPage })))
const PalsIndexPage = lazy(() => import('@/features/pals/pals-index-page').then((module) => ({ default: module.PalsIndexPage })))
const TierListPage = lazy(() => import('@/features/tiers/tier-list-page').then((module) => ({ default: module.TierListPage })))
const FeedbackPage = lazy(() => import('@/features/launch/feedback-page').then((module) => ({ default: module.FeedbackPage })))
const PlannerWorkspace = lazy(() => import('@/features/plan/planner-workspace').then((module) => ({ default: module.PlannerWorkspace })))
const Onboarding = lazy(() => import('@/features/launch/onboarding').then((module) => ({ default: module.Onboarding })))
const TrackingConsent = lazy(() => import('@/features/launch/tracking-consent').then((module) => ({ default: module.TrackingConsent })))

const ONBOARDING_KEY = 'pbp:experience:onboarding-seen'
const DEMO_NAME = 'Perfect Anubis Worker'
const DEMO_DRAFT: ProjectDraft = {
  targetPalId: 'Anubis',
  targetPalIds: ['Anubis'],
  desiredPassives: ['CraftSpeed_up3', 'CraftSpeed_up2', 'PAL_CorporateSlave', 'CraftSpeed_up1'],
  owned: [],
  mode: 'hybrid',
}

function DocumentLanguageSync({ route }: { route: string }) {
  const [lang] = useLang()

  useEffect(() => {
    syncDocumentSeo(route, lang)
  }, [lang, route])

  return null
}

function RouteFallback() {
  const t = useT()
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6" role="status" aria-live="polite">
      <div className="flex items-center gap-3 text-sm font-semibold text-muted-foreground">
        <PalaxisMark className="size-8 text-primary" />
        <span>{t('loadingState.text')}</span>
      </div>
    </main>
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
  const [path, setPath] = useState(() => stripLocalePrefix(window.location.pathname))
  useEffect(() => {
    const onPop = () => startTransition(() => setPath(stripLocalePrefix(window.location.pathname)))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  const navigate = (next: string) => {
    const clean = stripLocalePrefix(next)
    const localized = localizedPath(clean, getLang())
    if (localized !== window.location.pathname) window.history.pushState({}, '', localized)
    startTransition(() => setPath(clean))
  }
  return [path, navigate] as const
}

function ExperienceGate() {
  const { state, dispatch } = usePlannerStore()
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
    navigate(PLANNER_PATH)
  }

  const launch = () => {
    navigate(PLANNER_PATH)
    track('planner_launched')
    if (localStorage.getItem(ONBOARDING_KEY) !== 'true') setOnboardingOpen(true)
  }

  const finishOnboarding = () => {
    localStorage.setItem(ONBOARDING_KEY, 'true')
    setOnboardingOpen(false)
  }

  const goHome = () => {
    setOnboardingOpen(false)
    navigate('/')
    track('landing_opened')
  }

  const loadDemo = () => {
    const existingDemo = listProjects().find((project) => project.name === DEMO_NAME)
    if (!existingDemo) saveProject(DEMO_NAME, DEMO_DRAFT)
    // La demo enseña el flujo sin borrar la colección personal ya creada.
    dispatch({ type: 'loadDraft', draft: { ...DEMO_DRAFT, owned: state.owned } })
    localStorage.setItem(ONBOARDING_KEY, 'true')
    setOnboardingOpen(false)
    navigate(PLANNER_PATH)
    track('demo_loaded')
  }

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
  } else if (route === PLANNER_PATH) {
    content = <><PlannerWorkspace onHome={goHome} route={route} onNavigate={navigate} /><Onboarding open={onboardingOpen} onStart={finishOnboarding} /></>
    showGlobalHeader = false
  } else {
    content = <LandingPage onLaunch={launch} onLoadDemo={loadDemo} onOpenQuick={openQuick} onNavigate={navigate} />
    showGlobalHeader = false
  }

  return (
    <>
      <DocumentLanguageSync route={route} />
      <Suspense fallback={<RouteFallback />}>
        {showGlobalHeader ? <><AppHeader onHome={goHome} route={route} onNavigate={navigate} />{content}</> : content}
      </Suspense>
    </>
  )
}

export default function App() {
  return (
    <AppErrorBoundary>
      <PlannerProvider>
        <TooltipProvider delayDuration={350}>
          <ExperienceGate />
          <Suspense fallback={null}><TrackingConsent /></Suspense>
        </TooltipProvider>
      </PlannerProvider>
    </AppErrorBoundary>
  )
}
