/**
 * Puente entre la landing y la carta TCG premium real (`PalCard`,
 * src/components/pal-card.tsx) -el mismo componente que ya existe en el
 * repo para el arbol detallado, con marco por rareza, flechas de rango real
 * de pasiva, retrato y foil. NO es una carta nueva: se reusan sus props tal
 * cual, solo se resuelven desde datos reales (pal.work, getBuildsFor,
 * pal.rarity/elements) en vez de un PlanNode de una partida de cria.
 *
 * `PalCard` siempre mide 780x1000 (fijo, ver su propio comentario); este
 * wrapper la encoge a `size` de ancho con un contenedor de tamano real +
 * `transform: scale()` (mismo patron que cualquier "miniatura" de un nodo de
 * tamano fijo), para no tocar el componente original.
 *
 * `isCross` siempre va en `false` aqui: la landing solo muestra Pals reales
 * (objetivo, coleccion, vitrina), nunca un cruce calculado -mostrar un "% de
 * exito" inventado seria presentar un dato ilustrativo como si fuera un
 * calculo real del planner.
 */
import { PalCard } from '@/components/pal-card'
import { dexLabel, loadDatabase, palName, passiveName, workTypeLabel } from '@/domain/database'
import { getBuildsFor } from '@/domain/builds'
import { workIconUrl } from '@/domain/work-icon'
import { palSlug } from '@/domain/slug'
import { cn } from '@/lib/utils'

const NATIVE_WIDTH = 780
const NATIVE_HEIGHT = 1000

interface LandingTcgCardProps {
  palId: string
  /** Ancho final en px; el alto se deriva de la proporcion real de la carta (780x1000). */
  size: number
  compact?: boolean
  owned?: boolean
  selected?: boolean
  onNavigate?: (path: string) => void
  className?: string
}

export function LandingTcgCard({ palId, size, compact = false, owned = false, selected = false, onNavigate, className }: LandingTcgCardProps) {
  const db = loadDatabase()
  const pal = db.palById.get(palId)
  if (!pal) return null

  const build = getBuildsFor(palId)[0]
  const passives = (build?.passives ?? [])
    .map((id) => db.passiveById.get(id))
    .filter((p): p is NonNullable<typeof p> => !!p)
    .map((p) => ({ label: passiveName(p), rank: p.rank }))

  const work = pal.work.slice(0, 2).map(({ type, value }) => ({
    icon: workIconUrl(type),
    label: workTypeLabel(type),
    level: value,
  }))

  const href = `/pals/${palSlug(pal)}`
  const scale = size / NATIVE_WIDTH
  const height = size * (NATIVE_HEIGHT / NATIVE_WIDTH)

  return (
    <a
      href={href}
      className={cn('landing-tcg-card', className)}
      style={{ width: size, height }}
      onClick={(event) => {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
        if (!onNavigate) return
        event.preventDefault()
        onNavigate(href)
      }}
    >
      <PalCard
        palName={palName(pal)}
        element={pal.elements[0] ?? 'neutral'}
        rarity={pal.rarity}
        code={dexLabel(pal)}
        palId={pal.id}
        work={work}
        passives={passives}
        probability={100}
        isCross={false}
        compact={compact}
        owned={owned}
        selected={selected}
        style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}
      />
    </a>
  )
}
