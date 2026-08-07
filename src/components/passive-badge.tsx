import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { HighlightMatch } from '@/components/highlight-match'
import { RichTooltip } from '@/components/rich-tooltip'
import { passiveName, passiveSummary } from '@/domain/database'
import { passiveRankArrowCount, passiveRankDirection, passiveRankTier } from '@/components/passive-rank'
import type { Passive } from '@/domain/types'
import { useT } from '@/i18n/language-store'
import type { TranslationKey } from '@/i18n/translations'
import { cn } from '@/lib/utils'

/** Misma clave que usa la carta del arbol (palCard.rank4..rankNeg3): una sola
 * fuente de texto para "por que se ve asi" en toda la app. */
function rankLabelKey(rank: number): TranslationKey {
  const clamped = Math.min(4, rank)
  if (clamped >= 1) return `palCard.rank${clamped}` as TranslationKey
  return `palCard.rankNeg${Math.abs(clamped)}` as TranslationKey
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
  const tier = passiveRankTier(passive.rank)
  const arrowCount = passiveRankArrowCount(passive.rank)
  const direction = passiveRankDirection(passive.rank)
  const name = passiveName(passive)
  const rankLabel = t(rankLabelKey(passive.rank))

  const badge = (
    <Badge
      className={cn(
        'passive-badge h-6 max-w-full gap-1.5 rounded-full px-2 text-[10px] font-semibold leading-none shadow-sm transition-transform duration-150 hover:scale-[1.05]',
        `passive-badge--${tier}`,
        className,
      )}
      title={interactive ? undefined : `${rankLabel} — ${name}\n${passiveSummary(passive)}`}
    >
      <span className={cn('passive-badge__arrows', direction === 'down' && 'passive-badge__arrows--down')} aria-hidden="true">
        {Array.from({ length: arrowCount }, (_, index) => <i key={index} />)}
      </span>
      <span className="truncate">{query ? <HighlightMatch text={name} query={query} /> : name}</span>
      {children}
    </Badge>
  )

  if (!interactive) return badge

  return (
    <RichTooltip asChild={false} title={name} description={rankLabel} detail={passiveSummary(passive)}>
      {badge}
    </RichTooltip>
  )
}
