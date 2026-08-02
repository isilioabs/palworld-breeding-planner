/**
 * Cascaron del sidebar: envuelve los 4 paneles existentes (Target/Collection/
 * Mode/Projects) sin tocar su contenido. Solo aporta el layout: puede
 * colapsarse a un riel de iconos, redimensionarse arrastrando el borde, y
 * recuerda su estado entre sesiones (ver use-sidebar-state.ts).
 */
import { Backpack, FolderOpen, PanelLeftClose, PanelLeftOpen, SlidersHorizontal, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { RichTooltip } from '@/components/rich-tooltip'
import { TargetPanel } from '@/features/setup/target-panel'
import { ModePanel } from '@/features/setup/mode-panel'
import { CollectionPanel } from '@/features/collection/collection-panel'
import { ProjectsPanel } from '@/features/projects/projects-panel'
import { COLLAPSED_WIDTH, useSidebarState, type SidebarState } from '@/hooks/use-sidebar-state'
import { useT } from '@/i18n/language-store'
import { cn } from '@/lib/utils'

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
      <div className="min-w-0 flex-1 space-y-4 overflow-y-auto px-4 pb-4 pt-1">
        <TargetPanel />
        <CollectionPanel />
        <ModePanel />
        <ProjectsPanel />
      </div>
    </div>
  )
}
