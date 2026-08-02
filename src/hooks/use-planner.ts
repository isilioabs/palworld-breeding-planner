/**
 * Ejecuta el planificador en un worker y recalcula automaticamente cada vez que
 * cambia cualquier dato de entrada (objetivo, pasivas, coleccion o modo).
 */
import { useEffect, useRef, useState } from 'react'
import type { PlanResult, PlannerInput } from '@/domain/types'
import type { PlanRequest, PlanResponse } from '@/domain/breeding/planner.worker'
import { usePlannerStore } from '@/state/planner-store'

const DEBOUNCE_MS = 180
/**
 * Duracion minima visible del estado "calculando", aunque el worker responda
 * al instante. Sin esto, en rutas simples el spinner parpadea un frame y se
 * siente como un fallo de render en vez de un calculo real.
 */
const MIN_LOADING_MS = 220

export interface PlannerRun {
  result: PlanResult | null
  computing: boolean
}

export function usePlanner(): PlannerRun {
  const { state } = usePlannerStore()
  const [result, setResult] = useState<PlanResult | null>(null)
  const [computing, setComputing] = useState(false)
  const workerRef = useRef<Worker | null>(null)
  const requestRef = useRef(0)
  const loadingStartedAt = useRef(0)

  useEffect(() => {
    const worker = new Worker(new URL('../domain/breeding/planner.worker.ts', import.meta.url), {
      type: 'module',
    })
    worker.onmessage = (event: MessageEvent<PlanResponse>) => {
      const { requestId, result: newResult } = event.data
      // Descarta respuestas obsoletas.
      if (requestId !== requestRef.current) return
      const elapsed = performance.now() - loadingStartedAt.current
      const remaining = Math.max(0, MIN_LOADING_MS - elapsed)
      window.setTimeout(() => {
        // Pudo quedar obsoleta durante la espera de la duracion minima.
        if (requestId !== requestRef.current) return
        setResult(newResult)
        setComputing(false)
      }, remaining)
    }
    workerRef.current = worker
    return () => {
      worker.terminate()
      workerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!state.targetPalId) {
      setResult(null)
      setComputing(false)
      return
    }
    setComputing(true)
    const timer = window.setTimeout(() => {
      const worker = workerRef.current
      if (!worker) return
      const input: PlannerInput = {
        targetPalId: state.targetPalId,
        desiredPassives: state.desiredPassives,
        owned: state.owned,
        mode: state.mode,
      }
      const requestId = ++requestRef.current
      loadingStartedAt.current = performance.now()
      worker.postMessage({ requestId, input } satisfies PlanRequest)
    }, DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [state.targetPalId, state.desiredPassives, state.owned, state.mode])

  return { result, computing }
}
