/**
 * Resolucion de "padre A + padre B = hijo".
 *
 * Regla del juego:
 *   1. Si la pareja esta en la tabla de combinaciones unicas, manda esa.
 *   2. Si no, se calcula  target = floor((powerA + powerB + 1) / 2)  y el hijo
 *      es el Pal cuyo CombiRank queda mas cerca de ese valor.
 *
 * En lugar de reimplementar el paso 2 con reglas de desempate (que tienen
 * excepciones), la base de datos incluye la tabla `rankToChild` ya resuelta
 * y verificada contra las 44.849 parejas reales del juego. Ver
 * scripts/build-data.mjs.
 */
import type { BreedingData, Gender, Pal } from '../types'

export interface ChildResolver {
  size: number
  /** indice -> Pal */
  pals: Pal[]
  indexOf(palId: string): number
  /** Devuelve el indice del hijo, o -1 si la pareja no produce cria generica. */
  childIndex(a: number, b: number): number
  childId(aId: string, bId: string): string | null
  /** Combinaciones que exigen sexos concretos, indexadas por pareja. */
  genderOptions(a: number, b: number): GenderOption[]
  /** Todas las parejas (indices) que producen un hijo concreto. */
  parentsOf(childId: string): [string, string][]
}

export interface GenderOption {
  childIndex: number
  a: Gender
  b: Gender
}

const NO_CHILD = -1

export function createResolver(pals: Pal[], breeding: BreedingData): ChildResolver {
  const n = pals.length
  const indexMap = new Map(pals.map((p, i) => [p.id, i]))
  const idx = (id: string) => indexMap.get(id) ?? NO_CHILD

  // Tabla rank -> indice de hijo.
  const rankToChild = new Map<number, number>()
  for (const [rank, childId] of Object.entries(breeding.rankToChild)) {
    rankToChild.set(Number(rank), idx(childId))
  }

  // Matriz simetrica n x n con el indice del hijo.
  const matrix = new Int16Array(n * n).fill(NO_CHILD)
  for (let a = 0; a < n; a++) {
    for (let b = a; b < n; b++) {
      const target = Math.floor((pals[a].power + pals[b].power + 1) / 2)
      const child = rankToChild.get(target) ?? NO_CHILD
      matrix[a * n + b] = child
      matrix[b * n + a] = child
    }
  }

  // Las combinaciones unicas sobreescriben la formula.
  for (const [aId, bId, childId] of breeding.unique) {
    const a = idx(aId)
    const b = idx(bId)
    const c = idx(childId)
    if (a < 0 || b < 0 || c < 0) continue
    matrix[a * n + b] = c
    matrix[b * n + a] = c
  }

  // Parejas que SOLO dan cria con sexos concretos: se sacan de la matriz
  // generica para no ofrecer un resultado que el juego no produce.
  const genderMap = new Map<number, GenderOption[]>()
  for (const [aId, aGender, bId, bGender, childId] of breeding.genderUnique) {
    const a = idx(aId)
    const b = idx(bId)
    const c = idx(childId)
    if (a < 0 || b < 0 || c < 0) continue
    for (const [x, y, gx, gy] of [
      [a, b, aGender, bGender],
      [b, a, bGender, aGender],
    ] as const) {
      const key = x * n + y
      const list = genderMap.get(key) ?? []
      list.push({ childIndex: c, a: gx, b: gy })
      genderMap.set(key, list)
      matrix[key] = NO_CHILD
    }
  }

  let reverse: Map<string, [string, string][]> | null = null
  const buildReverse = () => {
    const map = new Map<string, [string, string][]>()
    for (let a = 0; a < n; a++) {
      for (let b = a; b < n; b++) {
        const c = matrix[a * n + b]
        if (c < 0) continue
        const list = map.get(pals[c].id) ?? []
        list.push([pals[a].id, pals[b].id])
        map.set(pals[c].id, list)
      }
    }
    for (const [key, options] of genderMap) {
      const a = Math.floor(key / n)
      const b = key % n
      if (a > b) continue
      for (const opt of options) {
        const list = map.get(pals[opt.childIndex].id) ?? []
        list.push([pals[a].id, pals[b].id])
        map.set(pals[opt.childIndex].id, list)
      }
    }
    return map
  }

  return {
    size: n,
    pals,
    indexOf: idx,
    childIndex: (a, b) => matrix[a * n + b],
    childId(aId, bId) {
      const a = idx(aId)
      const b = idx(bId)
      if (a < 0 || b < 0) return null
      const c = matrix[a * n + b]
      return c < 0 ? null : pals[c].id
    },
    genderOptions: (a, b) => genderMap.get(a * n + b) ?? [],
    parentsOf(childId) {
      reverse ??= buildReverse()
      return reverse.get(childId) ?? []
    },
  }
}
