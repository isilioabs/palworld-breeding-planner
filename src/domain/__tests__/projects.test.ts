import { describe, expect, it } from 'vitest'
import { getProjectProgress, type BreedingProject } from '../projects'

const project: BreedingProject = {
  format: 5,
  id: 'perfect-base',
  name: 'Perfect Base',
  updatedAt: '2026-08-03T00:00:00.000Z',
  targetPalId: 'Anubis',
  targetPalIds: ['Anubis', 'Verdash', 'Wumpo', 'Knocklem'],
  completedTargetPalIds: ['Verdash'],
  desiredPassives: [],
  owned: [],
  mode: 'hybrid',
}

describe('progreso de breeding projects', () => {
  it('combina checks manuales con Pals ya presentes en la colección', () => {
    const progress = getProjectProgress(project, ['Anubis', 'Wumpo'])

    expect(progress.completed).toBe(3)
    expect(progress.total).toBe(4)
    expect(progress.percent).toBe(75)
    expect(progress.completedTargetPalIds).toEqual(['Anubis', 'Verdash', 'Wumpo'])
  })
})
