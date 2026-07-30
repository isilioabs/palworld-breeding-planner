import { useEffect, useMemo, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Crown,
  Egg,
  Maximize2,
  Package,
  Percent,
  Swords,
  Target,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PalIcon } from '@/components/pal-icon'
import { loadDatabase, palName, passiveName, passiveSummary } from '@/domain/database'
import type { Pal, PlanNode } from '@/domain/types'
import { cn, formatNumber, formatPercent } from '@/lib/utils'
import { chanceTone, collectKeys, countBreedNodes, enumerateSteps } from './plan-utils'

const ZOOM_STEPS = [0.5, 0.65, 0.8, 1, 1.2]

export function BreedingTree({ root }: { root: PlanNode }) {
  const steps = useMemo(() => enumerateSteps(root), [root])
  const allKeys = useMemo(() => collectKeys(root), [root])
  // Se guarda lo PLEGADO: por defecto el arbol entero esta abierto.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [zoomIndex, setZoomIndex] = useState(3)

  // Un plan nuevo vuelve a empezar expandido.
  useEffect(() => setCollapsed(new Set()), [root])

  const toggle = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Arbol de crianza</CardTitle>
          <div className="flex flex-wrap items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Alejar"
              disabled={zoomIndex === 0}
              onClick={() => setZoomIndex((i) => Math.max(0, i - 1))}
            >
              <ZoomOut className="size-3.5" />
            </Button>
            <span className="w-11 text-center font-mono text-[11px] text-muted-foreground">
              {Math.round(ZOOM_STEPS[zoomIndex] * 100)} %
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Acercar"
              disabled={zoomIndex === ZOOM_STEPS.length - 1}
              onClick={() => setZoomIndex((i) => Math.min(ZOOM_STEPS.length - 1, i + 1))}
            >
              <ZoomIn className="size-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Restablecer zoom"
              onClick={() => setZoomIndex(3)}
            >
              <Maximize2 className="size-3.5" />
            </Button>
            <span className="mx-1 h-5 w-px bg-border" />
            <Button variant="ghost" size="sm" onClick={() => setCollapsed(new Set())}>
              Expandir todo
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setCollapsed(new Set(allKeys))}>
              Plegar todo
            </Button>
          </div>
        </div>
        <Legend />
      </CardHeader>
      <CardContent className="overflow-x-auto pb-5 pt-4">
        {/*
          `zoom` (y no `transform`) para que el contenedor siga midiendo bien.
          `w-max min-w-full`: el bloque crece hasta el ancho natural del arbol
          (y entonces el scroll horizontal funciona) pero nunca baja del ancho
          disponible, de modo que `justify-center` puede centrarlo cuando cabe.
        */}
        <div className="w-max min-w-full" style={{ zoom: ZOOM_STEPS[zoomIndex] }}>
          <div className="flex justify-center">
            <TreeNode node={root} steps={steps} collapsed={collapsed} onToggle={toggle} isRoot />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function Legend() {
  const items = [
    { icon: Crown, label: 'Objetivo', className: 'text-primary' },
    { icon: Egg, label: 'Lo crias tu', className: 'text-sky-400' },
    { icon: Package, label: 'Ya lo tienes', className: 'text-emerald-400' },
    { icon: Swords, label: 'Hay que capturarlo', className: 'text-amber-400' },
  ]
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
      <span>Se lee de arriba abajo: cada Pal cuelga de los dos padres que lo producen.</span>
      {items.map(({ icon: Icon, label, className }) => (
        <span key={label} className="flex items-center gap-1">
          <Icon className={cn('size-3', className)} />
          {label}
        </span>
      ))}
    </div>
  )
}

interface TreeNodeProps {
  node: PlanNode
  steps: Map<string, number>
  collapsed: Set<string>
  onToggle: (key: string) => void
  isRoot?: boolean
}

function TreeNode({ node, steps, collapsed, onToggle, isRoot = false }: TreeNodeProps) {
  const isBreed = node.kind === 'breed'
  const isOpen = !collapsed.has(node.key)
  const parents = node.parents

  return (
    <div className="flex flex-col items-center">
      <NodeCard
        node={node}
        step={steps.get(node.key)}
        isRoot={isRoot}
        isOpen={isOpen}
        onToggle={() => onToggle(node.key)}
      />

      {isBreed && parents && isOpen && (
        <>
          {/* tronco que baja del hijo hasta la union de las dos ramas */}
          <div className="h-7 w-px bg-border" />
          {/*
            Cada rama ocupa su ancho natural (forzarlas iguales duplicaria el
            ancho en cada nivel). La barra horizontal va del centro de un padre
            al del otro, y el centro de la fila -donde baja el tronco del hijo-
            siempre cae entre ambos, asi que el tronco aterriza en la barra.
          */}
          <div className="relative flex items-start">
            {/* El "+" marca donde se juntan los dos padres para dar el Pal de arriba. */}
            <span className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border bg-card px-1.5 py-px text-[11px] font-bold leading-none text-muted-foreground">
              +
            </span>
            {parents.map((parent, index) => (
              <div
                key={parent.key}
                className={cn(
                  'relative flex flex-col items-center px-3 pt-7',
                  // rama vertical que sube desde este padre hasta la barra horizontal
                  'before:absolute before:left-1/2 before:top-0 before:h-7 before:w-px before:bg-border',
                  // media barra horizontal; las dos mitades se encuentran en el centro
                  index === 0
                    ? 'after:absolute after:left-1/2 after:right-0 after:top-0 after:h-px after:bg-border'
                    : 'after:absolute after:left-0 after:right-1/2 after:top-0 after:h-px after:bg-border',
                )}
              >
                <TreeNode node={parent} steps={steps} collapsed={collapsed} onToggle={onToggle} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

interface NodeCardProps {
  node: PlanNode
  step: number | undefined
  isRoot: boolean
  isOpen: boolean
  onToggle: () => void
}

function NodeCard({ node, step, isRoot, isOpen, onToggle }: NodeCardProps) {
  const db = loadDatabase()
  const pal = db.palById.get(node.palId)
  const isBreed = node.kind === 'breed'
  const hidden = isBreed && !isOpen ? countBreedNodes(node) : 0

  const tone = isRoot
    ? 'border-primary/60 bg-primary/10 ring-1 ring-primary/30'
    : node.kind === 'owned'
      ? 'border-emerald-500/40 bg-emerald-500/5'
      : node.kind === 'capture'
        ? 'border-amber-500/40 bg-amber-500/5'
        : 'border-border bg-card'

  return (
    <div className={cn('relative w-44 rounded-xl border px-3 pb-2.5 pt-3 text-center shadow-sm', tone)}>
      {isRoot && (
        <Crown className="absolute -top-3 left-1/2 size-5 -translate-x-1/2 fill-primary/30 text-primary" />
      )}

      {isBreed && (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          aria-label={isOpen ? `Plegar los padres de ${palName(pal)}` : `Ver los padres de ${palName(pal)}`}
          className="absolute right-1.5 top-1.5 rounded-md p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          {isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </button>
      )}

      <div className="flex flex-col items-center gap-1.5">
        <PalIcon palId={node.palId} size={52} />
        <span className="text-sm font-semibold leading-tight">{palName(pal)}</span>
        <RoleBadge node={node} step={step} isRoot={isRoot} pal={pal} />
      </div>

      {node.passives.length > 0 && (
        <ul className="mt-2 flex flex-wrap justify-center gap-1">
          {node.passives.map((id) => (
            <li key={id}>
              <Badge
                variant="good"
                className="text-[10px] leading-tight"
                title={`${passiveName(db.passiveById.get(id))}\n${passiveSummary(db.passiveById.get(id))}`}
              >
                {passiveName(db.passiveById.get(id))}
              </Badge>
            </li>
          ))}
        </ul>
      )}

      {isBreed && node.successChance !== undefined && (
        <div className="mt-2 flex items-center justify-center gap-2 border-t border-border/60 pt-1.5 text-[11px]">
          <span
            className={cn(
              'flex items-center gap-0.5 font-semibold tabular-nums',
              chanceTone(node.successChance) === 'good'
                ? 'text-emerald-400'
                : chanceTone(node.successChance) === 'warn'
                  ? 'text-amber-400'
                  : 'text-rose-400',
            )}
            title="Probabilidad de que un huevo salga con todas las pasivas pedidas"
          >
            <Percent className="size-3" />
            {formatPercent(node.successChance)}
          </span>
          <span className="h-3 w-px bg-border" />
          <span
            className="flex items-center gap-1 tabular-nums text-muted-foreground"
            title="Huevos estimados para este cruce"
          >
            <Egg className="size-3" />
            {formatNumber(node.expectedEggs ?? 0)}
          </span>
        </div>
      )}

      {node.genderRequirement && (
        <Badge variant="warn" className="mt-1.5 text-[10px]">
          {node.genderRequirement.a === 'MALE' ? 'macho' : 'hembra'} +{' '}
          {node.genderRequirement.b === 'MALE' ? 'macho' : 'hembra'}
        </Badge>
      )}

      {hidden > 0 && (
        <button
          type="button"
          onClick={onToggle}
          className="mt-2 w-full rounded-md border border-dashed border-border py-1 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          + {hidden} {hidden === 1 ? 'cruce oculto' : 'cruces ocultos'}
        </button>
      )}
    </div>
  )
}

function RoleBadge({
  node,
  step,
  isRoot,
  pal,
}: {
  node: PlanNode
  step: number | undefined
  isRoot: boolean
  pal: Pal | undefined
}) {
  if (isRoot) {
    return (
      <Badge className="gap-1 text-[10px] uppercase tracking-wide">
        <Target className="size-3" />
        Tu objetivo
      </Badge>
    )
  }
  if (node.kind === 'owned') {
    return (
      <Badge variant="good" className="gap-1 text-[10px] uppercase tracking-wide">
        <Package className="size-3" />
        Ya lo tienes
      </Badge>
    )
  }
  if (node.kind === 'capture') {
    return (
      <Badge variant="warn" className="gap-1 text-[10px] uppercase tracking-wide">
        <Swords className="size-3" />
        Capturar{pal?.wild ? ` nv ${pal.wild[0]}-${pal.wild[1]}` : ''}
      </Badge>
    )
  }
  return (
    <Badge variant="secondary" className="gap-1 text-[10px] uppercase tracking-wide">
      <Egg className="size-3 text-sky-400" />
      Criar{step !== undefined ? ` · paso ${step}` : ''}
    </Badge>
  )
}
