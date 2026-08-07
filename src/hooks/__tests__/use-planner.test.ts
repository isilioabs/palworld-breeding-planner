import { describe, expect, it } from 'vitest'
import { isStaleResponse } from '../use-planner'

describe('isStaleResponse', () => {
  it('una respuesta con el ultimo requestId enviado no es obsoleta', () => {
    expect(isStaleResponse(3, 3)).toBe(false)
  })

  it('una respuesta que llega tarde (requestId antiguo) es obsoleta', () => {
    // Se enviaron peticiones 1, 2, 3 -la respuesta de la 1 llega despues de
    // que ya se envio (y quiza ya respondio) la 3.
    expect(isStaleResponse(1, 3)).toBe(true)
  })

  it('nunca se confunde una respuesta futura imposible con la vigente', () => {
    // No deberia ocurrir en la practica (requestRef solo crece), pero la
    // igualdad estricta es lo unico que importa: cualquier no-coincidencia es obsoleta.
    expect(isStaleResponse(4, 3)).toBe(true)
  })
})
