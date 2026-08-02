import type { ReactNode } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface RichTooltipProps {
  children: ReactNode
  title: string
  description?: string
  detail?: string
  /** Atajo de teclado real asociado a la accion, si existe. */
  shortcut?: string
  /** El disparador ya es un elemento focuseable (boton...): usa `asChild`. Si es un `span` decorativo sin su propio foco, pasa `false` para que Radix lo envuelva en un boton accesible por teclado. */
  asChild?: boolean
  className?: string
}

/** Tooltip enriquecido: titulo + descripcion + dato extra + atajo, para no dejar nunca al usuario adivinando. */
export function RichTooltip({
  children,
  title,
  description,
  detail,
  shortcut,
  asChild = true,
  className,
}: RichTooltipProps) {
  return (
    <Tooltip delayDuration={350}>
      <TooltipTrigger
        asChild={asChild}
        className={
          asChild
            ? undefined
            : cn(
                'rounded-[inherit] bg-transparent p-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
                className,
              )
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>
        <p className="font-semibold text-foreground">{title}</p>
        {description && <p className="mt-0.5 leading-snug text-muted-foreground">{description}</p>}
        {detail && <p className="mt-1 leading-snug text-muted-foreground/80">{detail}</p>}
        {shortcut && (
          <kbd className="mt-1.5 inline-flex items-center rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">
            {shortcut}
          </kbd>
        )}
      </TooltipContent>
    </Tooltip>
  )
}
