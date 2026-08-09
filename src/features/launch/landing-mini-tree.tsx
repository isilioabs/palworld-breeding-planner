/**
 * Composicion visual liviana de "target + hasta 2 padres" para la landing
 * (hero, Three Routes Showcase, How it Works). NO es el BreedingTree real
 * (ese trae pan/zoom/gestos y esta pensado para arboles de produccion, no
 * para una vinieta de marketing) -mismo lenguaje visual (PalIcon, marco por
 * elemento) pero markup propio y barato de montar varias veces por pagina.
 * `useReveal` dispara la entrada escalonada una sola vez al entrar en
 * viewport; sin JS de animacion en bucle.
 *
 * `useCards` (solo el hero lo activa) sustituye los iconos por la carta TCG
 * premium real (`LandingTcgCard` -> `PalCard`) para el objetivo y los
 * padres: la unica composicion de la landing que llega a mostrar la carta
 * completa en el arbol, tal como pide el brief ("strategically, not
 * everywhere"). Three Routes / How it Works se quedan en modo icono.
 */
import type { CSSProperties } from 'react'
import { PalIcon } from '@/components/pal-icon'
import { loadDatabase, palName } from '@/domain/database'
import { useT } from '@/i18n/language-store'
import type { TranslationKey } from '@/i18n/translations'
import { useReveal } from '@/lib/use-reveal'
import { cn } from '@/lib/utils'
import { LandingTcgCard } from './landing-tcg-card'

export interface MiniTreeParent {
  palId: string
  labelKey: TranslationKey
  /** Insignia extra opcional (Three Routes Showcase): "Owned" / "Easy capture" / "Hard capture". */
  badgeKey?: TranslationKey
}

interface LandingMiniTreeProps {
  targetPalId: string
  parents: MiniTreeParent[]
  className?: string
  /** Renderiza la carta TCG real en vez de los iconos (solo el hero). */
  useCards?: boolean
  onNavigate?: (path: string) => void
}

export function LandingMiniTree({ targetPalId, parents, className, useCards = false, onNavigate }: LandingMiniTreeProps) {
  const t = useT()
  const [ref, visible] = useReveal<HTMLDivElement>()
  const db = loadDatabase()
  const target = db.palById.get(targetPalId)

  return (
    <div ref={ref} className={cn('landing-mini-tree', useCards && 'landing-mini-tree--cards', visible && 'is-in', className)}>
      <div className="landing-mini-tree__target">
        {useCards ? (
          <LandingTcgCard palId={targetPalId} size={168} selected onNavigate={onNavigate} />
        ) : (
          <>
            <PalIcon palId={targetPalId} size={56} bare />
            <span>{palName(target)}</span>
          </>
        )}
      </div>
      <div className="landing-mini-tree__connector" aria-hidden="true">
        <span />
        <span />
      </div>
      <div className="landing-mini-tree__parents">
        {parents.map((parent, index) => {
          const pal = db.palById.get(parent.palId)
          return (
            <div key={parent.palId} className="landing-mini-tree__parent" style={{ '--i': index } as CSSProperties}>
              {useCards ? (
                <LandingTcgCard palId={parent.palId} size={92} compact onNavigate={onNavigate} />
              ) : (
                <>
                  <PalIcon palId={parent.palId} size={42} bare />
                  <span>{palName(pal)}</span>
                </>
              )}
              <small>{t(parent.labelKey)}</small>
              {parent.badgeKey && <em className="landing-mini-tree__parent-badge">{t(parent.badgeKey)}</em>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
