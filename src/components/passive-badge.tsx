import {
  BriefcaseBusiness,
  Crown,
  Shield,
  Swords,
  TriangleAlert,
  Wind,
  type LucideIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { passiveName, passiveSummary } from '@/domain/database'
import type { Passive } from '@/domain/types'
import { cn } from '@/lib/utils'

type PassiveCategory = 'work' | 'combat' | 'movement' | 'defense' | 'legendary' | 'negative'

const CATEGORY: Record<PassiveCategory, { label: string; icon: LucideIcon; className: string }> = {
  work: { label: 'Trabajo', icon: BriefcaseBusiness, className: 'border-amber-500/30 bg-amber-500/12 text-amber-500' },
  combat: { label: 'Combate', icon: Swords, className: 'border-rose-500/30 bg-rose-500/12 text-rose-500' },
  movement: { label: 'Movimiento', icon: Wind, className: 'border-sky-500/30 bg-sky-500/12 text-sky-500' },
  defense: { label: 'Defensa', icon: Shield, className: 'border-emerald-500/30 bg-emerald-500/12 text-emerald-500' },
  legendary: { label: 'Legendaria', icon: Crown, className: 'border-violet-500/35 bg-violet-500/12 text-violet-500' },
  negative: { label: 'Negativa', icon: TriangleAlert, className: 'border-slate-500/35 bg-slate-500/15 text-slate-400' },
}

/** Clasifica por los efectos reales para que el color sea consistente en toda la app. */
export function passiveCategory(passive: Passive): PassiveCategory {
  const text = `${passive.id} ${passive.name} ${passive.desc}`.toLowerCase()
  if (passive.rank < 0) return 'negative'
  if (/legend|worldtree|world tree|mutation|immortal|lucky|rare/.test(text)) return 'legendary'
  if (/work|craft|farm|logging|mining|sanity|breeding|incubat/.test(text)) return 'work'
  if (/move|swim|stamina|jump|speed/.test(text)) return 'movement'
  if (/defen|resist|health|hp|hunger|regene|shield|armor/.test(text)) return 'defense'
  return 'combat'
}

interface PassiveBadgeProps {
  passive: Passive | undefined
  className?: string
  children?: ReactNode
}

export function PassiveBadge({ passive, className, children }: PassiveBadgeProps) {
  if (!passive) return null
  const category = CATEGORY[passiveCategory(passive)]
  const Icon = category.icon
  const tooltip = `${category.label} — ${passiveName(passive)}\n${passiveSummary(passive)}`

  return (
    <Badge
      className={cn(
        'h-6 max-w-full gap-1 rounded-md border px-1.5 text-[10px] font-semibold leading-none shadow-sm transition-transform duration-150 hover:scale-[1.03]',
        category.className,
        className,
      )}
      title={tooltip}
    >
      <Icon className="size-3 shrink-0" aria-hidden="true" />
      <span className="truncate">{passiveName(passive)}</span>
      {children}
    </Badge>
  )
}
