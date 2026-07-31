import { AlertTriangle, Database, Egg, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { PassiveBadge } from '@/components/passive-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { MODES } from '@/domain/breeding/cost'
import type { PlannerMode } from '@/domain/types'
import { Sidebar } from '@/features/layout/sidebar'
import { PlanSummary } from '@/features/plan/plan-summary'
import { BreedingTree } from '@/features/plan/breeding-tree'
import { DirectRecipes } from '@/features/plan/direct-recipes'
import { usePlanner } from '@/hooks/use-planner'
import { PlannerProvider, usePlannerStore } from '@/state/planner-store'
import { loadDatabase } from '@/domain/database'

function Header() {
  const { mechanics } = loadDatabase()
  return (
    <header className="flex h-14 shrink-0 items-center gap-x-4 gap-y-1 border-b border-border bg-card/50 px-4">
      <div className="flex items-center gap-2.5">
        <Egg className="size-6 text-primary" />
        <h1 className="text-lg font-bold tracking-tight">Palworld Breeding Planner</h1>
      </div>
      <Badge variant="muted" className="hidden gap-1 sm:inline-flex">
        <Database className="size-3" />
        {mechanics.counts.pals} Pals · {mechanics.counts.uniqueCombos + mechanics.counts.genderCombos} combos unicos
      </Badge>
      <span className="ml-auto hidden text-[11px] text-muted-foreground lg:inline">
        Datos {mechanics.sourceVersion} · {mechanics.counts.verifiedPairs.toLocaleString('es-ES')} parejas
        verificadas · 100 % offline
      </span>
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
      <div className="mx-auto w-full max-w-[110rem]">
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            Elige un Pal objetivo para calcular la ruta de crianza.
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-[110rem] space-y-4">
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
                      <PassiveBadge passive={loadDatabase().passiveById.get(id)} />
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
  return (
    <div className="flex h-screen flex-col bg-background">
      <Header />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="px-5 py-5 sm:px-6 lg:px-8">
            <PlanArea />
          </div>
          <footer className="mx-auto max-w-[110rem] px-5 pb-8 pt-2 text-[11px] leading-relaxed text-muted-foreground sm:px-6 lg:px-8">
            Las probabilidades son estimaciones basadas en los pesos de herencia del juego. Se asume que
            descartas las crias con pasivas basura y que los Pals capturados en estado salvaje salen sin
            pasivas utiles. Palworld es una marca de Pocketpair, Inc.; este proyecto no esta afiliado con
            ellos.
          </footer>
        </main>
      </div>
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
