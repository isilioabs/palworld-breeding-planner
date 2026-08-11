/**
 * Estado global de la app (contexto + reducer, sin dependencias externas).
 * Cualquier cambio aqui dispara un recalculo automatico del plan (ver usePlanner).
 */
import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react'
import type { OwnedPal, PlannerMode } from '@/domain/types'
import { loadCurrent, saveCurrent, type ProjectDraft } from '@/domain/projects'

export const MAX_DESIRED_PASSIVES = 4

export interface PlannerState {
  targetPalId: string | null
  targetPalIds: string[]
  desiredPassives: string[]
  owned: OwnedPal[]
  mode: PlannerMode
  /**
   * Fuente fijada por pasiva: `{ [passiveId]: ownedUid }`. Restriccion del
   * planificador, no del perfil del Pal -por eso vive aqui y no en
   * `OwnedPal`- para poder fijar la MISMA pasiva a distintos Pals segun el
   * proyecto sin tocar la coleccion. Sin entrada = el planificador elige la
   * mejor fuente disponible automaticamente.
   */
  pinnedSources: Record<string, string>
}

const EMPTY: PlannerState = {
  targetPalId: null,
  targetPalIds: [],
  desiredPassives: [],
  owned: [],
  mode: 'breeding',
  pinnedSources: {},
}

export type PlannerAction =
  | { type: 'setTarget'; palId: string | null }
  | { type: 'addTarget'; palId: string }
  | { type: 'removeTarget'; palId: string }
  | { type: 'toggleDesired'; passiveId: string }
  | { type: 'setDesired'; passives: string[] }
  | { type: 'setMode'; mode: PlannerMode }
  | { type: 'addOwned'; palId: string }
  | { type: 'importOwned'; entries: OwnedPal[] }
  | { type: 'updateOwned'; uid: string; patch: Partial<Omit<OwnedPal, 'uid'>> }
  | { type: 'removeOwned'; uid: string }
  | { type: 'clearOwned' }
  | { type: 'setPinnedSource'; passiveId: string; ownedUid: string | null }
  | { type: 'loadDraft'; draft: ProjectDraft }
  | { type: 'resetPlan' }
  | { type: 'reset' }

const newUid = () => `o_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
export const MAX_PROJECT_TARGETS = 4

function normalizeTargets(targetPalIds: string[] | undefined, targetPalId: string | null): string[] {
  return [...new Set([...(targetPalIds ?? []), ...(targetPalId ? [targetPalId] : [])])].slice(0, MAX_PROJECT_TARGETS)
}

/** Cada captura tiene su propia ficha: dos Anubis con pasivas o género
 * diferentes son reproductores distintos y no deben perderse al importar. */
function normalizeCollection(owned: OwnedPal[]): OwnedPal[] {
  const usedUids = new Set<string>()
  return owned.map((entry, index) => {
    let uid = entry.uid || newUid()
    while (usedUids.has(uid)) uid = `${uid}_${index.toString(36)}`
    usedUids.add(uid)
    return { ...entry, uid, passives: [...new Set(entry.passives)].slice(0, 4), addedAt: entry.addedAt ?? Date.now() + index }
  })
}

function reducer(state: PlannerState, action: PlannerAction): PlannerState {
  switch (action.type) {
    case 'setTarget':
      return { ...state, targetPalId: action.palId, targetPalIds: action.palId ? [action.palId] : [] }
    case 'addTarget': {
      if (state.targetPalIds.includes(action.palId) || state.targetPalIds.length >= MAX_PROJECT_TARGETS) return state
      const targetPalIds = [...state.targetPalIds, action.palId]
      return { ...state, targetPalId: targetPalIds[0] ?? null, targetPalIds }
    }
    case 'removeTarget': {
      const targetPalIds = state.targetPalIds.filter((palId) => palId !== action.palId)
      return { ...state, targetPalId: targetPalIds[0] ?? null, targetPalIds }
    }
    case 'toggleDesired': {
      const has = state.desiredPassives.includes(action.passiveId)
      if (has) {
        return { ...state, desiredPassives: state.desiredPassives.filter((p) => p !== action.passiveId) }
      }
      if (state.desiredPassives.length >= MAX_DESIRED_PASSIVES) return state
      return { ...state, desiredPassives: [...state.desiredPassives, action.passiveId] }
    }
    case 'setDesired':
      return { ...state, desiredPassives: action.passives.slice(0, MAX_DESIRED_PASSIVES) }
    case 'setMode':
      return { ...state, mode: action.mode }
    case 'addOwned':
      return { ...state, owned: [...state.owned, { uid: newUid(), palId: action.palId, passives: [], favorite: false, notes: '', addedAt: Date.now() }] }
    case 'importOwned':
      return { ...state, owned: normalizeCollection([...state.owned, ...action.entries]) }
    case 'updateOwned':
      return {
        ...state,
        owned: state.owned.map((o) => (o.uid === action.uid ? { ...o, ...action.patch } : o)),
      }
    case 'removeOwned': {
      // Si el Pal eliminado era la fuente fijada de alguna pasiva, se
      // desfija: no tiene sentido conservar un pin que apunta a nadie.
      const pinnedSources = Object.fromEntries(Object.entries(state.pinnedSources).filter(([, uid]) => uid !== action.uid))
      return { ...state, owned: state.owned.filter((o) => o.uid !== action.uid), pinnedSources }
    }
    case 'clearOwned':
      return { ...state, owned: [], pinnedSources: {} }
    case 'setPinnedSource': {
      const pinnedSources = { ...state.pinnedSources }
      if (action.ownedUid) pinnedSources[action.passiveId] = action.ownedUid
      else delete pinnedSources[action.passiveId]
      return { ...state, pinnedSources }
    }
    case 'loadDraft':
      {
        const targetPalIds = normalizeTargets(action.draft.targetPalIds, action.draft.targetPalId)
        return {
        targetPalId: targetPalIds[0] ?? null,
        targetPalIds,
        desiredPassives: action.draft.desiredPassives.slice(0, MAX_DESIRED_PASSIVES),
        owned: normalizeCollection(action.draft.owned),
        mode: action.draft.mode,
        pinnedSources: {},
        }
      }
    case 'resetPlan':
      // Empieza un breeding limpio sin borrar la coleccion permanente del
      // jugador ni su preferencia de optimizacion.
      return { ...EMPTY, owned: state.owned, mode: state.mode }
    case 'reset':
      return EMPTY
    default:
      return state
  }
}

interface StoreValue {
  state: PlannerState
  dispatch: React.Dispatch<PlannerAction>
}

const StoreContext = createContext<StoreValue | null>(null)

export function PlannerProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, EMPTY, (initial) => {
    const saved = loadCurrent()
    if (!saved) return initial
    const targetPalIds = normalizeTargets(saved.targetPalIds, saved.targetPalId)
    return {
      ...initial,
      ...saved,
      targetPalIds,
      targetPalId: targetPalIds[0] ?? null,
      owned: normalizeCollection(saved.owned ?? []),
    }
  })

  useEffect(() => {
    saveCurrent(state)
  }, [state])

  const value = useMemo(() => ({ state, dispatch }), [state])
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function usePlannerStore(): StoreValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('usePlannerStore debe usarse dentro de <PlannerProvider>')
  return ctx
}
