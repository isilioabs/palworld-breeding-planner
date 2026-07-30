/// <reference lib="webworker" />
/**
 * El planificador corre en un worker para que la UI no se congele mientras se
 * explora el hipergrafo. Cada peticion lleva un `requestId`: las respuestas que
 * llegan tarde se descartan en el hilo principal.
 */
import { plan } from './index'
import type { PlanResult, PlannerInput } from '../types'

export interface PlanRequest {
  requestId: number
  input: PlannerInput
}

export interface PlanResponse {
  requestId: number
  result: PlanResult
}

self.onmessage = (event: MessageEvent<PlanRequest>) => {
  const { requestId, input } = event.data
  let result: PlanResult
  try {
    result = plan(input)
  } catch (error) {
    result = { ok: false, reason: `Error interno del planificador: ${(error as Error).message}` }
  }
  ;(self as unknown as Worker).postMessage({ requestId, result } satisfies PlanResponse)
}
