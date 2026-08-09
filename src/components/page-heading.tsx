import type { ComponentType, ReactNode, SVGProps } from 'react'

type IconType = ComponentType<SVGProps<SVGSVGElement>>

/** Titulo `<h1>` real de una pagina de nivel superior (una sola vez por pagina). */
export function PageH1({ icon: Icon, children }: { icon?: IconType; children: ReactNode }) {
  return (
    <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
      {Icon && <Icon className="size-6 text-primary" aria-hidden="true" />}
      {children}
    </h1>
  )
}

/**
 * Encabezado de seccion `<h2>` real (icono + texto), mismo look que el
 * patron visual ya usado en las fichas de Pal -pero como heading semantico
 * de verdad, no un `<div>` con estilo de titulo.
 */
export function PageSection({ icon: Icon, title }: { icon: IconType; title: string }) {
  return (
    <h2 className="flex items-center gap-2 text-sm font-bold">
      <Icon className="size-4 text-primary" aria-hidden="true" />
      {title}
    </h2>
  )
}
