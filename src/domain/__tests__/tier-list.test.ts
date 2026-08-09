import { describe, expect, it } from 'vitest'
import { getMountTier } from '../database'
import { getTierCategory, getTierList, groupByTier, tierLetter, TIER_CATEGORIES } from '../tier-list'

describe('tier-list', () => {
  it('trae exactamente 17 categorias: Best Base Pals + Player DMG + Best Combat Pals + 2 monturas + 12 trabajos', () => {
    expect(TIER_CATEGORIES).toHaveLength(17)
    expect(TIER_CATEGORIES.filter((c) => c.kind === 'work')).toHaveLength(12)
    expect(TIER_CATEGORIES.filter((c) => c.kind === 'base')).toHaveLength(1)
    expect(TIER_CATEGORIES.filter((c) => c.kind === 'combat-power')).toHaveLength(1)
  })

  /**
   * Best Combat Pals es 100% curada desde palworld.gg/tier-list/combat -el
   * PROPIO poder de combate del Pal (stats + habilidades), distinto de
   * Player DMG (cuanto potencia su Partner Skill el daño del JUGADOR).
   */
  it('Best Combat Pals: Necromus es S real (curado desde palworld.gg)', () => {
    const entries = getTierList('combat-power')
    const category = getTierCategory('combat-power')!
    const necromus = entries.find((e) => e.pal.name === 'Necromus')
    expect(necromus).toBeDefined()
    expect(tierLetter(category, necromus!.tier)).toBe('S')
  })

  it('Best Combat Pals: cubre practicamente todo el roster (298/299, un Pal nuevo omitido)', () => {
    const entries = getTierList('combat-power')
    expect(entries.length).toBe(298)
  })

  it('Best Base Pals usa 4 bandas (SS..B); Player DMG usa 6 (S..E); el resto usa 5 (S..D)', () => {
    expect(getTierCategory('base')!.letters).toEqual(['SS', 'S', 'A', 'B'])
    expect(getTierCategory('combat')!.letters).toEqual(['S', 'A', 'B', 'C', 'D', 'E'])
    expect(getTierCategory('mount-ground')!.letters).toEqual(['S', 'A', 'B', 'C', 'D'])
    expect(getTierCategory('work-Mining')!.letters).toEqual(['S', 'A', 'B', 'C', 'D'])
  })

  /**
   * Best Base Pals es 100% curada desde game8.co (src/data/base-pal-tiers.json,
   * ver scripts/build-base-pal-tiers.mjs) -sin respaldo calculado: un Pal
   * fuera de SS/S/A/B simplemente no aparece en esta categoria.
   */
  it('Best Base Pals: Anubis es SS real (curado desde game8.co)', () => {
    const baseEntries = getTierList('base')
    const category = getTierCategory('base')!
    const anubis = baseEntries.find((e) => e.pal.name === 'Anubis')
    expect(anubis).toBeDefined()
    expect(tierLetter(category, anubis!.tier)).toBe('SS')
  })

  it('Best Base Pals: un Pal sin curar (ej. Lamball no listado por game8) no aparece', () => {
    const baseEntries = getTierList('base')
    expect(baseEntries.find((e) => e.pal.name === 'Chikipi')).toBeUndefined()
  })

  /**
   * Player DMG's Tier List es curada a mano (src/data/player-dmg-tiers.json,
   * ver scripts/build-player-dmg-tiers.mjs) -no calculada por regex/ATK. S/A/B/C
   * son la transcripcion literal del usuario desde su propio analisis de la
   * meta real (que Partner Skills potencian el daño del JUGADOR); D/E reparten
   * al resto del roster elegible por ATK descendente.
   */
  it("Player DMG: Lovander es S real (curado por el usuario)", () => {
    const combatEntries = getTierList('combat')
    const category = getTierCategory('combat')!
    const lovander = combatEntries.find((e) => e.pal.name === 'Lovander')
    expect(lovander).toBeDefined()
    expect(tierLetter(category, lovander!.tier)).toBe('S')
  })

  it('Player DMG: Direhowl (sin dato curado) cae en D/E por ATK, no en S', () => {
    const combatEntries = getTierList('combat')
    const category = getTierCategory('combat')!
    const direhowl = combatEntries.find((e) => e.pal.name === 'Direhowl')
    expect(direhowl).toBeDefined()
    expect(['D', 'E']).toContain(tierLetter(category, direhowl!.tier))
  })

  it('Montura terrestre: un Pal S de GROUND_MOUNT_TIERS aparece como tier 5', () => {
    const groundEntries = getTierList('mount-ground')
    const necromus = groundEntries.find((e) => e.pal.name === 'Necromus')
    expect(necromus).toBeDefined()
    expect(necromus?.tier).toBe(getMountTier(necromus!.pal.id, 'ground'))
    expect(necromus?.tier).toBe(5)
  })

  it('Mineria: Anubis (WorkSuitability_Mining=6) aparece en tier A o superior', () => {
    const miningEntries = getTierList('work-Mining')
    const anubisEntry = miningEntries.find((e) => e.pal.id === 'Anubis')
    expect(anubisEntry).toBeDefined()
    expect(anubisEntry!.tier).toBeGreaterThanOrEqual(4)
  })

  /**
   * Farming y Generating Electricity son las 2 excepciones con curacion
   * COMPLETA S-D desde op.gg (src/data/work-tier-full.json) -el bucketing
   * generico por WorkSuitability crudo dejaba Tier A vacio en ambas (el
   * umbral minimo excluia a casi todos los mejores picks reales, cuyo numero
   * crudo es 1-2). Un Pal fuera de esa lista no aparece, igual que Best Base
   * Pals.
   */
  it('Farming: Tier A trae picks reales de op.gg (antes vacio con el bucketing generico)', () => {
    const category = getTierCategory('work-Farming')!
    const entries = getTierList('work-Farming')
    const cremis = entries.find((e) => e.pal.name === 'Cremis')
    expect(cremis).toBeDefined()
    expect(tierLetter(category, cremis!.tier)).toBe('A')
  })

  it('Generating Electricity: Tier A trae picks reales de op.gg (antes vacio con el bucketing generico)', () => {
    const category = getTierCategory('work-GenerateElectricity')!
    const entries = getTierList('work-GenerateElectricity')
    const grizzbolt = entries.find((e) => e.pal.name === 'Grizzbolt')
    expect(grizzbolt).toBeDefined()
    expect(tierLetter(category, grizzbolt!.tier)).toBe('A')
  })

  it('groupByTier siempre trae todas las bandas de la categoria, vacias si no hay entradas', () => {
    const category = getTierCategory('work-Cooling')!
    const groups = groupByTier(getTierList('work-Cooling'), category)
    expect(Object.keys(groups).sort()).toEqual(['1', '2', '3', '4', '5'])
    for (const tier of [1, 2, 3, 4, 5]) expect(Array.isArray(groups[tier])).toBe(true)
  })

  it('categoria desconocida devuelve lista vacia en vez de lanzar', () => {
    expect(getTierList('not-a-real-category')).toEqual([])
  })
})
