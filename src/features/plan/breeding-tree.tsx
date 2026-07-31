import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Crown,
  Droplets,
  Egg,
  Flame,
  FlaskConical,
  Hammer,
  Maximize2,
  Package,
  Percent,
  Pickaxe,
  Snowflake,
  Sprout,
  Swords,
  Target,
  TreePine,
  Truck,
  Wheat,
  Zap,
  ZoomIn,
  ZoomOut,
  type LucideIcon,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PalIcon } from '@/components/pal-icon'
import { PassiveBadge } from '@/components/passive-badge'
import { loadDatabase, palName, workTypeLabel } from '@/domain/database'
import { rarityInfo, type RarityTier } from '@/domain/rarity'
import type { Pal, PlanNode, WorkType } from '@/domain/types'
import { cn, formatNumber, formatPercent } from '@/lib/utils'
import { chanceTone, collectKeys, countBreedNodes, enumerateSteps } from './plan-utils'

const ZOOM_STEPS = [0.4, 0.55, 0.7, 0.85, 1, 1.15, 1.3]

export function BreedingTree({ root }: { root: PlanNode }) {
  const steps = useMemo(() => enumerateSteps(root), [root])
  const allKeys = useMemo(() => collectKeys(root), [root])
  // Se guarda lo PLEGADO: por defecto el arbol entero esta abierto.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [zoomIndex, setZoomIndex] = useState(4)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [spaceHeld, setSpaceHeld] = useState(false)
  const [dragStart, setDragStart] = useState<{ x: number; y: number; panX: number; panY: number } | null>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const treeRef = useRef<HTMLDivElement>(null)

  const zoomIn = () => setZoomIndex((i) => Math.min(ZOOM_STEPS.length - 1, i + 1))
  const zoomOut = () => setZoomIndex((i) => Math.max(0, i - 1))
  const centerTree = () => setPan({ x: 0, y: 0 })
  const fitTree = () => {
    const viewport = viewportRef.current
    const tree = treeRef.current
    if (!viewport || !tree) return
    const fittingZoom = Math.min(
      1.15,
      Math.max(0.4, Math.min((viewport.clientWidth - 48) / tree.offsetWidth, (viewport.clientHeight - 48) / tree.offsetHeight)),
    )
    const closest = ZOOM_STEPS.reduce((best, value, index) =>
      Math.abs(value - fittingZoom) < Math.abs(ZOOM_STEPS[best] - fittingZoom) ? index : best, 0)
    setZoomIndex(closest)
    centerTree()
  }

  // Un plan nuevo vuelve a empezar expandido.
  useEffect(() => {
    setCollapsed(new Set())
    setZoomIndex(4)
    centerTree()
  }, [root])

  useEffect(() => {
    const updateSpace = (event: KeyboardEvent) => {
      if (event.code === 'Space') setSpaceHeld(event.type === 'keydown')
    }
    window.addEventListener('keydown', updateSpace)
    window.addEventListener('keyup', updateSpace)
    const releaseSpace = () => setSpaceHeld(false)
    window.addEventListener('blur', releaseSpace)
    return () => {
      window.removeEventListener('keydown', updateSpace)
      window.removeEventListener('keyup', updateSpace)
      window.removeEventListener('blur', releaseSpace)
    }
  }, [])

  const centerNode = (element: HTMLElement) => {
    const viewport = viewportRef.current
    if (!viewport) return
    const viewportRect = viewport.getBoundingClientRect()
    const nodeRect = element.getBoundingClientRect()
    setPan((current) => ({
      x: current.x + viewportRect.left + viewportRect.width / 2 - (nodeRect.left + nodeRect.width / 2),
      y: current.y + viewportRect.top + viewportRect.height / 2 - (nodeRect.top + nodeRect.height / 2),
    }))
  }

  const toggle = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  return (
    <Card className="overflow-hidden border-border/80 shadow-md">
      <CardHeader className="gap-3 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base font-bold">Arbol de crianza</CardTitle>
          <div className="flex flex-wrap items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              title="Zoom Out (Ctrl + rueda)"
              disabled={zoomIndex === 0}
              onClick={zoomOut}
            >
              <ZoomOut className="size-3.5" />
              Zoom Out
            </Button>
            <span className="w-10 text-center font-mono text-[11px] text-muted-foreground">
              {Math.round(ZOOM_STEPS[zoomIndex] * 100)} %
            </span>
            <Button
              variant="outline"
              size="sm"
              title="Zoom In (Ctrl + rueda)"
              disabled={zoomIndex === ZOOM_STEPS.length - 1}
              onClick={zoomIn}
            >
              <ZoomIn className="size-3.5" />
              Zoom In
            </Button>
            <Button variant="outline" size="sm" title="Ajustar todo el árbol" onClick={fitTree}>
              <Maximize2 className="size-3.5" />
              Fit Tree
            </Button>
            <Button variant="outline" size="sm" title="Centrar el árbol" onClick={centerTree}>
              <Target className="size-3.5" />
              Center Tree
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
      <CardContent
        ref={viewportRef}
        onWheel={(event) => {
          if (!event.ctrlKey) return
          event.preventDefault()
          event.deltaY > 0 ? zoomOut() : zoomIn()
        }}
        onPointerDown={(event) => {
          if (!spaceHeld || event.button !== 0) return
          event.preventDefault()
          event.currentTarget.setPointerCapture(event.pointerId)
          setDragStart({ x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y })
        }}
        onPointerMove={(event) => {
          if (!dragStart) return
          setPan({ x: dragStart.panX + event.clientX - dragStart.x, y: dragStart.panY + event.clientY - dragStart.y })
        }}
        onPointerUp={() => setDragStart(null)}
        onPointerCancel={() => setDragStart(null)}
        className={cn(
          'relative overflow-hidden bg-[radial-gradient(var(--color-border)_1px,transparent_1px)] bg-[length:22px_22px] bg-[position:-11px_-11px] p-8 sm:p-10',
          spaceHeld ? 'cursor-grab' : '',
          dragStart ? 'cursor-grabbing select-none' : '',
        )}
        style={{ minHeight: '22rem' }}
      >
        <div
          ref={treeRef}
          className="flex min-h-full w-max min-w-full justify-center pb-12 pt-4 transition-transform duration-300 ease-out"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${ZOOM_STEPS[zoomIndex]})`, transformOrigin: 'center top' }}
        >
          <div className="flex w-full justify-center">
            <TreeNode node={root} steps={steps} collapsed={collapsed} onToggle={toggle} onCenter={centerNode} isRoot />
          </div>
        </div>
        <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-border bg-card/90 px-3 py-1 text-[10px] text-muted-foreground shadow-sm">
          Ctrl + rueda: zoom · Espacio + arrastrar: mover · Doble clic: centrar nodo
        </p>
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
  onCenter: (element: HTMLElement) => void
  isRoot?: boolean
}

function TreeNode({ node, steps, collapsed, onToggle, onCenter, isRoot = false }: TreeNodeProps) {
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
        onCenter={onCenter}
      />

      {isBreed && parents && isOpen && (
        <>
          {/* tronco que baja del hijo hasta la union de las dos ramas */}
          <div className="tree-connector h-9 w-px bg-border" />
          {/*
            Cada rama ocupa su ancho natural (forzarlas iguales duplicaria el
            ancho en cada nivel). La barra horizontal va del centro de un padre
            al del otro, y el centro de la fila -donde baja el tronco del hijo-
            siempre cae entre ambos, asi que el tronco aterriza en la barra.
          */}
          <div className="relative flex items-start">
            {/* El "+" marca donde se juntan los dos padres para dar el Pal de arriba. */}
            <span className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border bg-card px-1.5 py-px text-[11px] font-bold leading-none text-muted-foreground shadow-sm">
              +
            </span>
            {parents.map((parent, index) => (
              <div
                key={parent.key}
                className={cn(
                  'relative flex flex-col items-center px-4 pt-9',
                  // rama vertical que sube desde este padre hasta la barra horizontal
                  'before:absolute before:left-1/2 before:top-0 before:h-9 before:w-px before:bg-border before:content-[\'\']',
                  // media barra horizontal; las dos mitades se encuentran en el centro
                  index === 0
                    ? 'after:absolute after:left-1/2 after:right-0 after:top-0 after:h-px after:bg-border after:content-[\'\']'
                    : 'after:absolute after:left-0 after:right-1/2 after:top-0 after:h-px after:bg-border after:content-[\'\']',
                )}
              >
                <TreeNode node={parent} steps={steps} collapsed={collapsed} onToggle={onToggle} onCenter={onCenter} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/** Icono representativo por tipo de trabajo, para el chip de aptitud de la tarjeta. */
const WORK_ICONS: Record<WorkType, LucideIcon> = {
  Kindling: Flame,
  Watering: Droplets,
  Planting: Sprout,
  GenerateElectricity: Zap,
  Handiwork: Hammer,
  Gathering: Package,
  Lumbering: TreePine,
  Mining: Pickaxe,
  MedicineProduction: FlaskConical,
  Cooling: Snowflake,
  Transporting: Truck,
  Farming: Wheat,
}

/**
 * Anillo + tinte de fondo del retrato segun la rareza (1-20, ver domain/rarity.ts).
 * Reutiliza las mismas familias de color que ya usan los badges de la app
 * (emerald/sky/violet/amber/rose), asi no se introduce una paleta nueva.
 */
const RARITY_RING: Record<RarityTier, string> = {
  1: 'ring-border bg-muted/60',
  2: 'ring-emerald-500/40 bg-emerald-500/10',
  3: 'ring-sky-500/40 bg-sky-500/10',
  4: 'ring-violet-500/40 bg-violet-500/10',
  5: 'ring-amber-500/50 bg-amber-500/10',
  6: 'ring-rose-500/50 bg-rose-500/10',
}

interface NodeCardProps {
  node: PlanNode
  step: number | undefined
  isRoot: boolean
  isOpen: boolean
  onToggle: () => void
  onCenter: (element: HTMLElement) => void
}

function NodeCard({ node, step, isRoot, isOpen, onToggle, onCenter }: NodeCardProps) {
  const db = loadDatabase()
  const pal = db.palById.get(node.palId)
  const isBreed = node.kind === 'breed'
  const hidden = isBreed && !isOpen ? countBreedNodes(node) : 0
  const rarity = pal ? rarityInfo(pal.rarity) : null
  const bestWork = pal?.work[0]
  const WorkIcon = bestWork ? WORK_ICONS[bestWork.type] : null

  const tone = isRoot
    ? 'border-primary/60 bg-primary/10 ring-1 ring-primary/30'
    : node.kind === 'owned'
      ? 'border-emerald-500/40 bg-emerald-500/5'
      : node.kind === 'capture'
        ? 'border-amber-500/40 bg-amber-500/5'
        : 'border-border bg-card'

  const Wrapper = isBreed ? 'button' : 'div'

  return (
    <div
      onDoubleClick={(event) => onCenter(event.currentTarget)}
      className={cn(
        'tree-node-card relative w-52 rounded-2xl border px-3.5 pb-3 pt-4 text-center shadow-md shadow-black/5 transition-all duration-200',
        isBreed && 'hover:scale-[1.02] hover:shadow-lg hover:shadow-primary/10',
        tone,
      )}
    >
      {isRoot && (
        <Crown className="absolute -top-3.5 left-1/2 size-6 -translate-x-1/2 fill-primary/30 text-primary drop-shadow-sm" />
      )}

      <Wrapper
        type={isBreed ? 'button' : undefined}
        onClick={isBreed ? onToggle : undefined}
        aria-expanded={isBreed ? isOpen : undefined}
        aria-label={
          isBreed ? (isOpen ? `Plegar los padres de ${palName(pal)}` : `Ver los padres de ${palName(pal)}`) : undefined
        }
        className={cn(
          'flex w-full flex-col items-center gap-2 rounded-lg',
          isBreed && 'cursor-pointer -mt-0.5 pt-0.5 transition-colors hover:bg-accent/40',
        )}
      >
        <span
          className={cn(
            'relative flex size-16 items-center justify-center overflow-hidden rounded-xl ring-2',
            rarity ? RARITY_RING[rarity.tier] : 'ring-border bg-muted/60',
          )}
          title={rarity ? `Rareza: ${rarity.label}` : undefined}
        >
          <PalIcon palId={node.palId} size={60} className="rounded-none bg-transparent ring-0" />
        </span>

        <span className="flex items-center gap-1 text-sm font-semibold leading-tight">
          {palName(pal)}
          {isBreed &&
            (isOpen ? (
              <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
            ))}
        </span>

        <div className="flex flex-wrap items-center justify-center gap-1.5">
          <RoleBadge node={node} step={step} isRoot={isRoot} pal={pal} />
          {bestWork && WorkIcon && (
            <span
              className="flex items-center gap-0.5 rounded-md border border-border bg-background/60 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground"
              title={`Aptitud de trabajo: ${workTypeLabel(bestWork.type)} (nivel ${bestWork.value})`}
            >
              <WorkIcon className="size-3" />
              {bestWork.value}
            </span>
          )}
        </div>
      </Wrapper>

      {node.passives.length > 0 && (
        <ul className="mt-2.5 flex flex-wrap justify-center gap-1">
          {node.passives.map((id) => (
            <li key={id}>
              <PassiveBadge passive={db.passiveById.get(id)} />
            </li>
          ))}
        </ul>
      )}

      {isBreed && node.successChance !== undefined && (
        <div className="mt-2.5 flex items-center justify-center gap-2 border-t border-border/60 pt-2 text-[11px]">
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
          className="mt-2.5 w-full rounded-md border border-dashed border-border py-1 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
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
