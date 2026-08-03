import { describe, expect, it } from 'vitest'
import { candidatesToOwned, parseCollectionImport } from '../collection-import'

describe('collection import', () => {
  it('recognizes a PalBreed collection and preserves separate captures', () => {
    const result = parseCollectionImport(JSON.stringify({
      owned: [
        { palId: 'Anubis', gender: 'male', passives: ['CraftSpeed_up3'] },
        { palId: 'Anubis', gender: 'female', passives: [] },
      ],
    }))

    expect(result.source).toBe('palbreed')
    expect(result.candidates).toHaveLength(2)
    expect(result.candidates[0]).toMatchObject({ palId: 'Anubis', gender: 'MALE', passives: ['CraftSpeed_up3'] })
    expect(result.candidates[1]).toMatchObject({ palId: 'Anubis', gender: 'FEMALE' })
    const owned = candidatesToOwned(result.candidates)
    expect(new Set(owned.map((entry) => entry.uid)).size).toBe(2)
  })

  it('accepts simple species/name collection JSON and skips unknown entries', () => {
    const result = parseCollectionImport(JSON.stringify({
      pals: [{ species: 'Anubis' }, { species: 'NotARealPal' }],
    }))
    expect(result.source).toBe('collection')
    expect(result.candidates.map((entry) => entry.palId)).toEqual(['Anubis'])
    expect(result.skipped).toBe(1)
  })
})
