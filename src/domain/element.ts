/**
 * Identidad visual de cada elemento para la carta de Pal v1.5 (ver
 * design_handoff_pal_card/README.md del cliente para el origen del diseño:
 * acentos y atmosferas verificados contra la paleta real del juego).
 *
 * Un solo color hex por elemento (no clases Tailwind sueltas) para poder
 * inyectarlo como variable CSS (`--accent`) y que toda la carta -marco, halo,
 * paneles- se derive de un unico valor via color-mix().
 *
 * Los iconos son los oficiales de PalCalc (ver scripts/fetch-card-assets.mjs):
 * viven en public/elements/<Nombre>.png.
 */
import type { ElementType } from './types'

export interface ElementInfo {
  /** Nombre visible en la etiqueta de la carta (EARTH, FIRE...). */
  label: string
  color: string
  /** Ruta publica al PNG oficial (48x48, con alpha). */
  icon: string
}

export const ELEMENT_INFO: Record<ElementType, ElementInfo> = {
  ground: { label: 'EARTH', color: '#a97c3f', icon: '/elements/Earth.png' },
  fire: { label: 'FIRE', color: '#d9662e', icon: '/elements/Fire.png' },
  water: { label: 'WATER', color: '#2f6fb5', icon: '/elements/Water.png' },
  grass: { label: 'GRASS', color: '#3f9e6a', icon: '/elements/Leaf.png' },
  electric: { label: 'ELECTRIC', color: '#d9a520', icon: '/elements/Electricity.png' },
  dark: { label: 'DARK', color: '#7a4bb8', icon: '/elements/Dark.png' },
  ice: { label: 'ICE', color: '#3fb6c9', icon: '/elements/Ice.png' },
  dragon: { label: 'DRAGON', color: '#2f9e9e', icon: '/elements/Dragon.png' },
  neutral: { label: 'NEUTRAL', color: '#98a0ad', icon: '/elements/Normal.png' },
}

/**
 * En cartas legendarias (marco dorado) el acento de Electrico/Tierra choca
 * con el oro del marco y se empasta; el diseño los desatura para esa unica
 * combinacion. Se aplica solo cuando `rarity` resuelve a la franja legendaria.
 */
export const LEGENDARY_SAFE_ACCENT: Partial<Record<ElementType, string>> = {
  electric: '#b8912f',
  ground: '#96764a',
}

/** Atmosfera de fondo por elemento: gradientes CSS puros (sin imagenes), animados con pcDrift. */
export const ELEMENT_ATMOSPHERE: Record<ElementType, { image: string; size: string }> = {
  ground: {
    image:
      'radial-gradient(rgba(255,246,228,.2) 1.8px, transparent 2px), radial-gradient(rgba(0,0,0,.3) 1.3px, transparent 1.5px), repeating-linear-gradient(8deg, rgba(255,240,214,.07) 0 3px, transparent 3px 26px)',
    size: '36px 36px, 22px 22px, auto',
  },
  fire: {
    image:
      'radial-gradient(rgba(255,214,150,.26) 1.8px, transparent 2px), radial-gradient(rgba(255,160,80,.18) 1.2px, transparent 1.4px), radial-gradient(78% 56% at 50% 100%, rgba(255,170,90,.2), transparent 72%)',
    size: '44px 60px, 26px 34px, auto',
  },
  water: {
    image:
      'repeating-radial-gradient(circle at 50% 132%, transparent 0 20px, rgba(190,230,255,.11) 20px 23px, transparent 23px 44px), radial-gradient(rgba(220,244,255,.22) 2.4px, transparent 2.8px), radial-gradient(rgba(160,215,255,.13) 1.4px, transparent 1.6px)',
    size: 'auto, 62px 62px, 30px 30px',
  },
  grass: {
    image:
      'radial-gradient(rgba(214,255,214,.22) 2px, transparent 2.2px), repeating-linear-gradient(-34deg, transparent 0 26px, rgba(190,255,200,.08) 26px 30px, transparent 30px 58px)',
    size: '48px 48px, auto',
  },
  electric: {
    image:
      'repeating-linear-gradient(64deg, transparent 0 24px, rgba(255,240,170,.17) 24px 26px, transparent 26px 40px), repeating-linear-gradient(-58deg, transparent 0 32px, rgba(255,236,150,.11) 32px 34px, transparent 34px 58px), radial-gradient(rgba(255,246,190,.2) 1.6px, transparent 1.8px)',
    size: 'auto, auto, 54px 54px',
  },
  dark: {
    image:
      'radial-gradient(58% 40% at 22% 30%, rgba(206,170,255,.15), transparent 70%), radial-gradient(52% 38% at 76% 68%, rgba(180,140,240,.13), transparent 70%), radial-gradient(rgba(226,205,255,.2) 1.6px, transparent 1.8px)',
    size: 'auto, auto, 44px 44px',
  },
  ice: {
    image:
      'repeating-linear-gradient(60deg, transparent 0 28px, rgba(200,244,255,.12) 28px 30px, transparent 30px 58px), repeating-linear-gradient(-60deg, transparent 0 28px, rgba(200,244,255,.12) 28px 30px, transparent 30px 58px), radial-gradient(rgba(226,250,255,.2) 1.6px, transparent 1.8px)',
    size: 'auto, auto, 50px 50px',
  },
  dragon: {
    image:
      'repeating-linear-gradient(30deg, transparent 0 22px, rgba(160,255,246,.11) 22px 24px, transparent 24px 46px), repeating-linear-gradient(150deg, transparent 0 22px, rgba(160,255,246,.11) 22px 24px, transparent 24px 46px), radial-gradient(rgba(190,255,250,.17) 1.6px, transparent 1.8px)',
    size: 'auto, auto, 52px 52px',
  },
  neutral: {
    image:
      'repeating-linear-gradient(0deg, transparent 0 20px, rgba(226,236,250,.09) 20px 22px, transparent 22px 42px), repeating-linear-gradient(90deg, transparent 0 20px, rgba(226,236,250,.09) 20px 22px, transparent 22px 42px), radial-gradient(rgba(230,240,255,.15) 1.5px, transparent 1.7px)',
    size: 'auto, auto, 46px 46px',
  },
}
