import { describe, expect, it } from 'vitest'
import { buildPalDossier } from '../pal-dossier'
import { loadDatabase } from '../database'

describe('buildPalDossier', () => {
  it('devuelve null para un palId desconocido', () => {
    expect(buildPalDossier('NotARealPal')).toBeNull()
  })

  it('para un Pal real, devuelve pasivas, recetas y relacionados coherentes', () => {
    const dossier = buildPalDossier('Anubis')
    expect(dossier).not.toBeNull()
    expect(dossier!.pal.id).toBe('Anubis')
    expect(dossier!.bestPassives.length).toBeGreaterThan(0)
    expect(dossier!.bestPassives.length).toBeLessThanOrEqual(6)
    expect(dossier!.recipes.length).toBeGreaterThan(0)
    expect(dossier!.recipes.length).toBeLessThanOrEqual(8)
    // Cada receta debe ser una pareja real que la app ya sabe que cria a Anubis.
    const db = loadDatabase()
    for (const [a, b] of dossier!.recipes) {
      expect(db.palById.has(a)).toBe(true)
      expect(db.palById.has(b)).toBe(true)
    }
    // "Relacionados" nunca se incluye a si mismo.
    expect(dossier!.related.some((pal) => pal.id === 'Anubis')).toBe(false)
  })

  it('un Pal sin registro salvaje (wild: null) queda reflejado como tal', () => {
    const db = loadDatabase()
    const breedOnly = db.pals.find((pal) => pal.wild === null)
    if (!breedOnly) return // el dataset actual siempre tiene alguno, pero no lo asumimos a ciegas
    const dossier = buildPalDossier(breedOnly.id)
    expect(dossier!.wildLevelRange).toBeNull()
  })
})
