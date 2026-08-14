import { Crown, Database, Languages, MessageCircle, SlidersHorizontal, Zap } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PalaxisMark, PalaxisWordmark } from '@/components/palaxis-mark'
import { RichTooltip } from '@/components/rich-tooltip'
import { loadDatabase } from '@/domain/database'
import { useLang, useT } from '@/i18n/language-store'
import { localizedPath, stripLocalePrefix } from '@/lib/seo'
import { cn } from '@/lib/utils'

const NAV_TABS = [
  { path: '/planner', labelKey: 'nav.breedingPlanner', icon: SlidersHorizontal } as const,
  { path: '/pals', labelKey: 'nav.pals', icon: Database } as const,
  { path: '/tiers', labelKey: 'nav.tiers', icon: Crown } as const,
  { path: '/rapido', labelKey: 'nav.quickPath', icon: Zap } as const,
  { path: '/feedback', labelKey: 'nav.feedback', icon: MessageCircle } as const,
]

function isNavActive(route: string, path: string) {
  if (path === '/pals') return route === '/pals' || route.startsWith('/pals/')
  return route === path
}

function HeaderNav({ route, onNavigate }: { route: string; onNavigate: (path: string) => void }) {
  const t = useT()
  const [lang] = useLang()
  return (
    <nav aria-label="Palaxis" className="axis-nav">
      {NAV_TABS.map(({ path, labelKey, icon: Icon }) => {
        const active = isNavActive(route, path)
        return (
          <a
            key={path}
            href={localizedPath(path, lang)}
            aria-current={active ? 'page' : undefined}
            onClick={(event) => {
              if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
              event.preventDefault()
              onNavigate(path)
            }}
            className={cn('axis-nav__item', active && 'is-active')}
          >
            <Icon className="size-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">{t(labelKey)}</span>
          </a>
        )
      })}
    </nav>
  )
}

function LanguageToggle() {
  const [lang, setLang] = useLang()
  const t = useT()
  const next = lang === 'es' ? 'en' : 'es'
  return (
    <RichTooltip title={t(lang === 'es' ? 'header.langToggle' : 'header.langToggleToEs')} description="ES / EN">
      <Button
        className="app-header__language"
        variant="ghost"
        size="icon-sm"
        aria-label={t(lang === 'es' ? 'header.langToggle' : 'header.langToggleToEs')}
        onClick={() => {
          const nextPath = localizedPath(stripLocalePrefix(window.location.pathname), next)
          window.history.replaceState({}, '', `${nextPath}${window.location.search}${window.location.hash}`)
          setLang(next)
          window.dispatchEvent(new PopStateEvent('popstate'))
        }}
      >
        <Languages className="size-4" aria-hidden="true" />
      </Button>
    </RichTooltip>
  )
}

export function AppHeader({ onHome, route, onNavigate }: { onHome: () => void; route: string; onNavigate: (path: string) => void }) {
  const { mechanics } = loadDatabase()
  const t = useT()
  const [lang] = useLang()
  const locale = lang === 'en' ? 'en-US' : 'es-ES'
  return (
    <header className="app-header">
      <button
        type="button"
        className="app-brand flex min-w-0 items-center gap-2.5 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={t('header.home')}
        onClick={onHome}
      >
        <span className="app-brand__emblem"><PalaxisMark className="size-8" /></span>
        <div className="min-w-0">
          <div className="truncate leading-none" aria-hidden="true"><PalaxisWordmark className="app-brand__wordmark" /></div>
          <p className="mt-1 hidden text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground sm:block">{t('header.subtitle')}</p>
        </div>
      </button>
      <HeaderNav route={route} onNavigate={onNavigate} />
      <RichTooltip
        asChild={false}
        title={t('header.datasetTitle', { version: mechanics.sourceVersion })}
        description={t('header.datasetDescription', { count: mechanics.counts.verifiedPairs.toLocaleString(locale) })}
        detail={t('header.datasetDetail')}
      >
        <Badge variant="muted" className="app-header__dataset hidden gap-1 lg:inline-flex">
          <Database className="size-3" aria-hidden="true" />
          {t('header.badge', { pals: mechanics.counts.pals, combos: mechanics.counts.uniqueCombos + mechanics.counts.genderCombos })}
        </Badge>
      </RichTooltip>
      <span className="app-header__meta ml-auto hidden xl:inline">{t('header.footerLine', { version: mechanics.sourceVersion, count: mechanics.counts.verifiedPairs.toLocaleString(locale) })}</span>
      <LanguageToggle />
    </header>
  )
}
