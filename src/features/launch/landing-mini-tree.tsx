/**
 * Composicion visual liviana de "target + hasta 2 padres" para la landing
 * (hero, Three Routes Showcase, How it Works). NO es el BreedingTree real
 * (ese trae pan/zoom/gestos y esta pensado para arboles de produccion, no
 * para una vinieta de marketing) -mismo lenguaje visual (PalIcon, marco por
 * elemento) pero markup propio y barato de montar varias veces por pagina.
 * `useReveal` dispara la entrada escalonada una sola vez al entrar en
 * viewport; sin JS de animacion en bucle.
 */
import type { CSSProperties } from 'react'
import { PalIcon } from '@/components/pal-icon'
import { loadDatabase, palName } from '@/domain/database'
import { useT } from '@/i18n/language-store'
import type { TranslationKey } from '@/i18n/translations'
import { useReveal } from '@/lib/use-reveal'
import { cn } from '@/lib/utils'

export interface MiniTreeParent {
  palId: string
  labelKey: TranslationKey
}

interface LandingMiniTreeProps {
  targetPalId: string
  parents: MiniTreeParent[]
  className?: string
}

export function LandingMiniTree({ targetPalId, parents, className }: LandingMiniTreeProps) {
  const t = useT()
  const [ref, visible] = useReveal<HTMLDivElement>()
  const db = loadDatabase()
  const target = db.palById.get(targetPalId)

  return (
    <div ref={ref} className={cn('landing-mini-tree', visible && 'is-in', className)}>
      <div className="landing-mini-tree__target">
        <PalIcon palId={targetPalId} size={56} bare />
        <span>{palName(target)}</span>
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
              <PalIcon palId={parent.palId} size={42} bare />
              <span>{palName(pal)}</span>
              <small>{t(parent.labelKey)}</small>
            </div>
          )
        })}
      </div>
    </div>
  )
}
