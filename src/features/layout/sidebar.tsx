/**
 * Cascaron del sidebar: envuelve los 4 paneles existentes (Target/Collection/
 * Mode/Projects) sin tocar su contenido. Solo aporta el layout: puede
 * colapsarse a un riel de iconos, redimensionarse arrastrando el borde, y
 * recuerda su estado entre sesiones (ver use-sidebar-state.ts).
 */
import { lazy, Suspense, useState, type ReactNode } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Backpack, ChevronDown, FolderOpen, PanelLeftClose, PanelLeftOpen, SlidersHorizontal, Sparkles, Target, X, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { RichTooltip } from '@/components/rich-tooltip'
import { TargetPanel } from '@/features/setup/target-panel'
import { ModePanel } from '@/features/setup/mode-panel'
import { BuildAdvisor } from '@/features/setup/build-advisor'
import { COLLAPSED_WIDTH, useSidebarState, type SidebarState } from '@/hooks/use-sidebar-state'
import { useT } from '@/i18n/language-store'
import { cn } from '@/lib/utils'
import { usePlannerStore } from '@/state/planner-store'

// Estas superficies solo se abren bajo demanda: separarlas evita cargar su
// grid de Paldex y gestión de proyectos en el primer render del planner.
const CollectionPanel = lazy(() => import('@/features/collection/collection-panel').then((module) => ({ default: module.CollectionPanel })))
const ProjectsPanel = lazy(() => import('@/features/projects/projects-panel').then((module) => ({ default: module.ProjectsPanel })))

// `key` es estable en cualquier idioma (se usa como data-attribute para poder
// disparar el riel colapsado desde fuera, ver App.tsx#focusTargetPicker); las
// etiquetas se resuelven en render con `t()`.
const RAIL_ITEMS = [
  { key: 'target', icon: Target, labelKey: 'sidebar.rail.target', descriptionKey: 'sidebar.rail.targetDescription' },
  { key: 'collection', icon: Backpack, labelKey: 'sidebar.rail.collection', descriptionKey: 'sidebar.rail.collectionDescription' },
  { key: 'mode', icon: SlidersHorizontal, labelKey: 'sidebar.rail.mode', descriptionKey: 'sidebar.rail.modeDescription' },
  { key: 'projects', icon: FolderOpen, labelKey: 'sidebar.rail.projects', descriptionKey: 'sidebar.rail.projectsDescription' },
] as const

export function Sidebar() {
  const sidebar = useSidebarState()
  const t = useT()

  // El antiguo riel se mantenia colapsado por debajo de 820 px. `expand()`
  // solo cambia la preferencia de escritorio, asi que en movil no habia forma
  // de abrir los paneles: un callejon sin salida tanto con tacto como teclado.
  // En ese breakpoint la navegacion inferior abre un Dialog real de Radix,
  // que gestiona foco, Escape y aria-modal sin dejar contenido activo atras.
  if (!sidebar.canResize) return <MobileSidebar />

  return (
    <aside
      className={cn(
        'relative flex shrink-0 flex-col overflow-hidden border-r border-border bg-card/30',
        !sidebar.isDragging && 'transition-[width] duration-200 ease-out',
      )}
      style={{ width: sidebar.effectiveWidth }}
      aria-label={t('sidebar.ariaLabel')}
    >
      {sidebar.collapsed ? (
        <CollapsedRail onExpand={sidebar.expand} />
      ) : (
        <ExpandedContent onCollapse={sidebar.toggle} />
      )}

      {!sidebar.collapsed && sidebar.canResize && <ResizeHandle sidebar={sidebar} />}
    </aside>
  )
}

function MobileSidebar() {
  const [open, setOpen] = useState(false)
  const t = useT()

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 grid h-[calc(4rem+env(safe-area-inset-bottom))] grid-cols-4 border-t border-border/90 bg-card px-1 pb-[env(safe-area-inset-bottom)] pt-1 shadow-[0_-8px_20px_rgba(0,0,0,0.22)]"
        aria-label={t('sidebar.ariaLabel')}
      >
        {RAIL_ITEMS.map(({ key, icon: Icon, labelKey }) => {
          const label = t(labelKey)
          return (
            <Dialog.Trigger key={key} asChild>
              <button
                type="button"
                className="flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-[10px] font-semibold text-muted-foreground transition-colors active:bg-accent active:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={t('sidebar.expandAndOpen', { label })}
              >
                <Icon className="size-[18px]" aria-hidden="true" />
                <span className="max-w-full truncate">{label}</span>
              </button>
            </Dialog.Trigger>
          )
        })}
      </nav>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 flex max-h-[min(82dvh,46rem)] flex-col rounded-t-2xl border border-border bg-card shadow-2xl outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <Dialog.Title className="text-sm font-bold">{t('sidebar.ariaLabel')}</Dialog.Title>
              <Dialog.Description className="text-xs text-muted-foreground">{t('sidebar.expandDescription')}</Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon-sm" aria-label={t('sidebar.collapse')}>
                <X className="size-4" aria-hidden="true" />
              </Button>
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-4">
            <MobilePanelContent />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

const RESIZE_STEP = 16

function ResizeHandle({ sidebar }: { sidebar: SidebarState }) {
  const t = useT()
  return (
    <button
      type="button"
      role="separator"
      aria-orientation="vertical"
      aria-label={t('sidebar.resize')}
      aria-valuenow={sidebar.width}
      aria-valuemin={sidebar.minWidth}
      aria-valuemax={sidebar.maxWidth}
      onPointerDown={(e) => {
        e.preventDefault()
        e.currentTarget.focus()
        sidebar.startResize(e.clientX)
      }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') {
          e.preventDefault()
          sidebar.resizeBy(-RESIZE_STEP)
        } else if (e.key === 'ArrowRight') {
          e.preventDefault()
          sidebar.resizeBy(RESIZE_STEP)
        } else if (e.key === 'Home') {
          e.preventDefault()
          sidebar.resizeBy(-9999)
        } else if (e.key === 'End') {
          e.preventDefault()
          sidebar.resizeBy(9999)
        }
      }}
      className={cn(
        'group absolute right-0 top-0 h-full w-1.5 cursor-col-resize touch-none',
        'after:absolute after:right-0 after:top-0 after:h-full after:w-px after:bg-transparent',
        'hover:after:bg-primary/50 active:after:bg-primary',
        'focus-visible:outline-none focus-visible:after:bg-primary',
      )}
    />
  )
}

function CollapsedRail({ onExpand }: { onExpand: () => void }) {
  const t = useT()
  return (
    <div className="flex h-full flex-col items-center gap-1 py-3" style={{ width: COLLAPSED_WIDTH }}>
      <RichTooltip asChild title={t('sidebar.expand')} description={t('sidebar.expandDescription')}>
        <Button variant="ghost" size="icon-sm" aria-label={t('sidebar.expand')} onClick={onExpand}>
          <PanelLeftOpen className="size-4" aria-hidden="true" />
        </Button>
      </RichTooltip>
      <div className="my-1 h-px w-6 bg-border" aria-hidden="true" />
      {RAIL_ITEMS.map(({ key, icon: Icon, labelKey, descriptionKey }) => {
        const label = t(labelKey)
        return (
          <RichTooltip key={key} asChild title={label} description={t(descriptionKey)}>
            <Button variant="ghost" size="icon-sm" data-rail-key={key} aria-label={t('sidebar.expandAndOpen', { label })} onClick={onExpand}>
              <Icon className="size-4" aria-hidden="true" />
            </Button>
          </RichTooltip>
        )
      })}
    </div>
  )
}

function ExpandedContent({ onCollapse }: { onCollapse: () => void }) {
  const t = useT()
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-end px-2 pt-2">
        <RichTooltip asChild title={t('sidebar.collapse')} description={t('sidebar.collapseDescription')}>
          <Button variant="ghost" size="icon-sm" aria-label={t('sidebar.collapse')} onClick={onCollapse}>
            <PanelLeftClose className="size-4" aria-hidden="true" />
          </Button>
        </RichTooltip>
      </div>
      <div className="min-w-0 flex-1 space-y-3 overflow-y-auto px-4 pb-4 pt-1">
        <PlannerPanels />
      </div>
    </div>
  )
}

function MobilePanelContent() {
  return (
    <div className="space-y-3">
      <PlannerPanels />
    </div>
  )
}

function PlannerPanels() {
  const { state } = usePlannerStore()
  const t = useT()

  return (
    <>
      <TargetPanel />

      {state.targetPalId && (
        <PlannerSection
          icon={Sparkles}
          title={t('sidebar.section.buildAdvisor')}
          description={t('sidebar.section.buildAdvisorDescription')}
        >
          <BuildAdvisor showHeading={false} />
        </PlannerSection>
      )}

      <PlannerSection
        icon={Backpack}
        title={t('sidebar.section.collection')}
        description={t('sidebar.section.collectionDescription')}
      >
        <Suspense fallback={<PanelLoading />}><CollectionPanel embedded /></Suspense>
      </PlannerSection>

      <PlannerSection
        icon={SlidersHorizontal}
        title={t('sidebar.section.optimization')}
        description={t('sidebar.section.optimizationDescription')}
      >
        <ModePanel embedded />
      </PlannerSection>

      <PlannerSection
        icon={FolderOpen}
        title={t('sidebar.section.projects')}
        description={t('sidebar.section.projectsDescription')}
      >
        <Suspense fallback={<PanelLoading />}><ProjectsPanel embedded /></Suspense>
      </PlannerSection>
    </>
  )
}

function PanelLoading() {
  return <div className="h-24 animate-pulse rounded-lg border border-border/70 bg-background/35" aria-label="Loading panel" />
}

function PlannerSection({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon
  title: string
  description: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <section className={cn('planner-section', open && 'is-open')}>
        <CollapsibleTrigger asChild>
          <button type="button" className="planner-section__trigger">
            <span className="planner-section__icon"><Icon aria-hidden="true" /></span>
            <span className="min-w-0 flex-1 text-left">
              <strong>{title}</strong>
              <small>{description}</small>
            </span>
            <ChevronDown className="planner-section__chevron" aria-hidden="true" />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="planner-section__content">
          <div className="planner-section__body">{children}</div>
        </CollapsibleContent>
      </section>
    </Collapsible>
  )
}
