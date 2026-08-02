import { LocateFixed, PackageCheck } from 'lucide-react'
import type { CSSProperties, MouseEvent, ReactNode } from 'react'
import iconsJson from '@/data/icons.json'
import { ELEMENT_ATMOSPHERE, ELEMENT_INFO, LEGENDARY_SAFE_ACCENT } from '@/domain/element'
import { useT } from '@/i18n/language-store'
import type { ElementType } from '@/domain/types'

/**
 * Carta coleccionable del Pal v1.5, para el arbol de crianza. Puerto fiel del
 * prototipo en design_handoff_pal_card/ (ver su README): caja fija de
 * 780x1000, marco por rareza, pasivas por flechas segun el rango REAL del
 * juego, modo compacto para zoom-out, estado "en tu caja", y un presupuesto
 * de animacion estricto (ver `.pc-anim` en index.css: sin el, un arbol de 20
 * cartas corre ~300 animaciones a la vez).
 *
 * Adaptado a este proyecto en dos puntos: los dos glifos de Material Symbols
 * que pedia el diseno (`my_location`, `inventory_2`) son iconos de
 * lucide-react (ya es dependencia) en vez de sumar una fuente de iconos
 * nueva, y el elemento se recibe con las claves internas de la app
 * (`ElementType`) en vez de nombres en espanol.
 */

const AVAILABLE_ART = new Set(iconsJson as string[])

const RAINBOW = 'linear-gradient(100deg, #ff5f8f, #ffb038, #ffe94a, #46e08a, #46c8ff, #a06bff, #ff5f8f)'
const GOLD = 'linear-gradient(165deg, #fff8da, #f0cd6e 42%, #b98a22)'
const SILVER = 'linear-gradient(165deg, #e8ebf0, #9aa0aa)'
const RED = 'linear-gradient(165deg, #ff9c86, #c0392b)'
const ARROW_UP = 'polygon(50% 4%, 100% 62%, 72% 62%, 72% 96%, 28% 96%, 28% 62%, 0 62%)'
const ARROW_DOWN = 'polygon(50% 96%, 0 38%, 28% 38%, 28% 4%, 72% 4%, 72% 38%, 100% 38%)'

type RankNameKey = 'palCard.rank4' | 'palCard.rank3' | 'palCard.rank2' | 'palCard.rank1' | 'palCard.rankNeg1' | 'palCard.rankNeg2' | 'palCard.rankNeg3'

interface RankVisual {
  nameKey: RankNameKey
  arrows: number
  dir: 'up' | 'down'
  capsule: string
  text: string
  ring: string
  glow: string
  frame: string
  shine: boolean
  animated: boolean
  fill: string | string[]
}

/**
 * Rangos de pasiva REALES del juego (campo `Rank`, -3..5; 5 se trata como 4,
 * ver README de la carta). Las flechas imitan la UI del propio juego: el
 * rango se lee por cantidad y direccion, no solo por color (a prueba de
 * daltonismo).
 */
const RANKS: Record<number, RankVisual> = {
  4: {
    nameKey: 'palCard.rank4',
    arrows: 3,
    dir: 'up',
    capsule: 'linear-gradient(165deg, #2b2540, #14121c)',
    text: '#fdf6ff',
    ring: 'transparent',
    glow: '#b06bff',
    frame: RAINBOW,
    shine: true,
    animated: true,
    // Un tramo del arcoiris POR FLECHA, no el degradado entero: comprimido en
    // 15px (7px con el arbol alejado) un degradado completo sale de un solo color.
    fill: ['linear-gradient(160deg, #ff8fb0, #ff4f7d)', 'linear-gradient(160deg, #ffe98a, #ffab2e)', 'linear-gradient(160deg, #7de6ff, #6a6bff)'],
  },
  3: {
    nameKey: 'palCard.rank3',
    arrows: 3,
    dir: 'up',
    capsule: 'linear-gradient(165deg, #3d2f10, #161104)',
    text: '#ffeeb8',
    ring: 'transparent',
    glow: '#e8bf5a',
    frame: 'linear-gradient(150deg, #fff6cf 0%, #dfae43 28%, #8e6317 52%, #ffefb5 74%, #a9781d 100%)',
    shine: true,
    animated: false,
    fill: GOLD,
  },
  2: {
    nameKey: 'palCard.rank2',
    arrows: 2,
    dir: 'up',
    capsule: 'linear-gradient(165deg, #33280f, #151004)',
    text: '#ffeeb8',
    ring: 'rgba(224,190,110,.4)',
    glow: 'transparent',
    frame: 'none',
    shine: false,
    animated: false,
    fill: GOLD,
  },
  1: {
    nameKey: 'palCard.rank1',
    arrows: 1,
    dir: 'up',
    capsule: 'linear-gradient(165deg, #23262c, #14161a)',
    text: '#dfe3ea',
    ring: 'rgba(226,231,240,.16)',
    glow: 'transparent',
    frame: 'none',
    shine: false,
    animated: false,
    fill: SILVER,
  },
  '-1': {
    nameKey: 'palCard.rankNeg1',
    arrows: 1,
    dir: 'down',
    capsule: 'linear-gradient(165deg, #4a1c17, #1c0d0a)',
    text: '#ffd7cc',
    ring: 'rgba(224,92,64,.5)',
    glow: '#e05c40',
    frame: 'none',
    shine: false,
    animated: false,
    fill: RED,
  },
  '-2': {
    nameKey: 'palCard.rankNeg2',
    arrows: 2,
    dir: 'down',
    capsule: 'linear-gradient(165deg, #4a1c17, #1c0d0a)',
    text: '#ffd7cc',
    ring: 'rgba(224,92,64,.5)',
    glow: '#e05c40',
    frame: 'none',
    shine: false,
    animated: false,
    fill: RED,
  },
  '-3': {
    nameKey: 'palCard.rankNeg3',
    arrows: 3,
    dir: 'down',
    capsule: 'linear-gradient(165deg, #52201a, #1c0d0a)',
    text: '#ffd7cc',
    ring: 'rgba(224,92,64,.62)',
    glow: '#e05c40',
    frame: 'none',
    shine: false,
    animated: false,
    fill: RED,
  },
}

const EMPTY_SLOT_BASE = {
  capsule: 'linear-gradient(165deg, rgba(22,25,31,.93), rgba(13,15,19,.96))',
  ring: 'rgba(226,231,240,.14)',
  text: 'rgba(226,231,240,.66)',
  frame: 'none',
  framePad: 0,
  frameSize: '100% 100%',
  frameAnim: 'none',
  aura: 'transparent',
  auraOpacity: 0,
  arrows: [{ fill: 'rgba(226,231,240,.16)', shape: ARROW_UP }],
}

interface RarityVisual {
  frame: string
  ring: string
  glowPct: number
}

const RARITY: Record<'common' | 'rare' | 'epic' | 'legendary', RarityVisual> = {
  common: { frame: 'linear-gradient(160deg, #4a505c 0%, #23272e 42%, #3d434e 68%, #191c21 100%)', ring: 'rgba(232,236,244,.3)', glowPct: 18 },
  rare: { frame: 'linear-gradient(160deg, #6c7484 0%, #2a2f38 40%, #59616f 66%, #1c2026 100%)', ring: 'rgba(232,236,244,.44)', glowPct: 26 },
  epic: { frame: 'linear-gradient(160deg, #9aa4b6 0%, #333944 38%, #7d879a 64%, #1f2329 100%)', ring: 'rgba(240,244,252,.6)', glowPct: 38 },
  legendary: {
    frame: 'linear-gradient(160deg, #f3dc9c 0%, #a5822f 26%, #f7e9bd 46%, #7c5f1e 66%, #e7cd83 84%, #4d3a12 100%)',
    ring: 'rgba(255,242,204,.8)',
    glowPct: 48,
  },
}

const rarityKey = (n: number) => (n >= 6 ? 'legendary' : n === 5 ? 'epic' : n >= 3 ? 'rare' : 'common')

const A = 'var(--accent, #98a0ad)'
const mix = (pct: number, base: string) => `color-mix(in oklch, ${A} ${pct}%, ${base})`
const notch = (n: number) => `polygon(${n}px 0, 100% 0, 100% calc(100% - ${n}px), calc(100% - ${n}px) 100%, 0 100%, 0 ${n}px)`
const OCTAGON = 'polygon(29% 0, 71% 0, 100% 29%, 100% 71%, 71% 100%, 29% 100%, 0 71%, 0 29%)'

const PANEL: CSSProperties = {
  background: `linear-gradient(168deg, ${mix(20, '#23272f')}, ${mix(9, '#13151a')})`,
  clipPath: notch(13),
  boxShadow: `inset 0 0 0 1px ${mix(42, '#4a505c')}, inset 0 1px 0 rgba(255,255,255,.16)`,
}
const PLATE: CSSProperties = { background: `linear-gradient(160deg, ${mix(42, '#2f333c')} 0%, ${mix(18, '#0f1115')} 100%)` }
const PLATE_HI: CSSProperties = { background: `linear-gradient(160deg, ${mix(44, '#363b45')} 0%, ${mix(20, '#121419')} 100%)` }
const LABEL: CSSProperties = { fontSize: 18, fontWeight: 700, letterSpacing: '.1em', color: mix(55, '#e6eaf1') }
const SUBLABEL: CSSProperties = { fontSize: 13, fontWeight: 600, letterSpacing: '.07em', color: 'rgba(226,231,240,.4)' }
const BIG_NUM: CSSProperties = { fontFamily: "'Anton', sans-serif", lineHeight: 0.8, letterSpacing: '.01em', color: '#f4f6fa' }

function Dia({ s, fill, ring, r = 0 }: { s: number; fill: string; ring?: string; r?: number }) {
  return (
    <span
      style={{ width: s, height: s, flexShrink: 0, borderRadius: r, transform: 'rotate(45deg)', background: fill, boxShadow: ring ? `inset 0 0 0 1px ${ring}` : undefined }}
    />
  )
}

export interface PalCardWork {
  icon: string
  label: string
  level: number
}

export interface PalCardPassive {
  label: string
  /** Rango real del juego (-3..5; 5 se trata como 4). */
  rank: number
}

export interface PalCardProps {
  palName: string
  subtitle?: string
  element: ElementType
  rarity: number
  code: string
  /** Id del Pal: resuelve el retrato en public/pals/. Ausente/no descargado = solo fondo del elemento. */
  palId?: string
  work: PalCardWork[]
  /** Maximo 4; las que falten se rellenan con "ranura libre". */
  passives: PalCardPassive[]
  probability: number
  /**
   * Si esta carta es el resultado de un cruce (tiene dos padres) o no
   * (capturado / ya en tu coleccion). Solo los cruces tienen un "% exito de
   * pasivas" real que mostrar -en captura/coleccion siempre saldria 100%,
   * relleno sin informacion-, asi que ese bloque solo aparece para cruces; en
   * el resto ese espacio se lo queda el panel de trabajo, y las pasivas
   * (lo mas importante de la carta) crecen para llenar lo que sobra.
   */
  isCross: boolean
  /** Nivel de detalle para zoom-out: solo retrato, nombre, marco y dos cifras enormes. */
  compact?: boolean
  selected?: boolean
  /** Ya esta en la coleccion del usuario: la carta cede presencia al objetivo. */
  owned?: boolean
  foil?: boolean
  className?: string
  style?: CSSProperties
  children?: ReactNode
  /** 'button' cuando la carta entera es el objetivo de click (p.ej. expandir/plegar un cruce en el arbol). */
  as?: 'div' | 'button'
  onClick?: () => void
  onDoubleClick?: (event: MouseEvent<HTMLDivElement | HTMLButtonElement>) => void
  ariaExpanded?: boolean
  ariaLabel?: string
}

export function PalCard({
  palName,
  subtitle,
  element,
  rarity,
  code,
  palId,
  work,
  passives,
  probability,
  isCross,
  compact = false,
  selected = false,
  owned = false,
  foil = true,
  className,
  style,
  children,
  as = 'div',
  onClick,
  onDoubleClick,
  ariaExpanded,
  ariaLabel,
}: PalCardProps) {
  const t = useT()
  const el = ELEMENT_INFO[element]
  const rk = rarityKey(rarity)
  const r = RARITY[rk]
  const accent = (rk === 'legendary' && LEGENDARY_SAFE_ACCENT[element]) || el.color
  const atmos = ELEMENT_ATMOSPHERE[element]
  const artUrl = palId && AVAILABLE_ART.has(palId) ? `${import.meta.env.BASE_URL}pals/${palId}.png` : undefined

  const rows = work.slice(0, 5)
  const dense = rows.length > 3

  const slots = passives.slice(0, 4).map((p) => {
    const rank = Math.min(4, p.rank)
    const c = RANKS[rank] ?? RANKS[1]
    return {
      label: p.label,
      tip: `${p.label} · ${t(c.nameKey)}`,
      capsule: c.capsule,
      text: c.text,
      ring: c.ring,
      frame: c.frame,
      framePad: c.frame === 'none' ? 0 : 2,
      frameSize: c.animated ? '200% 100%' : '100% 100%',
      frameAnim: c.animated ? 'pcRainbow 4s linear infinite' : 'none',
      aura: c.glow,
      auraOpacity: c.shine ? 1 : 0,
      arrows: Array.from({ length: c.arrows }, (_, i) => ({
        fill: Array.isArray(c.fill) ? c.fill[i % c.fill.length] : c.fill,
        shape: c.dir === 'down' ? ARROW_DOWN : ARROW_UP,
      })),
    }
  })
  while (slots.length < 4) slots.push({ ...EMPTY_SLOT_BASE, label: t('palCard.emptySlot'), tip: t('palCard.emptySlotTip') })

  const nameSize = palName.length <= 7 ? 62 : palName.length <= 9 ? 54 : palName.length <= 12 ? 46 : 38
  const nameTrack = palName.length <= 9 ? '.075em' : palName.length <= 12 ? '.05em' : '.03em'
  const probW = `${Math.max(3, Math.min(100, probability))}%`
  // Zona de arte reducida frente a v1.5 original: el retrato es un PNG fijo de
  // 128x128 (no gana nitidez por tener mas hueco alrededor), asi que se le
  // resta espacio para dárselo a pasivas/trabajo, que sí son texto/iconos que
  // se benefician de mas tamano.
  const artHeight = compact ? 520 : 334
  const bannerTop = compact ? 420 : 224

  const Root = as
  return (
    <Root
      type={as === 'button' ? 'button' : undefined}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      aria-expanded={ariaExpanded}
      aria-label={ariaLabel}
      data-live={selected ? '1' : '0'}
      className={className ? `pc-card ${className}` : 'pc-card'}
      style={{
        '--accent': accent,
        position: 'relative',
        width: 780,
        height: 1000,
        borderRadius: 26,
        fontFamily: "'Oxanium', system-ui, sans-serif",
        transform: selected ? 'scale(1.018)' : 'scale(1)',
        // Los Pals que ya tienes ceden presencia para que el objetivo destaque; se restaura al hacer hover.
        filter: owned && !selected ? 'saturate(.68) brightness(.9)' : 'none',
        transition: 'transform .18s cubic-bezier(.22,.7,.3,1), box-shadow .18s ease, filter .18s ease',
        boxShadow: `0 2px 3px rgba(0,0,0,.5), 0 14px 22px -12px rgba(0,0,0,.75), 0 38px 70px -22px rgba(0,0,0,.85), 0 0 48px -20px ${mix(r.glowPct, 'transparent')}`,
        ...style,
      } as CSSProperties}
    >
      {(rk === 'epic' || rk === 'legendary') && (
        <div className="pc-anim" style={{ position: 'absolute', inset: -7, borderRadius: 32, pointerEvents: 'none', background: r.frame, filter: 'blur(13px)', opacity: 0.34, animation: 'pcEpic 4.6s ease-in-out infinite' }} />
      )}

      {selected && (
        <div className="pc-anim" style={{ position: 'absolute', inset: -12, borderRadius: 36, pointerEvents: 'none', border: `3px solid ${mix(62, '#eef2f8')}`, boxShadow: `0 0 70px -6px ${mix(78, 'transparent')}, inset 0 0 30px -8px ${mix(60, 'transparent')}`, animation: 'pcTarget 3.4s ease-in-out infinite' }} />
      )}

      {/* MARCO POR RAREZA + 4 capas de metal */}
      <div style={{ position: 'relative', height: '100%', boxSizing: 'border-box', padding: 10, borderRadius: 26, background: r.frame, boxShadow: 'inset 0 1px 0 rgba(255,255,255,.42), inset 0 -2px 6px rgba(0,0,0,.55), inset 0 0 0 1px rgba(255,255,255,.14)' }}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: 26, pointerEvents: 'none', backgroundImage: 'repeating-linear-gradient(96deg, rgba(255,255,255,.1) 0 1px, rgba(0,0,0,.11) 1px 2px, transparent 2px 5px)' }} />
        <div style={{ position: 'absolute', inset: 0, borderRadius: 26, pointerEvents: 'none', background: 'linear-gradient(180deg, rgba(255,255,255,.62) 0%, rgba(255,255,255,.26) 1.2%, rgba(255,255,255,.07) 4%, transparent 12%), linear-gradient(0deg, rgba(0,0,0,.72) 0%, rgba(0,0,0,.22) 2.6%, transparent 8%), linear-gradient(90deg, rgba(255,255,255,.14) 0%, transparent 2%, transparent 98%, rgba(0,0,0,.34) 100%)' }} />
        <div style={{ position: 'absolute', inset: 0, borderRadius: 26, pointerEvents: 'none', background: 'linear-gradient(116deg, transparent 20%, rgba(255,255,255,.07) 33%, rgba(255,255,255,.34) 42%, rgba(255,255,255,.08) 47%, rgba(255,255,255,.26) 53%, rgba(255,255,255,.05) 59%, transparent 72%)' }} />
        {owned && <div style={{ position: 'absolute', inset: 2, borderRadius: 24, pointerEvents: 'none', boxShadow: 'inset 0 0 0 2px rgba(96,214,160,.5), inset 0 0 22px -4px rgba(96,214,160,.32)' }} />}
        <div style={{ position: 'absolute', inset: 5, borderRadius: 22, pointerEvents: 'none', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.5), inset 0 0 0 1px rgba(255,255,255,.24), inset 0 0 0 3px rgba(0,0,0,.5), inset 0 -1px 0 3px rgba(255,255,255,.1), inset 0 0 0 4px rgba(255,255,255,.11)' }} />

        <div style={{ position: 'relative', height: '100%', boxSizing: 'border-box', padding: 3, borderRadius: 17, background: 'linear-gradient(180deg, rgba(11,12,16,.94), rgba(7,8,11,.98))', boxShadow: 'inset 0 0 0 1px rgba(240,244,252,.16)' }}>
          <div style={{ position: 'relative', height: '100%', borderRadius: 14, overflow: 'hidden', background: mix(12, '#14161b'), backgroundImage: 'radial-gradient(rgba(255,255,255,.04) 1px, transparent 1px)', backgroundSize: '7px 7px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 4, background: 'linear-gradient(180deg, rgba(255,255,255,.13) 0%, rgba(255,255,255,.03) 9%, transparent 20%)' }} />

            {/* ZONA DE ARTE — alto fijo. Ver README: el bloque inferior esta calibrado con el resto. */}
            <div style={{ position: 'relative', height: artHeight, flex: 'none', overflow: 'hidden', background: '#0f1115' }}>
              <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(78% 66% at 50% 38%, ${mix(62, '#16191f')} 0%, ${mix(22, '#101318')} 58%, #0a0c10 100%)` }} />
              <div style={{ position: 'absolute', inset: 0, opacity: 0.34, backgroundImage: 'radial-gradient(rgba(255,255,255,.045) 1px, transparent 1px)', backgroundSize: '8px 8px' }} />
              <div className="pc-anim" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.62, backgroundImage: atmos.image, backgroundSize: atmos.size, animation: 'pcDrift 70s linear infinite' }} />
              <div
                className="pc-anim"
                style={{
                  position: 'absolute', left: '50%', top: '44%', width: 760, height: 760, pointerEvents: 'none', transform: 'translate(-50%,-50%)', opacity: 0.15,
                  background: `conic-gradient(from 0deg, transparent 0deg, ${mix(85, 'transparent')} 12deg, transparent 26deg, transparent 60deg, ${mix(70, 'transparent')} 74deg, transparent 90deg, transparent 140deg, ${mix(80, 'transparent')} 154deg, transparent 170deg, transparent 230deg, ${mix(65, 'transparent')} 244deg, transparent 260deg, transparent 320deg, ${mix(75, 'transparent')} 334deg, transparent 350deg)`,
                  maskImage: 'radial-gradient(closest-side, transparent 26%, #000 52%, transparent 82%)',
                  WebkitMaskImage: 'radial-gradient(closest-side, transparent 26%, #000 52%, transparent 82%)',
                  animation: 'pcRays 120s linear infinite',
                } as CSSProperties}
              />
              <div className="pc-anim" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.7, backgroundImage: `radial-gradient(${mix(80, '#ffffff')} 2px, transparent 2.4px), radial-gradient(${mix(60, '#ffffff')} 1.4px, transparent 1.7px)`, backgroundSize: '118px 96px, 74px 132px', animation: 'pcBokeh 15s linear infinite' }} />
              <div className="pc-anim" style={{ position: 'absolute', left: '50%', top: '44%', width: 520, height: 520, transform: 'translate(-50%,-50%)', borderRadius: '50%', background: `radial-gradient(closest-side, ${mix(95, 'transparent')}, transparent 72%)`, animation: 'pcHalo 11s ease-in-out infinite' }} />
              <img src={el.icon} alt="" style={{ position: 'absolute', left: '50%', top: '44%', width: 340, height: 340, objectFit: 'contain', transform: 'translate(-50%,-50%)', opacity: 0.09 }} />

              {artUrl && (
                <div style={{ position: 'absolute', inset: 0 }}>
                  {/*
                    Pozo de ambiente detras del retrato. Sustituye a una copia
                    desenfocada del propio retrato (blur(54px)): aquel blur era
                    el paint mas caro de la carta y se pagaba aunque estuviera
                    quieta. No lo reintroduzcas.
                  */}
                  <div style={{ position: 'absolute', left: '50%', top: '46%', width: 520, height: 520, transform: 'translate(-50%,-50%)', borderRadius: '50%', background: `radial-gradient(closest-side, ${mix(92, '#2a2f38')} 0%, ${mix(55, '#171a20')} 46%, transparent 76%)`, opacity: 0.68 }} />
                  <div style={{ position: 'absolute', left: '50%', top: '46%', width: 262, height: 262, transform: 'translate(-50%,-50%)', background: `linear-gradient(150deg, ${mix(68, '#dbe0e8')}, ${mix(38, '#1e2128')})`, clipPath: OCTAGON, boxShadow: '0 20px 44px -14px rgba(0,0,0,.8)' }} />
                  <div style={{ position: 'absolute', left: '50%', top: '46%', width: 246, height: 246, transform: 'translate(-50%,-50%)', background: `radial-gradient(70% 70% at 50% 32%, ${mix(36, '#21252d')}, #0f1116 78%)`, clipPath: OCTAGON }} />
                  <div style={{ position: 'absolute', left: '50%', top: '70%', width: 292, height: 46, transform: 'translate(-50%,-50%)', borderRadius: '50%', background: 'radial-gradient(closest-side, rgba(3,4,7,.92), rgba(3,4,7,.45) 48%, transparent 76%)', filter: 'blur(9px)' }} />
                  <img
                    className="pc-portrait"
                    src={artUrl}
                    alt={palName}
                    loading="lazy"
                    decoding="async"
                    style={{
                      position: 'absolute', left: '50%', top: '44%', width: 224, height: 224, objectFit: 'contain', transform: 'translate(-50%,-50%)',
                      filter: `drop-shadow(0 14px 12px rgba(0,0,0,.8)) drop-shadow(0 -1px 0 ${mix(70, '#ffffff')}) drop-shadow(0 0 26px ${mix(80, 'transparent')}) drop-shadow(0 0 62px ${mix(45, 'transparent')}) contrast(1.04) saturate(1.06)`,
                    }}
                  />
                </div>
              )}

              <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', boxShadow: 'inset 0 0 70px 16px rgba(6,8,11,.5), inset 0 0 160px 60px rgba(6,8,11,.4)' }} />
              <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(to bottom, rgba(8,10,13,.42) 0%, transparent 24%, transparent 62%, rgba(10,12,16,.62) 100%)' }} />
              {foil && <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', mixBlendMode: 'screen', background: `radial-gradient(55% 40% at 22% 14%, ${mix(34, 'transparent')}, transparent 70%), linear-gradient(118deg, transparent 40%, rgba(235,242,255,.07) 48%, transparent 56%)` }} />}
            </div>

            {/* ── DETALLE COMPLETO ── */}
            {!compact && (
              <div style={{ flex: 1, minHeight: 0, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 13, padding: '18px 14px 10px' }}>
                {/*
                  Fila superior: alto FIJO por contenido (nunca flex:1) para
                  que las pasivas de abajo -lo mas importante de la carta- se
                  queden con todo el resto del alto disponible. El "% exito"
                  solo existe de verdad si esta carta es un cruce: en captura
                  o coleccion siempre daria 100% relleno sin informacion, asi
                  que ahi ese hueco se lo queda entero el panel de trabajo.
                */}
                <div style={{ flex: 'none', display: 'flex', gap: 13, alignItems: 'stretch' }}>
                  {isCross && (
                    <div style={{ flex: '1 1 50%', minWidth: 0, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '18px 20px', ...PANEL }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
                        <span style={{ ...BIG_NUM, fontSize: 54 }}>{probability}</span>
                        <span style={{ fontFamily: "'Anton', sans-serif", fontSize: 26, color: mix(58, '#e6eaf1') }}>%</span>
                      </div>
                      <div style={{ marginTop: 6, fontSize: 14, fontWeight: 700, letterSpacing: '.06em', color: 'rgba(226,231,240,.55)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t('palCard.probLabel')}</div>
                      <div style={{ marginTop: 10, height: 13, borderRadius: 7, overflow: 'hidden', background: 'rgba(6,8,11,.6)', boxShadow: 'inset 0 1px 3px rgba(0,0,0,.6)' }}>
                        <div style={{ height: '100%', width: probW, borderRadius: 7, background: `linear-gradient(90deg, ${mix(88, '#10131a')}, ${mix(45, '#f2f4f8')})`, boxShadow: `0 0 14px -2px ${mix(70, 'transparent')}` }} />
                      </div>
                    </div>
                  )}

                  {/* APTITUDES DE TRABAJO */}
                  <div style={{ flex: isCross ? '1 1 50%' : '1 1 100%', minWidth: 0, boxSizing: 'border-box', position: 'relative', padding: '34px 14px 12px', ...PANEL }}>
                    <div style={{ position: 'absolute', left: 18, top: 12, display: 'flex', alignItems: 'baseline', gap: 6 }}>
                      <span style={LABEL}>{t('palCard.work')}</span>
                      <span style={SUBLABEL}>{t('palCard.workSub')}</span>
                    </div>
                    {rows.map((w, i) => (
                      <div
                        key={i}
                        className="pc-work-row"
                        title={t('palCard.workLevel', { label: w.label, level: w.level })}
                        style={{ height: dense ? 44 : 56, boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 13, padding: '3px', borderBottom: `1px solid ${i === rows.length - 1 ? 'transparent' : 'rgba(226,231,240,.1)'}` }}
                      >
                        <span style={{ flex: 'none', width: dense ? 38 : 46, height: dense ? 38 : 46, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10, background: `linear-gradient(165deg, ${mix(34, '#33383f')}, ${mix(14, '#171a1f')})`, boxShadow: 'inset 0 0 0 1px rgba(226,231,240,.16), inset 0 1px 0 rgba(255,255,255,.2)' }}>
                          <img src={w.icon} alt="" style={{ width: dense ? 27 : 32, height: dense ? 27 : 32, objectFit: 'contain' }} />
                        </span>
                        <span style={{ flex: 1, minWidth: 0, fontSize: 21, fontWeight: 600, color: '#e2e7ef', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{w.label}</span>
                        {/*
                          Escala REAL del juego (1-10, no un 1-4 inventado): el
                          dato viene directo de pal.work[].value sin recortar.
                          Sekhmet Handiwork=6, por ejemplo, ya no se veia
                          distinto de un "4" con la barra vieja de 4 huecos.
                          Antes esto eran 10 tics en escalera (altura fija,
                          creciente, solo el COLOR marcaba on/off): con el
                          fondo oscuro los tics apagados se veian casi igual
                          que los encendidos, leia mal ("error visual"). Una
                          sola barra de progreso -mismo lenguaje que la de
                          PROB. DE PASIVAS- se entiende de un vistazo y es
                          mas grande/visible.
                        */}
                        <span style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ flex: 'none', width: dense ? 66 : 92, height: dense ? 11 : 15, borderRadius: 8, overflow: 'hidden', background: 'rgba(6,8,11,.6)', boxShadow: 'inset 0 1px 3px rgba(0,0,0,.6)' }}>
                            <span
                              style={{
                                display: 'block',
                                height: '100%',
                                width: `${Math.max(6, Math.min(100, (w.level / 10) * 100))}%`,
                                borderRadius: 8,
                                background: `linear-gradient(90deg, ${mix(88, '#10131a')}, ${mix(45, '#f2f4f8')})`,
                                boxShadow: `0 0 12px -2px ${mix(70, 'transparent')}`,
                              }}
                            />
                          </span>
                          <span style={{ flex: 'none', minWidth: dense ? 22 : 26, textAlign: 'right', fontFamily: "'Anton', sans-serif", fontSize: dense ? 18 : 22, color: '#f4f6fa' }}>{w.level}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/*
                  PASIVAS — es lo mas importante de la carta (y de la app
                  entera: el objetivo final siempre son las pasivas), asi que
                  ES el panel flex:1 que se queda con TODO el alto que sobra,
                  no solo el que le entra por contenido. Los 2 huecos de la
                  grilla (gridTemplateRows) se reparten ese alto a partes
                  iguales, y cada pildora va a height:'100%' para llenar su
                  hueco -sea grande o pequeno segun cuanto ceda la fila de
                  arriba-, en vez de quedarse en su alto minimo de texto.
                */}
                <div style={{ flex: 1, minHeight: 0, position: 'relative', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', padding: '42px 16px 16px', ...PANEL }}>
                  <div style={{ position: 'absolute', left: 20, top: 13, display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ ...LABEL, fontSize: 20 }}>{t('palCard.passives')}</span>
                    <span style={SUBLABEL}>{t('palCard.passivesSub')}</span>
                  </div>
                  {/*
                    alignItems:'stretch' (grid) + height:'100%' en la capsula:
                    sin esto, cuando un nombre pasa a 2 lineas ("God of
                    Destruction") esa celda se hace mas alta que su vecina de
                    1 linea, pero la capsula de la vecina NO crecia con ella
                    -se quedaba con su alto de contenido- y dejaba un hueco
                    relleno solo con el marco/aura de fondo debajo, como una
                    mancha de color sin pildora encima. Con la capsula a
                    100% de alto y su texto centrado en vertical, las 4
                    pastillas quedan siempre parejas, tengan 1 o 2 lineas.
                  */}
                  <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gridTemplateRows: 'repeat(2, minmax(0, 1fr))', gap: 16, alignItems: 'stretch' }}>
                    {slots.map((p, i) => (
                      <div key={i} title={p.tip} role="img" aria-label={p.tip} className={cnJoin('pc-passive-chip', p.frameAnim !== 'none' && 'pc-anim')} style={{ position: 'relative', height: '100%', boxSizing: 'border-box', padding: p.framePad, borderRadius: 32, background: p.frame, backgroundSize: p.frameSize, animation: p.frameAnim === 'none' ? undefined : p.frameAnim }}>
                        <span className="pc-anim" style={{ position: 'absolute', inset: -6, borderRadius: 36, pointerEvents: 'none', background: p.aura, filter: 'blur(12px)', opacity: p.auraOpacity, animation: 'pcPassiveGlow 4.2s ease-in-out infinite' }} />
                        <div style={{ position: 'relative', height: '100%', boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px 16px 16px', borderRadius: 30, background: p.capsule, boxShadow: `inset 0 0 0 1px ${p.ring}, inset 0 1px 0 rgba(255,255,255,.14), 0 5px 12px -5px rgba(0,0,0,.65)` }}>
                          {/* Las flechas imitan al juego: 3 arriba arcoiris / 3 arriba oro / 2 arriba oro / 1 arriba plata / N abajo rojo */}
                          <span style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 4, padding: '0 4px' }}>
                            {p.arrows.map((a, k) => (
                              <span key={k} style={{ width: 23, height: 23, background: a.fill, clipPath: a.shape, filter: 'drop-shadow(0 1px 1px rgba(0,0,0,.6))' }} />
                            ))}
                          </span>
                          <span style={{ flex: 1, minWidth: 0, fontSize: 26, fontWeight: 700, lineHeight: 1.14, color: p.text, textWrap: 'balance' }}>{p.label}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* PIE */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 2 }}>
                  <div style={{ padding: '5px 16px', borderRadius: 20, background: `linear-gradient(165deg, ${mix(38, '#2f333c')}, ${mix(18, '#14161a')})`, boxShadow: 'inset 0 0 0 1px rgba(226,231,240,.26), inset 0 1px 0 rgba(255,255,255,.2)' }}>
                    <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: '.1em', color: '#dfe3ea' }}>{code}</span>
                  </div>
                  <div style={{ flex: 1, height: 2, borderRadius: 1, background: `linear-gradient(to right, ${mix(58, '#cfd5df')}, rgba(207,213,223,.08))` }} />
                  {/* el wrapper de 60px reserva la diagonal del cuadrado rotado para que no se corte */}
                  <div style={{ flex: 'none', width: 60, height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: 42, height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 9, transform: 'rotate(45deg)', background: `linear-gradient(165deg, ${mix(42, '#30343d')}, ${mix(18, '#131519')})`, boxShadow: 'inset 0 0 0 1px rgba(226,231,240,.34), 0 4px 10px -4px rgba(0,0,0,.7)' }}>
                      <img src={el.icon} alt="" style={{ width: 28, height: 28, objectFit: 'contain', transform: 'rotate(-45deg)' }} />
                    </div>
                  </div>
                  <div style={{ flex: 1, height: 2, borderRadius: 1, background: `linear-gradient(to left, ${mix(58, '#cfd5df')}, rgba(207,213,223,.08))` }} />
                  <div style={{ flex: 'none', display: 'flex', gap: 7 }}>
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <Dia key={n} s={12} r={2} fill={n <= rarity ? mix(45, '#e2e6ee') : 'rgba(226,231,240,.11)'} ring="rgba(226,231,240,.34)" />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/*
              ── COMPACTO (arbol muy alejado, <20% zoom) ──
              Antes mostraba "pasos"/"% exito" en numeros gigantes: para
              capturas/coleccion siempre era 0/100%, relleno sin informacion,
              y ni con un cruce real era lo que el usuario queria ver de
              lejos -las pasivas son el objetivo del planificador, no un
              contador de pasos. Mismas 4 pastillas que en el detalle
              completo, pero a maxima escala: son legibles incluso con el
              arbol muy alejado, que es justo el punto de este modo.
            */}
            {compact && (
              <div style={{ flex: 1, minHeight: 0, boxSizing: 'border-box', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gridTemplateRows: 'repeat(2, minmax(0, 1fr))', gap: 22, padding: '0 26px' }}>
                {slots.map((p, i) => (
                  <div key={i} title={p.tip} role="img" aria-label={p.tip} className={cnJoin('pc-passive-chip', p.frameAnim !== 'none' && 'pc-anim')} style={{ position: 'relative', height: '100%', boxSizing: 'border-box', padding: p.framePad, borderRadius: 40, background: p.frame, backgroundSize: p.frameSize, animation: p.frameAnim === 'none' ? undefined : p.frameAnim }}>
                    <span className="pc-anim" style={{ position: 'absolute', inset: -8, borderRadius: 46, pointerEvents: 'none', background: p.aura, filter: 'blur(16px)', opacity: p.auraOpacity, animation: 'pcPassiveGlow 4.2s ease-in-out infinite' }} />
                    <div style={{ position: 'relative', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: '10px 14px', borderRadius: 36, background: p.capsule, boxShadow: `inset 0 0 0 1px ${p.ring}, inset 0 1px 0 rgba(255,255,255,.14), 0 5px 12px -5px rgba(0,0,0,.65)` }}>
                      <span style={{ flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                        {p.arrows.map((a, k) => (
                          <span key={k} style={{ width: 34, height: 34, background: a.fill, clipPath: a.shape, filter: 'drop-shadow(0 2px 2px rgba(0,0,0,.6))' }} />
                        ))}
                      </span>
                      <span style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.12, textAlign: 'center', color: p.text, textWrap: 'balance' }}>{p.label}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* BANNER DE NOMBRE */}
            <div style={{ position: 'absolute', left: 0, top: bannerTop, zIndex: 3, maxWidth: '76%', padding: '14px 46px 14px 26px', ...PLATE, clipPath: 'polygon(0 0, 100% 0, calc(100% - 26px) 100%, 0 100%)', boxShadow: '0 12px 30px -8px rgba(0,0,0,.8), inset 0 1px 0 rgba(255,255,255,.24), inset 0 0 0 1px rgba(226,231,240,.16)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: "'Anton', sans-serif", fontSize: nameSize, lineHeight: 1.04, paddingTop: 2, letterSpacing: nameTrack, textTransform: 'uppercase', color: '#fff', textShadow: `0 3px 2px rgba(0,0,0,.85), 0 0 14px ${mix(95, 'transparent')}, 0 0 38px ${mix(80, 'transparent')}, 0 0 78px ${mix(55, 'transparent')}` }}>
                    {palName}
                  </div>
                  {subtitle && <div style={{ marginTop: 5, fontSize: 22, fontWeight: 700, letterSpacing: '.02em', color: mix(52, '#e6eaf1') }}>{subtitle}</div>}
                </div>
                <span style={{ flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                  <Dia s={8} fill="rgba(226,231,240,.32)" />
                  <Dia s={12} fill="rgba(226,231,240,.68)" />
                  <Dia s={8} fill="rgba(226,231,240,.32)" />
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ORNAMENTOS DE ESQUINA */}
        <div style={{ position: 'absolute', left: 16, top: 16, width: 46, height: 46, pointerEvents: 'none', borderTop: '3px solid rgba(255,255,255,.34)', borderLeft: '3px solid rgba(255,255,255,.34)', borderTopLeftRadius: 20 }} />
        <div style={{ position: 'absolute', right: 16, top: 16, width: 46, height: 46, pointerEvents: 'none', borderTop: '3px solid rgba(255,255,255,.34)', borderRight: '3px solid rgba(255,255,255,.34)', borderTopRightRadius: 20 }} />
        <div style={{ position: 'absolute', left: 16, bottom: 16, width: 46, height: 46, pointerEvents: 'none', borderBottom: '3px solid rgba(0,0,0,.4)', borderLeft: '3px solid rgba(0,0,0,.4)', borderBottomLeftRadius: 20 }} />
        <div style={{ position: 'absolute', right: 16, bottom: 16, width: 46, height: 46, pointerEvents: 'none', borderBottom: '3px solid rgba(0,0,0,.4)', borderRight: '3px solid rgba(0,0,0,.4)', borderBottomRightRadius: 20 }} />
        <div style={{ position: 'absolute', left: 27, top: 138, width: 7, height: 7, pointerEvents: 'none', transform: 'rotate(45deg)', background: 'rgba(255,255,255,.5)', boxShadow: '0 0 8px rgba(255,255,255,.35)' }} />
        <div style={{ position: 'absolute', right: 27, top: 138, width: 7, height: 7, pointerEvents: 'none', transform: 'rotate(45deg)', background: 'rgba(255,255,255,.5)', boxShadow: '0 0 8px rgba(255,255,255,.35)' }} />
        <div style={{ position: 'absolute', left: 27, bottom: 138, width: 7, height: 7, pointerEvents: 'none', transform: 'rotate(45deg)', background: 'rgba(255,255,255,.3)' }} />
        <div style={{ position: 'absolute', right: 27, bottom: 138, width: 7, height: 7, pointerEvents: 'none', transform: 'rotate(45deg)', background: 'rgba(255,255,255,.3)' }} />
        <div style={{ position: 'absolute', left: 27, bottom: 27, width: 7, height: 7, pointerEvents: 'none', transform: 'rotate(45deg)', background: 'rgba(0,0,0,.42)' }} />
        <div style={{ position: 'absolute', right: 27, bottom: 27, width: 7, height: 7, pointerEvents: 'none', transform: 'rotate(45deg)', background: 'rgba(0,0,0,.42)' }} />

        {/* BADGE DE RAREZA */}
        <div style={{ position: 'absolute', left: 22, top: 22, zIndex: 5, width: 90, height: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', ...PLATE_HI, clipPath: notch(19), boxShadow: `inset 0 0 0 2px ${r.ring}, inset 0 2px 0 rgba(255,255,255,.28), 0 10px 22px -6px rgba(0,0,0,.8)` }}>
          <span style={{ fontFamily: "'Anton', sans-serif", fontSize: 50, color: '#f6f8fc', textShadow: '0 3px 8px rgba(0,0,0,.65)' }}>{rarity}</span>
        </div>

        {/*
          ELEMENTO — icono + etiqueta en una misma pastilla; es la unica
          aparicion del elemento en toda la carta. El escudo colgante de v1.5
          (esquina superior derecha) se elimino: repetia este mismo icono por
          defecto y era una capa DOM/paint mas sin informacion nueva.
        */}
        <div style={{ position: 'absolute', left: 22, top: 122, zIndex: 5, display: 'flex', alignItems: 'center', gap: 12, padding: '8px 18px 8px 8px', borderRadius: 18, ...PLATE, boxShadow: 'inset 0 0 0 2px rgba(232,236,244,.34), inset 0 2px 0 rgba(255,255,255,.22), 0 8px 18px -7px rgba(0,0,0,.75)' }}>
          <span style={{ flex: 'none', width: 52, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12, ...PLATE_HI }}>
            <img src={el.icon} alt="" style={{ width: 36, height: 36, objectFit: 'contain', filter: `drop-shadow(0 0 12px ${mix(60, 'transparent')})` }} />
          </span>
          <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: '.16em', color: '#e9edf3' }}>{el.label}</span>
        </div>

        {/* PLACA "PAL" */}
        <div style={{ position: 'absolute', right: 22, top: 22, zIndex: 5, padding: '8px 24px', display: 'flex', alignItems: 'center', gap: 11, ...PLATE_HI, clipPath: 'polygon(16px 0, 100% 0, 100% 100%, 0 100%, 0 16px)', boxShadow: `inset 0 0 0 2px ${r.ring}, inset 0 2px 0 rgba(255,255,255,.26), 0 8px 18px -7px rgba(0,0,0,.75)` }}>
          <Dia s={7} fill={mix(45, '#e8ecf4')} />
          <span style={{ fontFamily: "'Anton', sans-serif", fontSize: 27, letterSpacing: '.12em', color: '#f3f5f9' }}>{t('palCard.pal')}</span>
          <Dia s={7} fill={mix(45, '#e8ecf4')} />
        </div>

        {selected && (
          <div style={{ position: 'absolute', right: 26, top: 230, zIndex: 5, display: 'flex', alignItems: 'center', gap: 9, padding: '8px 18px 8px 14px', borderRadius: 18, background: `linear-gradient(160deg, ${mix(58, '#2f333c')}, ${mix(30, '#0f1115')})`, boxShadow: `inset 0 0 0 1px ${mix(62, '#eef2f8')}, inset 0 1px 0 rgba(255,255,255,.28), 0 0 24px -6px ${mix(70, 'transparent')}` }}>
            <LocateFixed size={20} color="#f2f5fa" aria-hidden="true" />
            <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: '.2em', color: '#f2f5fa' }}>{t('palCard.target')}</span>
          </div>
        )}

        {owned && (
          // Rail izquierdo, bajo la pastilla de elemento. NO abajo a la izquierda: esa esquina es del pie (codigo P-###).
          <div style={{ position: 'absolute', left: 22, top: 184, zIndex: 5, display: 'flex', alignItems: 'center', gap: 9, padding: '8px 18px 8px 13px', borderRadius: 18, background: 'linear-gradient(160deg, #2c5f48, #12251c)', boxShadow: 'inset 0 0 0 1px rgba(96,214,160,.55), inset 0 1px 0 rgba(255,255,255,.24), 0 8px 18px -7px rgba(0,0,0,.75)' }}>
            <PackageCheck size={18} color="#8de8bb" aria-hidden="true" />
            <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: '.18em', color: '#d8f6e7' }}>{t('palCard.owned')}</span>
          </div>
        )}

        {/* LAVADO DE ELEMENTO + BRILLO GLOBAL */}
        <div style={{ position: 'absolute', inset: 0, borderRadius: 26, pointerEvents: 'none', zIndex: 6, background: `radial-gradient(120% 78% at 50% 0%, ${mix(92, 'transparent')}, transparent 68%)`, opacity: 0.2 }} />
        <div style={{ position: 'absolute', inset: 0, borderRadius: 26, pointerEvents: 'none', zIndex: 6, background: 'linear-gradient(118deg, rgba(255,255,255,.06) 0%, transparent 24%, transparent 76%, rgba(255,255,255,.035) 100%)' }} />

        {rk === 'legendary' && (
          <div style={{ position: 'absolute', inset: 0, borderRadius: 26, overflow: 'hidden', pointerEvents: 'none', zIndex: 6 }}>
            <div className="pc-anim" style={{ position: 'absolute', top: '-30%', left: 0, width: '24%', height: '160%', background: 'linear-gradient(90deg, transparent, rgba(255,248,225,.18) 30%, rgba(255,252,238,.62) 50%, rgba(255,248,225,.18) 70%, transparent)', animation: 'pcShimmer 5.4s linear infinite' }} />
          </div>
        )}
      </div>

      {children}
    </Root>
  )
}

function cnJoin(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}
