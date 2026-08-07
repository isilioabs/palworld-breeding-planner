/**
 * Extrae la coleccion de Pals de un `Level.sav` real de Palworld.
 *
 * Todos los personajes del mundo -jugadores, Pals en party, Pals en base,
 * Pals salvajes ya "trackeados" por el juego- viven juntos en
 * `worldSaveData.CharacterSaveParameterMap`. Cada entrada guarda casi todo
 * en un campo `RawData` (un blob de bytes que es, el mismo, otra lista de
 * propiedades anidada) -ahi es donde estan CharacterID, Gender,
 * PassiveSkillList, NickName, OwnerPlayerUId e IsPlayer.
 *
 * Solo se extraen esos 7 campos: especie, genero, pasivas, apodo y quien es
 * el dueño. IVs, talento, HP/nivel y demas quedan fuera a proposito -no los
 * modela `OwnedPal` todavia.
 */
import {
  BinaryCursor,
  decompressSav,
  enterNamedStructProperty,
  isZeroGuidHex,
  readGvasHeader,
  readMapPropertyHeader,
  readNamedProperties,
  skipPropertiesUntilNone,
  GvasFormatError,
} from './gvas-reader'
import { resolvePalId, resolvePassives, type CollectionImportCandidate, type CollectionImportResult } from '@/domain/collection-import'

export interface RawPalRecord {
  characterId: string
  gender: 'MALE' | 'FEMALE' | undefined
  level: number | undefined
  nickname: string | undefined
  isPlayer: boolean
  /** Hex de 32 caracteres sin guiones, o null si el campo es todo ceros (nadie es dueño: salvaje/NPC). */
  ownerPlayerUId: string | null
  passives: string[]
}

const RAW_DATA_FIELDS = new Set(['CharacterID', 'Gender', 'Level', 'NickName', 'IsPlayer', 'OwnerPlayerUId', 'PassiveSkillList'])

/** Decodifica el blob `RawData` de UNA entrada como su propio documento de propiedades anidado.
 *
 * El documento NO empieza directamente en CharacterID/Gender/etc: el primer
 * (y unico) campo de nivel superior es siempre "SaveParameter", una
 * StructProperty de tipo "PalIndividualCharacterSaveParameter" -con la misma
 * cabecera de struct con nombre que cualquier otra (ver
 * `enterNamedStructProperty`). Hay que entrar ahi primero.
 */
function parseRawDataRecord(rawDataBytes: Uint8Array): RawPalRecord | null {
  const c = new BinaryCursor(rawDataBytes)
  const outer = readNamedProperties(c, new Set(['SaveParameter']))
  const saveParameter = outer.get('SaveParameter')
  if (!saveParameter || saveParameter.type !== 'StructProperty') return null
  enterNamedStructProperty(c, saveParameter.start)

  const fields = readNamedProperties(c, RAW_DATA_FIELDS)

  const idField = fields.get('CharacterID')
  if (!idField || idField.type !== 'NameProperty') return null
  c.pos = idField.start
  c.optionalGuid()
  const characterId = c.fstring()

  let gender: 'MALE' | 'FEMALE' | undefined
  const genderField = fields.get('Gender')
  if (genderField?.type === 'EnumProperty') {
    c.pos = genderField.start
    c.fstring() // enum type name (EPalGenderType)
    c.optionalGuid()
    const value = c.fstring() // "EPalGenderType::Male" / "...::Female"
    if (value.endsWith('Male')) gender = 'MALE'
    else if (value.endsWith('Female')) gender = 'FEMALE'
  }

  let level: number | undefined
  const levelField = fields.get('Level')
  if (levelField?.type === 'IntProperty') {
    c.pos = levelField.start
    c.optionalGuid()
    level = c.i32()
  }

  let nickname: string | undefined
  const nickField = fields.get('NickName')
  if (nickField?.type === 'StrProperty') {
    c.pos = nickField.start
    c.optionalGuid()
    const value = c.fstring()
    if (value) nickname = value.slice(0, 60)
  }

  let isPlayer = false
  const isPlayerField = fields.get('IsPlayer')
  if (isPlayerField?.type === 'BoolProperty') {
    c.pos = isPlayerField.start
    isPlayer = c.bool() // BoolProperty: el valor va ANTES del guid opcional
  }

  let ownerPlayerUId: string | null = null
  const ownerField = fields.get('OwnerPlayerUId')
  if (ownerField?.type === 'StructProperty') {
    c.pos = ownerField.start
    const structType = c.fstring()
    c.skip(16) // struct id (guid de metadato, no el valor)
    c.optionalGuid()
    if (structType === 'Guid') {
      const hex = c.guidHex()
      ownerPlayerUId = isZeroGuidHex(hex) ? null : hex
    }
  }

  const passives: string[] = []
  const passiveField = fields.get('PassiveSkillList')
  if (passiveField?.type === 'ArrayProperty') {
    c.pos = passiveField.start
    const arrayType = c.fstring()
    c.optionalGuid()
    const count = c.u32()
    if (arrayType === 'NameProperty') {
      for (let i = 0; i < count; i++) passives.push(c.fstring())
    }
  }

  return { characterId, gender, level, nickname, isPlayer, ownerPlayerUId, passives }
}

/** Lee el campo RawData (ArrayProperty<ByteProperty>) y devuelve sus bytes crudos. */
function readRawDataBytes(c: BinaryCursor, start: number): Uint8Array {
  c.pos = start
  const arrayType = c.fstring()
  c.optionalGuid()
  const count = c.u32()
  if (arrayType !== 'ByteProperty') {
    throw new GvasFormatError(`RawData con array_type inesperado: ${arrayType}`)
  }
  return c.bytes(count)
}

/**
 * Punto de entrada: bytes crudos de un `Level.sav` -> todos los personajes
 * (jugadores y Pals) que aparecen en `CharacterSaveParameterMap`, con sus 7
 * campos de interes ya decodificados.
 */
export function parseCharactersFromLevelSav(savBytes: Uint8Array): RawPalRecord[] {
  const gvas = decompressSav(savBytes)
  const c = new BinaryCursor(gvas)
  readGvasHeader(c)

  const rootFields = readNamedProperties(c, new Set(['worldSaveData']))
  const worldSaveData = rootFields.get('worldSaveData')
  if (!worldSaveData || worldSaveData.type !== 'StructProperty') {
    throw new GvasFormatError('No se encontro "worldSaveData": esto no parece un Level.sav de Palworld.')
  }
  enterNamedStructProperty(c, worldSaveData.start)

  const worldFields = readNamedProperties(c, new Set(['CharacterSaveParameterMap']))
  const charMap = worldFields.get('CharacterSaveParameterMap')
  if (!charMap || charMap.type !== 'MapProperty') {
    throw new GvasFormatError('No se encontro "CharacterSaveParameterMap" en worldSaveData.')
  }

  const header = readMapPropertyHeader(c, charMap.start)
  if (header.keyType !== 'StructProperty' || header.valueType !== 'StructProperty') {
    throw new GvasFormatError(`CharacterSaveParameterMap con tipos inesperados: ${header.keyType}/${header.valueType}`)
  }

  const records: RawPalRecord[] = []
  for (let i = 0; i < header.count; i++) {
    // Clave: identidad de la entrada (InstanceId/PlayerUId internos). No la
    // necesitamos -solo hay que atravesarla para llegar al valor.
    skipPropertiesUntilNone(c)
    // Valor: struct "pelado" (sin cabecera propia, ver enterNamedStructProperty)
    // que envuelve RawData -y, en la practica, no mucho mas.
    const valueFields = readNamedProperties(c, new Set(['RawData']))
    // `readNamedProperties` ya deja el cursor exactamente al final del
    // struct completo (listo para la SIGUIENTE entrada del mapa).
    // `readRawDataBytes` lo mueve hacia atras adrede para releer RawData
    // -hay que devolverlo aqui o la entrada siguiente se lee desalineada.
    const afterValue = c.pos
    const rawData = valueFields.get('RawData')
    if (rawData && rawData.type === 'ArrayProperty') {
      const bytes = readRawDataBytes(c, rawData.start)
      const record = parseRawDataRecord(bytes)
      if (record) records.push(record)
    }
    c.pos = afterValue
  }
  return records
}

/** Solo los Pals que de verdad son tuyos: descarta jugadores y Pals sin dueño (salvajes/NPC trackeados). */
export function ownedPalRecords(records: RawPalRecord[]): RawPalRecord[] {
  return records.filter((r) => !r.isPlayer && r.ownerPlayerUId !== null)
}

/**
 * Puente hacia el mismo pipeline que ya usa el import por JSON
 * (`domain/collection-import.ts`): reutiliza `resolvePalId`/`resolvePassives`
 * -las mismas funciones, así que un `characterId`/passive id real del juego
 * se resuelve exactamente igual sea cual sea su origen- y produce un
 * `CollectionImportResult` que la UI ya sabe mostrar y confirmar.
 */
export function ownedRecordsToImportResult(records: RawPalRecord[]): CollectionImportResult {
  let skipped = 0
  const candidates: CollectionImportCandidate[] = []
  ownedPalRecords(records).forEach((record, sourceIndex) => {
    const palId = resolvePalId(record.characterId)
    if (!palId) {
      skipped += 1
      return
    }
    candidates.push({
      sourceIndex,
      palId,
      passives: resolvePassives(record.passives),
      gender: record.gender,
      nickname: record.nickname?.slice(0, 60),
    })
  })
  return { candidates, skipped, source: 'save' }
}
