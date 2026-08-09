/**
 * Tier List (`/tiers`): 17 categorias (Best Base Pals, Player DMG, Best
 * Combat Pals, Montura terrestre, Montura voladora, y los 12 tipos de
 * trabajo por separado) -ver src/domain/tier-list.ts para el calculo de
 * cada una. El HTML que ve un crawler viene del script de prerenderizado
 * (`scripts/prerender-pal-pages.ts`); esta es la version interactiva.
 */
import { useEffect, useMemo, useState } from 'react'
import {
  Crown,
  Database,
  Droplet,
  Feather,
  Flame,
  Footprints,
  Hammer,
  Home,
  Package,
  Pickaxe,
  Pill,
  Search,
  ShieldCheck,
  Snowflake,
  Sprout,
  Swords,
  Target,
  Trees,
  Trophy,
  Truck,
  Wheat,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PalIcon } from '@/components/pal-icon'
import { PageH1 } from '@/components/page-heading'
import { RichTooltip } from '@/components/rich-tooltip'
import { dexLabel, loadDatabase, palName } from '@/domain/database'
import { ELEMENT_INFO } from '@/domain/element'
import { palSlug } from '@/domain/slug'
import { getTierList, groupByTier, tierLetter, TIER_CATEGORIES, type TierCategory, type TierEntry } from '@/domain/tier-list'
import type { ElementType } from '@/domain/types'
import { useT } from '@/i18n/language-store'
import type { TranslationKey } from '@/i18n/translations'
import { usePlannerStore } from '@/state/planner-store'
import { cn } from '@/lib/utils'

const ELEMENTS = Object.keys(ELEMENT_INFO) as ElementType[]

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  base: Home,
  combat: Swords,
  'combat-power': Target,
  'mount-ground': Footprints,
  'mount-flying': Feather,
  'work-Kindling': Flame,
  'work-Watering': Droplet,
  'work-Planting': Sprout,
  'work-GenerateElectricity': Zap,
  'work-Handiwork': Hammer,
  'work-Gathering': Package,
  'work-Lumbering': Trees,
  'work-Mining': Pickaxe,
  'work-MedicineProduction': Pill,
  'work-Cooling': Snowflake,
  'work-Transporting': Truck,
  'work-Farming': Wheat,
}

/** Posicion dentro de la categoria (0 = mejor banda), no la letra -asi SS/S/A/B de Base y S/A/B/C/D/E de Player DMG comparten el mismo lenguaje visual sin pisarse. */
const TIER_CLASS_BY_POSITION = ['tier-band--s', 'tier-band--a', 'tier-band--b', 'tier-band--c', 'tier-band--d', 'tier-band--e']

const GROUPS: { id: TierCategory['group']; labelKey: TranslationKey; icon: LucideIcon }[] = [
  { id: 'base', labelKey: 'tierList.groupBase', icon: Home },
  { id: 'combat', labelKey: 'tierList.groupCombat', icon: Swords },
  { id: 'work', labelKey: 'tierList.groupWork', icon: Hammer },
]

type OwnedFilter = 'all' | 'owned' | 'needed'

/**
 * Tocable-sin-hover (movil/tablet). Categorias grandes (Best Combat Pals,
 * ~300 chips) montaban un Tooltip de Radix por chip -state machine +
 * listeners de pointer/foco cada uno- que en touch no aporta nada (no hay
 * hover) y era el principal costo de render al cambiar de categoria
 * (bloqueaba el hilo principal varios segundos). En touch, los chips se
 * renderizan como links planos con `title` nativo en vez de envolver cada
 * uno en <RichTooltip>.
 */
function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(false)
  useEffect(() => {
    const mql = window.matchMedia('(hover: none), (pointer: coarse)')
    setCoarse(mql.matches)
    const onChange = () => setCoarse(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])
  return coarse
}

export function TierListPage({ onNavigate }: { onNavigate: (slug: string) => void }) {
  const t = useT()
  const { state } = usePlannerStore()
  const [categoryId, setCategoryId] = useState<string>('base')
  const [query, setQuery] = useState('')
  const [element, setElement] = useState<ElementType | null>(null)
  const [ownedFilter, setOwnedFilter] = useState<OwnedFilter>('all')

  const ownedIds = useMemo(() => new Set(state.owned.map((entry) => entry.palId)), [state.owned])
  const category = TIER_CATEGORIES.find((c) => c.id === categoryId) ?? TIER_CATEGORIES[0]
  const mechanics = loadDatabase().mechanics

  const entries = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase()
    return getTierList(categoryId).filter((entry) => {
      if (element && !entry.pal.elements.includes(element)) return false
      if (ownedFilter === 'owned' && !ownedIds.has(entry.pal.id)) return false
      if (ownedFilter === 'needed' && ownedIds.has(entry.pal.id)) return false
      if (needle && !`${entry.pal.name} ${entry.pal.nameEs}`.toLocaleLowerCase().includes(needle)) return false
      return true
    })
  }, [categoryId, element, ownedFilter, query, ownedIds])
  const groups = useMemo(() => groupByTier(entries, category), [entries, category])
  const tierNumbers = useMemo(() => Array.from({ length: category.letters.length }, (_, i) => category.letters.length - i), [category])

  const categoriesInGroup = TIER_CATEGORIES.filter((c) => c.group === category.group)
  const coarsePointer = useCoarsePointer()

  const selectCategory = (id: string) => {
    setCategoryId(id)
    // El filtro de elemento no aplica en Work -alli se filtra por tipo de
    // trabajo- asi que se limpia al entrar para que no quede un filtro
    // invisible aplicado en silencio.
    if (TIER_CATEGORIES.find((c) => c.id === id)?.group === 'work') setElement(null)
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
      <TierListHero mechanics={mechanics} />

      <div className="space-y-3">
        <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{t('tierList.viewBy')}</p>
        <div className="flex flex-wrap gap-2">
          {GROUPS.map((group) => {
            const Icon = group.icon
            const active = category.group === group.id
            return (
              <button
                key={group.id}
                type="button"
                onClick={() => selectCategory(TIER_CATEGORIES.find((c) => c.group === group.id)!.id)}
                className={cn('tier-view-toggle', active && 'tier-view-toggle--active')}
              >
                <Icon className="size-4" aria-hidden="true" />
                {t(group.labelKey)}
              </button>
            )
          })}
        </div>
        {categoriesInGroup.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {categoriesInGroup.map((entry) => {
              const Icon = CATEGORY_ICONS[entry.id]
              const active = entry.id === categoryId
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => selectCategory(entry.id)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                    active ? 'border-primary/60 bg-primary/15 text-primary' : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground',
                  )}
                >
                  <Icon className="size-3.5" aria-hidden="true" />
                  {t(entry.labelKey)}
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex min-w-[12rem] flex-1 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm">
          <Search className="size-4 text-muted-foreground" aria-hidden="true" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('tierList.search')} className="w-full bg-transparent outline-none placeholder:text-muted-foreground" />
        </label>
        {category.group !== 'work' && (
          <div className="flex flex-wrap gap-1.5" aria-label={t('palsIndex.browseByElement')}>
            <Button type="button" size="sm" variant={!element ? 'secondary' : 'outline'} onClick={() => setElement(null)}>{t('tierList.filterAll')}</Button>
            {ELEMENTS.map((entry) => (
              <Button type="button" key={entry} size="sm" variant={element === entry ? 'secondary' : 'outline'} onClick={() => setElement(element === entry ? null : entry)}>
                <img src={ELEMENT_INFO[entry].icon} alt="" width="13" height="13" />
                {ELEMENT_INFO[entry].label}
              </Button>
            ))}
          </div>
        )}
        <div className="ml-auto flex gap-1.5">
          <Button type="button" size="sm" variant={ownedFilter === 'owned' ? 'secondary' : 'outline'} onClick={() => setOwnedFilter(ownedFilter === 'owned' ? 'all' : 'owned')}>
            {t('tierList.filterOwned')}
          </Button>
          <Button type="button" size="sm" variant={ownedFilter === 'needed' ? 'secondary' : 'outline'} onClick={() => setOwnedFilter(ownedFilter === 'needed' ? 'all' : 'needed')}>
            {t('tierList.filterNeeded')}
          </Button>
        </div>
      </div>

      {entries.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">{t('tierList.empty')}</p>
      ) : (
        <div className="space-y-2.5">
          {tierNumbers.map((tierNumber, position) => (
            <TierBand key={tierNumber} category={category} tierNumber={tierNumber} position={position} entries={groups[tierNumber]} ownedIds={ownedIds} onNavigate={onNavigate} coarsePointer={coarsePointer} />
          ))}
        </div>
      )}
    </div>
  )
}

function TierListHero({ mechanics }: { mechanics: ReturnType<typeof loadDatabase>['mechanics'] }) {
  const t = useT()
  return (
    <div className="tier-hero">
      <div className="tier-hero__glow" aria-hidden="true" />
      <div className="tier-hero__content">
        <PageH1 icon={Crown}>{t('tierList.title')}</PageH1>
        <p className="max-w-2xl text-sm text-muted-foreground">{t('tierList.intro')}</p>
        <div className="tier-hero__stats">
          <HeroStat icon={Trophy} value={mechanics.counts.pals} label={t('tierList.statPalsRanked')} />
          <HeroStat icon={Database} value={TIER_CATEGORIES.length} label={t('tierList.statCategories')} />
          <HeroStat icon={ShieldCheck} value={mechanics.counts.verifiedPairs.toLocaleString('en-US')} label={t('tierList.statVerifiedPoints')} />
          <HeroStat icon={ShieldCheck} value="100%" label={t('tierList.statOffline')} />
        </div>
      </div>
    </div>
  )
}

function HeroStat({ icon: Icon, value, label }: { icon: LucideIcon; value: string | number; label: string }) {
  return (
    <div className="tier-hero-stat">
      <Icon className="size-4 text-primary" aria-hidden="true" />
      <div>
        <div className="tier-hero-stat__value">{value}</div>
        <div className="tier-hero-stat__label">{label}</div>
      </div>
    </div>
  )
}

function TierBand({
  category,
  tierNumber,
  position,
  entries,
  ownedIds,
  onNavigate,
  coarsePointer,
}: {
  category: TierCategory
  tierNumber: number
  position: number
  entries: TierEntry[]
  ownedIds: Set<string>
  onNavigate: (slug: string) => void
  coarsePointer: boolean
}) {
  const t = useT()
  const letter = tierLetter(category, tierNumber)
  const subtitleKey = `tierList.tierSubtitle.${Math.min(position, 5)}` as TranslationKey
  return (
    <div className={cn('tier-band', TIER_CLASS_BY_POSITION[position])}>
      <div className="tier-band__letter" aria-hidden="true">
        {letter}
        <span className="tier-band__subtitle">{t(subtitleKey)}</span>
      </div>
      <div className="tier-band__chips">
        {entries.length === 0 ? (
          <span className="tier-band__empty" />
        ) : (
          entries.map((entry) => <TierChip key={entry.pal.id} entry={entry} owned={ownedIds.has(entry.pal.id)} onNavigate={onNavigate} coarsePointer={coarsePointer} />)
        )}
      </div>
    </div>
  )
}

function TierChip({ entry, owned, onNavigate, coarsePointer }: { entry: TierEntry; owned: boolean; onNavigate: (slug: string) => void; coarsePointer: boolean }) {
  const t = useT()
  const slug = palSlug(entry.pal)
  const link = (
    <a
      href={`/pals/${slug}`}
      title={coarsePointer ? palName(entry.pal) : undefined}
      onClick={(event) => {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
        event.preventDefault()
        onNavigate(slug)
      }}
      className={cn('tier-chip', owned && 'tier-chip--owned')}
    >
      <PalIcon palId={entry.pal.id} size={40} bare />
      <span className="tier-chip__name">{palName(entry.pal)}</span>
      {entry.statLabel && <span className="tier-chip__stat">{entry.statLabel}</span>}
    </a>
  )
  if (coarsePointer) return link
  return (
    <RichTooltip title={palName(entry.pal)} description={entry.statLabel || dexLabel(entry.pal)} detail={owned ? t('pokedex.owned') : undefined}>
      {link}
    </RichTooltip>
  )
}
