/**
 * Directorio navegable de todas las Pals (`/pals`) -hub de la Pokedex, no
 * solo una grilla de links. La version que ve un crawler viene del script de
 * prerenderizado (`scripts/prerender-pal-pages.ts`), que lista TODAS las
 * Pals sin paginar; esta version cliente pagina para la UX (300 cards de una
 * es pesado) usando el mismo patron de busqueda/filtro que ya usa
 * `src/components/pal-picker.tsx`.
 */
import { useMemo, useState } from 'react'
import { Database, Search, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PalIcon } from '@/components/pal-icon'
import { PageH1, PageSection } from '@/components/page-heading'
import { dexLabel, loadDatabase, palName } from '@/domain/database'
import { ELEMENT_INFO } from '@/domain/element'
import { palSlug } from '@/domain/slug'
import type { ElementType, Pal } from '@/domain/types'
import { useLang, useT } from '@/i18n/language-store'
import { localizedPath } from '@/lib/seo'

const ELEMENTS = Object.keys(ELEMENT_INFO) as ElementType[]
const PAGE_SIZE = 30

function matchesSearch(pal: Pal, query: string) {
  const needle = query.trim().toLocaleLowerCase()
  return !needle || `${pal.name} ${pal.nameEs} ${pal.dex}`.toLocaleLowerCase().includes(needle)
}

export function PalsIndexPage({ onNavigate }: { onNavigate: (slug: string) => void }) {
  const db = loadDatabase()
  const t = useT()
  const [query, setQuery] = useState('')
  const [element, setElement] = useState<ElementType | null>(null)
  const [limit, setLimit] = useState(PAGE_SIZE)

  const elementCounts = useMemo(() => {
    const counts = new Map<ElementType, number>()
    for (const pal of db.pals) for (const el of pal.elements) counts.set(el, (counts.get(el) ?? 0) + 1)
    return counts
  }, [db.pals])

  const results = useMemo(
    () =>
      db.pals
        .filter((pal) => matchesSearch(pal, query) && (!element || pal.elements.includes(element)))
        .sort((a, b) => a.dex - b.dex),
    [db.pals, element, query],
  )
  const visible = results.slice(0, limit)

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="space-y-2">
        <PageH1 icon={Database}>{t('palsIndex.title')}</PageH1>
        <p className="max-w-2xl text-sm text-muted-foreground">{t('palsIndex.intro', { count: db.pals.length })}</p>
        <div className="flex flex-wrap gap-2 pt-1">
          <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold">{t('palsIndex.statPals', { count: db.mechanics.counts.pals })}</span>
          <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold">{t('palsIndex.statCombos', { count: db.mechanics.counts.uniqueCombos + db.mechanics.counts.genderCombos })}</span>
        </div>
      </div>

      <div className="space-y-2">
        <PageSection icon={Sparkles} title={t('palsIndex.browseByElement')} />
        <div className="flex flex-wrap gap-1.5" aria-label={t('palsIndex.browseByElement')}>
          <Button type="button" size="sm" variant={!element ? 'secondary' : 'outline'} onClick={() => { setElement(null); setLimit(PAGE_SIZE) }}>
            {t('palsIndex.all')} ({db.pals.length})
          </Button>
          {ELEMENTS.map((entry) => (
            <Button
              type="button"
              key={entry}
              size="sm"
              variant={element === entry ? 'secondary' : 'outline'}
              onClick={() => { setElement(element === entry ? null : entry); setLimit(PAGE_SIZE) }}
            >
              <img src={ELEMENT_INFO[entry].icon} alt="" width="13" height="13" />
              {ELEMENT_INFO[entry].label} ({elementCounts.get(entry) ?? 0})
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <PageSection icon={Search} title={t('palsIndex.allPals')} />
        <label className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm">
          <Search className="size-4 text-muted-foreground" aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => { setQuery(event.target.value); setLimit(PAGE_SIZE) }}
            placeholder={t('palsIndex.search')}
            className="w-full bg-transparent outline-none placeholder:text-muted-foreground"
          />
        </label>
        <p className="text-xs text-muted-foreground">{t('palsIndex.results', { count: results.length })}</p>

        {visible.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">{t('palsIndex.empty')}</p>
        ) : (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {visible.map((pal) => <li key={pal.id}><PalCardLink pal={pal} onNavigate={onNavigate} /></li>)}
          </ul>
        )}

        {visible.length < results.length && (
          <Button variant="outline" size="sm" onClick={() => setLimit((current) => current + PAGE_SIZE)}>
            {t('palsIndex.more', { count: Math.min(PAGE_SIZE, results.length - visible.length) })}
          </Button>
        )}
      </div>
    </div>
  )
}

/** `<a href>` real (crawlable), intercepta solo el click izquierdo simple -Ctrl/Cmd/rueda siguen abriendo en pestaña nueva. */
function PalCardLink({ pal, onNavigate }: { pal: Pal; onNavigate: (slug: string) => void }) {
  const [lang] = useLang()
  const slug = palSlug(pal)
  const primary = pal.elements[0] ?? 'neutral'
  return (
    <a
      href={localizedPath(`/pals/${slug}`, lang)}
      onClick={(event) => {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
        event.preventDefault()
        onNavigate(slug)
      }}
      className="flex flex-col items-center gap-1 rounded-lg border border-border bg-card px-2 py-3 text-center no-underline transition-colors hover:border-primary/50"
    >
      <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{dexLabel(pal)}</span>
      <PalIcon palId={pal.id} size={54} bare />
      <strong className="truncate text-sm">{palName(pal)}</strong>
      <span className="text-[10px] font-semibold" style={{ color: ELEMENT_INFO[primary].color }}>{ELEMENT_INFO[primary].label}</span>
    </a>
  )
}
