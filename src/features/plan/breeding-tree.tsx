import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Crown, Egg, Maximize2, Package, Swords, Target, ZoomIn, ZoomOut } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PalCard, type PalCardPassive, type PalCardWork } from '@/components/pal-card'
import { RichTooltip } from '@/components/rich-tooltip'
import { loadDatabase, palName, passiveName, workTypeLabel } from '@/domain/database'
import { rarityInfo } from '@/domain/rarity'
import { useT } from '@/i18n/language-store'
import type { PlanNode, WorkType } from '@/domain/types'
import { cn } from '@/lib/utils'
import { collectKeys, countBreedNodes } from './plan-utils'

// La carta del Pal es una caja fija de 780x1000 (ver design_handoff_pal_card):
// incluso un arbol "corto" de 2 niveles ya pide ~2000px de alto natural, asi
// que hacen falta escalones bastante mas pequenos que en la version anterior
// (cuando la carta media 224px) para poder encogerla lo que de verdad haga falta.
const ZOOM_STEPS = [0.12, 0.16, 0.2, 0.25, 0.3, 0.4, 0.55, 0.7, 0.85, 1, 1.15, 1.3]
const MIN_ZOOM = ZOOM_STEPS[0]
const MAX_ZOOM = ZOOM_STEPS[ZOOM_STEPS.length - 1]
const DEFAULT_ZOOM = 1

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

/**
 * La carta (design_handoff_pal_card) es una caja fija de 780x1000 en px
 * absolutos por dentro -no admite un prop de escala-, asi que para encogerla
 * un 20% sin tocar ni uno de esos valores calibrados se envuelve en un
 * `transform: scale()` con origen en la esquina y un contenedor exterior del
 * tamano YA encogido. Asi el layout del arbol (conectores, offsetWidth para
 * fitTree...) mide el tamano real en pantalla, no el de la carta sin escalar.
 */
const CARD_WIDTH = 780
const CARD_HEIGHT = 1000
const CARD_SCALE = 0.8

/** Alto de la cabecera fija de la app (h-14), unico numero que hay que conocer para calcular cuanto le queda al canvas. */
const APP_HEADER_HEIGHT = 56
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

export function BreedingTree({ root }: { root: PlanNode }) {
  const t = useT()
  const allKeys = useMemo(() => collectKeys(root), [root])
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
  const cardRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const treeRef = useRef<HTMLDivElement>(null)

  const beginZoomAnimation = () => {
    setZooming(true)
    if (zoomEndTimerRef.current != null) window.clearTimeout(zoomEndTimerRef.current)
    // Red de seguridad si `onTransitionEnd` no llega a disparar (p.ej. el
    // zoom no cambia realmente porque ya estaba en el limite): un poco mas
    // que los 450ms de la transicion para no cortarla a medias.
    zoomEndTimerRef.current = window.setTimeout(() => setZooming(false), 550)
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
    setZoom((z) => nextZoomStepUp(z))
  }
  const zoomOut = () => {
    beginZoomAnimation()
    setZoom((z) => nextZoomStepDown(z))
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
    setPan(centeredPanForScale(zoom))
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
    setZoom(fittingZoom)
    setPan(topAnchoredPanForScale(fittingZoom))
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
  }, [root])

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
      beginZoomAnimation()
      setZoom((z) => (event.deltaY > 0 ? nextZoomStepDown(z) : nextZoomStepUp(z)))
    }
    viewport.addEventListener('wheel', handleWheel, { passive: false })
    return () => viewport.removeEventListener('wheel', handleWheel)
  }, [])

  useEffect(() => {
    return () => {
      if (zoomEndTimerRef.current != null) window.clearTimeout(zoomEndTimerRef.current)
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
    setPan((current) => ({
      x: current.x + viewportRect.left + viewportRect.width / 2 - (nodeRect.left + nodeRect.width / 2),
      y: current.y + viewportRect.top + viewportRect.height / 2 - (nodeRect.top + nodeRect.height / 2),
    }))
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
        <CardTitle className="text-base font-bold">{t('tree.title')}</CardTitle>
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
          setDragStart({ x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y })
        }}
        onPointerMove={(event) => {
          if (!dragStart) return
          setPan({ x: dragStart.panX + event.clientX - dragStart.x, y: dragStart.panY + event.clientY - dragStart.y })
        }}
        onPointerUp={() => setDragStart(null)}
        onPointerCancel={() => setDragStart(null)}
        className={cn(
          'relative cursor-grab overflow-hidden bg-[radial-gradient(var(--color-border)_1px,transparent_1px)] bg-[length:22px_22px] bg-[position:-11px_-11px] p-8 sm:p-10',
          dragStart && 'cursor-grabbing select-none',
        )}
        style={{ height: canvasHeight ? `${canvasHeight}px` : undefined, minHeight: `${CANVAS_MIN_HEIGHT}px`, touchAction: 'none' }}
      >
        {/* Barra de controles flotante: no ocupa layout, vive sobre el canvas (estilo Figma/React Flow). */}
        <div className="pointer-events-none absolute right-3 top-3 z-20 flex flex-wrap items-center justify-end gap-1">
          <div className="pointer-events-auto flex items-center gap-1 rounded-lg border border-border bg-card/95 p-1 shadow-md backdrop-blur-sm">
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
            <span className="mx-0.5 h-5 w-px bg-border" aria-hidden="true" />
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
            <span className="mx-0.5 h-5 w-px bg-border" aria-hidden="true" />
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
            'inline-flex pb-12 pt-4',
            // Misma curva "premium" que el resto de la app (ver hover de
            // pal-card.tsx / index.css), mas larga que el resto de transiciones
            // de la UI (450ms) porque "Ajustar todo el arbol" suele ser un
            // salto de zoom grande -de 100% a 15%, por ejemplo-, y a 200ms
            // eso se ve como un corte en vez de un alejamiento fluido.
            !dragStart && 'transition-transform duration-[450ms] ease-[cubic-bezier(0.22,0.7,0.3,1)]',
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
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
            pointerEvents: dragStart ? 'none' : undefined,
            willChange: zooming ? 'transform' : undefined,
          }}
        >
          <TreeNode
            node={root}
            collapsed={collapsed}
            onToggle={toggle}
            onCenter={centerNode}
            // El detalle completo se mantiene visible hasta el 20% de zoom;
            // solo por debajo de ese piso se cambia al modo compacto.
            compact={zoom < 0.2}
            isRoot
          />
        </div>
        <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-border bg-card/90 px-3 py-1 text-[10px] text-muted-foreground shadow-sm">
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
  compact: boolean
  isRoot?: boolean
}

const TreeNode = memo(function TreeNode({ node, collapsed, onToggle, onCenter, compact, isRoot = false }: TreeNodeProps) {
  const isBreed = node.kind === 'breed'
  const isOpen = !collapsed.has(node.key)
  const parents = node.parents

  return (
    <div className="flex flex-col items-center">
      <NodeCard node={node} isRoot={isRoot} isOpen={isOpen} compact={compact} nodeKey={node.key} onToggle={onToggle} onCenter={onCenter} />

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
                <TreeNode node={parent} collapsed={collapsed} onToggle={onToggle} onCenter={onCenter} compact={compact} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
})

/** Mapea el WorkType interno de la app al nombre de archivo real en public/work (difieren solo en electricidad). */
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
const workIconUrl = (type: WorkType) => `${import.meta.env.BASE_URL}work/${WORK_ICON_FILE[type]}.png`

interface NodeCardProps {
  node: PlanNode
  isRoot: boolean
  isOpen: boolean
  compact: boolean
  nodeKey: string
  onToggle: (key: string) => void
  onCenter: (element: HTMLElement) => void
}

const NodeCard = memo(function NodeCard({ node, isRoot, isOpen, compact, nodeKey, onToggle, onCenter }: NodeCardProps) {
  const t = useT()
  const db = loadDatabase()
  const pal = db.palById.get(node.palId)
  const isBreed = node.kind === 'breed'
  const hidden = isBreed && !isOpen ? countBreedNodes(node) : 0

  const work: PalCardWork[] = (pal?.work ?? []).map((w) => ({
    icon: workIconUrl(w.type),
    label: workTypeLabel(w.type),
    level: w.value,
  }))

  // El rango es el dato REAL del juego (ver domain/database -> pal-card.tsx
  // RANKS): nada que clasificar aqui, solo pasar el numero tal cual.
  const passives: PalCardPassive[] = node.passives
    .map((id) => db.passiveById.get(id))
    .filter((p): p is NonNullable<typeof p> => !!p)
    .map((p) => ({ label: passiveName(p), rank: p.rank }))

  // "Objetivo" y "en tu caja" ya tienen su propio badge dedicado (selected/owned);
  // el subtitulo solo aporta algo nuevo para las capturas (nivel salvaje).
  const subtitle = node.kind === 'capture' && pal?.wild ? t('tree.captureLevel', { min: pal.wild[0], max: pal.wild[1] }) : ''

  return (
    <div
      className="tree-node-card flex flex-col items-center gap-2"
      onDoubleClick={(event) => onCenter(event.currentTarget)}
    >
      <div style={{ width: CARD_WIDTH * CARD_SCALE, height: CARD_HEIGHT * CARD_SCALE }}>
        <div style={{ width: CARD_WIDTH, height: CARD_HEIGHT, transform: `scale(${CARD_SCALE})`, transformOrigin: 'top left' }}>
          <PalCard
            className={isBreed ? 'pc-card-trigger' : undefined}
            as={isBreed ? 'button' : 'div'}
            onClick={isBreed ? () => onToggle(nodeKey) : undefined}
            ariaExpanded={isBreed ? isOpen : undefined}
            ariaLabel={isBreed ? t(isOpen ? 'tree.collapseNodeAria' : 'tree.expandNodeAria', { name: palName(pal) }) : undefined}
            palName={palName(pal)}
            subtitle={subtitle}
            element={pal?.elements[0] ?? 'neutral'}
            rarity={pal ? rarityInfo(pal.rarity).tier : 1}
            code={pal ? `P-${String(pal.dex).padStart(3, '0')}${pal.variant ? 'B' : ''}` : 'P-???'}
            palId={node.palId}
            isCross={isBreed}
            work={work}
            passives={passives}
            probability={node.successChance !== undefined ? Math.round(node.successChance * 100) : 100}
            compact={compact}
            selected={isRoot}
            owned={node.kind === 'owned'}
          />
        </div>
      </div>

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
