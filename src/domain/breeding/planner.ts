/**
 * Planificador de rutas de crianza.
 *
 * ---------------------------------------------------------------------------
 * MODELO
 * ---------------------------------------------------------------------------
 * El problema es una busqueda en un hipergrafo: cada "nodo" es un Pal que ya
 * puedes tener, y cada "hiperarista" toma DOS nodos y produce uno nuevo.
 *
 *   estado = (especie, mascara de pasivas deseadas que porta)
 *
 * Con un maximo de 4 pasivas deseadas hay 16 mascaras, asi que el espacio de
 * estados es |Pals| x 16 = 4.784 estados. Perfectamente explorable.
 *
 * ---------------------------------------------------------------------------
 * ALGORITMO
 * ---------------------------------------------------------------------------
 * Dijkstra generalizado a hiperaristas (algoritmo de Knuth para "superior
 * functions"). Es valido porque el coste de un paso siempre es mayor que el de
 * cualquiera de sus dos padres:
 *
 *     coste(hijo) = coste(padreA) + coste(padreB) + costePaso   con costePaso > 0
 *
 * Bucle: se extrae el estado mas barato pendiente, se marca como definitivo y
 * se combina con TODOS los estados ya definitivos. Cuando el objetivo se marca
 * como definitivo, su ruta es optima bajo la funcion de coste elegida.
 *
 * A* seria posible con una heuristica admisible (p.ej. generaciones minimas
 * restantes), pero con 4.784 estados Dijkstra ya termina en milisegundos y
 * evita el riesgo de una heuristica mal calibrada.
 *
 * ---------------------------------------------------------------------------
 * SUPUESTOS (documentados a proposito)
 * ---------------------------------------------------------------------------
 *  - Una cria intermedia se considera "limpia": se asume que crias hasta sacar
 *    una que solo lleve las pasivas objetivo. Es lo que hace todo el mundo en
 *    la practica y evita que el bote crezca sin control.
 *  - Un Pal capturado en estado salvaje se considera sin pasivas utiles
 *    (aprox. 20% de los salvajes salen con 0 pasivas).
 *  - El sexo solo se modela en las combinaciones que lo exigen.
 *  - Cada Pal de tu coleccion se usa como maximo una vez en todo el arbol.
 */
import type { Mechanics, Pal, PlanNode, PlanResult, PlannerInput, PlannerMode } from '../types'
import { createInheritanceModel, expectedEggs, inheritChance, type InheritanceModel } from './inheritance'
import {
  DEPTH_PRIORITY_SCALE,
  MODES,
  canCapture,
  captureDifficulty,
  stepCost,
  type CostWeights,
} from './cost'
import type { ChildResolver } from './resolver'

const KIND_OWNED = 1
const KIND_CAPTURE = 2
const KIND_BREED = 3

/** Solo se rastrean los primeros 30 Pals de la coleccion para el control de reutilizacion. */
const MAX_TRACKED_OWNED = 30

export interface PlannerContext {
  pals: Pal[]
  resolver: ChildResolver
  mechanics: Mechanics
}

export interface PlannerSettings {
  maxSettled: number
  timeBudgetMs: number
}

// El espacio de estados completo es |Pals| x 16 = 4.784, asi que este limite no
// recorta nada en la practica: es solo una red de seguridad si crece la base de
// datos. Explorarlo entero cuesta ~250 ms.
const DEFAULTS: PlannerSettings = { maxSettled: 6000, timeBudgetMs: 8000 }

const POPCOUNT = new Uint8Array(16)
for (let i = 0; i < 16; i++) POPCOUNT[i] = (i & 1) + ((i >> 1) & 1) + ((i >> 2) & 1) + ((i >> 3) & 1)

/** Monticulo binario minimo con borrado perezoso. */
class MinHeap {
  private cost: number[] = []
  private id: number[] = []
  get size() {
    return this.id.length
  }
  push(cost: number, id: number) {
    this.cost.push(cost)
    this.id.push(id)
    let i = this.id.length - 1
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (this.cost[parent] <= this.cost[i]) break
      this.swap(parent, i)
      i = parent
    }
  }
  pop(): { cost: number; id: number } | null {
    if (!this.id.length) return null
    const top = { cost: this.cost[0], id: this.id[0] }
    const lastCost = this.cost.pop()!
    const lastId = this.id.pop()!
    if (this.id.length) {
      this.cost[0] = lastCost
      this.id[0] = lastId
      let i = 0
      for (;;) {
        const l = 2 * i + 1
        const r = l + 1
        let best = i
        if (l < this.id.length && this.cost[l] < this.cost[best]) best = l
        if (r < this.id.length && this.cost[r] < this.cost[best]) best = r
        if (best === i) break
        this.swap(best, i)
        i = best
      }
    }
    return top
  }
  private swap(a: number, b: number) {
    ;[this.cost[a], this.cost[b]] = [this.cost[b], this.cost[a]]
    ;[this.id[a], this.id[b]] = [this.id[b], this.id[a]]
  }
}

export function planBreeding(
  input: PlannerInput,
  ctx: PlannerContext,
  settings: Partial<PlannerSettings> = {},
): PlanResult {
  const started = performance.now()
  const { maxSettled, timeBudgetMs } = { ...DEFAULTS, ...settings }
  const { pals, resolver, mechanics } = ctx

  if (!input.targetPalId) return { ok: false, reason: 'Elige un Pal objetivo.' }
  const targetIdx = resolver.indexOf(input.targetPalId)
  if (targetIdx < 0) return { ok: false, reason: 'El Pal objetivo no existe en la base de datos.' }

  const desired = [...new Set(input.desiredPassives)].slice(0, mechanics.maxPassives)
  const D = desired.length
  const MASKS = 1 << D
  const GOAL_MASK = MASKS - 1
  const N = pals.length
  const STATES = N * MASKS

  const mode: PlannerMode = input.mode
  const weights: CostWeights = MODES[mode].weights
  const model = createInheritanceModel(mechanics)

  // --- tabla de probabilidades precalculada: bote (0..16) x deseadas (0..4) --
  const MAX_POOL = 20
  const chanceTable = new Float64Array((MAX_POOL + 1) * (D + 1))
  for (let pool = 0; pool <= MAX_POOL; pool++) {
    for (let want = 0; want <= D; want++) {
      chanceTable[pool * (D + 1) + want] = inheritChance(model, pool, want)
    }
  }
  const chanceOf = (pool: number, want: number) =>
    chanceTable[Math.min(pool, MAX_POOL) * (D + 1) + want]

  // --- arrays de estado --------------------------------------------------
  const cost = new Float64Array(STATES).fill(Infinity)
  const depth = new Uint8Array(STATES)
  const settled = new Uint8Array(STATES)
  const kind = new Uint8Array(STATES)
  const pool = new Uint8Array(STATES)
  const used = new Int32Array(STATES)
  const parentA = new Int32Array(STATES).fill(-1)
  const parentB = new Int32Array(STATES).fill(-1)
  const ownedRef = new Int32Array(STATES).fill(-1)
  const genderA = new Int8Array(STATES)
  const genderB = new Int8Array(STATES)
  const stepEggs = new Float64Array(STATES)
  const stepChance = new Float64Array(STATES)
  const stepPool = new Uint8Array(STATES)

  const heap = new MinHeap()

  /**
   * Clave de ordenacion. En modo `depthFirst` es lexicografica (generaciones,
   * coste): asi "ruta mas rapida" minimiza de verdad la profundidad del arbol y
   * no solo el numero de cruces. La combinacion sigue siendo monotona y
   * superior en ese orden, que es lo que necesita el algoritmo de Knuth.
   */
  const keyOf = (c: number, d: number) => {
    if (!Number.isFinite(c)) return Infinity
    return weights.depthFirst ? d * DEPTH_PRIORITY_SCALE + Math.min(c, DEPTH_PRIORITY_SCALE - 1) : c
  }

  const relax = (
    state: number,
    newCost: number,
    newDepth: number,
    newPool: number,
    newKind: number,
    newUsed: number,
    a = -1,
    b = -1,
    owned = -1,
    gA = 0,
    gB = 0,
    eggs = 0,
    chance = 1,
    combinedPool = 0,
  ) => {
    if (!Number.isFinite(newCost)) return
    if (settled[state]) return
    const newKey = keyOf(newCost, newDepth)
    const currentKey = keyOf(cost[state], depth[state])
    // Empate: nos quedamos con el bote mas pequeno (mejores probabilidades luego).
    if (newKey > currentKey || (newKey === currentKey && newPool >= pool[state])) return
    cost[state] = newCost
    depth[state] = newDepth
    pool[state] = newPool
    kind[state] = newKind
    used[state] = newUsed
    parentA[state] = a
    parentB[state] = b
    ownedRef[state] = owned
    genderA[state] = gA
    genderB[state] = gB
    stepEggs[state] = eggs
    stepChance[state] = chance
    stepPool[state] = combinedPool
    heap.push(newKey, state)
  }

  // --- estados iniciales: la coleccion del jugador -------------------------
  const owned = input.owned.filter((o) => resolver.indexOf(o.palId) >= 0)
  owned.forEach((entry, i) => {
    const palIdx = resolver.indexOf(entry.palId)
    const unique = [...new Set(entry.passives)]
    let ownMask = 0
    for (let d = 0; d < D; d++) if (unique.includes(desired[d])) ownMask |= 1 << d
    const poolSize = unique.length
    const token = i < MAX_TRACKED_OWNED ? 1 << i : 0
    // Todos los submasks: a veces interesa "usar" solo parte de sus pasivas.
    for (let sub = ownMask; ; sub = (sub - 1) & ownMask) {
      relax(palIdx * MASKS + sub, 0, 0, poolSize, KIND_OWNED, token, -1, -1, i)
      if (sub === 0) break
    }
  })

  // --- estados iniciales: capturas -----------------------------------------
  for (let i = 0; i < N; i++) {
    if (!canCapture(pals[i], weights.captureTier)) continue
    const difficulty = captureDifficulty(pals[i])
    if (!Number.isFinite(difficulty)) continue
    relax(i * MASKS, weights.capture * (0.5 + difficulty), 0, 0, KIND_CAPTURE, 0)
  }

  if (heap.size === 0) {
    return {
      ok: false,
      reason:
        mode === 'collection'
          ? 'Tu coleccion esta vacia. Anade Pals o cambia de modo.'
          : 'No hay ningun punto de partida disponible.',
      suggestMode: mode === 'collection' ? 'breeding' : undefined,
    }
  }

  // En "Full breeding" hay Pals que no salen por ningun lado: ni se pueden
  // capturar (boss o nivel alto) ni los produce ninguna pareja que no sean ellos
  // mismos. Orserk es el caso tipico. Merece un aviso concreto antes de buscar.
  if (weights.captureTier === 'easy') {
    const target = pals[targetIdx]
    const bredFromOthers = resolver
      .parentsOf(target.id)
      .some(([a, b]) => a !== target.id || b !== target.id)
    if (!canCapture(target, 'easy') && !bredFromOthers) {
      return {
        ok: false,
        reason: `${target.nameEs} no se puede criar a partir de otras especies: solo se consigue capturandolo o cruzando dos ${target.nameEs}. Cambia a "Breeding + captura".`,
        suggestMode: 'hybrid',
      }
    }
  }

  // Las pasivas solo pueden entrar en el arbol a traves de tu coleccion: se
  // asume que un Pal salvaje sale sin pasivas utiles. Si alguna deseada no la
  // tiene nadie, no hay ruta posible y conviene decirlo claro antes de buscar.
  const availablePassives = new Set(owned.flatMap((o) => o.passives))
  const missing = desired.filter((p) => !availablePassives.has(p))
  if (missing.length > 0) {
    return {
      ok: false,
      reason:
        owned.length === 0
          ? 'Ningun Pal de tu coleccion aporta las pasivas pedidas: anade en el paso 2 los Pals que ya tienes y marca sus pasivas. Las pasivas no se pueden capturar, solo heredar.'
          : `Ninguno de tus Pals lleva ${missing.length === 1 ? 'esta pasiva' : 'estas pasivas'}. Anade un Pal que ${missing.length === 1 ? 'la tenga' : 'las tenga'} o quitala de la lista.`,
      missingPassives: missing,
    }
  }

  // --- Dijkstra sobre hiperaristas ----------------------------------------
  const goal = targetIdx * MASKS + GOAL_MASK
  const settledList: number[] = []
  let found = false
  let deadlineChecks = 0

  while (heap.size > 0) {
    const top = heap.pop()!
    const u = top.id
    if (settled[u] || top.cost > keyOf(cost[u], depth[u])) continue
    settled[u] = 1
    settledList.push(u)
    if (u === goal) {
      found = true
      break
    }
    if (settledList.length >= maxSettled) break
    if ((deadlineChecks++ & 63) === 0 && performance.now() - started > timeBudgetMs) break

    const uPal = (u / MASKS) | 0
    const uMask = u % MASKS
    const uCost = cost[u]
    const uDepth = depth[u]
    const uPool = pool[u]
    const uUsed = used[u]

    for (let k = 0; k < settledList.length; k++) {
      const v = settledList[k]
      // Un mismo ejemplar no puede criar consigo mismo. Se permite emparejar un
      // estado consigo mismo solo si su subarbol no consume Pals de la coleccion
      // (entonces basta con repetir el proceso para tener dos ejemplares).
      if (v === u && uUsed !== 0) continue
      const vUsed = used[v]
      if (v !== u && (uUsed & vUsed) !== 0) continue

      const vPal = (v / MASKS) | 0
      const vMask = v % MASKS
      const newMask = uMask | vMask
      const want = POPCOUNT[newMask]
      const combined = uPool + pool[v] - POPCOUNT[uMask & vMask]
      const chance = chanceOf(combined, want)
      if (chance <= 0) continue
      const eggs = expectedEggs(chance)
      const parentsCost = v === u ? 2 * uCost : uCost + cost[v]
      const newDepth = 1 + Math.max(uDepth, depth[v])
      const baseCost = parentsCost + stepCost(weights, eggs, combined, want, false)

      const generic = resolver.childIndex(uPal, vPal)
      if (generic >= 0) {
        relax(
          generic * MASKS + newMask,
          baseCost,
          newDepth,
          want,
          KIND_BREED,
          uUsed | vUsed,
          u,
          v,
          -1,
          0,
          0,
          eggs,
          chance,
          combined,
        )
      }

      const gendered = resolver.genderOptions(uPal, vPal)
      for (let g = 0; g < gendered.length; g++) {
        const opt = gendered[g]
        relax(
          opt.childIndex * MASKS + newMask,
          parentsCost + stepCost(weights, eggs, combined, want, true),
          newDepth,
          want,
          KIND_BREED,
          uUsed | vUsed,
          u,
          v,
          -1,
          opt.a === 'MALE' ? 1 : 2,
          opt.b === 'MALE' ? 1 : 2,
          eggs,
          chance,
          combined,
        )
      }
    }
  }

  if (!found) {
    const partial = bestPartial(targetIdx, MASKS, GOAL_MASK, settled, cost)
    const salida =
      mode === 'collection'
        ? ' Prueba con "Full breeding" para permitir capturas.'
        : mode === 'breeding'
          ? ' Prueba con "Breeding + captura": hay Pals que solo se consiguen capturando bosses o especies de nivel alto.'
          : ' Prueba a reducir el numero de pasivas deseadas.'
    return {
      ok: false,
      reason:
        partial === null
          ? `No se encontro ninguna ruta hasta ${pals[targetIdx].nameEs}.${salida}`
          : `No se logro reunir las ${D} pasivas en ${pals[targetIdx].nameEs}. Lo maximo alcanzable son ${POPCOUNT[partial]} de ellas.${salida}`,
      suggestMode: mode === 'collection' ? 'breeding' : mode === 'breeding' ? 'hybrid' : undefined,
    }
  }

  // --- reconstruccion del arbol -------------------------------------------
  const seen = new Map<number, string>()
  let counter = 0
  const build = (state: number, depth: number): PlanNode => {
    const palIdx = (state / MASKS) | 0
    const mask = state % MASKS
    const key = `n${counter++}`
    const passives: string[] = []
    for (let d = 0; d < D; d++) if (mask & (1 << d)) passives.push(desired[d])

    const previous = seen.get(state)
    if (!previous) seen.set(state, key)

    const node: PlanNode = {
      key,
      palId: pals[palIdx].id,
      passives,
      depth,
      kind: kind[state] === KIND_BREED ? 'breed' : kind[state] === KIND_OWNED ? 'owned' : 'capture',
      duplicateOf: previous,
    }
    if (kind[state] === KIND_OWNED) node.ownedUid = owned[ownedRef[state]]?.uid
    if (kind[state] === KIND_BREED) {
      node.successChance = stepChance[state]
      node.expectedEggs = stepEggs[state]
      node.poolSize = stepPool[state]
      if (genderA[state]) {
        node.genderRequirement = {
          a: genderA[state] === 1 ? 'MALE' : 'FEMALE',
          b: genderB[state] === 1 ? 'MALE' : 'FEMALE',
        }
      }
      node.parents = [build(parentA[state], depth + 1), build(parentB[state], depth + 1)]
    }
    return node
  }

  const root = build(goal, 0)
  const stats = summarize(root)

  return {
    ok: true,
    root,
    stats: {
      ...stats,
      settledStates: settledList.length,
      elapsedMs: Math.round(performance.now() - started),
    },
  }
}

function bestPartial(
  targetIdx: number,
  masks: number,
  goalMask: number,
  settled: Uint8Array,
  cost: Float64Array,
): number | null {
  let best: number | null = null
  for (let mask = goalMask; mask >= 0; mask--) {
    const state = targetIdx * masks + mask
    if (settled[state] || Number.isFinite(cost[state])) {
      if (best === null || POPCOUNT[mask] > POPCOUNT[best]) best = mask
    }
    if (mask === 0) break
  }
  return best
}

function summarize(root: PlanNode) {
  let steps = 0
  let generations = 0
  let totalExpectedEggs = 0
  let capturesNeeded = 0
  let ownedUsed = 0
  let combinedChance = 1

  const walk = (node: PlanNode) => {
    generations = Math.max(generations, node.depth)
    if (node.kind === 'breed') {
      steps++
      totalExpectedEggs += node.expectedEggs ?? 0
      combinedChance *= node.successChance ?? 1
      node.parents?.forEach(walk)
    } else if (node.kind === 'capture') {
      capturesNeeded++
    } else {
      ownedUsed++
    }
  }
  walk(root)

  return {
    steps,
    generations,
    totalExpectedEggs: Math.round(totalExpectedEggs * 10) / 10,
    capturesNeeded,
    ownedUsed,
    combinedChance,
  }
}

export type { InheritanceModel }
