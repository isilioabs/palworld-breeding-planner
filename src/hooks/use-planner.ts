/**
 * Ejecuta el planificador en un worker y recalcula automaticamente cada vez que
 * cambia cualquier dato de entrada (objetivo, pasivas, coleccion o modo).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { PlanResult, PlannerInput, ProjectPlan, RouteAlternative } from '@/domain/types'
import type { PlanRequest, PlanResponse } from '@/domain/breeding/planner.worker'
import { usePlannerStore } from '@/state/planner-store'
import { track } from '@/lib/analytics'

const DEBOUNCE_MS = 180
/**
 * Duracion minima visible del estado "calculando", contada desde que la
 * interfaz anuncia la solicitud. Asi el debounce forma parte de los ~220 ms
 * percibidos, en vez de sumar una pausa artificial al calculo real.
 */
const MIN_LOADING_MS = 220

export interface PlannerRun {
  result: PlanResult | null
  routes: RouteAlternative[]
  project: ProjectPlan | null
  computing: boolean
}

export function usePlanner(): PlannerRun {
  const { state } = usePlannerStore()
  const [result, setResult] = useState<PlanResult | null>(null)
  const [routes, setRoutes] = useState<RouteAlternative[]>([])
  const [project, setProject] = useState<ProjectPlan | null>(null)
  const [computing, setComputing] = useState(false)
  const workerRef = useRef<Worker | null>(null)
  const requestRef = useRef(0)
  const loadingStartedAt = useRef(0)
  const targetCountRef = useRef(state.targetPalIds.length)
  targetCountRef.current = state.targetPalIds.length
  // Favoritos, notas y futuras estadisticas son metadatos de Paldex: no deben
  // reiniciar un calculo que solo depende de especie, sexo y pasivas.
  const plannerOwnedKey = state.owned.map(({ uid, palId, passives, gender }) => `${uid}:${palId}:${gender ?? ''}:${passives.join(',')}`).join('|')
  const plannerOwned = useMemo(
    () => state.owned.map(({ uid, palId, passives, gender }) => ({ uid, palId, passives, gender })),
    [plannerOwnedKey],
  )

  useEffect(() => {
    const worker = new Worker(new URL('../domain/breeding/planner.worker.ts', import.meta.url), {
      type: 'module',
    })
    worker.onmessage = (event: MessageEvent<PlanResponse>) => {
      const { requestId, result: newResult, routes: newRoutes, project: newProject } = event.data
      // Descarta respuestas obsoletas.
      if (requestId !== requestRef.current) return
      const elapsed = performance.now() - loadingStartedAt.current
      const remaining = Math.max(0, MIN_LOADING_MS - elapsed)
      window.setTimeout(() => {
        // Pudo quedar obsoleta durante la espera de la duracion minima.
        if (requestId !== requestRef.current) return
        setResult(newResult)
        setRoutes(newRoutes)
        setProject(newProject ?? null)
        setComputing(false)
        if (newResult.ok) track('tree_generated', { targets: targetCountRef.current, routes: newRoutes.length })
      }, remaining)
    }
    workerRef.current = worker
    return () => {
      worker.terminate()
      workerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (state.targetPalIds.length === 0) {
      setResult(null)
      setRoutes([])
      setProject(null)
      setComputing(false)
      return
    }
    setComputing(true)
    loadingStartedAt.current = performance.now()
    const timer = window.setTimeout(() => {
      const worker = workerRef.current
      if (!worker) return
      const input: PlannerInput = {
        targetPalId: state.targetPalId,
        targetPalIds: state.targetPalIds,
        desiredPassives: state.desiredPassives,
        owned: plannerOwned,
        mode: state.mode,
      }
      const requestId = ++requestRef.current
      worker.postMessage({ requestId, input } satisfies PlanRequest)
    }, DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [state.targetPalId, state.targetPalIds, state.desiredPassives, plannerOwned, state.mode])

  return { result, routes, project, computing }
}
