import { useEffect, useState } from 'react'

/**
 * Detecta puntero tactil/sin hover real (no solo "pantalla angosta": un
 * iPad en horizontal es ancho pero sigue siendo tactil). Compartido por
 * cualquier pantalla que necesite recortar trabajo costoso en touch (saltar
 * tooltips que solo tienen sentido con hover, animaciones de bajo valor,
 * arboles pre-colapsados por defecto...).
 */
export function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(false)
  useEffect(() => {
    const mql = window.matchMedia('(hover: none), (pointer: coarse)')
    setCoarse(mql.matches)
    const onChange = () => setCoarse(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])
  return coarse
}
