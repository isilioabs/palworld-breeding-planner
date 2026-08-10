import { describe, expect, it } from 'vitest'
import type { PlanNode } from '@/domain/types'
import { collapsedKeysBeyondDepth } from '../plan-utils'

function breed(key: string, depth: number, parents?: [PlanNode, PlanNode]): PlanNode {
  return { key, palId: key, passives: [], kind: 'breed', depth, parents }
}

function leaf(key: string, depth: number): PlanNode {
  return { key, palId: key, passives: [], kind: 'capture', depth }
}

describe('collapsedKeysBeyondDepth', () => {
  it('no colapsa nada si el arbol no llega al umbral', () => {
    const root = breed('root', 0, [leaf('a', 1), leaf('b', 1)])
    expect(collapsedKeysBeyondDepth(root, 2)).toEqual([])
  })

  it('colapsa el cruce mas superficial en el umbral, no sus hijos', () => {
    // root(0) -breed-> mid(1) -breed-> leaf(2)/leaf(2), y una rama hermana capturable(1)
    const deepLeafA = leaf('deepA', 2)
    const deepLeafB = leaf('deepB', 2)
    const mid = breed('mid', 1, [deepLeafA, deepLeafB])
    const shallowCapture = leaf('shallow', 1)
    const root = breed('root', 0, [mid, shallowCapture])

    expect(collapsedKeysBeyondDepth(root, 1)).toEqual(['mid'])
  })

  it('colapsa cada rama por separado cuando ambas llegan al umbral', () => {
    const midA = breed('midA', 1, [leaf('a1', 2), leaf('a2', 2)])
    const midB = breed('midB', 1, [leaf('b1', 2), leaf('b2', 2)])
    const root = breed('root', 0, [midA, midB])

    expect(collapsedKeysBeyondDepth(root, 1)).toEqual(['midA', 'midB'])
  })

  it('no colapsa nodos capturados/propios, solo cruces', () => {
    // Si el umbral cae justo en una hoja (no-breed), no hay nada que colapsar ahi.
    const root = breed('root', 0, [leaf('a', 1), leaf('b', 1)])
    expect(collapsedKeysBeyondDepth(root, 1)).toEqual([])
  })
})
