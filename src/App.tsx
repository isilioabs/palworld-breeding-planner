import { AlertTriangle, Database, Egg, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { MODES } from '@/domain/breeding/cost'
import type { PlannerMode } from '@/domain/types'
import { Separator } from '@/components/ui/separator'
import { TargetPanel } from '@/features/setup/target-panel'
import { ModePanel } from '@/features/setup/mode-panel'
import { CollectionPanel } from '@/features/collection/collection-panel'
import { ProjectsPanel } from '@/features/projects/projects-panel'
import { PlanSummary } from '@/features/plan/plan-summary'
import { BreedingTree } from '@/features/plan/breeding-tree'
import { DirectRecipes } from '@/features/plan/direct-recipes'
import { usePlanner } from '@/hooks/use-planner'
import { PlannerProvider, usePlannerStore } from '@/state/planner-store'
import { loadDatabase, passiveName } from '@/domain/database'

function Header() {
  const { mechanics } = loadDatabase()
  return (
    <header className="border-b border-border bg-card/50">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
        <Egg className="size-5 text-primary" />
        <h1 className="text-base font-semibold tracking-tight">Palworld Breeding Planner</h1>
        <Badge variant="muted" className="gap-1">
          <Database className="size-3" />
          {mechanics.counts.pals} Pals · {mechanics.counts.uniqueCombos + mechanics.counts.genderCombos} combos
          unicos
        </Badge>
        <span className="ml-auto text-[11px] text-muted-foreground">
          Datos {mechanics.sourceVersion} · {mechanics.counts.verifiedPairs.toLocaleString('es-ES')} parejas
          verificadas · 100 % offline
        </span>
      </div>
    </header>
  )
}

function SwitchModeButton({ mode }: { mode: PlannerMode }) {
  const { dispatch } = usePlannerStore()
  return (
    <Button size="sm" variant="outline" onClick={() => dispatch({ type: 'setMode', mode })}>
      Cambiar a "{MODES[mode].label}"
    </Button>
  )
}

function PlanArea() {
  const { state } = usePlannerStore()
  const { result, computing } = usePlanner()

  if (!state.targetPalId) {
    return (
      <Card>
        <CardContent className="p-10 text-center text-sm text-muted-foreground">
          Elige un Pal objetivo para calcular la ruta de crianza.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {computing && (
        <Card>
          <CardContent className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Buscando la ruta optima...
          </CardContent>
        </Card>
      )}

      {!computing && result && !result.ok && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="flex items-start gap-2 p-4 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-400" />
            <div className="space-y-2">
              <p>{result.reason}</p>
              {result.missingPassives && result.missingPassives.length > 0 && (
                <ul className="flex flex-wrap gap-1.5">
                  {result.missingPassives.map((id) => (
                    <li key={id}>
                      <Badge variant="warn">{passiveName(loadDatabase().passiveById.get(id))}</Badge>
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

function Layout() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto grid max-w-7xl grid-cols-1 gap-4 px-4 py-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-4">
          <TargetPanel />
          <CollectionPanel />
          <ModePanel />
          <ProjectsPanel />
        </div>
        <div className="min-w-0">
          <PlanArea />
        </div>
      </main>
      <Separator />
      <footer className="mx-auto max-w-7xl px-4 py-6 text-[11px] leading-relaxed text-muted-foreground">
        Las probabilidades son estimaciones basadas en los pesos de herencia del juego. Se asume que descartas
        las crias con pasivas basura y que los Pals capturados en estado salvaje salen sin pasivas utiles.
        Palworld es una marca de Pocketpair, Inc.; este proyecto no esta afiliado con ellos.
      </footer>
    </div>
  )
}

export default function App() {
  return (
    <PlannerProvider>
      <Layout />
    </PlannerProvider>
  )
}
