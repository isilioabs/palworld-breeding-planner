import { loadDatabase } from '@/domain/database'
import type { Gender, OwnedPal } from '@/domain/types'

export interface CollectionImportCandidate {
  sourceIndex: number
  palId: string
  passives: string[]
  gender?: Gender
  nickname?: string
  notes?: string
}

export interface CollectionImportResult {
  candidates: CollectionImportCandidate[]
  skipped: number
  source: 'palaxis' | 'collection' | 'generic'
}

type UnknownRecord = Record<string, unknown>

const isRecord = (value: unknown): value is UnknownRecord => typeof value === 'object' && value !== null && !Array.isArray(value)

const firstArray = (value: unknown): unknown[] | null => {
  if (Array.isArray(value)) return value
  if (!isRecord(value)) return null
  for (const key of ['owned', 'collection', 'pals', 'ownedPals', 'entries', 'data']) {
    if (Array.isArray(value[key])) return value[key]
  }
  return null
}

function resolvePalId(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const needle = String(value).trim().toLocaleLowerCase()
  if (!needle) return null
  const db = loadDatabase()
  const exact = db.pals.find((pal) => [pal.id, pal.name, pal.nameEs].some((name) => name.toLocaleLowerCase() === needle))
  return exact?.id ?? null
}

function resolvePassives(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const db = loadDatabase()
  return [...new Set(value.flatMap((item) => {
    const raw = typeof item === 'string' || typeof item === 'number'
      ? item
      : isRecord(item) ? item.id ?? item.name ?? item.passiveId : null
    if (typeof raw !== 'string' && typeof raw !== 'number') return []
    const needle = String(raw).trim().toLocaleLowerCase()
    const passive = db.passives.find((entry) => [entry.id, entry.name, entry.nameEs].some((name) => name.toLocaleLowerCase() === needle))
    return passive ? [passive.id] : []
  }))].slice(0, 4)
}

function resolveGender(value: unknown): Gender | undefined {
  const normalized = typeof value === 'string' ? value.trim().toLocaleLowerCase() : ''
  if (['male', 'm', 'masculino', 'macho'].includes(normalized)) return 'MALE'
  if (['female', 'f', 'femenino', 'hembra'].includes(normalized)) return 'FEMALE'
  return undefined
}

/**
 * Lee formatos seguros y explícitos: un export de Palaxis, una lista de
 * colección o una lista genérica con palId/species, pasivas y género. Los
 * archivos .sav binarios no se interpretan aquí: requieren un exportador local
 * dedicado antes de exponer datos de un mundo al navegador.
 */
export function parseCollectionImport(text: string): CollectionImportResult {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('El archivo no es JSON válido. Exporta tu colección como .json antes de importarla.')
  }
  const items = firstArray(raw)
  if (!items) throw new Error('No encontramos una lista de Pals. Usa un export de Palaxis o un JSON con collection/pals.')

  const source: CollectionImportResult['source'] = isRecord(raw) && Array.isArray(raw.owned)
    ? 'palaxis'
    : isRecord(raw) && (Array.isArray(raw.collection) || Array.isArray(raw.pals))
      ? 'collection'
      : 'generic'
  let skipped = 0
  const candidates = items.flatMap((item, sourceIndex) => {
    if (!isRecord(item)) {
      skipped += 1
      return []
    }
    const palId = resolvePalId(item.palId ?? item.species ?? item.name ?? item.id)
    if (!palId) {
      skipped += 1
      return []
    }
    return [{
      sourceIndex,
      palId,
      passives: resolvePassives(item.passives ?? item.passiveSkills ?? item.skills ?? item.traits),
      gender: resolveGender(item.gender ?? item.sex),
      nickname: typeof item.nickname === 'string' ? item.nickname.slice(0, 60) : undefined,
      notes: typeof item.notes === 'string' ? item.notes.slice(0, 280) : undefined,
    }]
  })
  if (candidates.length === 0) throw new Error('No encontramos Pals reconocibles en ese archivo.')
  return { candidates, skipped, source }
}

export function candidatesToOwned(candidates: CollectionImportCandidate[]): OwnedPal[] {
  const now = Date.now()
  return candidates.map((entry, index) => ({
    uid: `i_${now.toString(36)}_${index.toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    palId: entry.palId,
    passives: entry.passives,
    gender: entry.gender,
    nickname: entry.nickname,
    notes: entry.notes,
    favorite: false,
    addedAt: now + index,
  }))
}
