/**
 * Landing page de Palaxis -unica pagina tocada por este rediseño (ver
 * conversacion: "redesigning ONLY the landing page"). No cambia el shell de
 * la app, el algoritmo de crianza/rutas, la Paldex, el calculo de la Tier
 * List, ni los colores de marca -todo eso se REUSA via datos y componentes
 * reales (getBuildsFor, getTierList, PalIcon, PassiveBadge, PalCombobox,
 * loadDatabase().mechanics), nunca duplicado.
 *
 * Pasada de pulido (reduce repeticion, sube jerarquia visual, acorta la
 * pagina): se elimino la franja grande de "3 historias" (ya cubiertas por
 * Hero+Three Routes+Collection Intelligence) a favor de un grid "More from
 * Palaxis" mas chico; la seccion de credibilidad se fusiono en la Trust
 * Strip. Tambien es donde la landing empieza a reusar la carta TCG premium
 * real (`PalCard`, src/components/pal-card.tsx, via el puente
 * `LandingTcgCard`) en vez de inventar una carta simplificada -pero solo en
 * 3 sitios (hero, Collection Intelligence, vitrina de Paldex), nunca en
 * listas grandes, siguiendo el mismo presupuesto de animacion (`.pc-anim`)
 * que ya protege el rendimiento del arbol real.
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import {
  ArrowRight,
  BookOpen,
  Boxes,
  ChevronRight,
  Compass,
  Crown,
  Database,
  Egg,
  GitCompareArrows,
  Languages,
  Menu,
  MessageCircle,
  PlusCircle,
  SlidersHorizontal,
  Sparkles,
  Swords,
  WifiOff,
  X,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PalCombobox } from '@/components/pal-combobox'
import { PalIcon } from '@/components/pal-icon'
import { PalaxisMark, PalaxisWordmark } from '@/components/palaxis-mark'
import { PassiveBadge } from '@/components/passive-badge'
import { getBuildsFor } from '@/domain/builds'
import { loadDatabase, palName } from '@/domain/database'
import { palSlug } from '@/domain/slug'
import { getTierCategory, getTierList, tierLetter, type TierCategory } from '@/domain/tier-list'
import { useLang, useT } from '@/i18n/language-store'
import type { TranslationKey } from '@/i18n/translations'
import { track } from '@/lib/analytics'
import { useMobileLayout } from '@/lib/use-mobile-layout'
import { useReveal } from '@/lib/use-reveal'
import { cn } from '@/lib/utils'
import { localizedPath, stripLocalePrefix } from '@/lib/seo'
import { usePlannerStore } from '@/state/planner-store'
import { LandingMiniTree } from './landing-mini-tree'
import { LandingTcgCard } from './landing-tcg-card'

interface LandingPageProps {
  onLaunch: () => void
  onLoadDemo: () => void
  onOpenQuick: () => void
  /** Navega a una ruta real de la app (Pals, Tier List, Feedback...) sin recargar la pagina. */
  onNavigate: (path: string) => void
}

/** Nav global -rutas reales, crawlables (`<a href>`). "Guides" no tiene pagina propia todavia: ancla a la vitrina de Palaxis Guide de esta misma pagina, no un link inventado. */
const NAV_LINKS = [
  { path: '/planner', labelKey: 'nav.breedingPlanner', kind: 'launch', icon: SlidersHorizontal } as const,
  { path: '/pals', labelKey: 'nav.pals', kind: 'route', icon: Database } as const,
  { path: '/tiers', labelKey: 'nav.tiers', kind: 'route', icon: Crown } as const,
  { path: '/rapido', labelKey: 'nav.quickPath', kind: 'quick', icon: Zap } as const,
  { path: '#guide', labelKey: 'landing.nav.guides', kind: 'anchor', icon: BookOpen } as const,
]

const POPULAR_TARGETS = ['Anubis', 'JetDragon', 'BlackGriffon', 'BlackCentaur']

/**
 * Cada modo explica visualmente POR QUE difiere: insignia por padre
 * (owned/hard capture) + comparacion compacta. Todo marcado como ejemplo
 * ilustrativo, no un calculo real del planner -PERO el cruce en si (Blazamut
 * + Shadowbeak -> Anubis) SI es real: floor((410+550+1)/2)=480, el rank
 * exacto de Anubis, verificado contra la misma formula que usa el
 * planificador real (src/domain/breeding/resolver.ts). Los 3 modos
 * reusan el MISMO cruce real (a este nivel de zoom -1 generacion- no hay
 * un segundo camino real hacia Anubis mas facil: sus unicos padres validos
 * son todos Pals de nivel 46+, no existe una combinacion "facil" real) -la
 * diferencia entre modos es narrativa (posesion/dificultad de captura) y las
 * cifras de comparacion, no un padre inventado.
 */
const ANUBIS_REAL_PARENTS = { a: 'KingBahamut', b: 'BlackGriffon' } as const

const ROUTE_MODES = [
  {
    id: 'collection',
    icon: Boxes,
    titleKey: 'landing.routes.collection.title',
    descriptionKey: 'landing.routes.collection.description',
    parents: [
      { palId: ANUBIS_REAL_PARENTS.a, labelKey: 'landing.tree.collection', badgeKey: 'landing.tree.owned' },
      { palId: ANUBIS_REAL_PARENTS.b, labelKey: 'landing.tree.collection', badgeKey: 'landing.tree.owned' },
    ],
    stats: { generations: 4, steps: 6, difficultyKey: 'landing.difficulty.none' },
  },
  {
    id: 'easiest',
    icon: Compass,
    titleKey: 'landing.routes.easiest.title',
    descriptionKey: 'landing.routes.easiest.description',
    parents: [
      { palId: ANUBIS_REAL_PARENTS.a, labelKey: 'landing.tree.capture' },
      { palId: ANUBIS_REAL_PARENTS.b, labelKey: 'landing.tree.capture' },
    ],
    stats: { generations: 6, steps: 9, difficultyKey: 'landing.difficulty.low' },
  },
  {
    id: 'fastest',
    icon: Zap,
    titleKey: 'landing.routes.fastest.title',
    descriptionKey: 'landing.routes.fastest.description',
    parents: [
      { palId: ANUBIS_REAL_PARENTS.a, labelKey: 'landing.tree.collection', badgeKey: 'landing.tree.owned' },
      { palId: ANUBIS_REAL_PARENTS.b, labelKey: 'landing.tree.capture', badgeKey: 'landing.tree.hardCapture' },
    ],
    stats: { generations: 3, steps: 5, difficultyKey: 'landing.difficulty.high' },
  },
] as const satisfies readonly {
  id: string
  icon: typeof Boxes
  titleKey: TranslationKey
  descriptionKey: TranslationKey
  parents: { palId: string; labelKey: TranslationKey; badgeKey?: TranslationKey }[]
  stats: { generations: number; steps: number; difficultyKey: TranslationKey }
}[]

/** Coleccion de ejemplo de Collection Intelligence: 3 Pals que ya estaban en la caja + 1 recien anadido (Bushi), cuya llegada es la que explica el antes/despues. */
const COLLECTION_BASE = ['CaptainPenguin', 'LazyDragon', 'Carbunclo']
const COLLECTION_ADDED = 'Ronin'

const TOOLS = [
  { icon: Database, titleKey: 'nav.pals', descriptionKey: 'landing.tools.pals.description', path: '/pals', kind: 'route' } as const,
  { icon: Crown, titleKey: 'nav.tiers', descriptionKey: 'landing.tools.tiers.description', path: '/tiers', kind: 'route' } as const,
  { icon: Swords, titleKey: 'landing.tools.multi.title', descriptionKey: 'landing.tools.multi.description', kind: 'launch' } as const,
  { icon: GitCompareArrows, titleKey: 'landing.tools.routes.title', descriptionKey: 'landing.tools.routes.description', kind: 'launch' } as const,
  { icon: Zap, titleKey: 'nav.quickPath', descriptionKey: 'landing.tools.quickPath.description', kind: 'quick' } as const,
  { icon: Boxes, titleKey: 'landing.tools.projects.title', descriptionKey: 'landing.tools.projects.description', kind: 'launch' } as const,
]

const PALDEX_PREVIEW = ['Anubis', 'JetDragon', 'BlackGriffon']

/** Combat/monturas/3 trabajos reales -tal cual pide el brief, cubriendo tipos distintos de rol. */
const TIER_SHOWCASE_TABS = [
  { categoryId: 'combat-power', labelKey: 'landing.tierShowcase.combat' },
  { categoryId: 'work-Mining', labelKey: 'work.Mining' },
  { categoryId: 'work-Handiwork', labelKey: 'work.Handiwork' },
  { categoryId: 'work-Kindling', labelKey: 'work.Kindling' },
  { categoryId: 'mount-ground', labelKey: 'landing.tierShowcase.mount' },
  { categoryId: 'work-Transporting', labelKey: 'work.Transporting' },
] as const

const BUILD_ADVISOR_EXAMPLE_PAL = 'Anubis'

const HOW_STEPS = [
  { number: '01', titleKey: 'landing.how.one.title', descriptionKey: 'landing.how.one.description' },
  { number: '02', titleKey: 'landing.how.two.title', descriptionKey: 'landing.how.two.description' },
  { number: '03', titleKey: 'landing.how.three.title', descriptionKey: 'landing.how.three.description' },
] as const

const FAQS = [
  { id: 'first', questionKey: 'landing.faq.first.question', answerKey: 'landing.faq.first.answer' },
  { id: 'offline', questionKey: 'landing.faq.offline.question', answerKey: 'landing.faq.offline.answer' },
  { id: 'collection', questionKey: 'landing.faq.collection.question', answerKey: 'landing.faq.collection.answer' },
] as const

export function LandingPage(props: LandingPageProps) {
  const mobile = useMobileLayout()
  return mobile ? <MobileLandingPage {...props} /> : <DesktopLandingPage {...props} />
}

function DesktopLandingPage({ onLaunch, onLoadDemo, onOpenQuick, onNavigate }: LandingPageProps) {
  const t = useT()
  const db = loadDatabase()
  const { dispatch } = usePlannerStore()

  const [heroTarget, setHeroTarget] = useState<string | null>(null)
  const [routeMode, setRouteMode] = useState<(typeof ROUTE_MODES)[number]['id']>('collection')
  const activeRoute = ROUTE_MODES.find((mode) => mode.id === routeMode) ?? ROUTE_MODES[0]

  const startBreeding = (palId?: string | null) => {
    const target = palId ?? heroTarget
    if (target) {
      dispatch({ type: 'setTarget', palId: target })
      track('target_selected', { source: 'landing_hero' })
    }
    onLaunch()
  }

  const [routesRef, routesVisible] = useReveal<HTMLElement>()
  const [collectionRef, collectionVisible] = useReveal<HTMLElement>()
  const [moreRef, moreVisible] = useReveal<HTMLElement>()
  const [tierRef, tierVisible] = useReveal<HTMLElement>()
  const [advisorRef, advisorVisible] = useReveal<HTMLElement>()
  const [howRef, howVisible] = useReveal<HTMLElement>()
  const [guideRef, guideVisible] = useReveal<HTMLElement>()
  const [ctaRef, ctaVisible] = useReveal<HTMLElement>()
  const [faqRef, faqVisible] = useReveal<HTMLElement>()

  return (
    <main className="landing-page">
      <a href="#landing-hero" className="skip-link">{t('layout.skipLink')}</a>
      <LandingNav onLaunch={onLaunch} onOpenQuick={onOpenQuick} onNavigate={onNavigate} />

      <HeroSection
        heroTarget={heroTarget}
        onHeroTargetChange={setHeroTarget}
        onStartBreeding={startBreeding}
        onLoadDemo={onLoadDemo}
        onNavigate={onNavigate}
        onOpenQuick={onOpenQuick}
      />

      <TrustStrip />

      <section ref={routesRef} className={cn('landing-section landing-routes reveal', routesVisible && 'is-in')} aria-labelledby="routes-title">
        <div className="landing-section__heading">
          <span>{t('landing.routes.eyebrow')}</span>
          <h2 id="routes-title">{t('landing.routes.title')}</h2>
        </div>
        <div className="landing-routes__layout">
          <div className="landing-routes__tabs" role="tablist" aria-label={t('landing.routes.title')}>
            {ROUTE_MODES.map((mode) => (
              <button
                key={mode.id}
                type="button"
                role="tab"
                aria-selected={routeMode === mode.id}
                className={cn('landing-routes__tab', routeMode === mode.id && 'is-active')}
                onClick={() => setRouteMode(mode.id)}
              >
                <mode.icon aria-hidden="true" />
                <span>
                  <strong>{t(mode.titleKey)}</strong>
                  <small>{t(mode.descriptionKey)}</small>
                </span>
              </button>
            ))}
          </div>
          <div className="landing-routes__preview">
            <LandingMiniTree key={routeMode} targetPalId="Anubis" parents={[...activeRoute.parents]} />
            <dl className="landing-routes__compare">
              <div><dt>{t('landing.routes.compare.generations')}</dt><dd>{activeRoute.stats.generations}</dd></div>
              <div><dt>{t('landing.routes.compare.steps')}</dt><dd>{activeRoute.stats.steps}</dd></div>
              <div><dt>{t('landing.routes.compare.difficulty')}</dt><dd>{t(activeRoute.stats.difficultyKey)}</dd></div>
            </dl>
            <span className="landing-routes__example-tag">{t('landing.exampleTag')}</span>
          </div>
        </div>
      </section>

      <section id="collection-intelligence" ref={collectionRef} className={cn('landing-section landing-collection reveal', collectionVisible && 'is-in')} aria-labelledby="collection-title">
        <div className="landing-section__heading">
          <span>{t('landing.collection.eyebrow')}</span>
          <h2 id="collection-title">{t('landing.collection.title')}</h2>
        </div>
        <div className="landing-collection__grid">
          <div className="landing-collection__panel">
            <h3>{t('landing.collection.yourBox')}</h3>
            <div className="landing-collection__cards">
              {COLLECTION_BASE.map((palId, index) => (
                <div key={palId} className="landing-collection__card" style={{ '--i': index } as CSSProperties}>
                  <LandingTcgCard palId={palId} size={118} compact owned onNavigate={onNavigate} />
                </div>
              ))}
              <div className="landing-collection__card landing-collection__card--added" style={{ '--i': COLLECTION_BASE.length } as CSSProperties}>
                <span className="landing-collection__event"><PlusCircle aria-hidden="true" />{t('landing.collection.event', { pal: palName(db.palById.get(COLLECTION_ADDED)) })}</span>
                <LandingTcgCard palId={COLLECTION_ADDED} size={118} compact owned onNavigate={onNavigate} />
              </div>
            </div>
          </div>
          <div className="landing-collection__compare">
            <div className="landing-collection__before">
              <span className="landing-collection__badge">{t('landing.collection.before')}</span>
              <ul>
                <li><b>6</b>{t('landing.collection.generations')}</li>
                <li><b>11.4</b>{t('landing.collection.eggs')}</li>
                <li><b>3</b>{t('landing.collection.captures')}</li>
              </ul>
            </div>
            <ArrowRight className="landing-collection__arrow" aria-hidden="true" />
            <div className="landing-collection__after">
              <span className="landing-collection__badge landing-collection__badge--after">{t('landing.collection.after')}</span>
              <ul>
                <li><b>4</b>{t('landing.collection.generations')}</li>
                <li><b>7.2</b>{t('landing.collection.eggs')}</li>
                <li><b>1</b>{t('landing.collection.captures')}</li>
              </ul>
            </div>
          </div>
        </div>
        <p className="landing-collection__note">{t('landing.collection.explanation')}<span className="landing-routes__example-tag">{t('landing.exampleTag')}</span></p>
      </section>

      <section ref={moreRef} className={cn('landing-section landing-section--tight landing-more reveal', moreVisible && 'is-in')} aria-labelledby="more-title">
        <div className="landing-section__heading">
          <span>{t('landing.more.eyebrow')}</span>
          <h2 id="more-title">{t('landing.more.title')}</h2>
        </div>
        <ul className="landing-tools">
          {TOOLS.map((tool, index) => (
            <li key={tool.titleKey} style={{ '--i': index } as CSSProperties}>
              <a
                href={tool.kind === 'route' ? tool.path : tool.kind === 'quick' ? '/rapido' : '/planner'}
                onClick={(event) => {
                  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
                  event.preventDefault()
                  if (tool.kind === 'route') onNavigate(tool.path)
                  else if (tool.kind === 'quick') onOpenQuick()
                  else onLaunch()
                }}
              >
                <tool.icon aria-hidden="true" />
                <span><strong>{t(tool.titleKey)}</strong><small>{t(tool.descriptionKey)}</small></span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className="landing-section landing-section--tight landing-paldex" aria-labelledby="paldex-title">
        <div className="landing-section__heading">
          <span>{t('landing.paldex.eyebrow')}</span>
          <h2 id="paldex-title">{t('landing.paldex.title')}</h2>
          <p>{t('landing.paldex.description', { count: db.mechanics.counts.pals })}</p>
        </div>
        <ul className="landing-paldex__cards">
          {PALDEX_PREVIEW.map((palId, index) => (
            <li key={palId} className="landing-paldex__card-slot" style={{ '--i': index } as CSSProperties}>
              {/* compact: el modo completo (filas de trabajo + pasivas + panel) se lee como texto borroso a
                  este tamano -el compacto son 4 pasivas grandes, mismo componente, mucho mas legible aca. */}
              <LandingTcgCard palId={palId} size={220} compact onNavigate={onNavigate} />
            </li>
          ))}
        </ul>
        <a
          href="/pals"
          className="landing-section__cta"
          onClick={(event) => { if (event.defaultPrevented || event.button !== 0) return; event.preventDefault(); onNavigate('/pals') }}
        >
          {t('landing.paldex.cta')}<ChevronRight aria-hidden="true" />
        </a>
      </section>

      <section ref={tierRef} className={cn('landing-section landing-section--tight reveal', tierVisible && 'is-in')} aria-labelledby="tier-title">
        <div className="landing-section__heading">
          <span>{t('landing.tierShowcase.eyebrow')}</span>
          <h2 id="tier-title">{t('landing.tierShowcase.title')}</h2>
        </div>
        <TierShowcase onNavigate={onNavigate} />
      </section>

      <section id="build-advisor" ref={advisorRef} className={cn('landing-section landing-section--tight landing-advisor reveal', advisorVisible && 'is-in')} aria-labelledby="advisor-title">
        <div className="landing-section__heading">
          <span>{t('landing.advisorShowcase.eyebrow')}</span>
          <h2 id="advisor-title">{t('landing.advisorShowcase.title')}</h2>
        </div>
        <BuildAdvisorShowcase onLaunch={onLaunch} />
      </section>

      <section ref={howRef} className={cn('landing-section landing-section--how reveal', howVisible && 'is-in')} aria-labelledby="how-title">
        <div className="landing-section__heading">
          <span>{t('landing.howEyebrow')}</span>
          <h2 id="how-title">{t('landing.howTitle')}</h2>
        </div>
        <ol className="landing-how">
          <li style={{ '--i': 0 } as CSSProperties}>
            <b>{HOW_STEPS[0].number}</b>
            <div>
              <strong>{t(HOW_STEPS[0].titleKey)}</strong>
              <p>{t(HOW_STEPS[0].descriptionKey)}</p>
              <div className="landing-how__visual landing-how__visual--picker">
                <PalCombobox value={null} onChange={() => {}} placeholder={t('landing.hero.searchPlaceholder')} size="sm" />
              </div>
            </div>
          </li>
          <li style={{ '--i': 1 } as CSSProperties}>
            <b>{HOW_STEPS[1].number}</b>
            <div>
              <strong>{t(HOW_STEPS[1].titleKey)}</strong>
              <p>{t(HOW_STEPS[1].descriptionKey)}</p>
              <ul className="landing-how__visual landing-how__visual--collection">
                {['CaptainPenguin', 'Ronin'].map((palId) => <li key={palId}><PalIcon palId={palId} size={30} /></li>)}
                <li className="landing-how__visual-add" aria-hidden="true">+</li>
              </ul>
            </div>
          </li>
          <li style={{ '--i': 2 } as CSSProperties}>
            <b>{HOW_STEPS[2].number}</b>
            <div>
              <strong>{t(HOW_STEPS[2].titleKey)}</strong>
              <p>{t(HOW_STEPS[2].descriptionKey)}</p>
              <div className="landing-how__visual">
                <LandingMiniTree targetPalId="Anubis" parents={[{ palId: ANUBIS_REAL_PARENTS.a, labelKey: 'landing.tree.collection' }, { palId: ANUBIS_REAL_PARENTS.b, labelKey: 'landing.tree.collection' }]} />
              </div>
            </div>
          </li>
        </ol>
      </section>

      <section id="guide" ref={guideRef} className={cn('landing-section landing-guide reveal', guideVisible && 'is-in')} aria-labelledby="guide-title">
        <div className="landing-section__heading">
          <span className="landing-guide__badge"><span className="landing-guide__dot" aria-hidden="true" />{t('landing.guide.comingSoon')}</span>
          <h2 id="guide-title">{t('landing.guide.title')}</h2>
          <p>{t('landing.guide.description')}</p>
        </div>
        <div className="landing-guide__preview" aria-hidden="true">
          <div className="landing-guide__bubble landing-guide__bubble--player">{t('landing.guide.question')}</div>
          <div className="landing-guide__bubble landing-guide__bubble--guide">
            <PalaxisMark />
            <p>{t('landing.guide.answer')}</p>
            <a
              href="/pals/anubis"
              onClick={(event) => { if (event.defaultPrevented || event.button !== 0) return; event.preventDefault(); onNavigate('/pals/anubis') }}
            >
              {t('landing.guide.viewPal')}<ChevronRight aria-hidden="true" />
            </a>
          </div>
        </div>
      </section>

      <section id="final-cta" ref={ctaRef} className={cn('landing-cta reveal', ctaVisible && 'is-in')} aria-labelledby="landing-cta-title">
        <span className="landing-kicker"><Sparkles aria-hidden="true" />{t('landing.ctaEyebrow')}</span>
        <h2 id="landing-cta-title">{t('landing.ctaTitle')}</h2>
        <p>{t('landing.ctaDescription')}</p>
        <div className="landing-cta__actions">
          <Button size="lg" onClick={onLaunch}>{t('landing.hero.primaryCta')}<ChevronRight aria-hidden="true" /></Button>
          <Button size="lg" variant="outline" onClick={onLoadDemo}>{t('landing.hero.secondaryCta')}</Button>
        </div>
      </section>

      <section ref={faqRef} className={cn('landing-section landing-faq reveal', faqVisible && 'is-in')} aria-labelledby="faq-title">
        <div className="landing-section__heading"><span>{t('landing.faqEyebrow')}</span><h2 id="faq-title">{t('landing.faqTitle')}</h2></div>
        <div>{FAQS.map(({ id, questionKey, answerKey }) => <details key={id}><summary>{t(questionKey)}<ChevronRight aria-hidden="true" /></summary><p>{t(answerKey)}</p></details>)}</div>
      </section>

      <LandingFooter onNavigate={onNavigate} onOpenQuick={onOpenQuick} />
      <MobileStickyCta onStartBreeding={() => startBreeding()} />
    </main>
  )
}

/**
 * Phone-first landing with the same message and navigation but a deliberately
 * small render budget. It keeps two real TCG cards as the product's visual
 * signature, while tier calculations, comparison scenes, demo trees and ten
 * reveal observers remain desktop-only.
 */
function MobileLandingPage({ onLaunch, onLoadDemo, onOpenQuick, onNavigate }: LandingPageProps) {
  const t = useT()
  const db = loadDatabase()
  const { dispatch } = usePlannerStore()
  const [target, setTarget] = useState<string | null>(null)

  const startBreeding = (palId?: string | null) => {
    const selected = palId ?? target
    if (selected) {
      dispatch({ type: 'setTarget', palId: selected })
      track('target_selected', { source: 'landing_mobile' })
    }
    onLaunch()
  }

  return (
    <main className="landing-page landing-page--mobile-lite">
      <a href="#landing-mobile-hero" className="skip-link">{t('layout.skipLink')}</a>
      <LandingNav onLaunch={onLaunch} onOpenQuick={onOpenQuick} onNavigate={onNavigate} />

      <section id="landing-mobile-hero" className="landing-mobile-hero" aria-labelledby="landing-mobile-title">
        <div className="landing-mobile-hero__copy">
          <span className="landing-kicker"><WifiOff aria-hidden="true" />{t('landing.kicker')}</span>
          <h1 id="landing-mobile-title">{t('landing.titleA')} <em>{t('landing.titleB')}</em></h1>
          <p>{t('landing.description')}</p>
        </div>

        <div className="landing-mobile-hero__cards" aria-label={t('landing.paldex.title')}>
          <div className="landing-mobile-hero__card landing-mobile-hero__card--back">
            <LandingTcgCard
              palId={target === 'BlackGriffon' ? 'JetDragon' : 'BlackGriffon'}
              size={142}
              compact
              owned
              onNavigate={onNavigate}
            />
          </div>
          <div className="landing-mobile-hero__card landing-mobile-hero__card--front">
            <LandingTcgCard
              palId={target ?? 'Anubis'}
              size={168}
              selected
              onNavigate={onNavigate}
            />
          </div>
          <span className="landing-mobile-hero__deck-label"><Sparkles aria-hidden="true" />{t('landing.paldex.eyebrow')}</span>
        </div>

        <div className="landing-mobile-hero__selector">
          <label htmlFor="landing-mobile-target">{t('landing.hero.selectorLabel')}</label>
          <PalCombobox
            value={target}
            onChange={setTarget}
            placeholder={t('landing.hero.searchPlaceholder')}
            triggerId="landing-mobile-target"
          />
          <Button size="lg" className="w-full" onClick={() => startBreeding()} disabled={!target}>
            {t('landing.hero.findRoute')}<ArrowRight aria-hidden="true" />
          </Button>
          <ul className="landing-mobile-hero__popular" aria-label={t('landing.hero.popularLabel')}>
            {POPULAR_TARGETS.slice(0, 3).map((palId) => (
              <li key={palId}>
                <button type="button" onClick={() => startBreeding(palId)}>
                  <PalIcon palId={palId} size={24} bare />{palName(db.palById.get(palId))}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="landing-mobile-hero__actions">
          <Button variant="outline" onClick={onLaunch}>{t('landing.hero.primaryCta')}<ChevronRight aria-hidden="true" /></Button>
          <Button variant="ghost" onClick={onLoadDemo}>{t('landing.hero.secondaryCta')}</Button>
        </div>
      </section>

      <TrustStrip />

      <section className="landing-mobile-section" aria-labelledby="landing-mobile-tools-title">
        <div className="landing-section__heading">
          <span>{t('landing.more.eyebrow')}</span>
          <h2 id="landing-mobile-tools-title">{t('landing.more.title')}</h2>
        </div>
        <ul className="landing-mobile-tools">
          {TOOLS.filter((_, index) => index === 0 || index === 1 || index === 3 || index === 4).map((tool) => (
            <li key={tool.titleKey}>
              <a
                href={tool.kind === 'route' ? tool.path : tool.kind === 'quick' ? '/rapido' : '/planner'}
                onClick={(event) => {
                  if (event.defaultPrevented || event.button !== 0) return
                  event.preventDefault()
                  if (tool.kind === 'route') onNavigate(tool.path)
                  else if (tool.kind === 'quick') onOpenQuick()
                  else onLaunch()
                }}
              >
                <tool.icon aria-hidden="true" />
                <span><strong>{t(tool.titleKey)}</strong><small>{t(tool.descriptionKey)}</small></span>
                <ChevronRight aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section id="guide" className="landing-mobile-section" aria-labelledby="how-title">
        <div className="landing-section__heading">
          <span>{t('landing.howEyebrow')}</span>
          <h2 id="how-title">{t('landing.howTitle')}</h2>
        </div>
        <ol className="landing-mobile-how">
          {HOW_STEPS.map((step) => (
            <li key={step.number}>
              <b>{step.number}</b>
              <div><strong>{t(step.titleKey)}</strong><p>{t(step.descriptionKey)}</p></div>
            </li>
          ))}
        </ol>
      </section>

      <section className="landing-mobile-cta" aria-labelledby="landing-mobile-cta-title">
        <span className="landing-kicker"><Sparkles aria-hidden="true" />{t('landing.ctaEyebrow')}</span>
        <h2 id="landing-mobile-cta-title">{t('landing.ctaTitle')}</h2>
        <p>{t('landing.ctaDescription')}</p>
        <Button size="lg" className="w-full" onClick={onLaunch}>{t('landing.hero.primaryCta')}<ChevronRight aria-hidden="true" /></Button>
      </section>

      <section className="landing-mobile-section landing-mobile-faq" aria-labelledby="landing-mobile-faq-title">
        <div className="landing-section__heading"><span>{t('landing.faqEyebrow')}</span><h2 id="landing-mobile-faq-title">{t('landing.faqTitle')}</h2></div>
        <div>{FAQS.map(({ id, questionKey, answerKey }) => <details key={id}><summary>{t(questionKey)}<ChevronRight aria-hidden="true" /></summary><p>{t(answerKey)}</p></details>)}</div>
      </section>

      <LandingFooter onNavigate={onNavigate} onOpenQuick={onOpenQuick} />
    </main>
  )
}

/* ------------------------------------------------------------------ Nav */

function LandingNav({ onLaunch, onOpenQuick, onNavigate }: { onLaunch: () => void; onOpenQuick: () => void; onNavigate: (path: string) => void }) {
  const t = useT()
  const [lang, setLang] = useLang()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        setScrolled(window.scrollY > 12)
        ticking = false
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenuOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])

  const handleLink = (event: React.MouseEvent, link: (typeof NAV_LINKS)[number]) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    setMenuOpen(false)
    if (link.kind === 'launch') onLaunch()
    else if (link.kind === 'quick') onOpenQuick()
    else if (link.kind === 'anchor') document.querySelector(link.path)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    else onNavigate(link.path)
  }

  return (
    <header className={cn('landing-nav', scrolled && 'landing-nav--scrolled')}>
      <div className="landing-nav__inner">
        <button type="button" className="landing-brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <span><PalaxisMark /></span><PalaxisWordmark />
        </button>
        <nav className="landing-nav__links" aria-label={t('landing.navigation')}>
          {NAV_LINKS.map((link) => {
            const Icon = link.icon
            return (
              <a key={link.path} href={localizedPath(link.kind === 'launch' ? '/planner' : link.path, lang)} onClick={(event) => handleLink(event, link)}>
                <Icon aria-hidden="true" />
                {t(link.labelKey)}
              </a>
            )
          })}
        </nav>
        <button
          type="button"
          className="landing-nav__language"
          aria-label={t(lang === 'es' ? 'header.langToggle' : 'header.langToggleToEs')}
          title={t(lang === 'es' ? 'header.langToggle' : 'header.langToggleToEs')}
          onClick={() => {
            const next = lang === 'es' ? 'en' : 'es'
            const nextPath = localizedPath(stripLocalePrefix(window.location.pathname), next)
            window.history.replaceState({}, '', `${nextPath}${window.location.search}${window.location.hash}`)
            setLang(next)
            window.dispatchEvent(new PopStateEvent('popstate'))
          }}
        >
          <Languages aria-hidden="true" />
          <span className={lang === 'es' ? 'is-active' : undefined}>ES</span>
          <i aria-hidden="true">/</i>
          <span className={lang === 'en' ? 'is-active' : undefined}>EN</span>
        </button>
        <Button size="sm" className="landing-nav__launch" onClick={onLaunch}>{t('landing.nav.launch')}<ChevronRight aria-hidden="true" /></Button>
        <button
          type="button"
          className="landing-nav__toggle"
          aria-expanded={menuOpen}
          aria-controls="landing-mobile-menu"
          aria-label={t(menuOpen ? 'landing.nav.closeMenu' : 'landing.nav.openMenu')}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
      </div>
      <nav id="landing-mobile-menu" className={cn('landing-nav__mobile', menuOpen && 'is-open')} aria-label={t('landing.navigation')} hidden={!menuOpen}>
        {NAV_LINKS.map((link) => {
          const Icon = link.icon
          return (
            <a key={link.path} href={localizedPath(link.kind === 'launch' ? '/planner' : link.path, lang)} onClick={(event) => handleLink(event, link)}>
              <Icon aria-hidden="true" />
              {t(link.labelKey)}
            </a>
          )
        })}
        <Button size="lg" className="w-full" onClick={() => { setMenuOpen(false); onLaunch() }}>{t('landing.nav.launch')}<ChevronRight aria-hidden="true" /></Button>
      </nav>
    </header>
  )
}

/* ----------------------------------------------------------------- Hero */

function HeroSection({
  heroTarget,
  onHeroTargetChange,
  onStartBreeding,
  onLoadDemo,
  onNavigate,
  onOpenQuick,
}: {
  heroTarget: string | null
  onHeroTargetChange: (palId: string | null) => void
  onStartBreeding: (palId?: string | null) => void
  onLoadDemo: () => void
  onNavigate: (path: string) => void
  onOpenQuick: () => void
}) {
  const t = useT()
  const db = loadDatabase()

  return (
    <section id="landing-hero" className="landing-hero" aria-labelledby="landing-title">
      <div className="landing-hero__copy">
        <PalaxisMark className="landing-hero__mark" />
        <span className="landing-kicker"><WifiOff aria-hidden="true" />{t('landing.kicker')}</span>
        <h1 id="landing-title">{t('landing.titleA')} <em>{t('landing.titleB')}</em></h1>
        <p>{t('landing.description')}</p>

        <div className="landing-hero__selector">
          <label htmlFor="landing-target-search" className="landing-hero__selector-label">{t('landing.hero.selectorLabel')}</label>
          <div className="landing-hero__selector-row">
            <PalCombobox
              value={heroTarget}
              onChange={onHeroTargetChange}
              placeholder={t('landing.hero.searchPlaceholder')}
              triggerId="landing-target-search"
              className="landing-hero__combobox"
            />
            <Button onClick={() => onStartBreeding()} disabled={!heroTarget}>
              {t('landing.hero.findRoute')}<ArrowRight aria-hidden="true" />
            </Button>
          </div>
          <ul className="landing-hero__popular" aria-label={t('landing.hero.popularLabel')}>
            {POPULAR_TARGETS.map((palId) => (
              <li key={palId}>
                <button type="button" onClick={() => onStartBreeding(palId)}>
                  <PalIcon palId={palId} size={26} bare />{palName(db.palById.get(palId))}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="landing-hero__actions landing-hero__actions--secondary">
          <Button variant="outline" onClick={() => onStartBreeding()}>{t('landing.hero.primaryCta')}<ChevronRight aria-hidden="true" /></Button>
          <Button variant="ghost" onClick={onLoadDemo}>{t('landing.hero.secondaryCta')}</Button>
        </div>

        <nav className="landing-hero__tabs" aria-label={t('landing.navigation')}>
          {[
            { path: '/pals', labelKey: 'nav.pals' as const, icon: Database },
            { path: '/tiers', labelKey: 'nav.tiers' as const, icon: Crown },
            { path: '/rapido', labelKey: 'nav.quickPath' as const, icon: Zap },
            { path: '/feedback', labelKey: 'nav.feedback' as const, icon: MessageCircle },
          ].map(({ path, labelKey, icon: Icon }) => (
            <a
              key={path}
              href={path}
              className="landing-hero__tab"
              onClick={(event) => {
                if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
                event.preventDefault()
                if (path === '/rapido') onOpenQuick()
                else onNavigate(path)
              }}
            >
              <Icon aria-hidden="true" />{t(labelKey)}
            </a>
          ))}
        </nav>
      </div>

      <div className="landing-hero__visual" aria-label={t('landing.demoLabel')}>
        <div className="landing-demo__ambient" aria-hidden="true" />
        <div className="landing-hero__visual-network" aria-hidden="true" />
        <div className="landing-hero__visual-eyebrow">
          <span className="landing-demo__lens" aria-hidden="true"><span /></span>
          {t('landing.exampleProject')}
        </div>
        <LandingMiniTree
          targetPalId="Anubis"
          parents={[
            { palId: ANUBIS_REAL_PARENTS.a, labelKey: 'landing.tree.collection' },
            { palId: ANUBIS_REAL_PARENTS.b, labelKey: 'landing.tree.capture' },
          ]}
          useCards
          onNavigate={onNavigate}
        />
      </div>
    </section>
  )
}

/* ------------------------------------------------------------- Trust strip */

/** Fusiona el antiguo bloque "Credibilidad de los datos" en la franja de confianza: mismos datos generados (mechanics.counts), sin repetir seccion. */
function TrustStrip() {
  const t = useT()
  const { mechanics } = loadDatabase()
  const items = [
    { icon: Database, value: mechanics.counts.pals, labelKey: 'landing.trust.pals' as const },
    { icon: Egg, value: mechanics.counts.verifiedPairs.toLocaleString('en-US'), labelKey: 'landing.trust.pairs' as const },
    { icon: GitCompareArrows, value: ROUTE_MODES.length, labelKey: 'landing.trust.routes' as const },
    { icon: WifiOff, value: '', labelKey: 'landing.trust.offline' as const },
  ]
  return (
    <section className="landing-trust" aria-label={t('landing.trust.label')}>
      <div className="landing-trust__grid">
        {items.map(({ icon: Icon, value, labelKey }) => (
          <div key={labelKey} className="landing-trust__item">
            <Icon aria-hidden="true" />
            {value !== '' ? <strong>{value}</strong> : null}
            <span>{t(labelKey)}</span>
          </div>
        ))}
      </div>
      <div className="landing-trust__footer">
        <p className="landing-trust__statement">{t('landing.trust.statement')}</p>
        <a
          href="#how-title"
          className="landing-trust__cta"
          onClick={(event) => { event.preventDefault(); document.getElementById('how-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}
        >
          {t('landing.trust.cta')}<ChevronRight aria-hidden="true" />
        </a>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------- Tier showcase */

function TierShowcase({ onNavigate }: { onNavigate: (path: string) => void }) {
  const t = useT()
  const [activeId, setActiveId] = useState<string>(TIER_SHOWCASE_TABS[0].categoryId)
  const category = getTierCategory(activeId)
  const entries = useMemo(() => getTierList(activeId), [activeId])
  const topLetter = category ? bestLetterWithEntries(category, entries) : null

  return (
    <div className="landing-tier-showcase">
      <div className="landing-tier-showcase__tabs" role="tablist">
        {TIER_SHOWCASE_TABS.map((tab) => (
          <button key={tab.categoryId} type="button" role="tab" aria-selected={activeId === tab.categoryId} className={cn(activeId === tab.categoryId && 'is-active')} onClick={() => setActiveId(tab.categoryId)}>
            {t(tab.labelKey)}
          </button>
        ))}
      </div>
      {category && topLetter && (
        <div className="landing-tier-showcase__band">
          <span className="landing-tier-showcase__letter">{topLetter.letter}</span>
          <ul>
            {topLetter.entries.slice(0, 6).map((entry) => {
              const href = `/pals/${palSlug(entry.pal)}`
              return (
                <li key={entry.pal.id}>
                  <a href={href} onClick={(event) => { if (event.defaultPrevented || event.button !== 0) return; event.preventDefault(); onNavigate(href) }}>
                    <PalIcon palId={entry.pal.id} size={40} bare /><span>{palName(entry.pal)}</span>
                  </a>
                </li>
              )
            })}
          </ul>
        </div>
      )}
      <a
        href="/tiers"
        className="landing-section__cta landing-section__cta--solid"
        onClick={(event) => { if (event.defaultPrevented || event.button !== 0) return; event.preventDefault(); onNavigate('/tiers') }}
      >
        {t('landing.tierShowcase.cta')}<ChevronRight aria-hidden="true" />
      </a>
    </div>
  )
}

/** La mejor banda con entradas reales (algunas categorias, como Best Base Pals, no llenan la banda mas alta para todos los tipos). */
function bestLetterWithEntries(category: TierCategory, entries: ReturnType<typeof getTierList>) {
  for (let tierNumber = category.letters.length; tierNumber >= 1; tierNumber--) {
    const matches = entries.filter((entry) => entry.tier === tierNumber)
    if (matches.length > 0) return { letter: tierLetter(category, tierNumber), entries: matches }
  }
  return null
}

/* ------------------------------------------------------ Build advisor showcase */

function BuildAdvisorShowcase({ onLaunch }: { onLaunch: () => void }) {
  const t = useT()
  const db = loadDatabase()
  const pal = db.palById.get(BUILD_ADVISOR_EXAMPLE_PAL)
  const build = getBuildsFor(BUILD_ADVISOR_EXAMPLE_PAL).find((entry) => entry.role === 'Base Worker') ?? getBuildsFor(BUILD_ADVISOR_EXAMPLE_PAL)[0]
  if (!pal || !build) return null
  const passives = build.passives.slice(0, 4).map((id) => db.passiveById.get(id)).filter((passive): passive is NonNullable<typeof passive> => !!passive)

  return (
    <div className="landing-advisor__card">
      <div className="landing-advisor__pal">
        <PalIcon palId={pal.id} size={88} bare />
        <div>
          <strong>{palName(pal)}</strong>
          <span>{build.role}</span>
        </div>
      </div>
      <div className="landing-advisor__passives">
        {passives.map((passive) => <PassiveBadge key={passive.id} passive={passive} />)}
      </div>
      <Button onClick={onLaunch}>{t('landing.advisorShowcase.cta')}<ChevronRight aria-hidden="true" /></Button>
    </div>
  )
}

/* -------------------------------------------------------------- Footer */

function LandingFooter({ onNavigate, onOpenQuick }: { onNavigate: (path: string) => void; onOpenQuick: () => void }) {
  const t = useT()
  const columns: { titleKey: TranslationKey; links: { labelKey: TranslationKey; path?: string; kind: 'route' | 'quick' | 'external' | 'details'; href?: string; bodyKey?: TranslationKey }[] }[] = [
    {
      titleKey: 'landing.footer.tools',
      links: [
        { labelKey: 'nav.breedingPlanner', path: '/planner', kind: 'route' },
        { labelKey: 'nav.pals', path: '/pals', kind: 'route' },
        { labelKey: 'nav.tiers', path: '/tiers', kind: 'route' },
        { labelKey: 'nav.quickPath', kind: 'quick' },
      ],
    },
    {
      titleKey: 'landing.footer.resources',
      links: [
        { labelKey: 'nav.feedback', path: '/feedback', kind: 'route' },
        { labelKey: 'landing.footer.credits', kind: 'external', href: 'https://github.com/isilioabs/palworld-breeding-planner' },
      ],
    },
    {
      titleKey: 'landing.footer.legal',
      links: [
        { labelKey: 'landing.footer.privacy', kind: 'details', bodyKey: 'landing.footer.privacyBody' },
        { labelKey: 'landing.footer.legalNotice', kind: 'details', bodyKey: 'landing.footer.legalBody' },
      ],
    },
  ]

  return (
    <footer className="landing-footer-v2">
      <div className="landing-footer-v2__grid">
        <div className="landing-footer-v2__brand">
          <span className="landing-brand"><span><PalaxisMark /></span><PalaxisWordmark /></span>
          <p>{t('landing.footer')}</p>
        </div>
        {columns.map((column) => (
          <div key={column.titleKey} className="landing-footer-v2__column">
            <h3>{t(column.titleKey)}</h3>
            <ul>
              {column.links.map((link) => (
                <li key={link.labelKey}>
                  {link.kind === 'details' && link.bodyKey ? (
                    <details className="landing-footer-v2__details">
                      <summary>{t(link.labelKey)}</summary>
                      <p>{t(link.bodyKey)}</p>
                    </details>
                  ) : link.kind === 'external' ? (
                    <a href={link.href} target="_blank" rel="noreferrer noopener">{t(link.labelKey)}</a>
                  ) : (
                    <a
                      href={link.kind === 'quick' ? '/rapido' : link.path}
                      onClick={(event) => {
                        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
                        event.preventDefault()
                        if (link.kind === 'quick') onOpenQuick()
                        else if (link.path) onNavigate(link.path)
                      }}
                    >
                      {t(link.labelKey)}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="landing-footer-v2__disclaimer"><BookOpen aria-hidden="true" />{t('landing.footer.disclaimer')}</p>
    </footer>
  )
}

/* --------------------------------------------------------- Mobile sticky CTA */

/**
 * Movil unicamente (oculto por CSS en desktop): aparece cuando el hero ya
 * salio de vista y desaparece cuando el CTA final entra en vista -evita un
 * segundo "Start Breeding" flotando justo encima del real. Dos
 * IntersectionObserver EN VIVO (no el `useReveal` de una sola vez que usa el
 * resto de la pagina) porque necesita reaccionar cada vez que el usuario
 * cruza esos limites, no solo la primera.
 */
function MobileStickyCta({ onStartBreeding }: { onStartBreeding: () => void }) {
  const t = useT()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const hero = document.getElementById('landing-hero')
    const finalCta = document.getElementById('final-cta')
    if (!hero || !finalCta) return

    let heroPassed = false
    let ctaInView = false
    const update = () => setVisible(heroPassed && !ctaInView)

    const heroObserver = new IntersectionObserver(([entry]) => {
      heroPassed = !entry.isIntersecting && entry.boundingClientRect.top < 0
      update()
    })
    const ctaObserver = new IntersectionObserver(([entry]) => {
      ctaInView = entry.isIntersecting
      update()
    })
    heroObserver.observe(hero)
    ctaObserver.observe(finalCta)
    return () => {
      heroObserver.disconnect()
      ctaObserver.disconnect()
    }
  }, [])

  return (
    <div className={cn('landing-sticky-cta', visible && 'is-visible')} aria-hidden={!visible}>
      <Button size="lg" className="w-full" onClick={onStartBreeding} tabIndex={visible ? 0 : -1}>
        {t('landing.hero.primaryCta')}<ArrowRight aria-hidden="true" />
      </Button>
    </div>
  )
}
