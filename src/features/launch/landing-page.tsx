import type { CSSProperties } from 'react'
import { BookOpen, Boxes, ChevronRight, Crown, Database, GitCompareArrows, MessageCircle, Network, ScanSearch, Sparkles, Swords, WifiOff, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PalaxisMark } from '@/components/palaxis-mark'
import { PalIcon } from '@/components/pal-icon'
import { useT } from '@/i18n/language-store'
import { cn } from '@/lib/utils'
import { useReveal } from '@/lib/use-reveal'

interface LandingPageProps {
  onLaunch: () => void
  onLoadDemo: () => void
  onOpenQuick: () => void
  /** Navega a una ruta real de la app (Pals, Tier List, Feedback...) sin recargar la pagina. */
  onNavigate: (path: string) => void
}

/**
 * El resto de las funciones de Palaxis, accesibles desde el hero -antes solo
 * "Quick Path" tenia un link directo aca; el resto (Pals, Tier List,
 * Feedback) solo se veian una vez adentro del planner. `/planner` no esta:
 * "Launch" ya cumple ese rol.
 */
const HERO_TABS = [
  { path: '/pals', labelKey: 'nav.pals', icon: Database } as const,
  { path: '/tiers', labelKey: 'nav.tiers', icon: Crown } as const,
  { path: '/rapido', labelKey: 'nav.quickPath', icon: Zap } as const,
  { path: '/feedback', labelKey: 'nav.feedback', icon: MessageCircle } as const,
]

const FEATURES = [
  { icon: Network, key: 'planner' },
  { icon: Sparkles, key: 'advisor' },
  { icon: Boxes, key: 'collection' },
  { icon: BookOpen, key: 'pokedex' },
  { icon: Swords, key: 'multi' },
  { icon: GitCompareArrows, key: 'routes' },
] as const

const HOW_STEPS = [
  { number: '01', titleKey: 'landing.how.one.title', descriptionKey: 'landing.how.one.description' },
  { number: '02', titleKey: 'landing.how.two.title', descriptionKey: 'landing.how.two.description' },
  { number: '03', titleKey: 'landing.how.three.title', descriptionKey: 'landing.how.three.description' },
] as const

const REASONS = [
  { id: 'offline', titleKey: 'landing.reason.offline.title', descriptionKey: 'landing.reason.offline.description' },
  { id: 'instant', titleKey: 'landing.reason.instant.title', descriptionKey: 'landing.reason.instant.description' },
  { id: 'smart', titleKey: 'landing.reason.smart.title', descriptionKey: 'landing.reason.smart.description' },
  { id: 'builds', titleKey: 'landing.reason.builds.title', descriptionKey: 'landing.reason.builds.description' },
  { id: 'personal', titleKey: 'landing.reason.personal.title', descriptionKey: 'landing.reason.personal.description' },
] as const
const FAQS = [
  { id: 'first', questionKey: 'landing.faq.first.question', answerKey: 'landing.faq.first.answer' },
  { id: 'offline', questionKey: 'landing.faq.offline.question', answerKey: 'landing.faq.offline.answer' },
  { id: 'collection', questionKey: 'landing.faq.collection.question', answerKey: 'landing.faq.collection.answer' },
] as const

export function LandingPage({ onLaunch, onLoadDemo, onOpenQuick, onNavigate }: LandingPageProps) {
  const t = useT()
  const [featuresRef, featuresVisible] = useReveal<HTMLElement>()
  const [reasonsRef, reasonsVisible] = useReveal<HTMLElement>()
  const [howRef, howVisible] = useReveal<HTMLElement>()
  const [ctaRef, ctaVisible] = useReveal<HTMLElement>()
  const [faqRef, faqVisible] = useReveal<HTMLElement>()
  return (
    <main className="landing-page">
      <nav className="landing-nav" aria-label={t('landing.navigation')}>
        <button type="button" className="landing-brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <span><PalaxisMark /></span><strong>PALAXIS</strong>
        </button>
        <Button size="sm" variant="ghost" onClick={onOpenQuick}><Zap aria-hidden="true" />{t('quickPath.navLabel')}</Button>
        <Button size="sm" onClick={onLaunch}>{t('landing.launch')}<ChevronRight aria-hidden="true" /></Button>
      </nav>

      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-hero__copy">
          <PalaxisMark className="landing-hero__mark" />
          <span className="landing-kicker"><WifiOff aria-hidden="true" />{t('landing.kicker')}</span>
          <h1 id="landing-title">{t('landing.titleA')} <em>{t('landing.titleB')}</em></h1>
          <p>{t('landing.description')}</p>
          <div className="landing-hero__actions">
            <Button size="lg" onClick={onLaunch}>{t('landing.launch')}<ChevronRight aria-hidden="true" /></Button>
            <Button size="lg" variant="outline" onClick={onLoadDemo}>{t('landing.loadDemo')}</Button>
          </div>
          <nav className="landing-hero__tabs" aria-label={t('landing.navigation')}>
            {HERO_TABS.map(({ path, labelKey, icon: Icon }) => (
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
          <ul className="landing-proof" aria-label={t('landing.proofLabel')}>
            <li><Database aria-hidden="true" />{t('landing.proofOffline')}</li>
            <li><ScanSearch aria-hidden="true" />{t('landing.proofInstant')}</li>
            <li><Sparkles aria-hidden="true" />{t('landing.proofPersonal')}</li>
          </ul>
        </div>
        <div className="landing-demo" aria-label={t('landing.demoLabel')}>
          <div className="landing-demo__ambient" aria-hidden="true" />
          <div className="landing-demo__rivets" aria-hidden="true" />
          <div className="landing-demo__eyebrow">
            <span className="landing-demo__lens" aria-hidden="true"><span /></span>
            {t('landing.exampleProject')}
          </div>
          <div className="landing-demo__screen">
            <div className="landing-demo__target">
              <PalIcon palId="Anubis" size={96} bare />
              <div><small>{t('landing.targetBadge')}</small><strong>{t('landing.demoTitle')}</strong><p>{t('landing.demoDescription')}</p></div>
            </div>
            <div className="landing-demo__progress"><span><i /></span><strong>{t('landing.demoProgress')}</strong></div>
            <div className="landing-demo__steps">
              {[t('landing.demoStepOne'), t('landing.demoStepTwo'), t('landing.demoStepThree')].map((step, index) => <p key={step}><b>{index + 1}</b>{step}</p>)}
            </div>
          </div>
          <Button size="sm" className="w-full" onClick={onLoadDemo}>{t('landing.loadDemo')}</Button>
        </div>
      </section>

      <section ref={featuresRef} className={cn('landing-section reveal', featuresVisible && 'is-in')} aria-labelledby="features-title">
        <div className="landing-section__heading"><span>{t('landing.platform')}</span><h2 id="features-title">{t('landing.featuresTitle')}</h2><p>{t('landing.featuresDescription')}</p></div>
        <ul className="landing-features">
          {FEATURES.map(({ icon: Icon, key }, index) => <li key={key} className={`landing-feature landing-feature--${index + 1}`} style={{ '--i': index } as CSSProperties}><Icon aria-hidden="true" /><strong>{t(`landing.feature.${key}.title`)}</strong><p>{t(`landing.feature.${key}.description`)}</p></li>)}
        </ul>
      </section>

      <section ref={reasonsRef} className={cn('landing-section landing-section--reasons reveal', reasonsVisible && 'is-in')} aria-labelledby="reasons-title">
        <div className="landing-section__heading"><span>{t('landing.reasonsEyebrow')}</span><h2 id="reasons-title">{t('landing.reasonsTitle')}</h2></div>
        <ul className="landing-reasons">
          {REASONS.map(({ id, titleKey, descriptionKey }, index) => <li key={id} style={{ '--i': index } as CSSProperties}><CheckMark /><div><strong>{t(titleKey)}</strong><p>{t(descriptionKey)}</p></div></li>)}
        </ul>
      </section>

      <section ref={howRef} className={cn('landing-section landing-section--how reveal', howVisible && 'is-in')} aria-labelledby="how-title">
        <div className="landing-section__heading"><span>{t('landing.howEyebrow')}</span><h2 id="how-title">{t('landing.howTitle')}</h2></div>
        <ol className="landing-how">
          {HOW_STEPS.map(({ number, titleKey, descriptionKey }, index) => <li key={number} style={{ '--i': index } as CSSProperties}><b>{number}</b><div><strong>{t(titleKey)}</strong><p>{t(descriptionKey)}</p></div></li>)}
        </ol>
      </section>

      <section ref={ctaRef} className={cn('landing-cta reveal', ctaVisible && 'is-in')} aria-labelledby="landing-cta-title">
        <span className="landing-kicker"><Sparkles aria-hidden="true" />{t('landing.ctaEyebrow')}</span>
        <h2 id="landing-cta-title">{t('landing.ctaTitle')}</h2>
        <p>{t('landing.ctaDescription')}</p>
        <Button size="lg" onClick={onLaunch}>{t('landing.launch')}<ChevronRight aria-hidden="true" /></Button>
      </section>

      <section ref={faqRef} className={cn('landing-section landing-faq reveal', faqVisible && 'is-in')} aria-labelledby="faq-title">
        <div className="landing-section__heading"><span>{t('landing.faqEyebrow')}</span><h2 id="faq-title">{t('landing.faqTitle')}</h2></div>
        <div>{FAQS.map(({ id, questionKey, answerKey }) => <details key={id}><summary>{t(questionKey)}<ChevronRight aria-hidden="true" /></summary><p>{t(answerKey)}</p></details>)}</div>
      </section>

      <footer className="landing-footer"><span>PALAXIS</span><p>{t('landing.footer')}</p></footer>
    </main>
  )
}

function CheckMark() { return <span className="landing-reasons__check" aria-hidden="true">✓</span> }
