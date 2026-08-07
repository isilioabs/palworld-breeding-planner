/// <reference lib="webworker" />
/**
 * El planificador corre en un worker para que la UI no se congele mientras se
 * explora el hipergrafo. Cada peticion lleva un `requestId`: las respuestas que
 * llegan tarde se descartan en el hilo principal.
 */
import { getPlannerContext, plan } from './index'
import { MODE_ORDER } from './cost'
import { planProject } from './project-planner'
import type { PlanNode, PlanResult, PlannerInput, PlannerMode, ProjectPlan, RouteAlternative, RouteAlternatives } from '../types'

export interface PlanRequest {
  requestId: number
  input: PlannerInput
}

export interface PlanResponse {
  requestId: number
  result: PlanResult
  routes: RouteAlternatives
  project?: ProjectPlan
}

self.onmessage = (event: MessageEvent<PlanRequest>) => {
  const { requestId, input } = event.data
  let result: PlanResult
  let routes: RouteAlternatives
  let project: ProjectPlan | undefined
  try {
    routes = planAlternatives(input)
    if ((input.targetPalIds?.length ?? 0) > 1) {
      project = planProject(input)
      result = project.ok && project.roots?.[0]
        ? { ok: true, root: project.roots[0] }
        : { ok: false, reason: project.reason }
    } else {
      result = routes[input.mode]?.result ?? plan(input)
    }
  } catch (error) {
    const message = `Error interno del planificador: ${(error as Error).message}`
    result = { ok: false, reason: message }
    routes = Object.fromEntries(MODE_ORDER.map((mode) => [
      mode,
      { id: mode, mode, result: { ok: false, reason: message }, legendaryUsage: 0, expectedEffort: Number.POSITIVE_INFINITY, efficiencyScore: 0, recommended: false },
    ])) as RouteAlternatives
  }
  ;(self as unknown as Worker).postMessage({ requestId, result, routes, project } satisfies PlanResponse)
}

/**
 * Reutiliza el mismo Dijkstra para cada politica de coste ya disponible.
 * Siempre las 3 -Only My Collection / Easiest / Fastest-, en sus 3
 * identidades fijas: una politica sin ruta valida sigue siendo una entrada
 * real (con `result.ok:false` y su motivo), nunca se omite ni se reordena.
 */
function planAlternatives(input: PlannerInput): RouteAlternatives {
  const palsById = new Map(getPlannerContext().pals.map((pal) => [pal.id, pal]))

  const base: Record<PlannerMode, Omit<RouteAlternative, 'efficiencyScore' | 'recommended'>> = {} as never
  for (const mode of MODE_ORDER) {
    const result = plan({ ...input, mode })
    const legendaryUsage = result.ok && result.root ? countLegendaryUsage(result.root, palsById) : 0
    base[mode] = {
      id: mode,
      mode,
      result,
      legendaryUsage,
      expectedEffort: result.ok && result.stats ? expectedEffort(result, legendaryUsage) : Number.POSITIVE_INFINITY,
    }
  }

  const validEfforts = MODE_ORDER.filter((mode) => base[mode].result.ok).map((mode) => base[mode].expectedEffort)
  const bestEffort = validEfforts.length > 0 ? Math.min(...validEfforts) : Number.POSITIVE_INFINITY

  const routes: Record<PlannerMode, RouteAlternative> = {} as never
  for (const mode of MODE_ORDER) {
    const entry = base[mode]
    const ok = entry.result.ok
    routes[mode] = {
      ...entry,
      efficiencyScore: ok ? Math.max(1, Math.round((bestEffort / Math.max(1, entry.expectedEffort)) * 100)) : 0,
      recommended: ok && entry.expectedEffort === bestEffort,
    }
  }
  return routes
}

function expectedEffort(result: PlanResult, legendaryUsage: number): number {
  const stats = result.stats!
  return Math.round(
    (stats.totalExpectedEggs + stats.generations * 5 + stats.steps * 2 + stats.capturesNeeded * 6 + legendaryUsage * 10) * 10,
  ) / 10
}

function countLegendaryUsage(root: PlanNode, palsById: Map<string, { rarity: number }>): number {
  const legendary = new Set<string>()
  const walk = (node: PlanNode) => {
    if (node.duplicateOf) return
    if ((palsById.get(node.palId)?.rarity ?? 0) >= 9) legendary.add(node.palId)
    node.parents?.forEach(walk)
  }
  walk(root)
  return legendary.size
}
