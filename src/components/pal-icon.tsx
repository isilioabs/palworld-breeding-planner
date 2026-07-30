import { useState } from 'react'
import iconsJson from '@/data/icons.json'
import { loadDatabase, palName } from '@/domain/database'
import { cn } from '@/lib/utils'

/** Ids con sprite descargado en public/pals. Ver scripts/fetch-icons.mjs. */
const AVAILABLE = new Set(iconsJson as string[])

interface PalIconProps {
  palId: string | null | undefined
  size?: number
  className?: string
}

/**
 * Sprite del Pal, con respaldo a un monograma si falta el archivo (asi la app
 * nunca muestra un icono roto aunque no se hayan descargado los iconos).
 */
export function PalIcon({ palId, size = 40, className }: PalIconProps) {
  const [broken, setBroken] = useState(false)
  const pal = palId ? loadDatabase().palById.get(palId) : undefined
  const showImage = palId && AVAILABLE.has(palId) && !broken

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted/60 ring-1 ring-border/60',
        className,
      )}
      style={{ width: size, height: size }}
      title={palName(pal)}
    >
      {showImage ? (
        <img
          src={`${import.meta.env.BASE_URL}pals/${palId}.png`}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          className="size-full object-contain"
          onError={() => setBroken(true)}
        />
      ) : (
        <span
          className="font-semibold uppercase text-muted-foreground"
          style={{ fontSize: Math.max(10, size * 0.4) }}
        >
          {palName(pal).slice(0, 2)}
        </span>
      )}
    </span>
  )
}
