/**
 * Ejecuta el planificador en un worker y recalcula automaticamente cada vez que
 * cambia cualquier dato de entrada (objetivo, pasivas, coleccion, modo o fuente
 * fijada).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { PlanResult, PlannerInput, ProjectPlan, RouteAlternatives } from '@/domain/types'
import type { PlanRequest, PlanResponse } from '@/domain/breeding/planner.worker'
import { usePlannerStore } from '@/state/planner-store'
import { track } from '@/lib/analytics'

/** Debounce del PRIMER plan para un objetivo nuevo: hay tiempo de sobra, así
 * que se prioriza no lanzar el worker en cada tecla mientras se configura. */
const INITIAL_DEBOUNCE_MS = 180
/** Debounce de un recalculo con un objetivo ya resuelto en pantalla (añadir/
 * quitar un Pal, cambiar de modo...): tiene que sentirse casi instantaneo. */
const INCREMENTAL_DEBOUNCE_MS = 100
/**
 * Duracion minima visible del estado "calculando" -SOLO para el primer plan
 * de un objetivo, para que el debounce forme parte de los ~220 ms percibidos
 * en vez de sumar una pausa. Un recalculo incremental NUNCA espera esto: ya
 * hay un arbol en pantalla, así que no hace falta disimular nada.
 */
const MIN_LOADING_MS = 220

/** Pura y exportada para poder testearla sin montar el hook completo (worker
 * de verdad, timers reales...): una respuesta es obsoleta si no corresponde
 * a la ULTIMA peticion enviada. */
export function isStaleResponse(responseRequestId: number, latestRequestId: number): boolean {
  return responseRequestId !== latestRequestId
}

export interface PlannerRun {
  result: PlanResult | null
  routes: RouteAlternatives | null
  project: ProjectPlan | null
  /** Sin resultado previo todavia: pantalla de carga completa. */
  computing: boolean
  /** Ya hay un resultado en pantalla y se esta calculando uno nuevo: no
   * reemplazar nada, solo atenuar y mostrar un indicador pequeño. */
  recalculating: boolean
}

export function usePlanner(): PlannerRun {
  const { state } = usePlannerStore()
  const [result, setResult] = useState<PlanResult | null>(null)
  const [routes, setRoutes] = useState<RouteAlternatives | null>(null)
  const [project, setProject] = useState<ProjectPlan | null>(null)
  const [computing, setComputing] = useState(false)
  const [recalculating, setRecalculating] = useState(false)
  const workerRef = useRef<Worker | null>(null)
  const requestRef = useRef(0)
  // Si ya hay un resultado mostrado en pantalla. Vive en un ref (no en el
  // estado de React) para poder leerlo dentro del efecto de disparo sin
  // meterlo en sus dependencias -si no, cada respuesta reprogramaria el
  // efecto y podria disparar una segunda peticion innecesaria.
  const hasResultRef = useRef(false)
  // Si la peticion en vuelo es la primera para el objetivo actual, capturado
  // en el momento del envio (no al resolver): dos peticiones concurrentes no
  // deben pisarse la una a la otra para decidir si aplica la espera minima.
  const pendingIsInitialRef = useRef(true)
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
      if (isStaleResponse(requestId, requestRef.current)) return
      const elapsed = performance.now() - loadingStartedAt.current
      const remaining = pendingIsInitialRef.current ? Math.max(0, MIN_LOADING_MS - elapsed) : 0
      window.setTimeout(() => {
        // Pudo quedar obsoleta durante la espera de la duracion minima.
        if (isStaleResponse(requestId, requestRef.current)) return
        setResult(newResult)
        hasResultRef.current = true
        setRoutes(newRoutes)
        setProject(newProject ?? null)
        setComputing(false)
        setRecalculating(false)
        if (newResult.ok) track('tree_generated', { targets: targetCountRef.current, routes: Object.keys(newRoutes).length })
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
      setRoutes(null)
      setProject(null)
      setComputing(false)
      setRecalculating(false)
      hasResultRef.current = false
      return
    }
    const isInitial = !hasResultRef.current
    if (isInitial) setComputing(true)
    else setRecalculating(true)
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
        pinnedSources: state.pinnedSources,
      }
      const requestId = ++requestRef.current
      pendingIsInitialRef.current = isInitial
      worker.postMessage({ requestId, input } satisfies PlanRequest)
    }, isInitial ? INITIAL_DEBOUNCE_MS : INCREMENTAL_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [state.targetPalId, state.targetPalIds, state.desiredPassives, plannerOwned, state.mode, state.pinnedSources])

  return { result, routes, project, computing, recalculating }
}
