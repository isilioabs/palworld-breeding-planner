/// <reference lib="webworker" />
/**
 * El planificador corre en un worker para que la UI no se congele mientras se
 * explora el hipergrafo. Cada peticion lleva un `requestId`: las respuestas que
 * llegan tarde se descartan en el hilo principal.
 */
import { getPlannerContext, plan } from './index'
import { MODE_ORDER } from './cost'
import { planProject } from './project-planner'
import type { PlanNode, PlanResult, PlannerInput, ProjectPlan, RouteAlternative } from '../types'

export interface PlanRequest {
  requestId: number
  input: PlannerInput
}

export interface PlanResponse {
  requestId: number
  result: PlanResult
  routes: RouteAlternative[]
  project?: ProjectPlan
}

self.onmessage = (event: MessageEvent<PlanRequest>) => {
  const { requestId, input } = event.data
  let result: PlanResult
  let routes: RouteAlternative[] = []
  let project: ProjectPlan | undefined
  try {
    if ((input.targetPalIds?.length ?? 0) > 1) {
      project = planProject(input)
      result = project.ok && project.roots?.[0]
        ? { ok: true, root: project.roots[0] }
        : { ok: false, reason: project.reason }
    } else {
      routes = planAlternatives(input)
      result = routes.find((route) => route.mode === input.mode)?.result ?? plan(input)
    }
  } catch (error) {
    result = { ok: false, reason: `Error interno del planificador: ${(error as Error).message}` }
  }
  ;(self as unknown as Worker).postMessage({ requestId, result, routes, project } satisfies PlanResponse)
}

/**
 * Reutiliza el mismo Dijkstra para cada politica de coste ya disponible.
 * No se modifica el algoritmo ni se fabrican rutas: se muestran solo los
 * optimos validos que devuelve el motor y se eliminan arboles identicos.
 */
function planAlternatives(input: PlannerInput): RouteAlternative[] {
  const modes = [input.mode, ...MODE_ORDER.filter((mode) => mode !== input.mode)]
  const seen = new Set<string>()
  const candidates: Array<Omit<RouteAlternative, 'efficiencyScore' | 'recommended'>> = []
  const palsById = new Map(getPlannerContext().pals.map((pal) => [pal.id, pal]))

  for (const mode of modes) {
    const result = plan({ ...input, mode })
    if (!result.ok || !result.root || !result.stats) continue
    const signature = routeSignature(result.root)
    if (seen.has(signature)) continue
    seen.add(signature)
    const legendaryUsage = countLegendaryUsage(result.root, palsById)
    candidates.push({
      id: mode,
      mode,
      result,
      legendaryUsage,
      expectedEffort: expectedEffort(result, legendaryUsage),
    })
  }

  if (candidates.length === 0) return []
  const bestEffort = Math.min(...candidates.map((route) => route.expectedEffort))
  return candidates
    .map((route) => ({
      ...route,
      efficiencyScore: Math.max(1, Math.round((bestEffort / Math.max(1, route.expectedEffort)) * 100)),
      recommended: route.expectedEffort === bestEffort,
    }))
    .sort((a, b) => b.efficiencyScore - a.efficiencyScore || a.expectedEffort - b.expectedEffort)
    .slice(0, 4)
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

function routeSignature(node: PlanNode): string {
  const own = node.kind === 'owned' ? `:${node.ownedUid ?? ''}` : ''
  const parents = node.parents ? `(${routeSignature(node.parents[0])},${routeSignature(node.parents[1])})` : ''
  return `${node.palId}:${node.kind}:${[...node.passives].sort().join(',')}${own}${parents}`
}
