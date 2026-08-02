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
import { HighlightMatch } from '@/components/highlight-match'
import { RichTooltip } from '@/components/rich-tooltip'
import { passiveName, passiveSummary } from '@/domain/database'
import type { Passive } from '@/domain/types'
import { useT } from '@/i18n/language-store'
import { cn } from '@/lib/utils'

type PassiveCategory = 'work' | 'combat' | 'movement' | 'defense' | 'legendary' | 'negative'

const CATEGORY: Record<PassiveCategory, { labelKey: `passiveCategory.${PassiveCategory}`; icon: LucideIcon; className: string }> = {
  work: { labelKey: 'passiveCategory.work', icon: BriefcaseBusiness, className: 'border-amber-500/30 bg-amber-500/12 text-amber-500' },
  combat: { labelKey: 'passiveCategory.combat', icon: Swords, className: 'border-rose-500/30 bg-rose-500/12 text-rose-500' },
  movement: { labelKey: 'passiveCategory.movement', icon: Wind, className: 'border-sky-500/30 bg-sky-500/12 text-sky-500' },
  defense: { labelKey: 'passiveCategory.defense', icon: Shield, className: 'border-emerald-500/30 bg-emerald-500/12 text-emerald-500' },
  legendary: { labelKey: 'passiveCategory.legendary', icon: Crown, className: 'border-violet-500/35 bg-violet-500/12 text-violet-500' },
  negative: { labelKey: 'passiveCategory.negative', icon: TriangleAlert, className: 'border-slate-500/35 bg-slate-500/15 text-slate-400' },
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

/** Icono por categoria: reutilizado por la carta de Pal para que el lenguaje visual sea el mismo en toda la app. */
export function passiveCategoryIcon(passive: Passive): LucideIcon {
  return CATEGORY[passiveCategory(passive)].icon
}

export type PassiveTier = 'mythic' | 'gold' | 'silver' | 'bad'

/** Calidad de la pasiva por rango (-3..5), para la carta de Pal ("mythic" solo el rango maximo). */
export function passiveTier(passive: Passive): PassiveTier {
  if (passive.rank >= 5) return 'mythic'
  if (passive.rank >= 3) return 'gold'
  if (passive.rank >= 1) return 'silver'
  return 'bad'
}

interface PassiveBadgeProps {
  passive: Passive | undefined
  className?: string
  children?: ReactNode
  /** Si se pasa, resalta la parte del nombre que coincide con la busqueda. */
  query?: string
  /**
   * Convierte el badge en un boton enfocable con tooltip enriquecido (teclado
   * incluido). Solo es seguro cuando el badge no tiene ya un boton anidado
   * (como el "x" de quitar en la coleccion) ni vive dentro de otro control
   * interactivo (como una fila de CommandItem en el buscador de pasivas).
   */
  interactive?: boolean
}

export function PassiveBadge({ passive, className, children, query, interactive = false }: PassiveBadgeProps) {
  const t = useT()
  if (!passive) return null
  const category = CATEGORY[passiveCategory(passive)]
  const categoryLabel = t(category.labelKey)
  const Icon = category.icon
  const name = passiveName(passive)
  const rankLabel = t('passiveBadge.rank', { rank: passive.rank > 0 ? `+${passive.rank}` : passive.rank })

  const badge = (
    <Badge
      className={cn(
        'h-6 max-w-full gap-1 rounded-full border px-2 text-[10px] font-semibold leading-none shadow-sm transition-transform duration-150 hover:scale-[1.05]',
        category.className,
        className,
      )}
      title={interactive ? undefined : `${categoryLabel} — ${name}\n${passiveSummary(passive)}`}
    >
      <Icon className="size-3 shrink-0" aria-hidden="true" />
      <span className="truncate">{query ? <HighlightMatch text={name} query={query} /> : name}</span>
      {children}
    </Badge>
  )

  if (!interactive) return badge

  return (
    <RichTooltip asChild={false} title={name} description={`${categoryLabel} · ${rankLabel}`} detail={passiveSummary(passive)}>
      {badge}
    </RichTooltip>
  )
}
