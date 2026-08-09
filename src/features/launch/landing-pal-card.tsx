/**
 * Carta de Pal compacta para las vitrinas de la landing (Paldex, Tier List,
 * Build Advisor). No es el mismo componente que la carta del arbol
 * (`TreePalCard`, interna a breeding-tree.tsx y acoplada a `PlanNode`) -esa
 * es parte del "card system" que este rediseño tiene prohibido tocar. Esta
 * es una vitrina nueva y mas simple: mismo lenguaje visual (marco por
 * elemento via `--accent`, PalIcon, tipografia), datos 100% reales
 * (`getBuildsFor`/pals.json), sin logica de crianza.
 */
import type { CSSProperties } from 'react'
import { PalIcon } from '@/components/pal-icon'
import { PassiveBadge } from '@/components/passive-badge'
import { getBuildsFor } from '@/domain/builds'
import { dexLabel, loadDatabase, palName } from '@/domain/database'
import { ELEMENT_INFO } from '@/domain/element'
import { palSlug } from '@/domain/slug'
import { cn } from '@/lib/utils'

interface LandingPalCardProps {
  palId: string
  onNavigate: (path: string) => void
  /** Muestra hasta 2 pasivas recomendadas reales (Build Advisor). Apagado en la vitrina del Paldex para no repetir lo que ya muestra la seccion de Build Advisor. */
  showPassives?: boolean
  className?: string
}

export function LandingPalCard({ palId, onNavigate, showPassives = false, className }: LandingPalCardProps) {
  const db = loadDatabase()
  const pal = db.palById.get(palId)
  if (!pal) return null
  const elementInfo = ELEMENT_INFO[pal.elements[0] ?? 'neutral']
  const build = getBuildsFor(palId)[0]
  const passives = showPassives ? (build?.passives ?? []).slice(0, 2).map((id) => db.passiveById.get(id)).filter((p): p is NonNullable<typeof p> => !!p) : []
  const slug = palSlug(pal)
  const href = `/pals/${slug}`

  return (
    <a
      href={href}
      className={cn('landing-pal-card', className)}
      style={{ '--accent': elementInfo.color } as CSSProperties}
      onClick={(event) => {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
        event.preventDefault()
        onNavigate(href)
      }}
    >
      <span className="landing-pal-card__dex">{dexLabel(pal)}</span>
      <PalIcon palId={palId} size={92} bare className="landing-pal-card__portrait" />
      <strong className="landing-pal-card__name">{palName(pal)}</strong>
      <span className="landing-pal-card__element">{elementInfo.label}</span>
      {passives.length > 0 && (
        <div className="landing-pal-card__passives">
          {passives.map((passive) => <PassiveBadge key={passive.id} passive={passive} />)}
        </div>
      )}
    </a>
  )
}
