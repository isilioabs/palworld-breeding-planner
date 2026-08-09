/**
 * Landing page de Palaxis -unica pagina tocada por este rediseño (ver
 * conversacion: "redesigning ONLY the landing page"). No cambia el shell de
 * la app, el algoritmo de crianza/rutas, el sistema de cartas, la Paldex, el
 * calculo de la Tier List, ni los colores de marca -todo eso se REUSA via
 * datos y componentes reales (getBuildsFor, getTierList, PalIcon,
 * PassiveBadge, PalCombobox, loadDatabase().mechanics), nunca duplicado.
 *
 * Arquitectura de la pagina (de arriba a abajo), pensada para no repetir el
 * mismo contenido dos veces pese a que el brief pide temas que se solapan
 * (breeding intelligence / collection intelligence / build advisor aparecen
 * en varias secciones del brief): el hero + Three Routes + Collection
 * Intelligence YA cubren "breeding inteligente" y "conoce tu coleccion" a
 * fondo, asi que la franja de "3 historias" mas abajo queda deliberadamente
 * compacta (titular + CTA), en vez de repetir el mismo visual tres veces.
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
  Menu,
  MessageCircle,
  Network,
  Sparkles,
  Swords,
  WifiOff,
  X,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PalCombobox } from '@/components/pal-combobox'
import { PalIcon } from '@/components/pal-icon'
import { PalaxisMark } from '@/components/palaxis-mark'
import { PassiveBadge } from '@/components/passive-badge'
import { getBuildsFor } from '@/domain/builds'
import { loadDatabase, palName } from '@/domain/database'
import { palSlug } from '@/domain/slug'
import { getTierCategory, getTierList, tierLetter, type TierCategory } from '@/domain/tier-list'
import { useT } from '@/i18n/language-store'
import type { TranslationKey } from '@/i18n/translations'
import { track } from '@/lib/analytics'
import { useReveal } from '@/lib/use-reveal'
import { cn } from '@/lib/utils'
import { usePlannerStore } from '@/state/planner-store'
import { LandingMiniTree } from './landing-mini-tree'
import { LandingPalCard } from './landing-pal-card'

interface LandingPageProps {
  onLaunch: () => void
  onLoadDemo: () => void
  onOpenQuick: () => void
  /** Navega a una ruta real de la app (Pals, Tier List, Feedback...) sin recargar la pagina. */
  onNavigate: (path: string) => void
}

/** Nav global -rutas reales, crawlables (`<a href>`). "Guides" no tiene pagina propia todavia: ancla a la vitrina de Palaxis Guide de esta misma pagina, no un link inventado. */
const NAV_LINKS = [
  { path: '/planner', labelKey: 'nav.breedingPlanner', kind: 'launch' } as const,
  { path: '/pals', labelKey: 'nav.pals', kind: 'route' } as const,
  { path: '/tiers', labelKey: 'nav.tiers', kind: 'route' } as const,
  { path: '/rapido', labelKey: 'nav.quickPath', kind: 'quick' } as const,
  { path: '#guide', labelKey: 'landing.nav.guides', kind: 'anchor' } as const,
]

const POPULAR_TARGETS = ['Anubis', 'JetDragon', 'BlackGriffon', 'BlackCentaur']

const ROUTE_MODES = [
  {
    id: 'collection',
    icon: Boxes,
    titleKey: 'landing.routes.collection.title',
    descriptionKey: 'landing.routes.collection.description',
    statKey: 'landing.routes.collection.stat',
    parents: [
      { palId: 'CaptainPenguin', labelKey: 'landing.tree.collection' },
      { palId: 'Ronin', labelKey: 'landing.tree.collection' },
    ],
  },
  {
    id: 'easiest',
    icon: Compass,
    titleKey: 'landing.routes.easiest.title',
    descriptionKey: 'landing.routes.easiest.description',
    statKey: 'landing.routes.easiest.stat',
    parents: [
      { palId: 'Carbunclo', labelKey: 'landing.tree.capture' },
      { palId: 'LazyDragon', labelKey: 'landing.tree.capture' },
    ],
  },
  {
    id: 'fastest',
    icon: Zap,
    titleKey: 'landing.routes.fastest.title',
    descriptionKey: 'landing.routes.fastest.description',
    statKey: 'landing.routes.fastest.stat',
    parents: [
      { palId: 'CaptainPenguin', labelKey: 'landing.tree.collection' },
      { palId: 'BlackCentaur', labelKey: 'landing.tree.capture' },
    ],
  },
] as const satisfies readonly { id: string; icon: typeof Boxes; titleKey: TranslationKey; descriptionKey: TranslationKey; statKey: TranslationKey; parents: { palId: string; labelKey: TranslationKey }[] }[]

const STORIES = [
  { icon: Network, titleKey: 'landing.story.breeding.title', descriptionKey: 'landing.story.breeding.description', ctaKey: 'landing.story.breeding.cta', action: 'launch' } as const,
  { icon: Boxes, titleKey: 'landing.story.collection.title', descriptionKey: 'landing.story.collection.description', ctaKey: 'landing.story.collection.cta', action: 'anchor', anchor: '#collection-intelligence' } as const,
  { icon: Sparkles, titleKey: 'landing.story.advisor.title', descriptionKey: 'landing.story.advisor.description', ctaKey: 'landing.story.advisor.cta', action: 'anchor', anchor: '#build-advisor' } as const,
]

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

export function LandingPage({ onLaunch, onLoadDemo, onOpenQuick, onNavigate }: LandingPageProps) {
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
  const [storiesRef, storiesVisible] = useReveal<HTMLElement>()
  const [paldexRef, paldexVisible] = useReveal<HTMLElement>()
  const [tierRef, tierVisible] = useReveal<HTMLElement>()
  const [advisorRef, advisorVisible] = useReveal<HTMLElement>()
  const [credibilityRef, credibilityVisible] = useReveal<HTMLElement>()
  const [howRef, howVisible] = useReveal<HTMLElement>()
  const [guideRef, guideVisible] = useReveal<HTMLElement>()
  const [ctaRef, ctaVisible] = useReveal<HTMLElement>()
  const [faqRef, faqVisible] = useReveal<HTMLElement>()

  return (
    <main className="landing-page">
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
            <LandingMiniTree targetPalId="Anubis" parents={[...activeRoute.parents]} />
            <p className="landing-routes__stat">{t(activeRoute.statKey)}</p>
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
            <ul className="landing-collection__owned">
              {['CaptainPenguin', 'Ronin', 'LazyDragon', 'Carbunclo'].map((palId) => (
                <li key={palId}><PalIcon palId={palId} size={34} /><span>{palName(db.palById.get(palId))}</span></li>
              ))}
            </ul>
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

      <section ref={storiesRef} className={cn('landing-section landing-stories reveal', storiesVisible && 'is-in')} aria-labelledby="stories-title">
        <div className="landing-section__heading">
          <span>{t('landing.stories.eyebrow')}</span>
          <h2 id="stories-title">{t('landing.stories.title')}</h2>
        </div>
        <ul className="landing-stories__grid">
          {STORIES.map((story, index) => (
            <li key={story.titleKey} style={{ '--i': index } as CSSProperties}>
              <story.icon aria-hidden="true" />
              <strong>{t(story.titleKey)}</strong>
              <p>{t(story.descriptionKey)}</p>
              <a
                href={story.action === 'anchor' ? story.anchor : '/planner'}
                className="landing-stories__cta"
                onClick={(event) => {
                  event.preventDefault()
                  if (story.action === 'anchor') document.querySelector(story.anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  else onLaunch()
                }}
              >
                {t(story.ctaKey)}<ChevronRight aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
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

      <section ref={paldexRef} className={cn('landing-section reveal', paldexVisible && 'is-in')} aria-labelledby="paldex-title">
        <div className="landing-section__heading">
          <span>{t('landing.paldex.eyebrow')}</span>
          <h2 id="paldex-title">{t('landing.paldex.title')}</h2>
          <p>{t('landing.paldex.description', { count: db.mechanics.counts.pals })}</p>
        </div>
        <ul className="landing-paldex__grid">
          {PALDEX_PREVIEW.map((palId, index) => (
            <li key={palId} style={{ '--i': index } as CSSProperties}><LandingPalCard palId={palId} onNavigate={onNavigate} /></li>
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

      <section ref={tierRef} className={cn('landing-section reveal', tierVisible && 'is-in')} aria-labelledby="tier-title">
        <div className="landing-section__heading">
          <span>{t('landing.tierShowcase.eyebrow')}</span>
          <h2 id="tier-title">{t('landing.tierShowcase.title')}</h2>
        </div>
        <TierShowcase onNavigate={onNavigate} />
      </section>

      <section id="build-advisor" ref={advisorRef} className={cn('landing-section landing-advisor reveal', advisorVisible && 'is-in')} aria-labelledby="advisor-title">
        <div className="landing-section__heading">
          <span>{t('landing.advisorShowcase.eyebrow')}</span>
          <h2 id="advisor-title">{t('landing.advisorShowcase.title')}</h2>
        </div>
        <BuildAdvisorShowcase onLaunch={onLaunch} />
      </section>

      <section ref={credibilityRef} className={cn('landing-section landing-credibility reveal', credibilityVisible && 'is-in')} aria-labelledby="credibility-title">
        <div className="landing-section__heading">
          <span>{t('landing.credibility.eyebrow')}</span>
          <h2 id="credibility-title">{t('landing.credibility.title')}</h2>
          <p>{t('landing.credibility.description', { pairs: db.mechanics.counts.verifiedPairs.toLocaleString('en-US') })}</p>
        </div>
        <a
          href="#how-title"
          className="landing-section__cta"
          onClick={(event) => { event.preventDefault(); document.getElementById('how-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}
        >
          {t('landing.credibility.cta')}<ChevronRight aria-hidden="true" />
        </a>
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
                <LandingMiniTree targetPalId="Anubis" parents={[{ palId: 'CaptainPenguin', labelKey: 'landing.tree.collection' }, { palId: 'Ronin', labelKey: 'landing.tree.collection' }]} />
              </div>
            </div>
          </li>
        </ol>
      </section>

      <section id="guide" ref={guideRef} className={cn('landing-section landing-guide reveal', guideVisible && 'is-in')} aria-labelledby="guide-title">
        <div className="landing-section__heading">
          <span className="landing-guide__badge">{t('landing.guide.comingSoon')}</span>
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

      <section ref={ctaRef} className={cn('landing-cta reveal', ctaVisible && 'is-in')} aria-labelledby="landing-cta-title">
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
    </main>
  )
}

/* ------------------------------------------------------------------ Nav */

function LandingNav({ onLaunch, onOpenQuick, onNavigate }: { onLaunch: () => void; onOpenQuick: () => void; onNavigate: (path: string) => void }) {
  const t = useT()
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
          <span><PalaxisMark /></span><strong>PALAXIS</strong>
        </button>
        <nav className="landing-nav__links" aria-label={t('landing.navigation')}>
          {NAV_LINKS.map((link) => (
            <a key={link.path} href={link.kind === 'launch' ? '/planner' : link.path} onClick={(event) => handleLink(event, link)}>
              {t(link.labelKey)}
            </a>
          ))}
        </nav>
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
        {NAV_LINKS.map((link) => (
          <a key={link.path} href={link.kind === 'launch' ? '/planner' : link.path} onClick={(event) => handleLink(event, link)}>
            {t(link.labelKey)}
          </a>
        ))}
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
    <section className="landing-hero" aria-labelledby="landing-title">
      <div className="landing-hero__copy">
        <PalaxisMark className="landing-hero__mark" />
        <span className="landing-kicker"><WifiOff aria-hidden="true" />{t('landing.kicker')}</span>
        <h1 id="landing-title">{t('landing.titleA')} <em>{t('landing.titleB')}</em></h1>
        <p>{t('landing.description')}</p>

        <div className="landing-hero__actions">
          <Button size="lg" onClick={() => onStartBreeding()}>{t('landing.hero.primaryCta')}<ChevronRight aria-hidden="true" /></Button>
          <Button size="lg" variant="outline" onClick={onLoadDemo}>{t('landing.hero.secondaryCta')}</Button>
        </div>

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
        <div className="landing-hero__visual-eyebrow">
          <span className="landing-demo__lens" aria-hidden="true"><span /></span>
          {t('landing.exampleProject')}
        </div>
        <LandingMiniTree
          targetPalId="Anubis"
          parents={[
            { palId: 'CaptainPenguin', labelKey: 'landing.tree.collection' },
            { palId: 'Ronin', labelKey: 'landing.tree.capture' },
          ]}
        />
      </div>
    </section>
  )
}

/* ------------------------------------------------------------- Trust strip */

function TrustStrip() {
  const t = useT()
  const { mechanics } = loadDatabase()
  const items = [
    { icon: Database, value: mechanics.counts.pals, labelKey: 'landing.trust.pals' as const },
    { icon: Egg, value: mechanics.counts.verifiedPairs.toLocaleString('en-US'), labelKey: 'landing.trust.pairs' as const },
    { icon: Boxes, value: '', labelKey: 'landing.trust.collectionAware' as const },
    { icon: WifiOff, value: '', labelKey: 'landing.trust.offline' as const },
  ]
  return (
    <section className="landing-trust" aria-label={t('landing.trust.label')}>
      {items.map(({ icon: Icon, value, labelKey }) => (
        <div key={labelKey} className="landing-trust__item">
          <Icon aria-hidden="true" />
          {value !== '' ? <strong>{value}</strong> : null}
          <span>{t(labelKey)}</span>
        </div>
      ))}
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
        className="landing-section__cta"
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
  const passives = build.passives.map((id) => db.passiveById.get(id)).filter((passive): passive is NonNullable<typeof passive> => !!passive)

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
          <span className="landing-brand"><span><PalaxisMark /></span><strong>PALAXIS</strong></span>
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
