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
  desiredPassives: string[]
  owned: OwnedPal[]
  mode: PlannerMode
}

const EMPTY: PlannerState = {
  targetPalId: null,
  desiredPassives: [],
  owned: [],
  mode: 'breeding',
}

export type PlannerAction =
  | { type: 'setTarget'; palId: string | null }
  | { type: 'toggleDesired'; passiveId: string }
  | { type: 'setDesired'; passives: string[] }
  | { type: 'setMode'; mode: PlannerMode }
  | { type: 'addOwned'; palId: string }
  | { type: 'updateOwned'; uid: string; patch: Partial<Omit<OwnedPal, 'uid'>> }
  | { type: 'removeOwned'; uid: string }
  | { type: 'clearOwned' }
  | { type: 'loadDraft'; draft: ProjectDraft }
  | { type: 'reset' }

const newUid = () => `o_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`

function reducer(state: PlannerState, action: PlannerAction): PlannerState {
  switch (action.type) {
    case 'setTarget':
      return { ...state, targetPalId: action.palId }
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
      return { ...state, owned: [...state.owned, { uid: newUid(), palId: action.palId, passives: [] }] }
    case 'updateOwned':
      return {
        ...state,
        owned: state.owned.map((o) => (o.uid === action.uid ? { ...o, ...action.patch } : o)),
      }
    case 'removeOwned':
      return { ...state, owned: state.owned.filter((o) => o.uid !== action.uid) }
    case 'clearOwned':
      return { ...state, owned: [] }
    case 'loadDraft':
      return {
        targetPalId: action.draft.targetPalId,
        desiredPassives: action.draft.desiredPassives.slice(0, MAX_DESIRED_PASSIVES),
        owned: action.draft.owned,
        mode: action.draft.mode,
      }
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
    return saved ? { ...initial, ...saved } : initial
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
