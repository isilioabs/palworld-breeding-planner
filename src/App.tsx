import { useEffect } from 'react'
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
import { BreedingTree } from '@/features/plan/breeding-tree'
import { DirectRecipes } from '@/features/plan/direct-recipes'
import { usePlanner } from '@/hooks/use-planner'
import { useLang, useT } from '@/i18n/language-store'
import { PlannerProvider, usePlannerStore } from '@/state/planner-store'
import { loadDatabase } from '@/domain/database'

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

function Header() {
  const { mechanics } = loadDatabase()
  const t = useT()
  const [lang] = useLang()
  const locale = lang === 'en' ? 'en-US' : 'es-ES'
  return (
    <header className="flex h-14 shrink-0 items-center gap-x-4 gap-y-1 border-b border-border bg-card/50 px-4">
      <div className="flex min-w-0 items-center gap-2.5">
        <Egg className="size-6 shrink-0 text-primary" aria-hidden="true" />
        <h1 className="truncate text-lg font-bold tracking-tight">{t('header.title')}</h1>
      </div>
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
      <span className="ml-auto hidden text-[11px] text-muted-foreground lg:inline">
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
    <div className="mx-auto flex w-full max-w-[110rem] flex-col items-center justify-center gap-6 px-4 py-16 text-center sm:py-24">
      <span className="relative flex size-24 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/20">
        <span className="absolute inset-0 animate-pulse rounded-full bg-primary/10" aria-hidden="true" />
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
    <Card className="loading-card" role="status" aria-live="polite">
      <CardContent className="flex flex-col items-center justify-center gap-3 p-8 text-center">
        <Egg className="size-7 animate-bounce text-primary" aria-hidden="true" />
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
  const { result, computing } = usePlanner()

  if (!state.targetPalId) return <EmptyState />

  return (
    <div className="mx-auto w-full max-w-[110rem] space-y-2.5 min-[1920px]:max-w-[130rem] min-[2560px]:max-w-[160rem]">
      {computing && <LoadingState />}

      {!computing && result && !result.ok && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="flex items-start gap-2 p-4 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-400" aria-hidden="true" />
            <div className="space-y-2">
              <p>{result.reason}</p>
              {result.missingPassives && result.missingPassives.length > 0 && (
                <ul className="flex flex-wrap gap-1.5">
                  {result.missingPassives.map((id) => (
                    <li key={id}>
                      <PassiveBadge passive={loadDatabase().passiveById.get(id)} interactive />
                    </li>
                  ))}
                </ul>
              )}
              {result.suggestMode && <SwitchModeButton mode={result.suggestMode} />}
            </div>
          </CardContent>
        </Card>
      )}

      {!computing && result?.ok && result.root && (
        <>
          <PlanSummary result={result} />
          <BreedingTree root={result.root} />
        </>
      )}

      <DirectRecipes targetPalId={state.targetPalId} />
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
function Layout() {
  const t = useT()
  const [lang] = useLang()
  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])
  return (
    <div className="flex h-screen flex-col bg-background">
      <a
        href="#plan-main"
        className="sr-only rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50"
      >
        {t('layout.skipLink')}
      </a>
      <Header />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main id="plan-main" className="min-w-0 flex-1 overflow-y-auto">
          <div className="px-5 py-5 sm:px-6 lg:px-8">
            <PlanArea />
          </div>
          <footer className="mx-auto max-w-[110rem] px-5 pb-8 pt-2 text-[11px] leading-relaxed text-muted-foreground min-[1920px]:max-w-[130rem] min-[2560px]:max-w-[160rem] sm:px-6 lg:px-8">
            {t('layout.footer')}
          </footer>
        </main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <PlannerProvider>
      <TooltipProvider delayDuration={350}>
        <Layout />
      </TooltipProvider>
    </PlannerProvider>
  )
}
