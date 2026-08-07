/**
 * Vista previa directa: en cuanto se elige un Pal objetivo, antes de que el
 * worker resuelva el plan completo, esto elige una pareja de padres real
 * (sin pasivas, sin pasar por el buscador) para dibujar un arbol de una sola
 * generacion al instante. Pura y sincrona -nada de worker- para que la
 * seleccion de un objetivo se sienta inmediata.
 */
import type { OwnedPal, Pal, PlanNode, PlannerMode } from '../types'
import { captureDifficulty } from './cost'
import type { ChildResolver } from './resolver'

export interface DirectPreviewPair {
  kind: 'pair'
  parentAId: string
  parentBId: string
  parentAOwnedUid?: string
  parentBOwnedUid?: string
}

export interface DirectPreviewUnavailable {
  kind: 'unavailable'
  /** 'no-parents': la especie no se cria de ninguna pareja (solo captura/boss).
   *  'no-owned-pair': "Only My Collection" pero ninguna pareja de tu caja produce el objetivo. */
  reason: 'no-parents' | 'no-owned-pair'
}

export type DirectPreviewResult = DirectPreviewPair | DirectPreviewUnavailable

/**
 * Elige la pareja directa a mostrar, con el mismo criterio que su modo activo
 * usaria para el paso final de una ruta:
 *  - Only My Collection: una pareja donde AMBOS padres esten en la coleccion,
 *    si existe -si no, informa que no hay ninguna todavia.
 *  - Easiest: la pareja con menor dificultad de captura maxima (y, para
 *    desempatar, menor suma) -el mismo criterio que ordena `direct-recipes`.
 *  - Fastest: la primera pareja real disponible; la dificultad de captura
 *    ya no importa a nivel de un solo cruce.
 */
export function pickDirectPreviewPair(
  targetPalId: string,
  mode: PlannerMode,
  owned: OwnedPal[],
  resolver: ChildResolver,
  palsById: Map<string, Pal>,
): DirectPreviewResult {
  const pairs = resolver.parentsOf(targetPalId)
  if (pairs.length === 0) return { kind: 'unavailable', reason: 'no-parents' }

  if (mode === 'collection') {
    const ownedByPalId = new Map<string, string>()
    for (const entry of owned) if (!ownedByPalId.has(entry.palId)) ownedByPalId.set(entry.palId, entry.uid)
    const match = pairs.find(([a, b]) => ownedByPalId.has(a) && ownedByPalId.has(b))
    if (!match) return { kind: 'unavailable', reason: 'no-owned-pair' }
    const [a, b] = match
    return { kind: 'pair', parentAId: a, parentBId: b, parentAOwnedUid: ownedByPalId.get(a), parentBOwnedUid: ownedByPalId.get(b) }
  }

  const difficulty = (id: string) => {
    const pal = palsById.get(id)
    if (!pal) return Number.POSITIVE_INFINITY
    const value = captureDifficulty(pal)
    return Number.isFinite(value) ? value : 10
  }

  if (mode === 'breeding') {
    const sorted = [...pairs].sort((x, y) => {
      const maxX = Math.max(difficulty(x[0]), difficulty(x[1]))
      const maxY = Math.max(difficulty(y[0]), difficulty(y[1]))
      if (maxX !== maxY) return maxX - maxY
      return difficulty(x[0]) + difficulty(x[1]) - (difficulty(y[0]) + difficulty(y[1]))
    })
    const [a, b] = sorted[0]
    return { kind: 'pair', parentAId: a, parentBId: b }
  }

  // hybrid (Fastest): el resultado directo tal cual, sin reordenar.
  const [a, b] = pairs[0]
  return { kind: 'pair', parentAId: a, parentBId: b }
}

/** Construye el arbol minimo (una generacion, sin pasivas) para <BreedingTree>. */
export function buildDirectPreviewNode(targetPalId: string, pair: DirectPreviewPair): PlanNode {
  const parentA: PlanNode = {
    key: 'preview-a',
    palId: pair.parentAId,
    passives: [],
    kind: pair.parentAOwnedUid ? 'owned' : 'capture',
    ownedUid: pair.parentAOwnedUid,
    depth: 1,
  }
  const parentB: PlanNode = {
    key: 'preview-b',
    palId: pair.parentBId,
    passives: [],
    kind: pair.parentBOwnedUid ? 'owned' : 'capture',
    ownedUid: pair.parentBOwnedUid,
    depth: 1,
  }
  return {
    key: 'preview-root',
    palId: targetPalId,
    passives: [],
    kind: 'breed',
    depth: 0,
    // Sin pasivas deseadas en la vista previa: cualquier cria vale, asi que
    // el exito es trivial. El plan real (con pasivas) llega del worker aparte.
    successChance: 1,
    expectedEggs: 1,
    poolSize: 0,
    parents: [parentA, parentB],
  }
}
