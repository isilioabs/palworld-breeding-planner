import { describe, expect, it } from 'vitest'
import { planProject } from '../project-planner'

describe('planificador de proyectos', () => {
  it('consolida varios objetivos en un unico plan de produccion', () => {
    const project = planProject({
      targetPalId: 'Anubis',
      targetPalIds: ['Anubis', 'GhostDragon'],
      desiredPassives: [],
      owned: [],
      mode: 'hybrid',
    })

    expect(project.ok).toBe(true)
    expect(project.roots).toHaveLength(2)
    expect(project.stats?.targets).toBe(2)
    expect(project.stats?.totalExpectedEggs).toBeGreaterThanOrEqual(0)
    expect(project.stats?.capturesNeeded).toBeGreaterThanOrEqual(0)
    expect(project.stats?.duplicateBreedsAvoided).toBeGreaterThanOrEqual(0)
  })

  it('requiere al menos dos objetivos distintos', () => {
    const project = planProject({
      targetPalId: 'Anubis',
      targetPalIds: ['Anubis', 'Anubis'],
      desiredPassives: [],
      owned: [],
      mode: 'hybrid',
    })

    expect(project.ok).toBe(false)
  })
})
