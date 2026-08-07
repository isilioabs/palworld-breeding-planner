/**
 * Lector minimo del formato GVAS/.sav de Palworld -SOLO lo necesario para
 * llegar hasta `worldSaveData.CharacterSaveParameterMap` y extraer, por cada
 * Pal, especie/genero/nivel/apodo/pasivas/dueño. No es un parser generico de
 * Unreal Engine ni pretende serlo (no incluye el lado de escritura).
 *
 * Formato validado contra archivos .sav REALES (fixtures de test del
 * proyecto de referencia de la comunidad, palworld-save-tools, MIT license)
 * durante el spike de esta feature, no inventado a partir de la
 * documentacion.
 *
 * IMPORTANTE (aprendido a base de dos bugs reales durante el desarrollo): el
 * tamaño (`size`, u64) que cada propiedad con nombre declara SI es fiable
 * para saltar su VALOR -pero no cubre el "property guid" opcional que lo
 * precede, ni (para Struct/Array/Map/Enum/Byte) los campos de cabecera
 * propios del tipo (nombre de struct, tipo interno de array...). Ese
 * preambulo hay que consumirlo siempre a mano segun el tipo; a partir de ahi,
 * `size` cubre el resto de un tiron -incluido el contenido COMPLETO de un
 * struct/array/map anidado, sin necesidad de entenderlo. Por eso este lector
 * solo recorre "de verdad" el camino exacto hacia
 * CharacterSaveParameterMap -todo lo demas se salta con preambulo+`size`.
 */
import { inflate } from 'pako'

const GVAS_MAGIC = 0x53415647 // "GVAS" en little-endian
const SAV_MAGIC = 'PlZ'

export class GvasFormatError extends Error {}

/** Contenedor .sav -> bytes GVAS descomprimidos. Palworld usa zlib simple (0x31) o doble (0x32). */
export function decompressSav(data: Uint8Array): Uint8Array {
  let offset = 8
  let magicBytes = bytesToLatin1(data, 8, 3)
  let saveType = data[11]
  if (magicBytes === 'CNK') {
    offset = 20
    magicBytes = bytesToLatin1(data, 20, 3)
    saveType = data[23]
  }
  if (magicBytes !== SAV_MAGIC) {
    throw new GvasFormatError(`No es un .sav de Palworld valido (cabecera "${magicBytes}")`)
  }
  if (saveType !== 0x31 && saveType !== 0x32) {
    throw new GvasFormatError(`Tipo de compresion de .sav no soportado: 0x${saveType.toString(16)}`)
  }
  const dataStart = offset === 20 ? 24 : 12
  let uncompressed = inflate(data.subarray(dataStart))
  if (saveType === 0x32) uncompressed = inflate(uncompressed)
  return uncompressed
}

function bytesToLatin1(data: Uint8Array, start: number, length: number): string {
  let out = ''
  for (let i = 0; i < length; i++) out += String.fromCharCode(data[start + i])
  return out
}

const textDecoderUtf16 = new TextDecoder('utf-16le')

/** Lector binario little-endian con cursor. Toda la lectura de GVAS es secuencial. */
export class BinaryCursor {
  readonly data: Uint8Array
  readonly view: DataView
  pos = 0

  constructor(data: Uint8Array) {
    this.data = data
    this.view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  }

  u8(): number {
    return this.data[this.pos++]
  }

  bool(): boolean {
    return this.u8() > 0
  }

  u16(): number {
    const v = this.view.getUint16(this.pos, true)
    this.pos += 2
    return v
  }

  i32(): number {
    const v = this.view.getInt32(this.pos, true)
    this.pos += 4
    return v
  }

  u32(): number {
    const v = this.view.getUint32(this.pos, true)
    this.pos += 4
    return v
  }

  /** Los enteros de 64 bits de este formato (tamaños, Int64Property) nunca se acercan a 2^53 en un .sav real. */
  u64AsNumber(): number {
    const v = this.view.getBigUint64(this.pos, true)
    this.pos += 8
    return Number(v)
  }

  i64AsNumber(): number {
    const v = this.view.getBigInt64(this.pos, true)
    this.pos += 8
    return Number(v)
  }

  f32(): number {
    const v = this.view.getFloat32(this.pos, true)
    this.pos += 4
    return v
  }

  f64(): number {
    const v = this.view.getFloat64(this.pos, true)
    this.pos += 8
    return v
  }

  bytes(n: number): Uint8Array {
    const v = this.data.subarray(this.pos, this.pos + n)
    this.pos += n
    return v
  }

  skip(n: number): void {
    this.pos += n
  }

  eof(): boolean {
    return this.pos >= this.data.length
  }

  /** FString de Unreal: i32 de longitud; positivo = ASCII (con \0 final), negativo = UTF-16LE (con \0 final). */
  fstring(): string {
    const len = this.i32()
    if (len === 0) return ''
    if (len > 0) {
      const raw = this.bytes(len)
      return bytesToLatin1(raw, 0, len - 1)
    }
    const chars = -len
    const raw = this.bytes(chars * 2)
    return textDecoderUtf16.decode(raw.subarray(0, (chars - 1) * 2))
  }

  guidBytes(): Uint8Array {
    return this.bytes(16)
  }

  guidHex(): string {
    const raw = this.guidBytes()
    let hex = ''
    for (const b of raw) hex += b.toString(16).padStart(2, '0')
    return hex
  }

  /** Presente en casi toda propiedad con nombre: 1 byte de bandera + GUID opcional (16 bytes) si esta activa. */
  optionalGuid(): void {
    if (this.u8()) this.skip(16)
  }
}

export function isZeroGuidHex(hex: string): boolean {
  return /^0*$/.test(hex)
}

export interface GvasHeader {
  saveGameClassName: string
  engineVersion: string
}

/** Lee solo lo necesario de la cabecera GVAS: confirma el magic number y
 * extrae el nombre de clase (identifica si es Level.sav, un save de
 * jugador, etc.) antes de saltar directo al cuerpo de propiedades. */
export function readGvasHeader(c: BinaryCursor): GvasHeader {
  const magic = c.u32()
  if (magic !== GVAS_MAGIC) throw new GvasFormatError('Cabecera GVAS invalida (no empieza con "GVAS")')
  c.skip(4) // saveGameVersion
  c.skip(4) // packageFileVersionUe4
  c.skip(4) // packageFileVersionUe5
  const major = c.u16()
  const minor = c.u16()
  const patch = c.u16()
  c.skip(4) // engineVersionChangelist
  c.fstring() // engineVersionBranch
  c.skip(4) // customVersionFormat
  const customVersionsCount = c.u32()
  for (let i = 0; i < customVersionsCount; i++) {
    c.skip(16) // guid
    c.skip(4) // version
  }
  const saveGameClassName = c.fstring()
  return { saveGameClassName, engineVersion: `${major}.${minor}.${patch}` }
}

// ---------------------------------------------------------------------------
// Propiedades con nombre (el "cuerpo" de cualquier struct: name, type, size,
// valor -terminado por un nombre literal "None"). Para lo que NO nos
// interesa, solo se consume el preambulo propio del tipo (fijo y pequeño) y
// se salta el resto con `size` -sin entrar a interpretarlo, sea lo que sea
// (un struct anidado, un array, un mapa... `size` cubre su contenido
// COMPLETO de un tiron). Es deliberadamente MENOS "listo" que un parser
// generico completo: solo entendemos de verdad el camino exacto hacia
// CharacterSaveParameterMap (ver readMapPropertyHeader/enterNamedStructProperty
// en pal-save-parser.ts), que es la unica parte que necesitamos leer.
// ---------------------------------------------------------------------------

/** Consume el preambulo propio de cada tipo (nombre de struct, tipo de enum,
 * tipo interno de array...) y salta el resto con `size`. */
function skipPropertyByType(c: BinaryCursor, typeName: string, size: number): void {
  switch (typeName) {
    case 'StructProperty':
      c.fstring() // struct type name
      c.skip(16) // struct id
      c.optionalGuid()
      c.skip(size)
      return
    case 'BoolProperty':
      // El valor va ANTES del guid opcional (unico tipo asi) y `size` es 0.
      c.bool()
      c.optionalGuid()
      c.skip(size)
      return
    case 'EnumProperty':
    case 'ByteProperty':
      c.fstring() // enum type name (o "None" para un ByteProperty sin enum)
      c.optionalGuid()
      c.skip(size)
      return
    case 'ArrayProperty':
    case 'MapProperty':
      c.fstring() // tipo interno del array, o tipo de clave del mapa
      if (typeName === 'MapProperty') c.fstring() // tipo de valor del mapa
      c.optionalGuid()
      c.skip(size)
      return
    default:
      // IntProperty, UInt16/32Property, Int64Property, FixedPoint64Property,
      // FloatProperty, DoubleProperty, StrProperty, NameProperty: sin
      // preambulo propio, solo el guid opcional universal.
      c.optionalGuid()
      c.skip(size)
  }
}

/** Recorre un bloque "propiedades con nombre hasta None" saltando cada
 * campo por su preambulo+`size` -sin interpretarlos. Se usa para todo lo
 * que no nos interesa (la inmensa mayoria de un save real: terreno,
 * construcciones, items, IA...) y para la mitad "clave" de cada entrada de
 * CharacterSaveParameterMap. */
export function readPropertiesUntilNone(c: BinaryCursor): void {
  for (;;) {
    const name = c.fstring()
    if (name === 'None') return
    const type = c.fstring()
    const size = c.u64AsNumber()
    skipPropertyByType(c, type, size)
  }
}

export interface FoundProperty {
  type: string
  start: number
}

/**
 * Recorre un bloque de propiedades ENTERO (hasta "None") buscando los
 * nombres pedidos: para esos, deja constancia de donde EMPIEZA su valor
 * (justo despues de leer `size`) para poder volver a esa posicion y
 * decodificarlo con calma; para el resto, los decodifica igual (para saber
 * cuanto ocupan) pero descarta el resultado. Se consume el bloque completo
 * SIEMPRE -aunque ya se haya encontrado todo lo buscado- porque el llamador
 * puede necesitar el cursor exactamente al final para seguir leyendo lo que
 * viene despues (ej. la siguiente entrada de un MapProperty).
 */
export function readNamedProperties(c: BinaryCursor, wanted: Set<string>): Map<string, FoundProperty> {
  const found = new Map<string, FoundProperty>()
  for (;;) {
    const name = c.fstring()
    if (name === 'None') return found
    const type = c.fstring()
    const size = c.u64AsNumber()
    const start = c.pos
    if (wanted.has(name)) found.set(name, { type, start })
    skipPropertyByType(c, type, size)
  }
}

const EMPTY_NAMES = new Set<string>()

export function skipPropertiesUntilNone(c: BinaryCursor): void {
  readNamedProperties(c, EMPTY_NAMES)
}

/**
 * Entra en una StructProperty encontrada como propiedad CON nombre (ej. el
 * campo "worldSaveData" del documento raiz): estas SI llevan una cabecera
 * propia (nombre del tipo de struct + un GUID de struct + un GUID opcional)
 * antes del contenido. Deja el cursor listo para leer las propiedades
 * internas del struct.
 *
 * OJO: esto NO aplica a los structs que son clave/valor de un MapProperty o
 * elemento de un ArrayProperty -esos van "pelados", sin esta cabecera,
 * porque el tipo ya se declaro una sola vez a nivel del map/array (ver
 * `readMapPropertyHeader`).
 */
export function enterNamedStructProperty(c: BinaryCursor, start: number): void {
  c.pos = start
  c.fstring() // struct type name (ej. "PalIndividualCharacterSaveParameter")
  c.skip(16) // struct id (guid)
  c.optionalGuid()
}

export interface MapPropertyHeader {
  keyType: string
  valueType: string
  count: number
}

/** Cabecera de un MapProperty encontrado como propiedad con nombre (ej.
 * CharacterSaveParameterMap). Tras leerla, el cursor queda al inicio de la
 * primera pareja clave/valor. */
export function readMapPropertyHeader(c: BinaryCursor, start: number): MapPropertyHeader {
  c.pos = start
  const keyType = c.fstring()
  const valueType = c.fstring()
  c.optionalGuid()
  c.skip(4) // byte de "modo" que la propia herramienta de referencia descarta
  const count = c.u32()
  return { keyType, valueType, count }
}
