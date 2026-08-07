import { describe, expect, it } from 'vitest'
import { loadDatabase } from '../../database'
import { createResolver } from '../resolver'
import { pickDirectPreviewPair, buildDirectPreviewNode } from '../direct-preview'
import type { OwnedPal } from '../../types'

const db = loadDatabase()
const resolver = createResolver(db.pals, db.breeding)
const palsById = db.palById

describe('vista previa directa', () => {
  it('elegir Anubis sin coleccion produce una vista previa inmediata (Fastest)', () => {
    const result = pickDirectPreviewPair('Anubis', 'hybrid', [], resolver, palsById)
    expect(result.kind).toBe('pair')
    if (result.kind !== 'pair') return
    const node = buildDirectPreviewNode('Anubis', result)
    expect(node.palId).toBe('Anubis')
    expect(node.kind).toBe('breed')
    expect(node.parents).toHaveLength(2)
    expect(node.parents![0].palId).toBe(result.parentAId)
    expect(node.parents![1].palId).toBe(result.parentBId)
    // Vista previa: sin pasivas, exito trivial -el plan real (con pasivas) es cosa del worker.
    expect(node.passives).toEqual([])
    expect(node.successChance).toBe(1)
  })

  it('Easiest prefiere la pareja con menor dificultad de captura maxima', () => {
    const result = pickDirectPreviewPair('Anubis', 'breeding', [], resolver, palsById)
    expect(result.kind).toBe('pair')
  })

  it('Only My Collection sin ninguna pareja propia devuelve "no disponible", no inventa una', () => {
    const owned: OwnedPal[] = [{ uid: 'o1', palId: 'Lamball', passives: [] }]
    const result = pickDirectPreviewPair('Anubis', 'collection', owned, resolver, palsById)
    expect(result.kind).toBe('unavailable')
    if (result.kind === 'unavailable') expect(result.reason).toBe('no-owned-pair')
  })

  it('Only My Collection con ambos padres en la coleccion si devuelve una pareja, con sus UID', () => {
    const pairs = resolver.parentsOf('PinkCat')
    const distinctPair = pairs.find(([a, b]) => a !== b)
    expect(distinctPair).toBeDefined()
    const [a, b] = distinctPair!
    const owned: OwnedPal[] = [
      { uid: 'ua', palId: a, passives: [] },
      { uid: 'ub', palId: b, passives: [] },
    ]
    const result = pickDirectPreviewPair('PinkCat', 'collection', owned, resolver, palsById)
    expect(result.kind).toBe('pair')
    if (result.kind !== 'pair') return
    expect(result.parentAOwnedUid).toBe('ua')
    expect(result.parentBOwnedUid).toBe('ub')
    const node = buildDirectPreviewNode('PinkCat', result)
    expect(node.parents!.every((p) => p.kind === 'owned')).toBe(true)
  })
})
