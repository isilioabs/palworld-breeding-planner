/**
 * Tier List: 17 categorias (Best Base Pals, Player DMG, Best Combat Pals,
 * Montura terrestre, Montura voladora, y los 12 tipos de trabajo por
 * separado).
 *
 * Best Combat Pals (`combat-power`) es distinta de Player DMG: aca se mide
 * el PROPIO poder de combate del Pal (stats + habilidades activas peleando
 * junto a vos), no cuanto potencia el Partner Skill el daño DEL JUGADOR.
 * Curada 100% desde https://palworld.gg/tier-list/combat (scrapeada via
 * Browser MCP, matcheada por slug contra pals.json -298/299, "Astralym" es
 * un Pal nuevo que la data v27 todavia no tiene, se omite en vez de
 * inventar un tier). Sin respaldo calculado -mismo criterio que Best Base
 * Pals: fuera de esta lista, un Pal simplemente no aparece.
 *
 * Best Base Pals es 100% curada, sin respaldo calculado: SS/S/A/B vienen
 * literal de https://game8.co/games/Palworld/archives/440432 ("Best Base
 * Pals Tier List"), scrapeado a mano (src/data/base-pal-tiers.json, ver
 * scripts/build-base-pal-tiers.mjs) -las filas de NPCs/vendors que esa pagina
 * mezcla en su tier SS se descartaron (esta app no modela NPCs). A diferencia
 * de Player DMG/Work, aca no hay un numero crudo con el que rellenar el
 * resto del roster -Pals fuera de SS/S/A/B simplemente no aparecen.
 *
 * "Player DMG" (antes "Combate") es la unica categoria curada a mano: el
 * bucketing por ATK crudo + regex sobre el texto del Partner Skill se probo
 * repetidas veces (ver historial) y demostro un techo real -separa S del
 * resto con ~95% de acierto pero NO puede separar A/B/C/D de forma
 * confiable. El usuario transcribio manualmente S/A/B/C desde su propio
 * analisis de la meta real (que Partner Skills potencian el DAÑO DEL
 * JUGADOR, el objetivo de fin de juego) -eso es `src/data/player-dmg-tiers.json`
 * (ver scripts/build-player-dmg-tiers.mjs). D/E reparten al resto del roster
 * elegible (ATK>=100) por ATK descendente, a falta de un juicio manual para
 * esos ~189 Pals restantes.
 *
 * Monturas no recalculan nada: leen directo `getMountTier()`
 * (src/data/mount-tiers.json, generado por scripts/generate-build-advisor.mjs).
 *
 * Los 12 trabajos: A-D salen en runtime del bucketing por
 * `PalCombatStats.workSuitability` (src/data/pal-stats.json). S es curado a
 * mano por el usuario por tipo de trabajo (src/data/work-tier-s.json, ver
 * scripts/build-work-tier-s.mjs) -mismo motivo que Player DMG: el numero
 * crudo de WorkSuitability no capta todo lo que hace al mejor pick real
 * (velocidad de movimiento, facilidad de condensar, etc.). Sin curar, el
 * tope real es A aunque el numero crudo llegue al umbral de S.
 */
import { loadDatabase } from './database'
import { getMountTier, getPalCombatStats } from './pal-details-data'
import basePalTiersJson from '@/data/base-pal-tiers.json'
import combatPowerTiersJson from '@/data/combat-power-tiers.json'
import playerDmgTiersJson from '@/data/player-dmg-tiers.json'
import workTierSJson from '@/data/work-tier-s.json'
import workTierFullJson from '@/data/work-tier-full.json'
import type { Pal, WorkType } from './types'
import type { TranslationKey } from '@/i18n/translations'

export type TierCategoryKind = 'base' | 'combat' | 'combat-power' | 'mount-ground' | 'mount-flying' | 'work'

/** De mejor a peor. La mayoria de categorias usan 5 bandas (S..D); Player DMG usa 6 (S..E); Base usa 4 (SS..B). */
const DEFAULT_LETTERS = ['S', 'A', 'B', 'C', 'D']
const PLAYER_DMG_LETTERS = ['S', 'A', 'B', 'C', 'D', 'E']
const BASE_PAL_LETTERS = ['SS', 'S', 'A', 'B']

export interface TierCategory {
  id: string
  kind: TierCategoryKind
  workType?: WorkType
  labelKey: TranslationKey
  group: 'base' | 'combat' | 'work'
  /** De mejor a peor -el largo define cuantas bandas tiene esta categoria. */
  letters: string[]
}

const WORK_TYPES: WorkType[] = [
  'Kindling',
  'Watering',
  'Planting',
  'GenerateElectricity',
  'Handiwork',
  'Gathering',
  'Lumbering',
  'Mining',
  'MedicineProduction',
  'Cooling',
  'Transporting',
  'Farming',
]

export const TIER_CATEGORIES: TierCategory[] = [
  { id: 'base', kind: 'base', labelKey: 'tierList.category.base', group: 'base', letters: BASE_PAL_LETTERS },
  { id: 'combat', kind: 'combat', labelKey: 'tierList.category.combat', group: 'combat', letters: PLAYER_DMG_LETTERS },
  { id: 'combat-power', kind: 'combat-power', labelKey: 'tierList.category.combatPower', group: 'combat', letters: DEFAULT_LETTERS },
  { id: 'mount-ground', kind: 'mount-ground', labelKey: 'tierList.category.mountGround', group: 'combat', letters: DEFAULT_LETTERS },
  { id: 'mount-flying', kind: 'mount-flying', labelKey: 'tierList.category.mountFlying', group: 'combat', letters: DEFAULT_LETTERS },
  ...WORK_TYPES.map((workType): TierCategory => ({
    id: `work-${workType}`,
    kind: 'work',
    workType,
    labelKey: `work.${workType}` as TranslationKey,
    group: 'work',
    letters: DEFAULT_LETTERS,
  })),
]

export interface TierEntry {
  pal: Pal
  /** 1 = peor banda de la categoria, `letters.length` = mejor (S). */
  tier: number
  statValue: number
  /** Vacio para monturas: el tier ahi ya ES el dato (curado), no hay un numero de respaldo que mostrar. */
  statLabel: string
}

const BASE_PAL_TIERS = basePalTiersJson as unknown as Record<string, number>
const COMBAT_POWER_TIERS = combatPowerTiersJson as unknown as Record<string, number>
const PLAYER_DMG_TIERS = playerDmgTiersJson as unknown as Record<string, number>
const WORK_TIER_S = workTierSJson as unknown as Record<string, string[]>
const WORK_TIER_FULL = workTierFullJson as unknown as Record<string, Record<string, number>>

/** Letra de una banda dentro de una categoria (S es siempre `letters[0]`, la mejor). */
export function tierLetter(category: TierCategory, tierNumber: number): string {
  return category.letters[category.letters.length - tierNumber] ?? '?'
}

/** Mismo umbral que ya usa el rol "Base Worker" del Build Advisor -una sola regla para toda la app. */
function bucketWorkValue(value: number): number | null {
  if (value >= 7) return 5
  if (value >= 6) return 4
  if (value >= 5) return 3
  if (value >= 4) return 2
  if (value >= 3) return 1
  return null
}

export function getTierCategory(categoryId: string): TierCategory | null {
  return TIER_CATEGORIES.find((c) => c.id === categoryId) ?? null
}

/** Entradas de una categoria, de S a la peor banda y por stat descendente dentro de cada tier. */
export function getTierList(categoryId: string): TierEntry[] {
  const category = getTierCategory(categoryId)
  if (!category) return []
  const db = loadDatabase()
  const entries: TierEntry[] = []

  if (category.kind === 'base') {
    for (const pal of db.pals) {
      const tier = BASE_PAL_TIERS[pal.id]
      if (tier === undefined) continue
      entries.push({ pal, tier, statValue: tier, statLabel: '' })
    }
  } else if (category.kind === 'combat') {
    for (const pal of db.pals) {
      const tier = PLAYER_DMG_TIERS[pal.id]
      if (tier === undefined) continue
      const atk = Math.max(getPalCombatStats(pal.id)?.meleeAttack ?? 0, getPalCombatStats(pal.id)?.shotAttack ?? 0)
      entries.push({ pal, tier, statValue: atk, statLabel: atk ? `${atk} ATK` : '' })
    }
  } else if (category.kind === 'combat-power') {
    for (const pal of db.pals) {
      const tier = COMBAT_POWER_TIERS[pal.id]
      if (tier === undefined) continue
      const atk = Math.max(getPalCombatStats(pal.id)?.meleeAttack ?? 0, getPalCombatStats(pal.id)?.shotAttack ?? 0)
      entries.push({ pal, tier, statValue: atk, statLabel: atk ? `${atk} ATK` : '' })
    }
  } else if (category.kind === 'mount-ground' || category.kind === 'mount-flying') {
    const mountKind = category.kind === 'mount-ground' ? 'ground' : 'flying'
    for (const pal of db.pals) {
      const tier = getMountTier(pal.id, mountKind)
      if (tier === null) continue
      entries.push({ pal, tier, statValue: tier, statLabel: '' })
    }
  } else if (category.kind === 'work' && category.workType) {
    const workType = category.workType
    const fullCuration = WORK_TIER_FULL[workType]
    if (fullCuration) {
      // Farming y Generating Electricity: el umbral generico de
      // bucketWorkValue deja Tier A vacio para estos dos -sus mejores picks
      // reales tienen WorkSuitability crudo muy bajo (1-2) en casi todo el
      // roster. Curado completo S-D desde op.gg (src/data/work-tier-full.json,
      // ver scripts/build-work-tier-full.mjs): un Pal fuera de esa lista
      // simplemente no aparece, igual que Best Base Pals.
      for (const pal of db.pals) {
        const tier = fullCuration[pal.id]
        if (tier === undefined) continue
        const value = getPalCombatStats(pal.id)?.workSuitability[workType] ?? 0
        entries.push({ pal, tier, statValue: value, statLabel: value ? `${value}` : '' })
      }
    } else {
      const curatedS = new Set(WORK_TIER_S[workType] ?? [])
      for (const pal of db.pals) {
        const value = getPalCombatStats(pal.id)?.workSuitability[workType] ?? 0
        const isCuratedS = curatedS.has(pal.id)
        // El numero crudo de WorkSuitability no capta todo lo que hace a un
        // Pal el mejor pick real para un trabajo (velocidad de movimiento,
        // facilidad de condensar, etc.) -mismo patron que Player DMG: S es
        // SOLO la lista curada a mano por el usuario, incluso cuando ese
        // numero por si solo ni siquiera llegaria al umbral minimo (ej.
        // Woolipop en Farming, WorkSuitability=1). Sin curar, el tope real es
        // A (4) aunque el numero crudo llegue al umbral de S.
        const bucketed = bucketWorkValue(value)
        if (!isCuratedS && bucketed === null) continue
        const tier = isCuratedS ? 5 : Math.min(bucketed ?? 1, 4)
        entries.push({ pal, tier, statValue: value, statLabel: value ? `${value}` : '' })
      }
    }
  }

  entries.sort((a, b) => b.tier - a.tier || b.statValue - a.statValue)
  return entries
}

/** Agrupa en las bandas de la categoria (5 o 6 segun `letters.length`), siempre todas presentes (vacias si no hay entradas en esa tier). */
export function groupByTier(entries: TierEntry[], category: TierCategory): Record<number, TierEntry[]> {
  const groups: Record<number, TierEntry[]> = {}
  for (let tierNumber = 1; tierNumber <= category.letters.length; tierNumber++) groups[tierNumber] = []
  for (const entry of entries) {
    if (groups[entry.tier]) groups[entry.tier].push(entry)
  }
  return groups
}
