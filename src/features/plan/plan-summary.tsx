import { Egg, GitBranch, Layers, Percent, Target, Timer } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { formatNumber, formatPercent } from '@/lib/utils'
import type { PlanResult } from '@/domain/types'

const ITEMS = [
  {
    key: 'generations', icon: Layers, label: 'Generaciones totales', tone: 'text-violet-500 bg-violet-500/10 border-violet-500/20',
    help: 'Número máximo de generaciones entre el Pal objetivo y los Pals de origen.',
  },
  {
    key: 'steps', icon: GitBranch, label: 'Cruces', tone: 'text-sky-500 bg-sky-500/10 border-sky-500/20',
    help: 'Cruces distintos que necesitas completar a lo largo de la ruta.',
  },
  {
    key: 'eggs', icon: Egg, label: 'Huevos estimados', tone: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
    help: 'Media acumulada de huevos necesarios; no es un máximo garantizado.',
  },
  {
    key: 'captures', icon: Target, label: 'Capturas necesarias', tone: 'text-rose-500 bg-rose-500/10 border-rose-500/20',
    help: 'Pals salvajes que tendrás que conseguir antes de iniciar los cruces.',
  },
  {
    key: 'success', icon: Percent, label: '% de éxito estimado', tone: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
    help: 'Probabilidad de terminar toda la ruta si cada cruce sale al primer intento.',
  },
  {
    key: 'time', icon: Timer, label: 'Tiempo de cálculo', tone: 'text-primary bg-primary/10 border-primary/20',
    help: 'Tiempo que el planificador tardó en evaluar y encontrar esta ruta.',
  },
] as const

export function PlanSummary({ result }: { result: PlanResult }) {
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

  return (
    <section aria-label="Estadísticas del plan" className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      {ITEMS.map(({ key, icon: Icon, label, tone, help }, index) => (
        <Card
          key={key}
          title={help}
          className="metric-card group overflow-hidden border-border/80 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
          style={{ animationDelay: `${index * 45}ms` }}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
              <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg border ${tone}`}>
                <Icon className="size-4" />
              </span>
            </div>
            <p className="mt-4 text-2xl font-bold tracking-tight tabular-nums">{values[key]}</p>
            <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-muted-foreground opacity-70 transition-opacity group-hover:opacity-100">
              {help}
            </p>
          </CardContent>
        </Card>
      ))}
    </section>
  )
}
