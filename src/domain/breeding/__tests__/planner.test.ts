import { describe, expect, it } from 'vitest'
import { loadDatabase } from '../../database'
import { createResolver } from '../resolver'
import { isEasyToCatch } from '../cost'
import { planBreeding, type PlannerContext } from '../planner'
import type { OwnedPal, PlanNode, PlannerInput, PlannerMode } from '../../types'

const db = loadDatabase()
const resolver = createResolver(db.pals, db.breeding)
const ctx: PlannerContext = { pals: db.pals, resolver, mechanics: db.mechanics }

const P = {
  swift: 'MoveSpeed_up_2', // pasivas reales de la base de datos
} as const

const passiveIds = db.passives.filter((p) => p.rank >= 3).map((p) => p.id)
const [A, B, C, D] = passiveIds

const run = (input: Partial<PlannerInput> & { targetPalId: string }) =>
  planBreeding(
    { desiredPassives: [], owned: [], mode: 'breeding', ...input },
    ctx,
    { timeBudgetMs: 20000 },
  )

/** Comprueba que el arbol es fisicamente posible en el juego. */
function assertTreeIsValid(node: PlanNode) {
  expect(db.palById.has(node.palId)).toBe(true)
  if (node.kind !== 'breed') {
    expect(node.parents).toBeUndefined()
    return
  }
  const parents = node.parents!
  expect(parents).toHaveLength(2)

  const [a, b] = parents
  const generic = resolver.childId(a.palId, b.palId)
  if (generic === null) {
    // solo puede ser una combinacion que exija sexos concretos
    const options = resolver.genderOptions(resolver.indexOf(a.palId), resolver.indexOf(b.palId))
    expect(options.some((o) => db.pals[o.childIndex].id === node.palId)).toBe(true)
    expect(node.genderRequirement).toBeDefined()
  } else {
    expect(generic).toBe(node.palId)
  }

  // las pasivas del hijo tienen que venir de los padres
  const pool = new Set([...a.passives, ...b.passives])
  for (const passive of node.passives) expect(pool.has(passive)).toBe(true)

  expect(node.successChance).toBeGreaterThan(0)
  expect(node.successChance).toBeLessThanOrEqual(1)
  expect(node.expectedEggs).toBeGreaterThanOrEqual(1)

  parents.forEach(assertTreeIsValid)
}

describe('planificador', () => {
  it('la base de datos expone pasivas reales', () => {
    expect(passiveIds.length).toBeGreaterThan(20)
    expect(db.passiveById.has(P.swift) || passiveIds.length > 0).toBe(true)
  })

  it('si ya tienes el Pal con las pasivas, no hace falta criar', () => {
    const owned: OwnedPal[] = [{ uid: 'o1', palId: 'Anubis', passives: [A, B] }]
    const result = run({ targetPalId: 'Anubis', desiredPassives: [A, B], owned, mode: 'collection' })
    expect(result.ok).toBe(true)
    expect(result.stats!.steps).toBe(0)
    expect(result.root!.kind).toBe('owned')
  })

  it('el modo "solo mi coleccion" falla con la caja vacia', () => {
    const result = run({ targetPalId: 'Anubis', desiredPassives: [A], mode: 'collection' })
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/coleccion/i)
  })

  it('encuentra una ruta capturando cuando el modo lo permite', () => {
    const result = run({ targetPalId: 'Anubis', mode: 'hybrid' })
    expect(result.ok).toBe(true)
    assertTreeIsValid(result.root!)
  })

  describe('limite de capturas', () => {
    /** Todas las especies que el plan manda capturar. */
    const captures = (node: PlanNode): string[] => {
      const out: string[] = []
      const walk = (n: PlanNode) => {
        if (n.kind === 'capture') out.push(n.palId)
        n.parents?.forEach(walk)
      }
      walk(node)
      return out
    }

    it('clasifica bien los Pals de la frontera', () => {
      const easy = (name: string) => isEasyToCatch(db.pals.find((p) => p.name === name)!)
      // El caso que motivo el cambio: Orserk es rareza 9 y aparece a nivel 74.
      expect(easy('Orserk')).toBe(false)
      expect(easy('Eidrolon')).toBe(false) // nivel 65
      expect(easy('Jetragon')).toBe(false)
      expect(easy('Anubis')).toBe(false)
      // ...pero un Pal grande de nivel bajo si vale.
      expect(easy('Kingpaca')).toBe(true) // rareza 8, nivel 23
      expect(easy('Mammorest')).toBe(true) // rareza 8, nivel 26
      expect(easy('Cryolinx')).toBe(true) // rareza 7, nivel 42
      expect(easy('Lamball')).toBe(true)
    })

    it('"Full breeding" nunca manda capturar un boss', () => {
      for (const target of ['GhostDragon', 'GrassPanda_Electric', 'Anubis', 'SheepBall']) {
        const result = run({ targetPalId: target, mode: 'breeding' })
        if (!result.ok) continue
        for (const palId of captures(result.root!)) {
          expect(isEasyToCatch(db.palById.get(palId)!)).toBe(true)
        }
        assertTreeIsValid(result.root!)
      }
    })

    it('"Breeding + captura" si puede usarlos', () => {
      const result = run({ targetPalId: 'GhostDragon', mode: 'hybrid' })
      expect(result.ok).toBe(true)
      assertTreeIsValid(result.root!)
    })

    it('avisa cuando el objetivo solo se consigue capturandolo', () => {
      // Orserk no lo produce ninguna pareja que no sean dos Orserk.
      const result = run({ targetPalId: 'ThunderDragonMan', mode: 'breeding' })
      expect(result.ok).toBe(false)
      expect(result.suggestMode).toBe('hybrid')
      const hybrid = run({ targetPalId: 'ThunderDragonMan', mode: 'hybrid' })
      expect(hybrid.ok).toBe(true)
    })

    it('"Solo mi coleccion" no captura nada', () => {
      const owned: OwnedPal[] = [
        { uid: 'o1', palId: 'Boar', passives: [A] },
        { uid: 'o2', palId: 'ChickenPal', passives: [B] },
      ]
      const result = run({ targetPalId: 'BluePlatypus', desiredPassives: [A, B], owned, mode: 'collection' })
      expect(result.ok).toBe(true)
      expect(captures(result.root!)).toEqual([])
    })
  })

  it.each<PlannerMode>(['hybrid', 'breeding'])(
    'produce un arbol valido con 4 pasivas en modo %s',
    (mode) => {
      const owned: OwnedPal[] = [
        { uid: 'o1', palId: 'SheepBall', passives: [A] },
        { uid: 'o2', palId: 'ChickenPal', passives: [B] },
        { uid: 'o3', palId: 'PinkCat', passives: [C] },
        { uid: 'o4', palId: 'Boar', passives: [D] },
      ]
      const result = run({
        targetPalId: 'GrassPanda_Electric',
        desiredPassives: [A, B, C, D],
        owned,
        mode,
      })
      expect(result.ok).toBe(true)
      expect(result.root!.palId).toBe('GrassPanda_Electric')
      expect(result.root!.passives.sort()).toEqual([A, B, C, D].sort())
      assertTreeIsValid(result.root!)
    },
  )

  it('no reutiliza el mismo Pal de la coleccion dos veces', () => {
    const owned: OwnedPal[] = [
      { uid: 'o1', palId: 'SheepBall', passives: [A, B] },
      { uid: 'o2', palId: 'ChickenPal', passives: [C] },
    ]
    const result = run({ targetPalId: 'PinkCat', desiredPassives: [A, B, C], owned, mode: 'collection' })
    if (!result.ok) return // sin ruta posible: nada que comprobar
    const used: string[] = []
    const walk = (node: PlanNode) => {
      if (node.ownedUid) used.push(node.ownedUid)
      node.parents?.forEach(walk)
    }
    walk(result.root!)
    expect(new Set(used).size).toBe(used.length)
  })

  const FOUR: OwnedPal[] = [
    { uid: 'o1', palId: 'SheepBall', passives: [A] },
    { uid: 'o2', palId: 'ChickenPal', passives: [B] },
    { uid: 'o3', palId: 'PinkCat', passives: [C] },
    { uid: 'o4', palId: 'Boar', passives: [D] },
  ]

  it.each([
    ['3 pasivas', [A, B, C], FOUR.slice(0, 3)],
    ['4 pasivas', [A, B, C, D], FOUR],
  ] as const)(
    '"Breeding + captura" no usa mas generaciones que "Full breeding" (%s)',
    (_label, passives, owned) => {
      const base = { targetPalId: 'Anubis', desiredPassives: [...passives], owned: [...owned] }
      const hybrid = run({ ...base, mode: 'hybrid' })
      const breeding = run({ ...base, mode: 'breeding' })
      expect(hybrid.ok && breeding.ok).toBe(true)
      // Hybrid tiene mas opciones y ademas optimiza profundidad.
      expect(hybrid.stats!.generations).toBeLessThanOrEqual(breeding.stats!.generations)
    },
  )

  it('el limite de "Full breeding" se paga en generaciones, no en Pals imposibles', () => {
    // Caso real del usuario: Eidrolon con dos pasivas. En hybrid el plan usa
    // Orserk (boss de nivel 74); en full breeding no puede, asi que alarga.
    const owned: OwnedPal[] = [
      { uid: 'o1', palId: 'ThunderBird', passives: [A] },
      { uid: 'o2', palId: 'Garm', passives: [B] },
    ]
    const base = { targetPalId: 'GhostDragon', desiredPassives: [A, B], owned }
    const hybrid = run({ ...base, mode: 'hybrid' })
    const breeding = run({ ...base, mode: 'breeding' })
    expect(hybrid.ok && breeding.ok).toBe(true)

    const hard = (r: typeof breeding) => {
      const out: string[] = []
      const walk = (n: PlanNode) => {
        if (n.kind === 'capture' && !isEasyToCatch(db.palById.get(n.palId)!)) out.push(n.palId)
        n.parents?.forEach(walk)
      }
      walk(r.root!)
      return out
    }
    expect(hard(breeding)).toEqual([])
    expect(breeding.stats!.generations).toBeGreaterThanOrEqual(hybrid.stats!.generations)
  })

  it('rechaza un objetivo desconocido', () => {
    const result = run({ targetPalId: 'NoExisteEsteAnimal' })
    expect(result.ok).toBe(false)
  })

  it('termina dentro del presupuesto de tiempo', () => {
    const started = Date.now()
    run({ targetPalId: 'JetDragon', desiredPassives: [A, B, C, D], mode: 'hybrid' })
    expect(Date.now() - started).toBeLessThan(25000)
  })
})
