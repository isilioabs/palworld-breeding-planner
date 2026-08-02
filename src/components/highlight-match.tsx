import { Fragment } from 'react'
import { cn } from '@/lib/utils'

interface HighlightMatchProps {
  text: string
  query: string
  className?: string
}

/**
 * Resalta la primera aparicion (sin distinguir mayusculas) de `query` dentro
 * de `text`. Es una coincidencia de subcadena simple a proposito: cmdk usa un
 * scorer difuso internamente para ordenar resultados, pero replicar sus
 * posiciones exactas de coincidencia no compensa la complejidad frente a
 * resaltar la subcadena literal, que cubre el caso real de uso (la gente
 * escribe prefijos o fragmentos del nombre, no letras salteadas).
 */
export function HighlightMatch({ text, query, className }: HighlightMatchProps) {
  const q = query.trim()
  if (!q) return <Fragment>{text}</Fragment>

  const idx = text.toLowerCase().indexOf(q.toLowerCase())
  if (idx === -1) return <Fragment>{text}</Fragment>

  return (
    <Fragment>
      {text.slice(0, idx)}
      <mark className={cn('rounded-[2px] bg-primary/25 px-0 text-inherit', className)}>
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </Fragment>
  )
}
