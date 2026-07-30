/** Punto de entrada del motor de crianza. */
import { loadDatabase } from '../database'
import { createResolver, type ChildResolver } from './resolver'
import { planBreeding, type PlannerContext, type PlannerSettings } from './planner'
import type { PlanResult, PlannerInput } from '../types'

let contextCache: PlannerContext | null = null

export function getPlannerContext(): PlannerContext {
  if (contextCache) return contextCache
  const db = loadDatabase()
  contextCache = { pals: db.pals, resolver: createResolver(db.pals, db.breeding), mechanics: db.mechanics }
  return contextCache
}

export function getResolver(): ChildResolver {
  return getPlannerContext().resolver
}

export function plan(input: PlannerInput, settings?: Partial<PlannerSettings>): PlanResult {
  return planBreeding(input, getPlannerContext(), settings)
}

export * from './resolver'
export * from './inheritance'
export * from './cost'
export { planBreeding } from './planner'
export type { PlannerContext, PlannerSettings } from './planner'
