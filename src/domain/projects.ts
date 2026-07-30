/**
 * Persistencia de proyectos de crianza (localStorage).
 *
 * Formato versionado para poder migrar sin romper lo que el usuario ya tenga
 * guardado. Import/export a JSON permite compartir un plan o hacer copia.
 */
import type { OwnedPal, PlannerMode } from './types'

export const PROJECT_FORMAT = 3

/** v2 optimizaba por velocidad; v3 optimiza por cuanto estas dispuesto a capturar. */
const LEGACY_MODES: Record<string, PlannerMode> = {
  easiest: 'breeding',
  fastest: 'hybrid',
}

/**
 * Convierte un proyecto de un formato anterior al actual. Devuelve null si el
 * formato no se reconoce, para no cargar basura silenciosamente.
 */
function migrate<T extends { format?: number; mode?: string }>(raw: T): T | null {
  if (!raw || typeof raw !== 'object') return null
  if (raw.format === PROJECT_FORMAT) return raw
  if (raw.format === 2) {
    return { ...raw, format: PROJECT_FORMAT, mode: LEGACY_MODES[raw.mode ?? ''] ?? 'breeding' }
  }
  return null
}

export interface BreedingProject {
  format: number
  id: string
  name: string
  updatedAt: string
  targetPalId: string | null
  desiredPassives: string[]
  owned: OwnedPal[]
  mode: PlannerMode
}

export type ProjectDraft = Omit<BreedingProject, 'format' | 'id' | 'updatedAt' | 'name'>

const LIST_KEY = 'pbp:projects'
const CURRENT_KEY = 'pbp:current'

const safeParse = <T,>(raw: string | null, fallback: T): T => {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function listProjects(): BreedingProject[] {
  const all = safeParse<BreedingProject[]>(localStorage.getItem(LIST_KEY), [])
  return all
    .map((p) => migrate(p))
    .filter((p): p is BreedingProject => p !== null)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function saveProject(name: string, draft: ProjectDraft, id?: string): BreedingProject {
  const project: BreedingProject = {
    format: PROJECT_FORMAT,
    id: id ?? `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    name: name.trim() || 'Proyecto sin nombre',
    updatedAt: new Date().toISOString(),
    ...draft,
  }
  const rest = listProjects().filter((p) => p.id !== project.id)
  localStorage.setItem(LIST_KEY, JSON.stringify([project, ...rest]))
  return project
}

export function deleteProject(id: string): void {
  localStorage.setItem(LIST_KEY, JSON.stringify(listProjects().filter((p) => p.id !== id)))
}

export function loadCurrent(): ProjectDraft | null {
  const raw = safeParse<(ProjectDraft & { format?: number }) | null>(localStorage.getItem(CURRENT_KEY), null)
  return raw ? migrate(raw) : null
}

export function saveCurrent(draft: ProjectDraft): void {
  localStorage.setItem(CURRENT_KEY, JSON.stringify({ format: PROJECT_FORMAT, ...draft }))
}

export function exportProject(project: BreedingProject): string {
  return JSON.stringify(project, null, 2)
}

export function importProject(raw: string): BreedingProject {
  const parsed = JSON.parse(raw) as BreedingProject
  if (!parsed || typeof parsed !== 'object') throw new Error('El archivo no contiene un proyecto valido.')
  const migrated = migrate(parsed)
  if (!migrated) {
    throw new Error(`Formato de proyecto incompatible (v${parsed.format ?? '?'}; se esperaba v${PROJECT_FORMAT}).`)
  }
  return migrated
}
