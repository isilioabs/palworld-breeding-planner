/**
 * Funcion de coste y modos de optimizacion.
 *
 * El planificador minimiza un unico escalar, asi que los cuatro objetivos que
 * pide el usuario (generaciones, huevos, Pals dificiles y perdida de pasivas)
 * se combinan con pesos. Cambiar de modo = cambiar de pesos.
 *
 * El coste debe ser monotono y "superior" (coste(padres) <= coste(hijo)) para
 * que la busqueda tipo Dijkstra sobre hiperaristas sea optima. Se cumple porque
 * todos los terminos son >= 0 y cada paso suma un `stepCost` estrictamente
 * positivo.
 */
import { getLang } from '@/i18n/lang'
import { DICTS } from '@/i18n/translations'
import type { Pal, PlannerMode } from '../types'

export type CaptureTier = 'none' | 'easy' | 'any'

/**
 * Umbrales que separan un Pal "de andar por casa" de uno de final de partida.
 *
 * Calibrado con los datos reales, no a ojo: la dificultad de captura es un
 * continuo sin corte natural (Orserk 0,57 · Cryolinx 0,37 · Beakon 0,30 ·
 * comunes ~0,00), asi que el limite se pone sobre las dos senales que si son
 * interpretables. Rareza >= 8 seria demasiado: dejaria fuera a Kingpaca (nv 23)
 * o Mammorest (nv 26), que no son bosses. Con rareza >= 9 caen Orserk, Blazamut,
 * Anubis, Shadowbeak y los legendarios, y con nivel >= 50 caen Eidrolon (65),
 * Jormuntide (55), Aegidron (79) y Bastigor (75).
 */
export const HARD_CATCH_RARITY = 9
export const HARD_CATCH_LEVEL = 50

/**
 * Si un jugador normal puede plantarse delante de este Pal y capturarlo sin
 * montar una expedicion. Los que no, en modo "full breeding" hay que criarlos.
 */
export function isEasyToCatch(pal: Pal): boolean {
  if (!pal.wild) return false
  return pal.rarity < HARD_CATCH_RARITY && pal.wild[0] < HARD_CATCH_LEVEL
}

export function canCapture(pal: Pal, tier: CaptureTier): boolean {
  if (tier === 'none' || !pal.wild) return false
  return tier === 'any' || isEasyToCatch(pal)
}

/**
 * Nivel de prioridad para un orden lexicografico. Cuando `CostWeights.priorityOrder`
 * esta presente, el buscador ordena los estados por esta tupla (el primer nivel
 * manda; los siguientes solo desempatan) en vez de por el escalar ponderado.
 * Ver `orderingKey()` en planner.ts.
 */
export type PriorityLevel = 'maxCapture' | 'totalCapture' | 'eggs' | 'steps' | 'generations'

export interface CostWeights {
  /** Coste fijo por generacion. Sube -> arboles mas planos. */
  step: number
  /** Peso del numero esperado de huevos. */
  eggs: number
  /** Techo de huevos por paso: por encima, penalizacion progresiva. */
  eggsSoftCap: number
  /** Peso de la dificultad de conseguir un Pal salvaje. */
  capture: number
  /** Peso de perder pasivas: penaliza los botes muy diluidos. */
  dilution: number
  /** Penalizacion por exigir sexos concretos. */
  genderLock: number
  /**
   * Que Pals se pueden usar como punto de partida capturandolos:
   *  - 'none': ninguno, solo tu coleccion.
   *  - 'easy': solo los accesibles (ver `isEasyToCatch`); el resto hay que criarlo.
   *  - 'any' : cualquiera que exista en estado salvaje, bosses incluidos.
   */
  captureTier: CaptureTier
  /**
   * Si es true la busqueda ordena por (generaciones, coste) en vez de solo por
   * coste. El coste por paso minimiza el NUMERO de cruces, que no es lo mismo
   * que la profundidad del arbol: un arbol equilibrado de 7 cruces tiene menos
   * generaciones que una cadena de 5.
   *
   * Ignorado si `priorityOrder` esta presente (ver mas abajo); se mantiene
   * solo por compatibilidad con pesos construidos a mano fuera de `MODES`.
   */
  depthFirst: boolean
  /**
   * Orden lexicografico explicito: el buscador prefiere el estado con el
   * nivel mas prioritario mas bajo, y solo mira el siguiente nivel para
   * desempatar. Sustituye a `depthFirst`/al escalar ponderado cuando esta
   * presente. Ver `orderingKey()` en planner.ts para como se codifica.
   */
  priorityOrder?: PriorityLevel[]
}

/** Factor de la clave lexicografica (generaciones, coste). Ver `depthFirst`. */
export const DEPTH_PRIORITY_SCALE = 1e6

export const MODE_ORDER: PlannerMode[] = ['collection', 'breeding', 'hybrid']

export const MODES: Record<PlannerMode, { weights: CostWeights }> = {
  // "Only My Collection": nunca captura (captureTier:'none' ya lo garantiza).
  // Entre las rutas posibles con lo que tienes, prioriza menos huevos
  // esperados y, para desempatar, menos pasos.
  collection: {
    weights: {
      step: 6,
      eggs: 1,
      eggsSoftCap: 40,
      capture: 0,
      dilution: 1.5,
      genderLock: 2,
      captureTier: 'none',
      depthFirst: false,
      priorityOrder: ['eggs', 'steps'],
    },
  },
  // "Easiest Route": evita capturas dificiles por encima de todo. Orden:
  // dificultad maxima de captura en toda la ruta, luego dificultad total,
  // luego huevos, luego pasos, luego generaciones. captureTier:'easy' ya
  // saca del todo a los bosses del conjunto de partida; priorityOrder ademas
  // prefiere, entre lo que queda, lo mas accesible.
  breeding: {
    weights: {
      step: 3,
      eggs: 2.5,
      eggsSoftCap: 12,
      capture: 8,
      dilution: 2.5,
      genderLock: 6,
      captureTier: 'easy',
      depthFirst: false,
      priorityOrder: ['maxCapture', 'totalCapture', 'eggs', 'steps', 'generations'],
    },
  },
  // "Fastest Route": generaciones ante todo, luego pasos, luego huevos. La
  // dificultad de captura solo desempata al final -captureTier:'any' permite
  // usar cualquier Pal, legendarios incluidos, si acorta la ruta.
  hybrid: {
    weights: {
      step: 40,
      eggs: 0.6,
      eggsSoftCap: 80,
      capture: 1.5,
      dilution: 0.5,
      genderLock: 3,
      captureTier: 'any',
      depthFirst: true,
      priorityOrder: ['generations', 'steps', 'eggs', 'maxCapture'],
    },
  },
}

/** Texto de cada modo, en el idioma activo. Separado de MODES para no mezclar texto de UI con los pesos del algoritmo (esos no se tocan nunca). */
export function modeLabel(mode: PlannerMode): string {
  return DICTS[getLang()][`mode.${mode}.label` as 'mode.collection.label']
}

export function modeHint(mode: PlannerMode): string {
  const template = DICTS[getLang()][`mode.${mode}.hint` as 'mode.collection.hint']
  return template.replace('{rarity}', String(HARD_CATCH_RARITY)).replace('{level}', String(HARD_CATCH_LEVEL))
}

/**
 * Dificultad normalizada (0..1) de conseguir un Pal salvaje.
 * Mezcla rareza, precio de mercado y si es una variante (spawns muy limitados).
 */
export function captureDifficulty(pal: Pal): number {
  if (!pal.wild) return Infinity // solo se obtiene criando o en incursiones
  const byRarity = (pal.rarity - 1) / 19
  const byPrice = Math.min(1, Math.max(0, (pal.price - 500) / 8000))
  const variantPenalty = pal.variant ? 0.25 : 0
  const levelPenalty = Math.min(0.2, pal.wild[0] / 300)
  return Math.min(2, byRarity * 0.55 + byPrice * 0.3 + variantPenalty + levelPenalty)
}

/** Coste de un paso de crianza. */
export function stepCost(
  weights: CostWeights,
  eggs: number,
  poolSize: number,
  wantedCount: number,
  genderLocked: boolean,
): number {
  if (!Number.isFinite(eggs)) return Infinity
  const overCap = Math.max(0, eggs - weights.eggsSoftCap)
  const dilution = Math.max(0, poolSize - wantedCount)
  return (
    weights.step +
    weights.eggs * eggs +
    weights.eggs * overCap * 2 +
    weights.dilution * dilution +
    (genderLocked ? weights.genderLock : 0)
  )
}
