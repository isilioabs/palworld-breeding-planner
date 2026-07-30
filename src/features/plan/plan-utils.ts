import type { PlanNode } from '@/domain/types'

/**
 * Numera los pasos de crianza en post-orden: ese es el orden real de ejecucion
 * (primero las hojas, el objetivo el ultimo).
 */
export function enumerateSteps(root: PlanNode): Map<string, number> {
  const order = new Map<string, number>()
  let n = 0
  const walk = (node: PlanNode) => {
    if (node.kind !== 'breed') return
    node.parents?.forEach(walk)
    order.set(node.key, ++n)
  }
  walk(root)
  return order
}

export function collectKeys(root: PlanNode): string[] {
  const keys: string[] = []
  const walk = (node: PlanNode) => {
    keys.push(node.key)
    node.parents?.forEach(walk)
  }
  walk(root)
  return keys
}

/** Cruces que hay por debajo de un nodo (sin contarlo a el). */
export function countBreedNodes(node: PlanNode): number {
  let total = 0
  const walk = (current: PlanNode) => {
    if (current.kind === 'breed') total++
    current.parents?.forEach(walk)
  }
  node.parents?.forEach(walk)
  return total
}

/** Semaforo para la probabilidad de un paso. */
export function chanceTone(chance: number): 'good' | 'warn' | 'bad' {
  if (chance >= 0.3) return 'good'
  if (chance >= 0.1) return 'warn'
  return 'bad'
}
