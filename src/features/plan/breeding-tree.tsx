import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Crown, Egg, Maximize2, Package, Sparkle, Swords, Target, ZoomIn, ZoomOut } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PalIcon } from '@/components/pal-icon'
import { RichTooltip } from '@/components/rich-tooltip'
import { loadDatabase, palName, passiveName, workTypeLabel } from '@/domain/database'
import { ELEMENT_INFO } from '@/domain/element'
import { useT } from '@/i18n/language-store'
import { usePokedex } from '@/features/pokedex/pokedex-panel'
import type { PlanNode, WorkType } from '@/domain/types'
import { cn } from '@/lib/utils'
import { collectKeys, countBreedNodes } from './plan-utils'

const ZOOM_STEPS = [0.2, 0.28, 0.4, 0.55, 0.7, 0.85, 1, 1.15, 1.3]
const MIN_ZOOM = ZOOM_STEPS[0]
const MAX_ZOOM = ZOOM_STEPS[ZOOM_STEPS.length - 1]
const DEFAULT_ZOOM = 1
const COMPACT_CARD_ZOOM = 0.3

const WORK_ICON_FILE: Record<WorkType, string> = {
  Kindling: 'Kindling',
  Watering: 'Watering',
  Planting: 'Planting',
  GenerateElectricity: 'ElectricityGeneration',
  Handiwork: 'Handiwork',
  Gathering: 'Gathering',
  Lumbering: 'Lumbering',
  Mining: 'Mining',
  MedicineProduction: 'MedicineProduction',
  Cooling: 'Cooling',
  Transporting: 'Transporting',
  Farming: 'Farming',
}

/**
 * "Ajustar todo el arbol" YA NO redondea al escalon mas cercano: entre 0.16 y
 * 0.2, por ejemplo, hay hueco de sobra sin usar (el arbol cabria con un 0.19
 * pero se forzaba al escalon inferior, dejando un marco vacio notorio en
 * arboles altos). fitTree ahora guarda el zoom EXACTO que hace falta; los
 * escalones de ZOOM_STEPS solo se usan para +/- (rueda y botones), que sí
 * deben moverse en saltos predecibles desde donde sea que haya caido el fit.
 */
const nextZoomStepUp = (zoom: number) => ZOOM_STEPS.find((step) => step > zoom + 0.001) ?? MAX_ZOOM
const nextZoomStepDown = (zoom: number) => [...ZOOM_STEPS].reverse().find((step) => step < zoom - 0.001) ?? MIN_ZOOM

/** Alto minimo de la cabecera de la app (min-h-16). */
const APP_HEADER_HEIGHT = 64
const CANVAS_MIN_HEIGHT = 420
const CANVAS_BOTTOM_GAP = 24

/**
 * Margenes que usa `fitTree()` para dejar sitio a la interfaz flotante que
 * vive DENTRO del canvas (no participa del layout, asi que nada la reserva
 * automaticamente): la barra de zoom arriba a la derecha, y la leyenda +
 * franja de instrucciones pegadas abajo. `clientWidth`/`clientHeight` ya
 * incluyen el padding propio del canvas (p-8/p-10 = 32-40px por lado), asi
 * que estos numeros son ADEMAS de ese padding, no en su lugar.
 */
const FIT_SIDE_GAP = 48
const FIT_TOP_GAP = 24
const FIT_BOTTOM_GAP = 64

/** Limita el escalonado visual: los arboles profundos siguen revelandose en
 * menos de 400 ms y no retienen capas de composicion despues de aparecer. */
function maxPlanDepth(node: PlanNode): number {
  return Math.max(node.depth, ...(node.parents?.map(maxPlanDepth) ?? []))
}

export function BreedingTree({ root, roots }: { root?: PlanNode; roots?: PlanNode[] }) {
  const t = useT()
  const projectRoots = useMemo(() => roots?.length ? roots : root ? [root] : [], [root, roots])
  const allKeys = useMemo(() => projectRoots.flatMap((projectRoot) => collectKeys(projectRoot)), [projectRoots])
  const revealDepth = useMemo(() => Math.max(0, ...projectRoots.map(maxPlanDepth)), [projectRoots])
  // Se guarda lo PLEGADO: por defecto el arbol entero esta abierto.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [zoom, setZoom] = useState(DEFAULT_ZOOM)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [dragStart, setDragStart] = useState<{ x: number; y: number; panX: number; panY: number } | null>(null)
  const [canvasHeight, setCanvasHeight] = useState<number | null>(null)
  // Cierto solo mientras la transicion CSS de zoom/encuadre esta corriendo
  // (ver beginZoomAnimation): promociona el arbol a su propia capa de GPU
  // nada mas que para esa animacion, para que escalar un arbol grande no
  // obligue al navegador a repintar decenas de cartas en cada frame. No se
  // deja encendido siempre a proposito -eso fue justo lo que colgo el
  // arrastre antes- ni se activa nunca durante el arrastre (son caminos de
  // estado totalmente separados: arrastrar jamas llama a esta funcion).
  const [zooming, setZooming] = useState(false)
  const zoomEndTimerRef = useRef<number | null>(null)
  const panFrameRef = useRef<number | null>(null)
  const wheelFrameRef = useRef<number | null>(null)
  const wheelDeltaRef = useRef(0)
  const panRef = useRef(pan)
  const zoomRef = useRef(zoom)
  const cardRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const treeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    panRef.current = pan
  }, [pan])
  useEffect(() => {
    zoomRef.current = zoom
  }, [zoom])

  const writeTreeTransform = (nextPan = panRef.current, nextZoom = zoomRef.current) => {
    const tree = treeRef.current
    if (tree) tree.style.transform = `translate3d(${nextPan.x}px, ${nextPan.y}px, 0) scale(${nextZoom})`
  }

  const beginZoomAnimation = () => {
    setZooming(true)
    if (zoomEndTimerRef.current != null) window.clearTimeout(zoomEndTimerRef.current)
    // La animacion es corta a proposito: una transicion larga mientras se
    // escalan muchos nodos se percibe como lag aunque el compositor mantenga
    // los FPS. El boton sigue teniendo respuesta visual, sin arrastrar la UI.
    zoomEndTimerRef.current = window.setTimeout(() => setZooming(false), 190)
  }

  /**
   * El canvas debe llenar TODO lo que queda de la pantalla por debajo de la
   * cabecera de la app y de la propia cabecera de esta tarjeta -no un alto
   * fijo en rem-, para que "Arbol de crianza" ocupe la pantalla como en
   * Figma/Miro en vez de ser una caja pequena en medio de una pagina larga.
   * Se calcula a partir de alturas conocidas (no de la posicion de scroll
   * actual) para que el resultado sea el mismo antes y despues de que
   * termine la animacion de scroll.
   */
  const updateCanvasHeight = () => {
    const headerHeight = headerRef.current?.getBoundingClientRect().height ?? 0
    const available = window.innerHeight - APP_HEADER_HEIGHT - headerHeight - CANVAS_BOTTOM_GAP
    setCanvasHeight(Math.max(CANVAS_MIN_HEIGHT, available))
  }

  useEffect(() => {
    updateCanvasHeight()
    window.addEventListener('resize', updateCanvasHeight)
    return () => window.removeEventListener('resize', updateCanvasHeight)
  }, [])

  const zoomIn = () => {
    beginZoomAnimation()
    setZoom((z) => {
      const next = nextZoomStepUp(z)
      zoomRef.current = next
      return next
    })
  }
  const zoomOut = () => {
    beginZoomAnimation()
    setZoom((z) => {
      const next = nextZoomStepDown(z)
      zoomRef.current = next
      return next
    })
  }

  /**
   * Pan que centra el arbol (ancho/alto natural x `scale`) dentro del
   * viewport, calculado a mano en vez de fiarse del centrado por flex: con
   * `transform-origin: 0 0` el arbol renderizado ocupa exactamente
   * `offsetWidth*scale x offsetHeight*scale` empezando en (0,0), asi que
   * centrarlo es solo repartir el espacio sobrante a partes iguales por eje.
   * Recibe `scale` en vez de leerlo de `zoom` para poder usarse desde
   * `fitTree()` con el zoom que se ACABA de calcular, sin esperar al rerender.
   */
  const centeredPanForScale = (scale: number) => {
    const viewport = viewportRef.current
    const tree = treeRef.current
    if (!viewport || !tree) return { x: 0, y: 0 }
    const x = (viewport.clientWidth - tree.offsetWidth * scale) / 2
    const y = (viewport.clientHeight - tree.offsetHeight * scale) / 2
    return { x, y }
  }

  const centerTree = () => {
    beginZoomAnimation()
    const nextPan = centeredPanForScale(zoom)
    panRef.current = nextPan
    setPan(nextPan)
  }

  /**
   * Ancla el arbol arriba en vez de centrarlo en Y: `clientWidth`/`clientHeight`
   * YA incluyen el padding propio del canvas (p-8/p-10), asi que repartir el
   * sobrante con /2 sub-contaba ese padding y encima partia el hueco en dos
   * mitades iguales arriba y abajo. Con un arbol mucho mas ancho que alto eso
   * dejaba un hueco vacio bien visible ENCIMA del objetivo. Ahora el objetivo
   * queda pegado arriba (justo bajo la barra flotante) y el sobrante -si lo
   * hay- se queda abajo, donde ya vive la barra de instrucciones.
   */
  const topAnchoredPanForScale = (scale: number) => {
    const viewport = viewportRef.current
    const tree = treeRef.current
    if (!viewport || !tree) return { x: 0, y: 0 }
    const x = Math.max(0, (viewport.clientWidth - tree.offsetWidth * scale) / 2)
    return { x, y: FIT_TOP_GAP }
  }

  /** Encoge el zoom lo justo para que el arbol ENTERO quepa en el panel, y lo ancla arriba. */
  const fitTree = () => {
    const viewport = viewportRef.current
    const tree = treeRef.current
    if (!viewport || !tree) return
    // El suelo es MIN_ZOOM, no un 0.4 fijo: con cartas de 780x1000, un arbol
    // de solo 2 niveles ya puede necesitar menos de eso para caber entero. El
    // zoom resultante es EXACTO (no se redondea a un escalon de ZOOM_STEPS):
    // redondear hacia abajo dejaba hueco vacio sin usar en arboles altos.
    // El margen vertical reserva sitio para la barra flotante de arriba
    // (FIT_TOP_GAP) y para la barra de instrucciones/leyenda que vive pegada
    // al borde inferior (FIT_BOTTOM_GAP): sin esto el calculo asumia que el
    // arbol podia usar TODO el alto del canvas, y la fila de abajo terminaba
    // tapada por esa barra aunque el arbol "cupiera" segun la cuenta.
    const fittingZoom = Math.min(
      1.15,
      Math.max(
        MIN_ZOOM,
        Math.min(
          (viewport.clientWidth - FIT_SIDE_GAP) / tree.offsetWidth,
          (viewport.clientHeight - FIT_TOP_GAP - FIT_BOTTOM_GAP) / tree.offsetHeight,
        ),
      ),
    )
    beginZoomAnimation()
    zoomRef.current = fittingZoom
    setZoom(fittingZoom)
    const nextPan = topAnchoredPanForScale(fittingZoom)
    panRef.current = nextPan
    setPan(nextPan)
  }

  // Un plan nuevo vuelve a empezar expandido y encuadrado por completo: con
  // rutas de varias generaciones, empezar a 100% deja la mayoria fuera de
  // vista. Ademas el usuario nunca deberia tener que buscar el arbol a mano:
  // en cuanto hay un resultado, la pagina baja sola hasta el.
  useEffect(() => {
    setCollapsed(new Set())
    updateCanvasHeight()
    cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    // requestAnimationFrame depende del compositor (no dispara en pestañas en
    // segundo plano o sin pintar); un timeout corto mide igual de bien tras el
    // commit y no depende de eso.
    const timer = window.setTimeout(() => fitTree(), 30)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [root, roots])

  // El zoom con Ctrl+rueda debe quedarse DENTRO del arbol. React registra sus
  // listeners de wheel como pasivos por defecto, asi que un event.preventDefault()
  // en un onWheel normal no evita que el navegador haga zoom de toda la
  // pagina: hace falta un listener nativo no-pasivo para poder bloquearlo.
  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const handleWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return
      event.preventDefault()
      wheelDeltaRef.current += event.deltaY
      if (wheelFrameRef.current != null) return
      wheelFrameRef.current = window.requestAnimationFrame(() => {
        const direction = wheelDeltaRef.current
        wheelDeltaRef.current = 0
        wheelFrameRef.current = null
        // La rueda/trackpad actualiza un maximo de una vez por frame y sin
        // transicion CSS. Esto evita encadenar transiciones de 450 ms cuando
        // el usuario hace varios pasos seguidos.
        setZoom((z) => {
          const next = direction > 0 ? nextZoomStepDown(z) : nextZoomStepUp(z)
          zoomRef.current = next
          return next
        })
      })
    }
    viewport.addEventListener('wheel', handleWheel, { passive: false })
    return () => viewport.removeEventListener('wheel', handleWheel)
  }, [])

  useEffect(() => {
    return () => {
      if (zoomEndTimerRef.current != null) window.clearTimeout(zoomEndTimerRef.current)
      if (panFrameRef.current != null) window.cancelAnimationFrame(panFrameRef.current)
      if (wheelFrameRef.current != null) window.cancelAnimationFrame(wheelFrameRef.current)
    }
  }, [])

  // `useCallback` aqui no es cosmetico: es lo que permite que `React.memo` en
  // TreeNode/NodeCard funcione de verdad. Sin referencia estable, cada
  // pointermove del pan (60/s) recrearia esta funcion, el prop "cambiaria" en
  // cada nodo del arbol, y memo dejaria de servir para nada -exactamente el
  // caso que mas le interesa optimizar (arrastrar con un arbol grande).
  const centerNode = useCallback((element: HTMLElement) => {
    const viewport = viewportRef.current
    if (!viewport) return
    const viewportRect = viewport.getBoundingClientRect()
    const nodeRect = element.getBoundingClientRect()
    const nextPan = {
      x: panRef.current.x + viewportRect.left + viewportRect.width / 2 - (nodeRect.left + nodeRect.width / 2),
      y: panRef.current.y + viewportRect.top + viewportRect.height / 2 - (nodeRect.top + nodeRect.height / 2),
    }
    panRef.current = nextPan
    setPan(nextPan)
  }, [])

  const toggle = useCallback(
    (key: string) =>
      setCollapsed((prev) => {
        const next = new Set(prev)
        if (next.has(key)) next.delete(key)
        else next.add(key)
        return next
      }),
    [],
  )

  return (
    <Card ref={cardRef} className="overflow-hidden border-border/80 shadow-md">
      <CardHeader ref={headerRef} className="gap-0 py-2.5">
        <CardTitle className="text-base font-bold">{projectRoots.length > 1 ? t('tree.projectTitle') : t('tree.title')}</CardTitle>
      </CardHeader>
      <CardContent
        ref={viewportRef}
        onPointerDown={(event) => {
          // Click normal para mover el lienzo, como un panel tactil: solo se
          // ignora si el click empieza sobre un boton (expandir/plegar nodo,
          // "+N cruces ocultos"...), para que ese boton reciba su propio click.
          if (event.button !== 0 || (event.target as HTMLElement).closest('button')) return
          event.preventDefault()
          event.currentTarget.setPointerCapture(event.pointerId)
          setDragStart({ x: event.clientX, y: event.clientY, panX: panRef.current.x, panY: panRef.current.y })
        }}
        onPointerMove={(event) => {
          if (!dragStart) return
          panRef.current = { x: dragStart.panX + event.clientX - dragStart.x, y: dragStart.panY + event.clientY - dragStart.y }
          if (panFrameRef.current != null) return
          panFrameRef.current = window.requestAnimationFrame(() => {
            panFrameRef.current = null
            writeTreeTransform()
          })
        }}
        onPointerUp={() => {
          if (panFrameRef.current != null) window.cancelAnimationFrame(panFrameRef.current)
          panFrameRef.current = null
          writeTreeTransform()
          setPan(panRef.current)
          setDragStart(null)
        }}
        onPointerCancel={() => {
          if (panFrameRef.current != null) window.cancelAnimationFrame(panFrameRef.current)
          panFrameRef.current = null
          setPan(panRef.current)
          setDragStart(null)
        }}
        className={cn(
          'tree-canvas relative cursor-grab overflow-hidden p-8 sm:p-10',
          dragStart && 'cursor-grabbing select-none',
        )}
        style={{ height: canvasHeight ? `${canvasHeight}px` : undefined, minHeight: `${CANVAS_MIN_HEIGHT}px`, touchAction: 'none' }}
      >
        {/* Barra de controles flotante: no ocupa layout, vive sobre el canvas (estilo Figma/React Flow). */}
        <div className="pointer-events-none absolute right-3 top-3 z-20 flex flex-wrap items-center justify-end gap-1">
          <div className="tree-toolbar pointer-events-auto flex items-center gap-1 rounded-lg border border-border bg-card/95 p-1 shadow-md backdrop-blur-sm">
            <RichTooltip
              title={t('tree.zoomOutTitle')}
              description={t('tree.zoomOutDescription')}
              shortcut={t('tree.zoomShortcut')}
            >
              <Button variant="ghost" size="icon-sm" disabled={zoom <= MIN_ZOOM} onClick={zoomOut} aria-label={t('tree.zoomOutTitle')}>
                <ZoomOut className="size-3.5" aria-hidden="true" />
              </Button>
            </RichTooltip>
            <span className="w-9 text-center font-mono text-[11px] text-muted-foreground">
              {Math.round(zoom * 100)} %
            </span>
            <RichTooltip
              title={t('tree.zoomInTitle')}
              description={t('tree.zoomInDescription')}
              shortcut={t('tree.zoomShortcut')}
            >
              <Button variant="ghost" size="icon-sm" disabled={zoom >= MAX_ZOOM} onClick={zoomIn} aria-label={t('tree.zoomInTitle')}>
                <ZoomIn className="size-3.5" aria-hidden="true" />
              </Button>
            </RichTooltip>
            <span className="tree-toolbar__divider mx-0.5 h-5 w-px bg-border" aria-hidden="true" />
            <RichTooltip title={t('tree.fitTitle')} description={t('tree.fitDescription')}>
              <Button variant="ghost" size="icon-sm" onClick={fitTree} aria-label={t('tree.fitTitle')}>
                <Maximize2 className="size-3.5" aria-hidden="true" />
              </Button>
            </RichTooltip>
            <RichTooltip title={t('tree.centerTitle')} description={t('tree.centerDescription')}>
              <Button variant="ghost" size="icon-sm" onClick={centerTree} aria-label={t('tree.centerTitle')}>
                <Target className="size-3.5" aria-hidden="true" />
              </Button>
            </RichTooltip>
            <span className="tree-toolbar__divider mx-0.5 h-5 w-px bg-border" aria-hidden="true" />
            <RichTooltip title={t('tree.expandAllTitle')} description={t('tree.expandAllDescription')}>
              <Button variant="ghost" size="sm" onClick={() => setCollapsed(new Set())}>
                {t('tree.expandAll')}
              </Button>
            </RichTooltip>
            <RichTooltip title={t('tree.collapseAllTitle')} description={t('tree.collapseAllDescription')}>
              <Button variant="ghost" size="sm" onClick={() => setCollapsed(new Set(allKeys))}>
                {t('tree.collapseAll')}
              </Button>
            </RichTooltip>
          </div>
        </div>

        {/* Leyenda flotante: misma idea, en la esquina opuesta para no competir con los controles. */}
        <div className="pointer-events-none absolute bottom-3 left-3 z-20 hidden sm:block">
          <div className="pointer-events-auto rounded-lg border border-border bg-card/95 px-3 py-1.5 shadow-md backdrop-blur-sm">
            <Legend />
          </div>
        </div>

        {/*
          `inline-flex` (sin min-w-full/justify-center) para que encoja a su
          contenido de verdad: offsetWidth/offsetHeight tienen que reflejar el
          tamano NATURAL del arbol para que centeredPanForScale() pueda
          centrarlo a mano. Con transform-origin en la esquina, el arbol
          renderizado ocupa exactamente offsetWidth*scale x offsetHeight*scale
          empezando en (0,0): la unica fuente de "donde esta" es `pan`.
        */}
        <div
          ref={treeRef}
          className={cn(
            'relative z-10 inline-flex pb-12 pt-4',
            zooming && !dragStart && 'transition-transform duration-150 ease-out',
          )}
          // pointerEvents:'none' mientras se arrastra: sin esto, el cursor
          // barre por encima de decenas de cartas en cada gesto de arrastre,
          // y cada una dispara su propio :hover (traslada, activa sombras
          // grandes y arranca de golpe ~15-20 capas animadas en pausa). Eso
          // -no el numero de renders de React- era lo que colgaba el arbol al
          // arrastrar (probado: quitar esto y el problema vuelve). Con el
          // puntero "atravesando" las cartas durante el gesto, ninguna entra
          // en :hover hasta soltar.
          //
          // willChange SOLO mientras `zooming` esta activo (ver
          // beginZoomAnimation): promociona el arbol a su propia capa de GPU
          // nada mas que para la duracion de la transicion, asi escalar un
          // arbol con muchas cartas no obliga a repintarlas todas en cada
          // frame -eso es lo que se sentia "lageado" en el zoom con botones
          // y en "Ajustar todo el arbol". Nunca se activa durante el
          // arrastre (son caminos de estado separados), que es justo lo que
          // colgo el arbol la vez anterior que se probo esto.
          onTransitionEnd={(event) => {
            if (event.target === treeRef.current && event.propertyName === 'transform') setZooming(false)
          }}
          style={{
            transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
            transformOrigin: '0 0',
            pointerEvents: dragStart ? 'none' : undefined,
            willChange: zooming || dragStart ? 'transform' : undefined,
          }}
        >
          <div className="tree-reveal">
            <div className={cn(projectRoots.length > 1 && 'tree-project-roots')}>
              {projectRoots.map((projectRoot) => (
                <TreeNode
                  key={projectRoot.key}
                  node={projectRoot}
                  collapsed={collapsed}
                  onToggle={toggle}
                  onCenter={centerNode}
                  isRoot
                  compact={zoom <= COMPACT_CARD_ZOOM}
                  revealDepth={revealDepth}
                />
              ))}
            </div>
          </div>
        </div>
        <p className="pointer-events-none absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-full border border-border bg-card/90 px-3 py-1 text-[10px] text-muted-foreground shadow-sm">
          {t('tree.canvasHint')}
        </p>
      </CardContent>
    </Card>
  )
}

function Legend() {
  const t = useT()
  const items = [
    { icon: Crown, label: t('tree.legendTarget'), className: 'text-primary' },
    { icon: Egg, label: t('tree.legendBred'), className: 'text-sky-400' },
    { icon: Package, label: t('tree.legendOwned'), className: 'text-emerald-400' },
    { icon: Swords, label: t('tree.legendCapture'), className: 'text-amber-400' },
  ]
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
      <span>{t('tree.legendIntro')}</span>
      {items.map(({ icon: Icon, label, className }) => (
        <span key={label} className="flex items-center gap-1">
          <Icon className={cn('size-3', className)} aria-hidden="true" />
          {label}
        </span>
      ))}
    </div>
  )
}

interface TreeNodeProps {
  node: PlanNode
  collapsed: Set<string>
  onToggle: (key: string) => void
  onCenter: (element: HTMLElement) => void
  isRoot?: boolean
  compact: boolean
  revealDepth: number
}

const TreeNode = memo(function TreeNode({ node, collapsed, onToggle, onCenter, isRoot = false, compact, revealDepth }: TreeNodeProps) {
  const isBreed = node.kind === 'breed'
  const isOpen = !collapsed.has(node.key)
  const parents = node.parents
  // Los Pals de origen se presentan primero; el objetivo cierra la secuencia.
  const revealDelay = Math.min(3, Math.max(0, revealDepth - node.depth)) * 48

  return (
    <div
      className="tree-node flex flex-col items-center"
      data-depth={Math.min(node.depth, 3)}
      style={{ '--tree-node-delay': `${revealDelay}ms`, '--tree-line-delay': `${revealDelay + 72}ms`, '--tree-target-delay': `${revealDelay + 28}ms` } as CSSProperties}
    >
      <NodeCard node={node} isRoot={isRoot} isOpen={isOpen} nodeKey={node.key} onToggle={onToggle} onCenter={onCenter} compact={compact} />

      {isBreed && parents && isOpen && (
        <>
          {/* tronco que baja del hijo hasta la union de las dos ramas */}
          <div className="tree-connector" aria-hidden="true" />
          {/*
            minmax(min-content,1fr) y no minmax(0,1fr): con minimo 0, una rama
            simple (una sola captura) se encogia por debajo del ancho fijo de
            su propia carta en cuanto la rama hermana tenia un subarbol mas
            profundo/ancho -la carta desbordaba su columna y quedaba pintada
            ENCIMA de la carta vecina (bug reportado: "las cartas se montan
            encima de otras"). min-content garantiza que ninguna columna baje
            de lo que su propia carta necesita; 1fr sigue repartiendo el
            sobrante a partes iguales entre columnas que ya cumplen su minimo,
            asi que ramas de igual profundidad se siguen viendo simetricas.
          */}
          <div className="relative grid" style={{ gridTemplateColumns: `repeat(${parents.length}, minmax(min-content, 1fr))` }}>
            {/* El "+" marca donde se juntan los dos padres para dar el Pal de arriba. */}
            <span className="tree-junction absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border bg-card px-1.5 py-px text-[11px] font-bold leading-none text-muted-foreground shadow-sm">
              +
            </span>
            {(parents as PlanNode[]).map((parent, index, all) => (
              <div
                key={parent.key}
                className={cn(
                  'tree-branch relative flex flex-col items-center px-5 pt-10',
                  all.length === 1 && 'tree-branch--single',
                  all.length > 1 && index === 0 && 'tree-branch--first',
                  all.length > 1 && index === all.length - 1 && 'tree-branch--last',
                  all.length > 1 && index !== 0 && index !== all.length - 1 && 'tree-branch--middle',
                )}
              >
                <TreeNode node={parent} collapsed={collapsed} onToggle={onToggle} onCenter={onCenter} compact={compact} revealDepth={revealDepth} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
})

interface NodeCardProps {
  node: PlanNode
  isRoot: boolean
  isOpen: boolean
  nodeKey: string
  onToggle: (key: string) => void
  onCenter: (element: HTMLElement) => void
  compact: boolean
}

const NodeCard = memo(function NodeCard({ node, isRoot, isOpen, nodeKey, onToggle, onCenter, compact }: NodeCardProps) {
  const t = useT()
  const db = loadDatabase()
  const pal = db.palById.get(node.palId)
  const isBreed = node.kind === 'breed'
  const hidden = isBreed && !isOpen ? countBreedNodes(node) : 0
  const passives = node.passives.map((id) => {
    const passive = db.passiveById.get(id)
    return { label: passiveName(passive), rank: passive?.rank ?? 0 }
  })
  const work = (pal?.work ?? []).slice(0, 3).map(({ type, value }) => ({
    label: workTypeLabel(type),
    level: value,
    icon: `${import.meta.env.BASE_URL}work/${WORK_ICON_FILE[type]}.png`,
  }))
  const element = pal?.elements[0] ?? 'neutral'
  const captureLabel = node.kind === 'capture' && pal?.wild ? t('tree.captureLevel', { min: pal.wild[0], max: pal.wild[1] }) : undefined

  return (
    <div
      className="tree-node-card flex flex-col items-center gap-2"
      data-depth={Math.min(node.depth, 3)}
      data-kind={node.kind}
      onDoubleClick={(event) => onCenter(event.currentTarget)}
    >
      <TreePalCard
        palId={node.palId}
        name={palName(pal)}
        passives={passives}
        work={work}
        element={element}
        compact={compact}
        captureLabel={captureLabel}
        isRoot={isRoot}
        owned={node.kind === 'owned'}
        isBreed={isBreed}
        isOpen={isOpen}
        onToggle={() => onToggle(nodeKey)}
        ariaLabel={isBreed ? t(isOpen ? 'tree.collapseNodeAria' : 'tree.expandNodeAria', { name: palName(pal) }) : undefined}
      />

      {node.shared && !isRoot && (
        <Badge variant="secondary" className="tree-node-card__shared text-[10px]">
          {t('tree.shared')}
        </Badge>
      )}

      {node.genderRequirement && (
        <Badge variant="warn" className="text-[10px]">
          {t(node.genderRequirement.a === 'MALE' ? 'tree.genderMale' : 'tree.genderFemale')} +{' '}
          {t(node.genderRequirement.b === 'MALE' ? 'tree.genderMale' : 'tree.genderFemale')}
        </Badge>
      )}

      {hidden > 0 && (
        <button
          type="button"
          onClick={() => onToggle(nodeKey)}
          className="w-full max-w-[26rem] rounded-full border border-dashed border-border py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          {t(hidden === 1 ? 'tree.hiddenCross' : 'tree.hiddenCrosses', { count: hidden })}
        </button>
      )}
    </div>
  )
})

interface TreePalCardProps {
  palId: string
  name: string
  passives: { label: string; rank: number }[]
  work: { label: string; level: number; icon: string }[]
  element: keyof typeof ELEMENT_INFO
  compact: boolean
  captureLabel?: string
  isRoot: boolean
  owned: boolean
  isBreed: boolean
  isOpen: boolean
  onToggle: () => void
  ariaLabel?: string
}

/**
 * Carta TCG compacta para el arbol. Conserva arte, marco y jerarquia de una
 * carta coleccionable, pero evita foil, texturas repetidas, filtros y paneles
 * secundarios: cada nodo se mantiene como una superficie estatica y barata
 * de componer mientras el usuario panea o hace zoom.
 */
const TreePalCard = memo(function TreePalCard({
  palId,
  name,
  passives,
  work,
  element,
  compact,
  captureLabel,
  isRoot,
  owned,
  isBreed,
  isOpen,
  onToggle,
  ariaLabel,
}: TreePalCardProps) {
  const t = useT()
  const { openPal } = usePokedex()
  const elementInfo = ELEMENT_INFO[element]
  const passiveSlots = [...passives.slice(0, 4), ...Array.from({ length: Math.max(0, 4 - passives.length) }, () => null)]
  // Traza visual: `passives` ya son solo las deseadas que ESTE nodo porta (el
  // solver las asigna en build()), asi que no hace falta recalcular nada -un
  // Pal propio que las lleva es la fuente; una cria intermedia que las lleva
  // es quien las transporta hacia el objetivo.
  const isPassiveSource = owned && passives.length > 0
  const isPassiveCarrier = isBreed && passives.length > 0
  const stateLabel = isRoot
    ? t('tree.legendTarget')
    : owned
      ? t('tree.legendOwned')
      : isBreed
        ? t('tree.legendBred')
        : t('tree.legendCapture')

  const content = (
    <>
      {!compact && (
        <div className="tree-pal-card__topline">
          <span className="tree-pal-card__rarity">PAL</span>
        </div>
      )}

      <div className="tree-pal-card__art">
        {!compact && <span className="tree-pal-card__element">{elementInfo.label}</span>}
        <PalIcon palId={palId} size={compact ? 96 : 118} bare className="tree-pal-card__portrait" />
        {!compact && <span className="tree-pal-card__state">{stateLabel}</span>}
        {isPassiveCarrier && (
          <span className="tree-pal-card__trace-badge" title={t('tree.passiveTraceCarrier')} aria-hidden="true">
            <Sparkle aria-hidden="true" />
          </span>
        )}
      </div>
      <div className="tree-pal-card__title-row">
        <span className="tree-pal-card__name">{name}</span>
        {!compact && captureLabel && <span className="tree-pal-card__meta">{captureLabel}</span>}
      </div>
      {!compact && (
        <>
          {work.length > 0 && (
            <section className="tree-pal-card__work" aria-label={t('palCard.work')}>
              <header>
                <span className="tree-pal-card__work-label">{t('palCard.work')}</span>
                <small>{t('palCard.workSub')}</small>
              </header>
              <ul>
                {work.map((item) => (
                  <li key={item.label} style={{ '--tree-work-level': `${item.level * 10}%` } as CSSProperties} aria-label={t('palCard.workLevel', { label: item.label, level: item.level })}>
                    <img className="tree-pal-card__work-icon" src={item.icon} alt="" width="14" height="14" loading="lazy" decoding="async" />
                    <span className="tree-pal-card__work-name">{item.label}</span>
                    <span className="tree-pal-card__work-meter" aria-hidden="true" />
                    <b>{item.level}</b>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
      <section className="tree-pal-card__passive-section" aria-label={t('palCard.passives')}>
        {!compact && (
          <header>
            <span>{t('palCard.passives')}</span>
            <small>{t('palCard.passivesSub')}</small>
          </header>
        )}
        <ul className="tree-pal-card__passives" data-count={Math.min(passives.length, 4)}>
          {passiveSlots.map((passive, index) => (
            passive ? (
              <li key={passive.label} data-rank={Math.max(-3, Math.min(4, passive.rank))} title={passive.label}>
                <span className="tree-pal-card__passive-arrows" aria-hidden="true">
                  {Array.from({ length: Math.max(1, Math.min(3, Math.abs(passive.rank))) }, (_, arrowIndex) => <i key={arrowIndex} />)}
                </span>
                <span className="tree-pal-card__passive-name">{passive.label}</span>
              </li>
            ) : (
              <li key={`empty-${index}`} className="tree-pal-card__passive-empty" title={t('palCard.emptySlotTip')}>
                {t('palCard.emptySlot')}
              </li>
            )
          ))}
        </ul>
      </section>
    </>
  )

  const className = cn(
    'tree-pal-card',
    compact && 'tree-pal-card--compact',
    isRoot && 'tree-pal-card--target',
    owned && 'tree-pal-card--owned',
    !isBreed && !owned && !isRoot && 'tree-pal-card--capture',
    isPassiveSource && 'tree-pal-card--passive-source',
    isPassiveCarrier && 'tree-pal-card--passive-carrier',
  )
  const style = { '--tree-element': elementInfo.color } as CSSProperties
  return (
    <div className="tree-pal-card-shell">
      <div className={className} style={style}>{content}</div>
      <button type="button" className="tree-pal-card__open" onClick={() => openPal(palId)} aria-label={t('pokedex.open', { name })} />
      {isBreed && <button type="button" className="tree-pal-card__fold" onClick={onToggle} aria-expanded={isOpen} aria-label={ariaLabel}>{isOpen ? '−' : '+'}</button>}
    </div>
  )
})
