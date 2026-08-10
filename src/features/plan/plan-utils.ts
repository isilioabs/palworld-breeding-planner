import type { PlanNode, PlanResult, PlannerMode } from '@/domain/types'
import { MODES, type PriorityLevel } from '@/domain/breeding/cost'

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

/**
 * Llaves de los cruces mas superficiales a partir de `maxDepth` (sin bajar
 * mas alla): colapsarlas basta para ocultar todo lo que cuelga debajo -el
 * propio TreeNode no renderiza a los padres de un nodo colapsado-, asi que no
 * hace falta juntar cada nodo profundo, solo el primero de cada rama.
 * Usado para arrancar un plan grande ya parcialmente colapsado en touch (ver
 * breeding-tree.tsx): menos tarjetas montadas de entrada, sin perder acceso
 * -el boton "+N cruces ocultos" ya existente sigue expandiendo bajo demanda.
 */
export function collapsedKeysBeyondDepth(root: PlanNode, maxDepth: number): string[] {
  const keys: string[] = []
  const walk = (node: PlanNode) => {
    if (node.kind === 'breed' && node.depth >= maxDepth) {
      keys.push(node.key)
      return
    }
    node.parents?.forEach(walk)
  }
  walk(root)
  return keys
}

/** Semaforo para la probabilidad de un paso. */
export function chanceTone(chance: number): 'good' | 'warn' | 'bad' {
  if (chance >= 0.3) return 'good'
  if (chance >= 0.1) return 'warn'
  return 'bad'
}

type Stats = NonNullable<PlanResult['stats']>

function levelValue(level: PriorityLevel, stats: Stats): number {
  switch (level) {
    case 'generations':
      return stats.generations
    case 'steps':
      return stats.steps
    case 'eggs':
      return stats.totalExpectedEggs
    case 'maxCapture':
      return stats.maxCaptureDifficulty ?? 0
    case 'totalCapture':
      return stats.totalCaptureDifficulty ?? 0
  }
}

export interface StatDelta {
  key: 'generations' | 'steps' | 'eggs' | 'captures'
  delta: number
}

/**
 * Deltas para el aviso de "ruta mejorada". Solo devuelve algo cuando `next`
 * es mejor que `prev` bajo el orden lexicografico del modo activo -nunca en
 * un empate ni en un cambio a peor. Un orden lexicografico puede aceptar que
 * una metrica individual suba si otra de mayor prioridad ya bajo (ver el test
 * de monotonia en planner.test.ts): por eso la comparacion se hace nivel a
 * nivel y no exigiendo "<=" en las cuatro a la vez.
 */
export function diffStats(mode: PlannerMode, prev: Stats | null, next: Stats | null): StatDelta[] {
  if (!prev || !next) return []
  const order = MODES[mode].weights.priorityOrder ?? []
  let improved = false
  for (const level of order) {
    const a = levelValue(level, next)
    const b = levelValue(level, prev)
    if (a < b) {
      improved = true
      break
    }
    if (a > b) return [] // peor en el primer nivel donde difieren: no es una mejora
  }
  if (!improved) return []

  const deltas: StatDelta[] = []
  if (next.generations !== prev.generations) deltas.push({ key: 'generations', delta: next.generations - prev.generations })
  if (next.steps !== prev.steps) deltas.push({ key: 'steps', delta: next.steps - prev.steps })
  const eggsDelta = Math.round((next.totalExpectedEggs - prev.totalExpectedEggs) * 10) / 10
  if (eggsDelta !== 0) deltas.push({ key: 'eggs', delta: eggsDelta })
  if (next.capturesNeeded !== prev.capturesNeeded) deltas.push({ key: 'captures', delta: next.capturesNeeded - prev.capturesNeeded })
  return deltas
}
