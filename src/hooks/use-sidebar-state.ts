/**
 * Estado del sidebar (ancho + colapsado), persistido en localStorage con el
 * mismo patron que src/domain/projects.ts. Es puramente de interfaz: no
 * comparte llave ni forma con el estado del planificador.
 */
import { useCallback, useEffect, useRef, useState } from 'react'

const KEY = 'pbp:sidebar'
const DEFAULT_WIDTH = 360
const MIN_WIDTH = 280
const MAX_WIDTH = 480
const COLLAPSED_WIDTH = 56
/** Por debajo de esto no hay sitio para un sidebar de escritorio: se repliega solo. */
const NARROW_VIEWPORT = 820

interface SidebarPrefs {
  width: number
  collapsed: boolean
}

function loadPrefs(): SidebarPrefs {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { width: DEFAULT_WIDTH, collapsed: false }
    const parsed = JSON.parse(raw) as Partial<SidebarPrefs>
    return {
      width: clamp(parsed.width ?? DEFAULT_WIDTH),
      collapsed: !!parsed.collapsed,
    }
  } catch {
    return { width: DEFAULT_WIDTH, collapsed: false }
  }
}

function clamp(width: number): number {
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width))
}

/**
 * En pantallas estrechas no hay sitio para un sidebar de escritorio: se
 * repliega solo al riel de iconos SIN tocar la preferencia guardada, para que
 * al volver a un monitor grande la app recuerde el ancho que el usuario eligio.
 */
function useIsNarrowViewport(): boolean {
  const [narrow, setNarrow] = useState(() =>
    typeof window === 'undefined' ? false : window.innerWidth < NARROW_VIEWPORT,
  )
  useEffect(() => {
    // Se escuchan dos fuentes a proposito: `matchMedia` es lo correcto, pero
    // `resize` como respaldo cubre entornos donde el cambio de viewport no
    // dispara el evento `change` de MediaQueryList (visto en herramientas de
    // automatizacion que redimensionan el viewport sin pasar por el SO).
    const check = () => setNarrow(window.innerWidth < NARROW_VIEWPORT)
    const mql = window.matchMedia(`(max-width: ${NARROW_VIEWPORT - 1}px)`)
    check()
    mql.addEventListener('change', check)
    window.addEventListener('resize', check)
    return () => {
      mql.removeEventListener('change', check)
      window.removeEventListener('resize', check)
    }
  }, [])
  return narrow
}

export interface SidebarState {
  width: number
  collapsed: boolean
  /** Ancho real ocupado en pantalla ahora mismo (colapsado o expandido). */
  effectiveWidth: number
  /** Falso mientras se arrastra el borde: evita animar la transicion durante el drag. */
  isDragging: boolean
  /** Si se puede arrastrar para redimensionar (no tiene sentido en pantallas estrechas). */
  canResize: boolean
  toggle: () => void
  expand: () => void
  startResize: (clientX: number) => void
}

export function useSidebarState(): SidebarState {
  const [prefs, setPrefs] = useState<SidebarPrefs>(() => loadPrefs())
  const [isDragging, setIsDragging] = useState(false)
  const dragStart = useRef<{ x: number; width: number } | null>(null)
  const isNarrow = useIsNarrowViewport()

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(prefs))
  }, [prefs])

  useEffect(() => {
    if (!isDragging) return
    const onMove = (e: PointerEvent) => {
      if (!dragStart.current) return
      const delta = e.clientX - dragStart.current.x
      setPrefs((p) => ({ ...p, width: clamp(dragStart.current!.width + delta) }))
    }
    const onUp = () => {
      dragStart.current = null
      setIsDragging(false)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [isDragging])

  const toggle = useCallback(() => setPrefs((p) => ({ ...p, collapsed: !p.collapsed })), [])
  const expand = useCallback(() => setPrefs((p) => (p.collapsed ? { ...p, collapsed: false } : p)), [])
  const startResize = useCallback(
    (clientX: number) => {
      dragStart.current = { x: clientX, width: prefs.width }
      setIsDragging(true)
    },
    [prefs.width],
  )

  const effectiveCollapsed = prefs.collapsed || isNarrow

  return {
    width: prefs.width,
    collapsed: effectiveCollapsed,
    effectiveWidth: effectiveCollapsed ? COLLAPSED_WIDTH : prefs.width,
    isDragging,
    canResize: !isNarrow,
    toggle,
    expand,
    startResize,
  }
}

export { COLLAPSED_WIDTH }
