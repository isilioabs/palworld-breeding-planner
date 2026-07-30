import { describe, expect, it } from 'vitest'
import { loadDatabase } from '../../database'
import { createInheritanceModel, expectedEggs, inheritChance } from '../inheritance'

const model = createInheritanceModel(loadDatabase().mechanics)

describe('modelo de herencia', () => {
  it('los pesos suman 1', () => {
    const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
    expect(sum(model.inheritWeights)).toBeCloseTo(1, 10)
    expect(sum(model.randomWeights)).toBeCloseTo(1, 10)
  })

  it('usa los pesos reales del juego (40/30/20/10)', () => {
    expect(model.inheritWeights).toEqual([0.4, 0.3, 0.2, 0.1])
  })

  it('con el bote justo siempre se hereda todo', () => {
    // Bote de 2 y quiero esas 2: solo falla si se hereda 1 sola.
    expect(inheritChance(model, 1, 1)).toBeCloseTo(1, 10)
    expect(inheritChance(model, 2, 2)).toBeCloseTo(0.6, 10)
  })

  it('pedir mas de lo que hay en el bote es imposible', () => {
    expect(inheritChance(model, 2, 3)).toBe(0)
    expect(inheritChance(model, 0, 1)).toBe(0)
  })

  it('la probabilidad baja al diluir el bote', () => {
    const tight = inheritChance(model, 4, 4)
    const loose = inheritChance(model, 8, 4)
    expect(tight).toBeGreaterThan(loose)
    expect(loose).toBeGreaterThan(0)
  })

  it('la probabilidad baja al pedir mas pasivas', () => {
    const pool = 6
    for (let want = 1; want < 4; want++) {
      expect(inheritChance(model, pool, want)).toBeGreaterThan(inheritChance(model, pool, want + 1))
    }
  })

  it('todas las probabilidades estan en [0, 1]', () => {
    for (let pool = 0; pool <= 12; pool++) {
      for (let want = 0; want <= 4; want++) {
        const p = inheritChance(model, pool, want)
        expect(p).toBeGreaterThanOrEqual(0)
        expect(p).toBeLessThanOrEqual(1)
      }
    }
  })

  it('los huevos esperados son el inverso de la probabilidad', () => {
    expect(expectedEggs(0.25)).toBe(4)
    expect(expectedEggs(0)).toBe(Infinity)
  })
})
