/**
 * Datos avanzados que no hacen falta para arrancar la landing ni el shell.
 * Viven fuera de database.ts para que Vite pueda descargarlos solo cuando se
 * abre una ficha, la Tier List o cualquier vista que realmente los consume.
 */
import palStatsJson from '@/data/pal-stats.json'
import palWikiDataJson from '@/data/pal-wiki-data.json'
import palPartnerSkillsJson from '@/data/pal-partner-skills.json'
import mountTiersJson from '@/data/mount-tiers.json'
import type { PalActiveSkill, PalCombatStats, PalDrop, PalPartnerSkill, PalWildSpawn } from './types'

interface PalStatsEntry extends PalCombatStats { drops: PalDrop[] }
const PAL_STATS = palStatsJson as unknown as Record<string, PalStatsEntry>

export function getPalCombatStats(palId: string): PalCombatStats | null { return PAL_STATS[palId] ?? null }
export function getPalDrops(palId: string): PalDrop[] { return PAL_STATS[palId]?.drops ?? [] }

interface PalWikiEntry {
  activeSkills: PalActiveSkill[]
  partnerSkill: PalPartnerSkill | null
  wildSpawns: PalWildSpawn[]
  sourceUrl: string
}
const PAL_WIKI_DATA = palWikiDataJson as unknown as Record<string, PalWikiEntry>

export function getPalWikiData(palId: string): PalWikiEntry | null { return PAL_WIKI_DATA[palId] ?? null }

const PAL_PARTNER_SKILLS = palPartnerSkillsJson as unknown as Record<string, PalPartnerSkill>
export function getPalPartnerSkill(palId: string): PalPartnerSkill | null { return PAL_PARTNER_SKILLS[palId] ?? null }

interface MountTiers { ground: Record<string, number>; flying: Record<string, number> }
const MOUNT_TIERS = mountTiersJson as unknown as MountTiers

export function getMountTier(palId: string, kind: 'ground' | 'flying'): number | null { return MOUNT_TIERS[kind][palId] ?? null }
