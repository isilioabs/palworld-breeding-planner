/**
 * Lenguaje visual compartido para el rango de una pasiva (-3..5, 5 se trata
 * como 4). Una sola fuente de verdad para la carta del arbol, el badge
 * pequeño, las ranuras del selector y los chips de "pasivas deseadas" del
 * sidebar -antes cada uno coloreaba distinto (o no coloreaba en absoluto).
 */
export type PassiveRankTier = 'legendary' | 'gold' | 'silver' | 'negative'

export const RAINBOW = 'linear-gradient(100deg, #ff5f8f, #ffb038, #ffe94a, #46e08a, #46c8ff, #a06bff, #ff5f8f)'
export const GOLD = 'linear-gradient(165deg, #fff8da, #f0cd6e 42%, #b98a22)'
export const SILVER = 'linear-gradient(165deg, #e8ebf0, #9aa0aa)'
export const RED = 'linear-gradient(165deg, #ff9c86, #c0392b)'

export function passiveRankTier(rank: number): PassiveRankTier {
  if (rank >= 4) return 'legendary'
  if (rank >= 2) return 'gold'
  if (rank >= 1) return 'silver'
  return 'negative'
}

export function passiveRankArrowCount(rank: number): number {
  return Math.max(1, Math.min(3, Math.abs(rank)))
}

export function passiveRankDirection(rank: number): 'up' | 'down' {
  return rank < 0 ? 'down' : 'up'
}

/** Un tramo del arcoiris por flecha (rango 4): comprimidas en pocos px, un
 * degradado completo por flecha se ve de un solo color -mejor un tramo cada una. */
export const LEGENDARY_ARROW_FILLS = [
  'linear-gradient(160deg, #ff8fb0, #ff4f7d)',
  'linear-gradient(160deg, #ffe98a, #ffab2e)',
  'linear-gradient(160deg, #7de6ff, #6a6bff)',
]

export function passiveRankArrowFill(tier: PassiveRankTier, index: number): string {
  if (tier === 'legendary') return LEGENDARY_ARROW_FILLS[index % LEGENDARY_ARROW_FILLS.length]
  if (tier === 'gold') return GOLD
  if (tier === 'negative') return RED
  return SILVER
}
