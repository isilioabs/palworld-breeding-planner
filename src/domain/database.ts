/**
 * Carga y indexado de la base de datos local.
 *
 * Todo se importa como JSON estatico: la app funciona sin red. Si en el futuro
 * se quiere cargar la base de datos desde disco o desde una URL basta con
 * sustituir `loadDatabase()` por otra implementacion que devuelva `PalDatabase`;
 * el resto del codigo solo depende de esta interfaz.
 */
import palsJson from '@/data/pals.json'
import breedingJson from '@/data/breeding.json'
import passivesJson from '@/data/passives.json'
import mechanicsJson from '@/data/mechanics.json'
import palStatsJson from '@/data/pal-stats.json'
import palWikiDataJson from '@/data/pal-wiki-data.json'
import palPartnerSkillsJson from '@/data/pal-partner-skills.json'
import mountTiersJson from '@/data/mount-tiers.json'
import { getLang } from '@/i18n/lang'
import { DICTS } from '@/i18n/translations'
import type { BreedingData, Mechanics, Pal, PalCombatStats, PalDrop, PalActiveSkill, PalPartnerSkill, PalWildSpawn, Passive, WorkType } from './types'

export interface PalDatabase {
  pals: Pal[]
  passives: Passive[]
  breeding: BreedingData
  mechanics: Mechanics
  palById: Map<string, Pal>
  passiveById: Map<string, Passive>
  /** Indice posicional de cada Pal (usado por las matrices del planificador). */
  palIndex: Map<string, number>
}

let cached: PalDatabase | null = null

export function loadDatabase(): PalDatabase {
  if (cached) return cached

  const pals = palsJson as unknown as Pal[]
  const passives = passivesJson as unknown as Passive[]
  const breeding = breedingJson as unknown as BreedingData
  const mechanics = mechanicsJson as unknown as Mechanics

  cached = {
    pals,
    passives,
    breeding,
    mechanics,
    palById: new Map(pals.map((p) => [p.id, p])),
    passiveById: new Map(passives.map((p) => [p.id, p])),
    palIndex: new Map(pals.map((p, i) => [p.id, i])),
  }
  return cached
}

/** Nombre a mostrar en el idioma activo (con fallback a ingles si falta la traduccion). */
export function palName(pal: Pal | undefined): string {
  if (!pal) return '???'
  if (getLang() === 'en') return pal.name
  return pal.nameEs || pal.name
}

export function passiveName(passive: Passive | undefined): string {
  if (!passive) return '???'
  if (getLang() === 'en') return passive.name
  return passive.nameEs || passive.name
}

/** Efecto de la pasiva, como lista de lineas (algunas tienen varios efectos). */
export function passiveEffects(passive: Passive | undefined): string[] {
  if (!passive) return []
  const desc = getLang() === 'en' ? passive.desc : passive.descEs || passive.desc || ''
  return (desc || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

/** Efecto en una sola linea, para tooltips nativos y resumenes. */
export function passiveSummary(passive: Passive | undefined): string {
  return passiveEffects(passive).join(' · ')
}

/** Numero de Paldex legible, con sufijo B para las variantes. */
export function dexLabel(pal: Pal): string {
  return `#${String(pal.dex).padStart(3, '0')}${pal.variant ? 'B' : ''}`
}

export function workTypeLabel(type: WorkType): string {
  return DICTS[getLang()][`work.${type}` as keyof (typeof DICTS)['es']] ?? type
}

interface PalStatsEntry extends PalCombatStats {
  drops: PalDrop[]
}
const PAL_STATS = palStatsJson as unknown as Record<string, PalStatsEntry>

export function getPalCombatStats(palId: string): PalCombatStats | null {
  return PAL_STATS[palId] ?? null
}

export function getPalDrops(palId: string): PalDrop[] {
  return PAL_STATS[palId]?.drops ?? []
}

interface PalWikiEntry {
  activeSkills: PalActiveSkill[]
  partnerSkill: PalPartnerSkill | null
  wildSpawns: PalWildSpawn[]
  sourceUrl: string
}
const PAL_WIKI_DATA = palWikiDataJson as unknown as Record<string, PalWikiEntry>

export function getPalWikiData(palId: string): PalWikiEntry | null {
  return PAL_WIKI_DATA[palId] ?? null
}

const PAL_PARTNER_SKILLS = palPartnerSkillsJson as unknown as Record<string, PalPartnerSkill>

/** Partner Skill real desde game8.co -mas completo que el de PAL_WIKI_DATA, ver scripts/parse-game8-partner-skills.mjs. */
export function getPalPartnerSkill(palId: string): PalPartnerSkill | null {
  return PAL_PARTNER_SKILLS[palId] ?? null
}

interface MountTiers {
  ground: Record<string, number>
  flying: Record<string, number>
}
const MOUNT_TIERS = mountTiersJson as unknown as MountTiers

/** Estrellas 1-5 (S..D via tierLetter() en tier-list.ts), o null si no es montura de ese tipo. */
export function getMountTier(palId: string, kind: 'ground' | 'flying'): number | null {
  return MOUNT_TIERS[kind][palId] ?? null
}
