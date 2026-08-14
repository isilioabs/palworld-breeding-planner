import { useId } from 'react'

import { cn } from '@/lib/utils'

interface PalaxisMarkProps {
  className?: string
  /** Monochrome is useful for embossing, masks, and low-ink contexts. */
  monochrome?: boolean
  title?: string
}

/**
 * Axis Core — the Palaxis master mark.
 *
 * The broken gold ring represents the breeding network, the cyan core the
 * selected Pal, and the vertical axis the shortest route through the graph.
 * The production vector follows the approved Axis Core concept: a metallic
 * breeding ring, a dimensional route axis, and a luminous selected-Pal core.
 * It remains crisp from a 16px favicon to the oversized landing-page mark.
 */
export function PalaxisMark({ className, monochrome = false, title }: PalaxisMarkProps) {
  const id = useId().replace(/:/g, '')
  const labelled = Boolean(title)
  const gold = monochrome ? 'currentColor' : `url(#${id}-gold)`
  const teal = monochrome ? 'currentColor' : `url(#${id}-teal)`
  const core = monochrome ? 'currentColor' : `url(#${id}-core)`

  return (
    <svg
      viewBox="0 0 64 64"
      className={cn('palaxis-mark', className)}
      role={labelled ? 'img' : undefined}
      aria-hidden={labelled ? undefined : 'true'}
      aria-label={title}
      fill="none"
    >
      {title ? <title>{title}</title> : null}

      {!monochrome ? (
        <defs>
          <linearGradient id={`${id}-gold`} x1="8" y1="7" x2="52" y2="57" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FFE08A" />
            <stop offset=".28" stopColor="#EAB94F" />
            <stop offset=".72" stopColor="#B77A26" />
            <stop offset="1" stopColor="#E7BB58" />
          </linearGradient>
          <linearGradient id={`${id}-teal`} x1="27" y1="2" x2="38" y2="62" gradientUnits="userSpaceOnUse">
            <stop stopColor="#78E8E1" />
            <stop offset=".42" stopColor="#35C9C4" />
            <stop offset="1" stopColor="#138B87" />
          </linearGradient>
          <linearGradient id={`${id}-core`} x1="20" y1="19" x2="44" y2="45" gradientUnits="userSpaceOnUse">
            <stop stopColor="#62E9DF" />
            <stop offset=".5" stopColor="#28C8C0" />
            <stop offset="1" stopColor="#117E7A" />
          </linearGradient>
        </defs>
      ) : null}

      {/* Circular network, interrupted by two inward-facing route chevrons. */}
      <path
        d="M24.3 10H23A23.5 23.5 0 0 0 8 25.6L14.2 32 8 38.4A23.5 23.5 0 0 0 23 54h1.3"
        stroke={gold}
        strokeWidth="5.15"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
      <path
        d="M39.7 10H41A23.5 23.5 0 0 1 56 25.6L49.8 32l6.2 6.4A23.5 23.5 0 0 1 41 54h-1.3"
        stroke={gold}
        strokeWidth="5.15"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />

      {!monochrome ? (
        <>
          <path d="M23.8 11.8h-1A21.5 21.5 0 0 0 10.1 24.8" stroke="#FFE8A5" strokeOpacity=".56" strokeWidth=".95" strokeLinecap="square" />
          <path d="M40.2 52.2h1A21.5 21.5 0 0 0 53.9 39.2" stroke="#F1C96A" strokeOpacity=".34" strokeWidth=".9" strokeLinecap="square" />
        </>
      ) : null}

      {/* The route axis deliberately projects beyond the network. */}
      <path d="M32 0 35.6 10.7h-1.9v42.6h1.9L32 64l-3.6-10.7h1.9V10.7h-1.9L32 0Z" fill={teal} />
      {!monochrome ? <path d="M31.25 6.8h1.1v50.4h-1.1Z" fill="#B8F5F0" fillOpacity=".38" /> : null}

      {/* Open circuit brackets and a three-stage luminous core. */}
      <path
        d="M26.3 20.5 20.5 27v10l5.8 6.5"
        stroke={core}
        strokeWidth="3.4"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
      <path
        d="m37.7 20.5 5.8 6.5v10l-5.8 6.5"
        stroke={core}
        strokeWidth="3.4"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
      <circle cx="32" cy="32" r="7" fill={monochrome ? 'none' : 'var(--palaxis-ink, #050a0e)'} stroke={core} strokeWidth="2.8" />
      <circle
        cx="32"
        cy="32"
        r="3.8"
        fill={monochrome ? 'none' : 'var(--palaxis-ink, #050a0e)'}
        stroke={monochrome ? 'currentColor' : 'var(--palaxis-white, #f4f6f2)'}
        strokeWidth="1.3"
      />
      <circle cx="32" cy="32" r="2" fill={core} />
    </svg>
  )
}

interface PalaxisWordmarkProps {
  className?: string
  /** Hides the visible name while retaining it for assistive technology. */
  compact?: boolean
}

/**
 * Custom vector lettering derived from the approved Axis Core concept.
 * Paths avoid font substitution and keep both open A glyphs exact everywhere.
 */
export function PalaxisWordmark({ className, compact = false }: PalaxisWordmarkProps) {
  if (compact) return <span className={cn('sr-only', className)}>Palaxis</span>

  return (
    <svg
      viewBox="0 0 240 36"
      className={cn('palaxis-wordmark', className)}
      role="img"
      aria-label="Palaxis"
      preserveAspectRatio="xMinYMid meet"
    >
      <title>Palaxis</title>
      <g fill="currentColor">
        {/* P */}
        <path fillRule="evenodd" d="M0 3h20l8 8v5l-8 8H7v9H0V3Zm7 7v7h10l4-3.5-4-3.5H7Z" />
        {/* A — deliberately open, matching the approved concept. */}
        <path d="M36 33 49 3h7l13 30h-8L52.5 12 44 33h-8Z" />
        {/* L */}
        <path d="M78 3h7v23h19v7H78V3Z" />
        {/* A */}
        <path d="m108 33 13-30h7l13 30h-8l-8.5-21-8.5 21h-8Z" />
        {/* X */}
        <path d="M149 3h9l8.5 10.7L175 3h9l-13 15 13 15h-9l-8.5-10.7L158 33h-9l13-15-13-15Z" />
        {/* I */}
        <path d="M193 3h7v30h-7V3Z" />
        {/* S */}
        <path d="M211 3h29v7h-25l-2 2v2l2 2h18l7 7v3l-7 7h-29v-7h25l3-2-3-2h-18l-7-7v-5l7-7Z" />
      </g>
      <path className="palaxis-wordmark__core" d="m124.5 23 5 10h-10l5-10Z" />
    </svg>
  )
}
