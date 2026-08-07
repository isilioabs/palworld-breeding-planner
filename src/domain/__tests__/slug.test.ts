import { describe, expect, it } from 'vitest'
import { loadDatabase } from '../database'
import { buildSlugIndex, palSlug } from '../slug'

describe('palSlug / buildSlugIndex', () => {
  it('genera slugs unicos para los ~300 Pals reales (sin colisiones)', () => {
    const db = loadDatabase()
    expect(() => buildSlugIndex(db.pals)).not.toThrow()
    const index = buildSlugIndex(db.pals)
    expect(index.size).toBe(db.pals.length)
  })

  it('las variantes con el mismo nombre visible que su base no colisionan', () => {
    // Gumoss normal y Gumoss (flor) comparten name: "Gumoss" -encontrado a
    // mano durante el desarrollo, exactamente el caso que motivo el sufijo.
    const db = loadDatabase()
    const base = db.palById.get('PlantSlime')!
    const variant = db.palById.get('PlantSlime_Flower')!
    expect(palSlug(base)).not.toBe(palSlug(variant))
    expect(palSlug(variant)).toBe(`${palSlug(base)}-variant`)
  })

  it('produce un slug legible en minusculas con guiones', () => {
    const db = loadDatabase()
    const anubis = db.palById.get('Anubis')!
    expect(palSlug(anubis)).toBe('anubis')
  })
})
