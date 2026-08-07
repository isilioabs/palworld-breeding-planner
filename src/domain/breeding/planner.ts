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
  type PriorityLevel,
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

/**
 * Monticulo binario minimo con borrado perezoso. La clave es un bigint (no
 * un float): con hasta 5 niveles de prioridad lexicografica empaquetados
 * (ver `orderingKey`), un Float64 se queda corto de precision mucho antes de
 * agotar los niveles. bigint no tiene ese limite y solo necesita `<`/`<=`,
 * que ya funcionan igual que con numeros.
 */
class MinHeap {
  private cost: bigint[] = []
  private id: number[] = []
  get size() {
    return this.id.length
  }
  push(cost: bigint, id: number) {
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
  pop(): { cost: bigint; id: number } | null {
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
  const modeWeights: CostWeights = MODES[mode].weights
  const model = createInheritanceModel(mechanics)

  // Toda la busqueda (estados, Dijkstra y reconstruccion del arbol) vive en
  // `attempt()`, parametrizada por los pesos, para poder reintentar con un
  // orden distinto si el orden lexicografico estricto se atasca (ver la
  // red de seguridad justo despues de la primera llamada, mas abajo).
  const attempt = (weights: CostWeights): PlanResult => {
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
  // Rastreo adicional para el orden lexicografico de Easiest/Fastest/Only My
  // Collection (ver `orderingKey`). Cada uno se combina exactamente como
  // `depth` (maximo) o `cost` (suma) ya se combinan arriba, asi que hereda la
  // misma prueba de monotonia que el comentario de cabecera del archivo ya
  // documenta para el coste.
  const stepsCount = new Uint16Array(STATES)
  const totalEggsAcc = new Float64Array(STATES)
  const maxCapture = new Float64Array(STATES)
  const totalCaptureAcc = new Float64Array(STATES)

  const heap = new MinHeap()

  /**
   * Empaqueta niveles de prioridad lexicografica en un bigint: el nivel mas
   * prioritario ocupa los digitos mas significativos, asi que comparar dos
   * claves con < / > equivale a comparar la tupla completa nivel a nivel. Un
   * bigint no tiene limite de precision (a diferencia de empaquetar en un
   * Float64, que se queda sin digitos seguros mucho antes de 5 niveles), asi
   * que el orden es exacto sin importar cuantos niveles tenga el modo.
   */
  const LEVEL_SCALE = 100_000_000n
  const LEVEL_SCALE_NUM = 100_000_000
  const LEVEL_MULT: Record<PriorityLevel, number> = {
    generations: 1,
    steps: 1,
    eggs: 100,
    maxCapture: 1000,
    totalCapture: 1000,
  }
  const INFINITY_KEY = 1n << 400n
  // Encajonado (clamp) a LEVEL_SCALE-1: sin esto, una cadena de auto-cruces
  // (una especie criada consigo misma varias generaciones seguidas, algo que
  // el buscador SI explora aunque la ruta acabe siendo pesima) duplica
  // `totalCaptureAcc`/`totalEggsAcc`/`stepsCount` en cada paso, y tras solo
  // ~20-30 generaciones el valor empaquetado supera LEVEL_SCALE y se
  // "desborda" hacia el digito del nivel MAS prioritario en `orderingKey`
  // -corrompiendo el orden del monticulo para ese estado y, con ello, la
  // invariante de Dijkstra de "una vez asentado, nunca se revisita". El
  // sintoma real: anadir un Pal a la coleccion (que no tiene nada que ver con
  // la ruta final) cambiaba el orden de exploracion lo suficiente como para
  // que el estado objetivo quedara inalcanzable, aunque sin ese Pal la
  // busqueda SI encontraba ruta. El tope no distingue entre rutas
  // absurdamente malas (todas empatan en el maximo, y ninguna le gana nunca a
  // una ruta real) -solo evita que su magnitud se filtre al digito vecino.
  const packLevel = (raw: number, mult: number) => BigInt(Math.min(LEVEL_SCALE_NUM - 1, Math.max(0, Math.ceil(raw * mult))))

  /**
   * Clave de ordenacion para el monticulo. Con `priorityOrder` presente
   * (Easiest/Fastest/Only My Collection) es un orden lexicografico real sobre
   * la tupla de niveles del modo. Sin el (pesos construidos a mano fuera de
   * `MODES`), cae al comportamiento historico: (generaciones, coste) si
   * `depthFirst`, o solo coste. El coste real (`cost[]`) nunca se toca aqui:
   * esta funcion solo decide el ORDEN de extraccion del monticulo, no que se
   * suma para calcular huevos esperados/informes, que sigue siendo el mismo
   * escalar aditivo que ya garantiza la optimalidad de Knuth.
   */
  const orderingKey = (
    c: number,
    d: number,
    steps: number,
    totalEggs: number,
    maxCap: number,
    totalCap: number,
  ): bigint => {
    if (!Number.isFinite(c)) return INFINITY_KEY
    const order = weights.priorityOrder
    if (order && order.length > 0) {
      let key = 0n
      for (const level of order) {
        const raw =
          level === 'generations' ? d : level === 'steps' ? steps : level === 'eggs' ? totalEggs : level === 'maxCapture' ? maxCap : totalCap
        key = key * LEVEL_SCALE + packLevel(raw, LEVEL_MULT[level])
      }
      return key
    }
    if (weights.depthFirst) {
      return BigInt(d) * LEVEL_SCALE + packLevel(Math.min(c, DEPTH_PRIORITY_SCALE - 1), 1000)
    }
    return packLevel(c, 1000)
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
    newSteps = 0,
    newTotalEggs = 0,
    newMaxCapture = 0,
    newTotalCapture = 0,
  ) => {
    if (!Number.isFinite(newCost)) return
    if (settled[state]) return
    const newKey = orderingKey(newCost, newDepth, newSteps, newTotalEggs, newMaxCapture, newTotalCapture)
    const currentKey = orderingKey(cost[state], depth[state], stepsCount[state], totalEggsAcc[state], maxCapture[state], totalCaptureAcc[state])
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
    stepsCount[state] = newSteps
    totalEggsAcc[state] = newTotalEggs
    maxCapture[state] = newMaxCapture
    totalCaptureAcc[state] = newTotalCapture
    heap.push(newKey, state)
  }

  // --- estados iniciales: la coleccion del jugador -------------------------
  const owned = input.owned.filter((o) => resolver.indexOf(o.palId) >= 0)

  // Fuente fijada por pasiva ("Use as passive source"): un pin solo cuenta si
  // apunta a un Pal que sigue en la coleccion y que de verdad lleva esa
  // pasiva; si no, queda inerte y el buscador elige solo, como si no hubiera pin.
  const resolvedPins = new Map<number, string>() // indice de pasiva deseada -> uid
  for (let d = 0; d < D; d++) {
    const pinnedUid = input.pinnedSources?.[desired[d]]
    if (!pinnedUid) continue
    if (owned.some((o) => o.uid === pinnedUid && o.passives.includes(desired[d]))) {
      resolvedPins.set(d, pinnedUid)
    }
  }

  owned.forEach((entry, i) => {
    const palIdx = resolver.indexOf(entry.palId)
    const unique = [...new Set(entry.passives)]
    let ownMask = 0
    for (let d = 0; d < D; d++) {
      if (!unique.includes(desired[d])) continue
      // Esta pasiva esta fijada a OTRO Pal: este ejemplar no puede aportarla,
      // aunque la lleve -asi la ruta final usa siempre la fuente elegida.
      const pinnedUid = resolvedPins.get(d)
      if (pinnedUid && pinnedUid !== entry.uid) continue
      ownMask |= 1 << d
    }
    const poolSize = unique.length
    const token = i < MAX_TRACKED_OWNED ? 1 << i : 0
    // Todos los submasks: a veces interesa "usar" solo parte de sus pasivas.
    for (let sub = ownMask; ; sub = (sub - 1) & ownMask) {
      relax(palIdx * MASKS + sub, 0, 0, poolSize, KIND_OWNED, token, -1, -1, i, 0, 0, 0, 1, 0, 0, 0, 0)
      if (sub === 0) break
    }
  })

  // --- estados iniciales: capturas -----------------------------------------
  for (let i = 0; i < N; i++) {
    if (!canCapture(pals[i], weights.captureTier)) continue
    const difficulty = captureDifficulty(pals[i])
    if (!Number.isFinite(difficulty)) continue
    relax(i * MASKS, weights.capture * (0.5 + difficulty), 0, 0, KIND_CAPTURE, 0, -1, -1, -1, 0, 0, 0, 1, 0, 0, 0, difficulty, difficulty)
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
    if (settled[u] || top.cost > orderingKey(cost[u], depth[u], stepsCount[u], totalEggsAcc[u], maxCapture[u], totalCaptureAcc[u])) continue
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
    const uSteps = stepsCount[u]
    const uTotalEggs = totalEggsAcc[u]
    const uMaxCapture = maxCapture[u]
    const uTotalCapture = totalCaptureAcc[u]

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
      // Los mismos niveles que `parentsCost`/`newDepth` ya combinan arriba,
      // solo que sin ponderar: pasos y dificultad total se SUMAN (como el
      // coste), la dificultad maxima toma el MAYOR de los dos padres (como la
      // profundidad). Ambas combinaciones son monotonas no decrecientes por
      // el mismo argumento que el comentario de cabecera ya hace para el coste.
      const newSteps = (v === u ? 2 * uSteps : uSteps + stepsCount[v]) + 1
      const newTotalEggs = (v === u ? 2 * uTotalEggs : uTotalEggs + totalEggsAcc[v]) + eggs
      const newMaxCapture = Math.max(uMaxCapture, maxCapture[v])
      const newTotalCapture = v === u ? 2 * uTotalCapture : uTotalCapture + totalCaptureAcc[v]

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
          newSteps,
          newTotalEggs,
          newMaxCapture,
          newTotalCapture,
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
          newSteps,
          newTotalEggs,
          newMaxCapture,
          newTotalCapture,
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
  const stats = summarize(root, (palId) => pals[resolver.indexOf(palId)])

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

  let result = attempt(modeWeights)
  // Red de seguridad: el orden lexicografico estricto de Easiest/Fastest
  // prefiere agresivamente rutas que pasan por Pals propios sin capturar
  // (coste de captura = 0), lo que puede hacer que dos ramas del arbol
  // terminen queriendo el MISMO ejemplar propio -algo que solo se detecta al
  // combinar estados ya asentados, cuando Dijkstra ya no puede reconsiderar
  // la ruta que asento primero ese estado compartido (settle-once). El
  // resultado observado: anadir un Pal a la coleccion podia dejar SIN ruta
  // una busqueda que sin el si la encontraba -justo lo contrario de lo que
  // se espera (tener mas Pals nunca deberia empeorar la ruta disponible).
  // Como red de seguridad, si el intento con orden lexicografico no
  // encuentra ninguna ruta, se reintenta una vez con el orden por coste
  // escalar (el que ya se usaba antes de introducir el orden lexicografico,
  // y que no tiene este problema porque no favorece tan agresivamente los
  // Pals propios compartidos). Si el reintento SI encuentra ruta, se usa esa
  // -no es la mas "facil/rapida" posible en teoria, pero es una ruta valida,
  // que es estrictamente mejor que reportar un fallo que no deberia ocurrir.
  if (!result.ok && modeWeights.priorityOrder && result.reason?.startsWith('No se encontro ninguna ruta')) {
    const fallback = attempt({ ...modeWeights, priorityOrder: undefined })
    if (fallback.ok) result = fallback
  }
  return result
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

function summarize(root: PlanNode, getPal: (palId: string) => Pal) {
  let steps = 0
  let generations = 0
  let totalExpectedEggs = 0
  let capturesNeeded = 0
  let ownedUsed = 0
  let combinedChance = 1
  let maxCaptureDifficulty = 0
  let totalCaptureDifficulty = 0

  const walk = (node: PlanNode) => {
    generations = Math.max(generations, node.depth)
    if (node.kind === 'breed') {
      steps++
      totalExpectedEggs += node.expectedEggs ?? 0
      combinedChance *= node.successChance ?? 1
      node.parents?.forEach(walk)
    } else if (node.kind === 'capture') {
      capturesNeeded++
      const difficulty = captureDifficulty(getPal(node.palId))
      if (Number.isFinite(difficulty)) {
        maxCaptureDifficulty = Math.max(maxCaptureDifficulty, difficulty)
        totalCaptureDifficulty += difficulty
      }
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
    maxCaptureDifficulty: Math.round(maxCaptureDifficulty * 1000) / 1000,
    totalCaptureDifficulty: Math.round(totalCaptureDifficulty * 1000) / 1000,
  }
}

export type { InheritanceModel }
