/**
 * Cascaron del sidebar: envuelve los 4 paneles existentes (Target/Collection/
 * Mode/Projects) sin tocar su contenido. Solo aporta el layout: puede
 * colapsarse a un riel de iconos, redimensionarse arrastrando el borde, y
 * recuerda su estado entre sesiones (ver use-sidebar-state.ts).
 */
import { Backpack, FolderOpen, PanelLeftClose, PanelLeftOpen, SlidersHorizontal, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TargetPanel } from '@/features/setup/target-panel'
import { ModePanel } from '@/features/setup/mode-panel'
import { CollectionPanel } from '@/features/collection/collection-panel'
import { ProjectsPanel } from '@/features/projects/projects-panel'
import { COLLAPSED_WIDTH, useSidebarState } from '@/hooks/use-sidebar-state'
import { cn } from '@/lib/utils'

const RAIL_ITEMS = [
  { key: 'target', icon: Target, label: 'Que quieres criar' },
  { key: 'collection', icon: Backpack, label: 'Tu coleccion' },
  { key: 'mode', icon: SlidersHorizontal, label: 'Como optimizar' },
  { key: 'projects', icon: FolderOpen, label: 'Proyectos guardados' },
] as const

export function Sidebar() {
  const sidebar = useSidebarState()

  return (
    <aside
      className={cn(
        'relative flex shrink-0 flex-col overflow-hidden border-r border-border bg-card/30',
        !sidebar.isDragging && 'transition-[width] duration-200 ease-out',
      )}
      style={{ width: sidebar.effectiveWidth }}
      aria-label="Configuracion de la ruta de crianza"
    >
      {sidebar.collapsed ? (
        <CollapsedRail onExpand={sidebar.expand} />
      ) : (
        <ExpandedContent onCollapse={sidebar.toggle} />
      )}

      {!sidebar.collapsed && sidebar.canResize && (
        <button
          type="button"
          aria-label="Redimensionar el panel lateral"
          onPointerDown={(e) => {
            e.preventDefault()
            sidebar.startResize(e.clientX)
          }}
          className={cn(
            'group absolute right-0 top-0 h-full w-1.5 cursor-col-resize touch-none',
            'after:absolute after:right-0 after:top-0 after:h-full after:w-px after:bg-transparent',
            'hover:after:bg-primary/50 active:after:bg-primary',
          )}
        />
      )}
    </aside>
  )
}

function CollapsedRail({ onExpand }: { onExpand: () => void }) {
  return (
    <div className="flex h-full flex-col items-center gap-1 py-3" style={{ width: COLLAPSED_WIDTH }}>
      <Button variant="ghost" size="icon-sm" aria-label="Expandir el panel lateral" onClick={onExpand}>
        <PanelLeftOpen className="size-4" />
      </Button>
      <div className="my-1 h-px w-6 bg-border" />
      {RAIL_ITEMS.map(({ key, icon: Icon, label }) => (
        <Button
          key={key}
          variant="ghost"
          size="icon-sm"
          aria-label={`Expandir y abrir "${label}"`}
          title={label}
          onClick={onExpand}
        >
          <Icon className="size-4" />
        </Button>
      ))}
    </div>
  )
}

function ExpandedContent({ onCollapse }: { onCollapse: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-end px-2 pt-2">
        <Button variant="ghost" size="icon-sm" aria-label="Colapsar el panel lateral" onClick={onCollapse}>
          <PanelLeftClose className="size-4" />
        </Button>
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
