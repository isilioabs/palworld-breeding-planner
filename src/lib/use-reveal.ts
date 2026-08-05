import { useEffect, useRef, useState } from 'react'

/** Marca un elemento como "visible" la primera vez que entra en el viewport,
 * para animar su entrada al hacer scroll. Un solo disparo por elemento: el
 * observer se desconecta en cuanto se revela, así que no hay coste continuo. */
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') { setVisible(true); return }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); observer.disconnect() }
    }, { threshold: 0.15 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return [ref, visible] as const
}
