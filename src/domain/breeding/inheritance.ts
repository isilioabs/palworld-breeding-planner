/**
 * Modelo de herencia de pasivas.
 *
 * Como funciona en el juego (pesos extraidos de DT_PalCombiInheritance):
 *  - Se juntan las pasivas de los dos padres en un unico "bote" sin repetidos.
 *  - Se sortea cuantas se heredan: 1 (40%), 2 (30%), 3 (20%), 4 (10%).
 *  - Se eligen esas N al azar del bote, sin reemplazo.
 *  - Aparte, se anaden 0-3 pasivas aleatorias: 0 (40%), 1 (30%), 2 (20%), 3 (10%).
 *
 * La probabilidad de que una cria concreta traiga TODAS las pasivas deseadas es
 * un problema hipergeometrico: si el bote tiene `pool` pasivas y queremos `want`
 * concretas, y se heredan `k`:
 *
 *     P(las `want` estan entre las `k`) = C(pool - want, k - want) / C(pool, k)
 *
 * y se suma ponderando por la probabilidad de cada `k`.
 */
import type { Mechanics } from '../types'

export interface InheritanceModel {
  /** P(heredar exactamente k) para k = 1..4 */
  inheritWeights: number[]
  /** P(anadir exactamente k pasivas aleatorias) para k = 0..3 */
  randomWeights: number[]
  maxPassives: number
}

export function createInheritanceModel(mechanics: Mechanics): InheritanceModel {
  const norm = (weights: Record<string, number>, from: number, to: number) => {
    const total = Object.values(weights).reduce((a, b) => a + b, 0)
    const out: number[] = []
    for (let k = from; k <= to; k++) out.push((weights[String(k)] ?? 0) / total)
    return out
  }
  return {
    inheritWeights: norm(mechanics.passiveInheritanceWeights, 1, mechanics.maxPassives),
    randomWeights: norm(mechanics.passiveRandomWeights, 0, mechanics.maxPassives - 1),
    maxPassives: mechanics.maxPassives,
  }
}

const binomCache = new Map<number, number>()
function binom(n: number, k: number): number {
  if (k < 0 || k > n) return 0
  if (k === 0 || k === n) return 1
  const key = n * 100 + k
  const hit = binomCache.get(key)
  if (hit !== undefined) return hit
  let result = 1
  for (let i = 1; i <= k; i++) result = (result * (n - k + i)) / i
  const rounded = Math.round(result)
  binomCache.set(key, rounded)
  return rounded
}

/**
 * Probabilidad de que una cria herede las `want` pasivas deseadas cuando el
 * bote conjunto de los padres tiene `pool` pasivas distintas.
 */
export function inheritChance(model: InheritanceModel, pool: number, want: number): number {
  if (want <= 0) return 1
  if (pool < want) return 0

  let p = 0
  for (let k = 1; k <= model.maxPassives; k++) {
    const weight = model.inheritWeights[k - 1]
    if (!weight) continue
    // Si se piden mas pasivas de las que hay en el bote, se heredan todas.
    const taken = Math.min(k, pool)
    if (taken < want) continue
    p += weight * (binom(pool - want, taken - want) / binom(pool, taken))
  }
  return p
}

/** Probabilidad de que ademas no se cuelen pasivas aleatorias extra. */
export function noJunkChance(model: InheritanceModel): number {
  return model.randomWeights[0] ?? 0
}

/** Huevos esperados hasta conseguir una cria valida. */
export function expectedEggs(chance: number): number {
  if (chance <= 0) return Infinity
  return 1 / chance
}
