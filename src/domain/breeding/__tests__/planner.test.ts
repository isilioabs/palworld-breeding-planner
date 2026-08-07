import { describe, expect, it } from 'vitest'
import { loadDatabase } from '../../database'
import { createResolver } from '../resolver'
import { isEasyToCatch, MODES, type PriorityLevel } from '../cost'
import { planBreeding, type PlannerContext } from '../planner'
import type { OwnedPal, PlanNode, PlannerInput, PlannerMode, PlanResult } from '../../types'

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
    20000, // hasta un reintento de red de seguridad si el orden lexicografico no encuentra ruta
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
    20000, // 2 busquedas (una por modo), cada una con hasta un reintento de red de seguridad
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

/** Valor de un nivel de prioridad, leido de las estadisticas ya calculadas. */
function levelValue(level: PriorityLevel, stats: NonNullable<PlanResult['stats']>): number {
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

/**
 * Un orden lexicografico NO garantiza que cada metrica individual mejore al
 * ampliar la coleccion -solo que la tupla completa, comparada nivel a nivel
 * en el orden de prioridad del modo, nunca empeora. (Un "-1 generacion"
 * puede legitimamente costar mas huevos si esos dos niveles estan en el
 * orden.) Por eso la comprobacion se detiene en el primer nivel donde de
 * verdad se decide la comparacion, no exige "<=" en todos a la vez.
 */
function assertNotWorseLexicographically(mode: PlannerMode, before: NonNullable<PlanResult['stats']>, after: NonNullable<PlanResult['stats']>) {
  const order = MODES[mode].weights.priorityOrder ?? []
  for (const level of order) {
    const b = levelValue(level, before)
    const a = levelValue(level, after)
    if (a < b) return // mejora en este nivel: la ruta nueva ya es mejor, no hace falta mirar mas
    if (a > b) {
      throw new Error(`Anadir un Pal a la coleccion empeoro el nivel "${level}" en modo "${mode}": antes ${b}, despues ${a}`)
    }
    // empate en este nivel: sigue comprobando el siguiente
  }
}

describe('rutas lexicograficas (Only My Collection / Easiest / Fastest)', () => {
  it('Only My Collection: cada hoja es un Pal propio real, nunca una captura', () => {
    const owned: OwnedPal[] = [
      { uid: 'o1', palId: 'Boar', passives: [A] },
      { uid: 'o2', palId: 'ChickenPal', passives: [B] },
    ]
    const result = run({ targetPalId: 'BluePlatypus', desiredPassives: [A, B], owned, mode: 'collection' })
    expect(result.ok).toBe(true)
    const ownedUids = new Set(owned.map((o) => o.uid))
    const walk = (node: PlanNode) => {
      expect(node.kind).not.toBe('capture')
      if (node.kind === 'owned') expect(ownedUids.has(node.ownedUid!)).toBe(true)
      node.parents?.forEach(walk)
    }
    walk(result.root!)
  })

  it('Easiest Route prefiere menos dificultad de captura aunque cueste mas generaciones que Fastest', () => {
    // Mismo caso que "el limite de Full breeding se paga en generaciones":
    // Fastest usa Orserk (boss dificil) para acortar el arbol; Easiest lo evita.
    const owned: OwnedPal[] = [
      { uid: 'o1', palId: 'ThunderBird', passives: [A] },
      { uid: 'o2', palId: 'Garm', passives: [B] },
    ]
    const base = { targetPalId: 'GhostDragon', desiredPassives: [A, B], owned }
    const easiest = run({ ...base, mode: 'breeding' })
    const fastest = run({ ...base, mode: 'hybrid' })
    expect(easiest.ok && fastest.ok).toBe(true)
    expect(easiest.stats!.maxCaptureDifficulty ?? 0).toBeLessThanOrEqual(fastest.stats!.maxCaptureDifficulty ?? 0)
    expect(easiest.stats!.generations).toBeGreaterThan(fastest.stats!.generations)
  })

  it('Fastest Route prioriza generaciones minimas por encima de la dificultad de captura', () => {
    const owned: OwnedPal[] = [
      { uid: 'o1', palId: 'ThunderBird', passives: [A] },
      { uid: 'o2', palId: 'Garm', passives: [B] },
    ]
    const base = { targetPalId: 'GhostDragon', desiredPassives: [A, B], owned }
    const fastest = run({ ...base, mode: 'hybrid' })
    const easiest = run({ ...base, mode: 'breeding' })
    expect(fastest.ok).toBe(true)
    expect(fastest.stats!.generations).toBeLessThan(easiest.stats!.generations)
    assertTreeIsValid(fastest.root!)
  })

  it('anadir un Pal a la coleccion nunca empeora la ruta optima bajo el mismo modo (monotonia)', () => {
    const base: OwnedPal[] = [{ uid: 'o1', palId: 'SheepBall', passives: [A] }]
    const extended: OwnedPal[] = [...base, { uid: 'o2', palId: 'ChickenPal', passives: [B] }]
    for (const mode of ['collection', 'breeding', 'hybrid'] as const) {
      const before = run({ targetPalId: 'PinkCat', desiredPassives: [A, B], owned: base, mode })
      const after = run({ targetPalId: 'PinkCat', desiredPassives: [A, B], owned: extended, mode })
      if (!before.ok) continue // sin ruta previa: cualquier resultado nuevo es, como mucho, una mejora
      expect(after.ok).toBe(true)
      assertNotWorseLexicographically(mode, before.stats!, after.stats!)
    }
  })

  it('regresion: anadir un Pal propio sin pasivas no puede dejar sin ruta una busqueda que antes si la encontraba', () => {
    // Caso real reportado: en modo Easiest, Anubis+Artisan se encontraba via
    // una cadena larga de capturas. Al anadir Dualith (sin pasivas, pero
    // parte real de las recetas de Anubis) a la coleccion, el orden
    // lexicografico estricto favorecia tan agresivamente las rutas que pasan
    // por Pals propios gratis que dos ramas del arbol terminaban queriendo el
    // MISMO Dualith -y como Dijkstra nunca reconsidera un estado ya asentado,
    // la busqueda se quedaba sin ruta por completo (ver la red de seguridad
    // en planner.ts: reintento con el orden por coste escalar si el orden
    // lexicografico no encuentra nada).
    const withoutDualith: OwnedPal[] = [{ uid: 'o1', palId: 'SheepBall', passives: [A] }]
    const withDualith: OwnedPal[] = [...withoutDualith, { uid: 'o2', palId: 'GrassGolem', passives: [] }]
    const before = run({ targetPalId: 'Anubis', desiredPassives: [A], owned: withoutDualith, mode: 'breeding' })
    const after = run({ targetPalId: 'Anubis', desiredPassives: [A], owned: withDualith, mode: 'breeding' })
    expect(before.ok).toBe(true)
    expect(after.ok).toBe(true)
    assertTreeIsValid(after.root!)
    // Owning the extra Pal should be able to help, never force MORE captures.
    expect(after.stats!.capturesNeeded).toBeLessThanOrEqual(before.stats!.capturesNeeded)
  })
})

describe('busqueda rapida (sin pasivas, D=0)', () => {
  // La pantalla de busqueda rapida llama a planBreeding con desiredPassives:
  // [] -este bloque blinda ese caso trivial (mask siempre 0) para que ningun
  // cambio futuro en el orden lexicografico o en el empaquetado de niveles
  // lo rompa sin que un test lo note.

  it('breeding/hybrid: encuentran una ruta valida hasta la especie sin pedir pasivas ni coleccion', () => {
    for (const mode of ['breeding', 'hybrid'] as const) {
      const result = run({ targetPalId: 'PinkCat', desiredPassives: [], owned: [], mode })
      expect(result.ok).toBe(true)
      expect(result.root!.passives).toEqual([])
      assertTreeIsValid(result.root!)
    }
  })

  it('collection: con ambos padres de una pareja directa en la coleccion, encuentra ruta sin capturar nada', () => {
    // Dualith + Azurmane -> Anubis es una pareja directa real (id interno de
    // Azurmane: BlueThunderHorse). Poseer ambos basta para "Only My
    // Collection" incluso sin pedir ninguna pasiva.
    const owned: OwnedPal[] = [
      { uid: 'o1', palId: 'GrassGolem', passives: [] },
      { uid: 'o2', palId: 'BlueThunderHorse', passives: [] },
    ]
    const result = run({ targetPalId: 'Anubis', desiredPassives: [], owned, mode: 'collection' })
    expect(result.ok).toBe(true)
    expect(result.root!.passives).toEqual([])
    assertTreeIsValid(result.root!)
    const walk = (node: PlanNode) => {
      expect(node.kind).not.toBe('capture')
      node.parents?.forEach(walk)
    }
    walk(result.root!)
  })

  it('un Pal propio que la ruta ya usaba como captura acorta la ruta frente a no tener ninguno', () => {
    const withoutOwned = run({ targetPalId: 'Anubis', desiredPassives: [], owned: [], mode: 'hybrid' })
    expect(withoutOwned.ok).toBe(true)
    const captureLeaf: string[] = []
    const collectCaptures = (node: PlanNode) => {
      if (node.kind === 'capture') captureLeaf.push(node.palId)
      node.parents?.forEach(collectCaptures)
    }
    collectCaptures(withoutOwned.root!)
    expect(captureLeaf.length).toBeGreaterThan(0)

    const withOwned = run({
      targetPalId: 'Anubis',
      desiredPassives: [],
      owned: [{ uid: 'o1', palId: captureLeaf[0], passives: [] }],
      mode: 'hybrid',
    })
    expect(withOwned.ok).toBe(true)
    expect(withOwned.stats!.capturesNeeded).toBeLessThan(withoutOwned.stats!.capturesNeeded)
  })
})

describe('fuente de pasiva fijada ("Use as passive source")', () => {
  const FOUR: OwnedPal[] = [
    { uid: 'o1', palId: 'SheepBall', passives: [A] },
    { uid: 'o2', palId: 'ChickenPal', passives: [B] },
    { uid: 'o3', palId: 'PinkCat', passives: [C] },
    { uid: 'o4', palId: 'Boar', passives: [D] },
  ]

  it('un pin fuerza la ruta a usar exactamente ese Pal, no otro que lleve la misma pasiva', () => {
    const owned: OwnedPal[] = [{ uid: 'o1b', palId: 'SheepBall', passives: [A] }, ...FOUR]
    const result = planBreeding(
      { targetPalId: 'GrassPanda_Electric', desiredPassives: [A, B, C, D], owned, mode: 'breeding', pinnedSources: { [A]: 'o1b' } },
      ctx,
      { timeBudgetMs: 20000 },
    )
    expect(result.ok).toBe(true)
    const sources: string[] = []
    const walk = (node: PlanNode) => {
      if (node.kind === 'owned' && node.passives.includes(A)) sources.push(node.ownedUid!)
      node.parents?.forEach(walk)
    }
    walk(result.root!)
    expect(sources.length).toBeGreaterThan(0)
    expect(sources.every((uid) => uid === 'o1b')).toBe(true)
    assertTreeIsValid(result.root!)
  })

  it('un pin colgante (el Pal ya no esta en la coleccion) queda inerte: el buscador elige solo', () => {
    const result = planBreeding(
      { targetPalId: 'GrassPanda_Electric', desiredPassives: [A, B, C, D], owned: FOUR, mode: 'breeding', pinnedSources: { [A]: 'no-existe' } },
      ctx,
      { timeBudgetMs: 20000 },
    )
    expect(result.ok).toBe(true)
    assertTreeIsValid(result.root!)
  })
})

describe('deteccion de fuente de pasiva (live optimization)', () => {
  const findOwnedNodes = (node: PlanNode, out: PlanNode[] = []): PlanNode[] => {
    if (node.kind === 'owned') out.push(node)
    node.parents?.forEach((p) => findOwnedNodes(p, out))
    return out
  }

  it.each<PlannerMode>(['collection', 'breeding', 'hybrid'])(
    'una pasiva deseada sin fuente propia no puede aparecer en el arbol final (modo %s)',
    (mode) => {
      // Con algo en la caja (que no lleva la pasiva) para que los 3 modos
      // lleguen igual a la comprobacion de pasivas, no a "caja vacia".
      const owned: OwnedPal[] = [{ uid: 'x', palId: 'Boar', passives: [] }]
      const result = run({ targetPalId: 'Anubis', desiredPassives: [A], owned, mode })
      expect(result.ok).toBe(false)
      expect(result.missingPassives).toContain(A)
    },
  )

  it('anadir un Pal propio que lleva la pasiva deseada genera una ruta desde ese UID exacto', () => {
    const partial: OwnedPal[] = [
      { uid: 'o1', palId: 'SheepBall', passives: [A] },
      { uid: 'o2', palId: 'ChickenPal', passives: [B] },
      { uid: 'o3', palId: 'PinkCat', passives: [C] },
    ]
    const withoutSource = run({ targetPalId: 'GrassPanda_Electric', desiredPassives: [A, B, C, D], owned: partial, mode: 'breeding' })
    expect(withoutSource.ok).toBe(false)
    expect(withoutSource.missingPassives).toContain(D)

    const owned: OwnedPal[] = [...partial, { uid: 'boar-1', palId: 'Boar', passives: [D] }]
    const withSource = run({ targetPalId: 'GrassPanda_Electric', desiredPassives: [A, B, C, D], owned, mode: 'breeding' })
    expect(withSource.ok).toBe(true)
    const sourceUids = findOwnedNodes(withSource.root!).map((n) => n.ownedUid)
    expect(sourceUids).toContain('boar-1')
    assertTreeIsValid(withSource.root!)
  })

  it('quitar un Pal necesario recalcula correctamente: sin fuente alternativa, falla con un motivo claro', () => {
    const owned: OwnedPal[] = [
      { uid: 'o1', palId: 'SheepBall', passives: [A] },
      { uid: 'o2', palId: 'ChickenPal', passives: [B] },
      { uid: 'o3', palId: 'PinkCat', passives: [C] },
      { uid: 'o4', palId: 'Boar', passives: [D] },
    ]
    const before = run({ targetPalId: 'GrassPanda_Electric', desiredPassives: [A, B, C, D], owned, mode: 'breeding' })
    expect(before.ok).toBe(true)

    // Se quita "o4" (unica fuente de D): la ruta debe recalcularse y fallar
    // explicando que falta D, no devolver un arbol viejo ni uno inventado.
    const afterRemoval = run({ targetPalId: 'GrassPanda_Electric', desiredPassives: [A, B, C, D], owned: owned.slice(0, 3), mode: 'breeding' })
    expect(afterRemoval.ok).toBe(false)
    expect(afterRemoval.missingPassives).toContain(D)
  })
})
