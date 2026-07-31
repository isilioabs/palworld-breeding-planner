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
import type { BreedingData, Mechanics, Pal, Passive, WorkType } from './types'

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

/** Nombre a mostrar (es con fallback a en). */
export function palName(pal: Pal | undefined): string {
  if (!pal) return '???'
  return pal.nameEs || pal.name
}

export function passiveName(passive: Passive | undefined): string {
  if (!passive) return '???'
  return passive.nameEs || passive.name
}

/** Efecto de la pasiva, como lista de lineas (algunas tienen varios efectos). */
export function passiveEffects(passive: Passive | undefined): string[] {
  if (!passive) return []
  return (passive.descEs || passive.desc || '')
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

const WORK_LABELS: Record<WorkType, string> = {
  Kindling: 'Encender fuego',
  Watering: 'Regar',
  Planting: 'Plantar',
  GenerateElectricity: 'Generar electricidad',
  Handiwork: 'Manualidades',
  Gathering: 'Recolectar',
  Lumbering: 'Talar',
  Mining: 'Minar',
  MedicineProduction: 'Producir medicinas',
  Cooling: 'Refrigerar',
  Transporting: 'Transportar',
  Farming: 'Cultivar',
}

export function workTypeLabel(type: WorkType): string {
  return WORK_LABELS[type] ?? type
}
