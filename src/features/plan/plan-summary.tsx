import { Egg, GitBranch, Layers, Sparkles, Timer, Target as TargetIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { formatNumber, formatPercent } from '@/lib/utils'
import type { PlanResult } from '@/domain/types'

const ITEMS = [
  { key: 'generations', icon: Layers, label: 'Generaciones' },
  { key: 'steps', icon: GitBranch, label: 'Cruces' },
  { key: 'eggs', icon: Egg, label: 'Huevos estimados' },
  { key: 'captures', icon: TargetIcon, label: 'Capturas' },
  { key: 'owned', icon: Sparkles, label: 'De tu caja' },
  { key: 'time', icon: Timer, label: 'Calculo' },
] as const

export function PlanSummary({ result }: { result: PlanResult }) {
  if (!result.ok || !result.stats) return null
  const s = result.stats

  const values: Record<(typeof ITEMS)[number]['key'], string> = {
    generations: String(s.generations),
    steps: String(s.steps),
    eggs: formatNumber(s.totalExpectedEggs),
    captures: String(s.capturesNeeded),
    owned: String(s.ownedUsed),
    time: `${s.elapsedMs} ms`,
  }

  return (
    <Card>
      <CardContent className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-6">
        {ITEMS.map(({ key, icon: Icon, label }) => (
          <div key={key} className="space-y-0.5">
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
              <Icon className="size-3.5" />
              {label}
            </div>
            <div className="text-xl font-semibold tabular-nums">{values[key]}</div>
          </div>
        ))}
      </CardContent>
      <CardContent className="border-t border-border pt-3 text-xs text-muted-foreground">
        Probabilidad de que toda la ruta salga a la primera:{' '}
        <span className="font-semibold text-foreground">{formatPercent(s.combinedChance, 2)}</span>. Los huevos
        estimados son el valor esperado acumulado ({formatNumber(s.totalExpectedEggs)} incubaciones de media);
        no es un maximo.
      </CardContent>
    </Card>
  )
}
