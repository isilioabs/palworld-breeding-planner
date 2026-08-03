/**
 * Planificador de proyecto multiobjetivo.
 *
 * Mantiene el motor de crianza intacto: resuelve cada objetivo con el mismo
 * planificador y despues consolida estados equivalentes. En Palworld un Pal
 * intermedio se puede reutilizar como padre, asi que una rama con la misma
 * especie y las mismas pasivas se ejecuta una vez para el proyecto completo.
 */
import { getPlannerContext, plan } from './index'
import type { PlanNode, PlannerInput, ProjectPlan } from '../types'

export function planProject(input: PlannerInput): ProjectPlan {
  const targets = [...new Set(input.targetPalIds ?? (input.targetPalId ? [input.targetPalId] : []))]
  if (targets.length < 2) return { ok: false, reason: 'El proyecto necesita al menos dos Pals objetivo.' }

  const results = targets.map((targetPalId) => plan({ ...input, targetPalId }))
  const failedAt = results.findIndex((result) => !result.ok || !result.root || !result.stats)
  if (failedAt >= 0) {
    return { ok: false, reason: results[failedAt].reason ?? 'No se pudo calcular uno de los objetivos del proyecto.' }
  }

  const roots = results.map((result) => result.root!)
  roots.forEach((root, index) => prefixTreeKeys(root, 'project-' + index + '-'))
  const occurrences = new Map<string, number>()
  const kinds = new Map<string, PlanNode['kind']>()
  roots.forEach((root) => visit(root, (node) => {
    const key = stateKey(node)
    occurrences.set(key, (occurrences.get(key) ?? 0) + 1)
    kinds.set(key, node.kind)
  }))
  roots.forEach((root) => visit(root, (node) => {
    node.shared = (occurrences.get(stateKey(node)) ?? 0) > 1
  }))

  const counted = new Set<string>()
  const legendary = new Set<string>()
  let steps = 0
  let eggs = 0
  let captures = 0

  const palsById = new Map(getPlannerContext().pals.map((pal) => [pal.id, pal]))
  roots.forEach((root) => visit(root, (node) => {
    if ((palsById.get(node.palId)?.rarity ?? 0) >= 9) legendary.add(node.palId)
    const key = stateKey(node)
    if (counted.has(key)) return
    counted.add(key)
    if (node.kind === 'breed') {
      steps++
      eggs += node.expectedEggs ?? 0
    } else if (node.kind === 'capture') {
      captures++
    }
  }))

  const rawSteps = results.reduce((sum, result) => sum + result.stats!.steps, 0)
  const rawEggs = results.reduce((sum, result) => sum + result.stats!.totalExpectedEggs, 0)
  const rawCaptures = results.reduce((sum, result) => sum + result.stats!.capturesNeeded, 0)
  const generations = Math.max(...results.map((result) => result.stats!.generations))
  const sharedBranches = [...occurrences.entries()].filter(([key, count]) => count > 1 && kinds.get(key) === 'breed').length
  const sharedParents = [...occurrences.entries()].filter(([key, count]) => count > 1 && kinds.get(key) !== 'breed').length
  const totalExpectedEggs = round(eggs)
  const capturesNeeded = captures
  const expectedEffort = round(totalExpectedEggs + generations * 5 + steps * 2 + capturesNeeded * 6 + legendary.size * 10)

  return {
    ok: true,
    roots,
    stats: {
      targets: targets.length,
      steps,
      generations,
      totalExpectedEggs,
      capturesNeeded,
      legendaryUsage: legendary.size,
      sharedBranches,
      sharedParents,
      eggsSaved: Math.max(0, round(rawEggs - totalExpectedEggs)),
      capturesSaved: Math.max(0, rawCaptures - capturesNeeded),
      duplicateBreedsAvoided: Math.max(0, rawSteps - steps),
      expectedEffort,
    },
  }
}

function prefixTreeKeys(node: PlanNode, prefix: string): void {
  node.key = prefix + node.key
  if (node.duplicateOf) node.duplicateOf = prefix + node.duplicateOf
  node.parents?.forEach((parent) => prefixTreeKeys(parent, prefix))
}

function visit(node: PlanNode, fn: (node: PlanNode) => void) {
  fn(node)
  node.parents?.forEach((parent) => visit(parent, fn))
}

function stateKey(node: PlanNode): string {
  const passives = [...node.passives].sort().join(',')
  if (node.kind === 'owned') return ['owned', node.ownedUid ?? node.palId, passives].join('|')
  return [node.kind, node.palId, passives].join('|')
}

function round(value: number): number {
  return Math.round(value * 10) / 10
}
