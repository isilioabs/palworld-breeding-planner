import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parseCharactersFromLevelSav, ownedPalRecords } from '../pal-save-parser'

const fixturePath = fileURLToPath(new URL('./fixtures/Level.sav', import.meta.url))
const savBytes = new Uint8Array(readFileSync(fixturePath))

describe('parseCharactersFromLevelSav (contra un Level.sav real)', () => {
  it('decodifica CharacterSaveParameterMap sin lanzar, y encuentra Pals', () => {
    // Este fixture real tiene 3 entradas en CharacterSaveParameterMap: 1
    // jugador + 2 Pals. El jugador no lleva CharacterID (no es una especie),
    // asi que nunca produce un registro -solo los 2 Pals llegan aqui.
    const records = parseCharactersFromLevelSav(savBytes)
    expect(records).toHaveLength(2)
  })

  it('cada registro tiene un characterId no vacio y un genero reconocible', () => {
    const records = parseCharactersFromLevelSav(savBytes)
    for (const record of records) {
      expect(typeof record.characterId).toBe('string')
      expect(record.characterId.length).toBeGreaterThan(0)
      expect(['MALE', 'FEMALE']).toContain(record.gender)
    }
  })

  it('decodifica especie, genero, nivel y dueño de cada Pal correctamente', () => {
    // Confirmado a mano durante el desarrollo: este fixture real contiene un
    // ChickenPal (Lifmunk) hembra sin pasivas y un Sheepball (Lamball) macho
    // con la pasiva MoveSpeed_up_1, ambos nivel 2 y del mismo dueño.
    const records = parseCharactersFromLevelSav(savBytes)
    const chicken = records.find((r) => r.characterId === 'ChickenPal')
    const sheep = records.find((r) => r.characterId === 'Sheepball')
    expect(chicken).toBeDefined()
    expect(chicken!.gender).toBe('FEMALE')
    expect(chicken!.level).toBe(2)
    expect(sheep).toBeDefined()
    expect(sheep!.gender).toBe('MALE')
    expect(sheep!.passives).toContain('MoveSpeed_up_1')
  })

  it('ningun registro se confunde con el jugador: todos tienen isPlayer=false y dueño real', () => {
    const records = parseCharactersFromLevelSav(savBytes)
    for (const record of records) {
      expect(record.isPlayer).toBe(false)
      expect(record.ownerPlayerUId).not.toBeNull()
    }
  })

  it('ownedPalRecords devuelve los mismos Pals (ya vienen todos con dueño real)', () => {
    const records = parseCharactersFromLevelSav(savBytes)
    const owned = ownedPalRecords(records)
    expect(owned).toHaveLength(records.length)
  })
})
