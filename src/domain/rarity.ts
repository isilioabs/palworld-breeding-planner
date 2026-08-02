/**
 * Escala de rareza visual, derivada del campo `rarity` (1-20) que ya trae la
 * base de datos. No es un dato nuevo: es una lectura de uno que ya existia.
 *
 * Los cortes estan calibrados con la distribucion real de los 299 Pals, no a
 * ojo (ver distribucion completa en el historial del proyecto):
 *
 *   1-2   -> 57 Pals   3-4  -> 64 Pals   5-6  -> 71 Pals
 *   7-8   -> 71 Pals   9-10 -> 28 Pals   20   -> 8 Pals (no hay 11..19)
 *
 * Ese salto de 10 a 20 sin nada en medio es real: son los legendarios/bosses,
 * y por eso tienen su propio nivel en vez de compartirlo con "legendario".
 */

import { getLang } from '@/i18n/lang'
import { DICTS } from '@/i18n/translations'

export type RarityTier = 1 | 2 | 3 | 4 | 5 | 6

export interface RarityInfo {
  tier: RarityTier
  label: string
}

const TIERS: { max: number; tier: RarityTier; key: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic' }[] = [
  { max: 2, tier: 1, key: 'common' },
  { max: 4, tier: 2, key: 'uncommon' },
  { max: 6, tier: 3, key: 'rare' },
  { max: 8, tier: 4, key: 'epic' },
  { max: 10, tier: 5, key: 'legendary' },
  { max: Infinity, tier: 6, key: 'mythic' },
]

export function rarityInfo(rarity: number): RarityInfo {
  const found = TIERS.find((t) => rarity <= t.max) ?? TIERS[TIERS.length - 1]
  return { tier: found.tier, label: DICTS[getLang()][`rarity.${found.key}`] }
}
