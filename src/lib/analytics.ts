export type ProductEvent =
  | 'target_selected'
  | 'tree_generated'
  | 'build_applied'
  | 'collection_updated'
  | 'route_compared'
  | 'demo_loaded'
  | 'landing_opened'
  | 'planner_launched'
  | 'planner_cleared'
  | 'plan_shared'
  | 'quick_path_opened'
  | 'quick_path_open_full_planner'

/**
 * Adaptador local-first. No transmite datos por defecto; cuando se configure
 * Plausible, la misma API lo detecta sin acoplar el producto a un proveedor.
 */
export function track(event: ProductEvent, props: Record<string, string | number | boolean> = {}): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('palaxis:analytics', { detail: { event, props } }))
  const plausible = (window as Window & { plausible?: (name: string, options?: { props: typeof props }) => void }).plausible
  plausible?.(event, { props })
  trackGoogleEvent(event, props)
}
import { trackGoogleEvent } from './google-tag'
