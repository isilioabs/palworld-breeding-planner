import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Heart, Pin, Plus, Search, Star, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PassiveBadge } from '@/components/passive-badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PalPicker } from '@/components/pal-picker'
import { PassivePicker } from '@/components/passive-picker'
import { PalIcon } from '@/components/pal-icon'
import { loadDatabase, palName, passiveName } from '@/domain/database'
import { ELEMENT_INFO } from '@/domain/element'
import type { ElementType, Gender, OwnedPal, Pal } from '@/domain/types'
import { useT } from '@/i18n/language-store'
import { cn } from '@/lib/utils'
import { usePlannerStore } from '@/state/planner-store'
import { usePokedex } from '@/features/pokedex/pokedex-panel'
import { CollectionImportDialog } from './collection-import-dialog'

const MAX_PASSIVES_PER_PAL = 4
const PAGE_SIZE = 24
const ELEMENTS = Object.keys(ELEMENT_INFO) as ElementType[]

type CollectionView = 'owned' | 'missing'

interface PokedexCardProps {
  pal: Pal
  entry?: OwnedPal
  desired: Set<string>
  onAdd: () => void
  onManage: () => void
  onFavorite: () => void
}

function PokedexCard({ pal, entry, desired, onAdd, onManage, onFavorite }: PokedexCardProps) {
  const t = useT()
  const { openPal } = usePokedex()
  const db = loadDatabase()
  const element = pal.elements[0] ?? 'neutral'
  const owned = !!entry
  const highlighted = entry?.passives.some((id) => desired.has(id)) ?? false

  return (
    <article
      className={cn('collection-pokedex-card', !owned && 'collection-pokedex-card--missing', highlighted && 'collection-pokedex-card--matched', entry?.favorite && 'collection-pokedex-card--favorite')}
      style={{ '--collection-element': ELEMENT_INFO[element].color } as CSSProperties}
    >
      <button
        type="button"
        className="collection-pokedex-card__open"
        aria-label={t('pokedex.open', { name: palName(pal) })}
        onClick={() => openPal(pal.id)}
      />
      <div className="collection-pokedex-card__topline">
        <span>{`#${String(pal.dex).padStart(3, '0')}${pal.variant ? 'B' : ''}`}</span>
        <span className="collection-pokedex-card__element">{ELEMENT_INFO[element].label}</span>
      </div>
      <div className="collection-pokedex-card__art">
        <PalIcon palId={pal.id} size={68} bare />
        {owned && (
          <Button
            variant="ghost"
            size="icon-sm"
            className={cn('collection-pokedex-card__favorite', entry.favorite && 'is-favorite')}
            aria-label={t(entry.favorite ? 'collectionPanel.unfavorite' : 'collectionPanel.favorite', { name: palName(pal) })}
            aria-pressed={entry.favorite ?? false}
            onClick={(event) => { event.stopPropagation(); onFavorite() }}
          >
            <Heart className="size-3.5" fill={entry.favorite ? 'currentColor' : 'none'} aria-hidden="true" />
          </Button>
        )}
      </div>
      <div className="collection-pokedex-card__name">
        <span>{entry?.nickname || palName(pal)}</span>
        <small>{owned ? t('collectionPanel.ownedTag') : t('collectionPanel.missingTag')}</small>
      </div>
      {owned && entry.passives.length > 0 ? (
        <ul className="collection-pokedex-card__passives" aria-label={t('collectionPanel.passiveLabel')}>
          {entry.passives.slice(0, 2).map((id) => (
            <li key={id} className={desired.has(id) ? 'is-required' : undefined}>
              <PassiveBadge passive={db.passiveById.get(id)} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="collection-pokedex-card__hint">{owned ? t('collectionPanel.noPassives') : t('collectionPanel.missingHint')}</p>
      )}
      {owned ? (
        <Button variant="outline" size="sm" className="collection-pokedex-card__action mt-auto w-full" onClick={onManage}>
          {t('collectionPanel.manage')}
        </Button>
      ) : (
        <Button size="sm" className="collection-pokedex-card__action mt-auto w-full" onClick={onAdd}>
          <Plus className="size-3.5" aria-hidden="true" />
          {t('collectionPanel.addFromDex')}
        </Button>
      )}
    </article>
  )
}

function CollectionEditor({ entry, onClose }: { entry: OwnedPal; onClose: () => void }) {
  const { state, dispatch } = usePlannerStore()
  const db = loadDatabase()
  const t = useT()
  const pal = db.palById.get(entry.palId)
  const setGender = (gender?: Gender) => dispatch({ type: 'updateOwned', uid: entry.uid, patch: { gender } })

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="collection-editor__overlay" />
        <Dialog.Content className="collection-editor" aria-describedby={undefined}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <PalIcon palId={entry.palId} size={48} />
              <div className="min-w-0">
                <Dialog.Title className="truncate font-[Anton] text-xl uppercase tracking-wide">{palName(pal)}</Dialog.Title>
                <p className="text-xs text-muted-foreground">{t('collectionPanel.editorSubtitle')}</p>
              </div>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon-sm" aria-label={t('collectionPanel.closeEditor')}>
                <X className="size-4" aria-hidden="true" />
              </Button>
            </Dialog.Close>
          </div>

          <div className="collection-editor__section">
            <span className="collection-editor__label">{t('collectionPanel.gender')}</span>
            <div className="flex flex-wrap gap-2">
              {([['MALE', 'collectionPanel.genderMale'], ['FEMALE', 'collectionPanel.genderFemale']] as const).map(([gender, key]) => (
                <Button key={gender} variant={entry.gender === gender ? 'default' : 'outline'} size="sm" onClick={() => setGender(entry.gender === gender ? undefined : gender)}>
                  {t(key)}
                </Button>
              ))}
              <Button variant={!entry.gender ? 'secondary' : 'ghost'} size="sm" onClick={() => setGender(undefined)}>{t('collectionPanel.genderAny')}</Button>
            </div>
          </div>

          <div className="collection-editor__section">
            <div className="flex items-center justify-between gap-3">
              <span className="collection-editor__label">{t('collectionPanel.passives')}</span>
              <PassivePicker
                selected={entry.passives}
                max={MAX_PASSIVES_PER_PAL}
                label={t('collectionPanel.addPassive')}
                onToggle={(passiveId) => dispatch({
                  type: 'updateOwned',
                  uid: entry.uid,
                  patch: { passives: entry.passives.includes(passiveId) ? entry.passives.filter((id) => id !== passiveId) : [...entry.passives, passiveId].slice(0, MAX_PASSIVES_PER_PAL) },
                })}
              />
            </div>
            {entry.passives.length > 0 ? (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {entry.passives.map((id) => {
                  const isDesired = state.desiredPassives.includes(id)
                  const isPinned = state.pinnedSources[id] === entry.uid
                  return (
                    <li key={id} className="flex items-center gap-1">
                      <PassiveBadge passive={db.passiveById.get(id)} className={isDesired ? 'ring-1 ring-emerald-400/60' : undefined} />
                      {isDesired && (
                        <Button
                          variant={isPinned ? 'secondary' : 'ghost'}
                          size="icon-sm"
                          aria-label={t(isPinned ? 'collectionPanel.unpinSource' : 'collectionPanel.pinSource', { name: passiveName(db.passiveById.get(id)) })}
                          aria-pressed={isPinned}
                          title={t(isPinned ? 'collectionPanel.unpinSourceHint' : 'collectionPanel.pinSourceHint')}
                          onClick={() => dispatch({ type: 'setPinnedSource', passiveId: id, ownedUid: isPinned ? null : entry.uid })}
                        >
                          <Pin className="size-3" fill={isPinned ? 'currentColor' : 'none'} aria-hidden="true" />
                        </Button>
                      )}
                    </li>
                  )
                })}
              </ul>
            ) : <p className="mt-2 text-xs text-muted-foreground">{t('collectionPanel.noPassives')}</p>}
          </div>

          <div className="collection-editor__section">
            <label className="collection-editor__label" htmlFor={`notes-${entry.uid}`}>{t('collectionPanel.notes')}</label>
            <textarea
              id={`notes-${entry.uid}`}
              className="collection-editor__notes"
              value={entry.notes ?? ''}
              maxLength={280}
              placeholder={t('collectionPanel.notesPlaceholder')}
              onChange={(event) => dispatch({ type: 'updateOwned', uid: entry.uid, patch: { notes: event.target.value } })}
            />
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
            <Button variant={entry.favorite ? 'secondary' : 'outline'} size="sm" onClick={() => dispatch({ type: 'updateOwned', uid: entry.uid, patch: { favorite: !entry.favorite } })}>
              <Star className="size-3.5" fill={entry.favorite ? 'currentColor' : 'none'} aria-hidden="true" />
              {t(entry.favorite ? 'collectionPanel.unfavoriteShort' : 'collectionPanel.favoriteShort')}
            </Button>
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => { dispatch({ type: 'removeOwned', uid: entry.uid }); onClose() }}>
              <Trash2 className="size-3.5" aria-hidden="true" />
              {t('collectionPanel.remove')}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export function CollectionPanel({ embedded = false }: { embedded?: boolean }) {
  const db = loadDatabase()
  const { state, dispatch } = usePlannerStore()
  const t = useT()
  const [search, setSearch] = useState('')
  const [element, setElement] = useState<ElementType | null>(null)
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [passiveFilter, setPassiveFilter] = useState<string | null>(null)
  const [view, setView] = useState<CollectionView>('owned')
  const [recentFirst, setRecentFirst] = useState(true)
  const [editingUid, setEditingUid] = useState<string | null>(null)
  const [limit, setLimit] = useState(PAGE_SIZE)
  const desired = useMemo(() => new Set(state.desiredPassives), [state.desiredPassives])
  const ownedIds = useMemo(() => new Set(state.owned.map((entry) => entry.palId)), [state.owned])
  const edited = state.owned.find((entry) => entry.uid === editingUid)

  const visible = useMemo<Array<{ pal: Pal; entry?: OwnedPal }>>(() => {
    const needle = search.trim().toLocaleLowerCase()
    const matches = (pal: Pal) => !needle || `${pal.name} ${pal.nameEs}`.toLocaleLowerCase().includes(needle)
    if (view === 'missing') {
      return db.pals
        .filter((pal) => !ownedIds.has(pal.id) && matches(pal) && (!element || pal.elements.includes(element)))
        .sort((a, b) => a.dex - b.dex)
        .map((pal) => ({ pal }))
    }
    return state.owned
      .map((entry) => ({ entry, pal: db.palById.get(entry.palId) }))
      .filter((item): item is { entry: OwnedPal; pal: Pal } => !!item.pal)
      .filter(({ entry, pal }) => matches(pal) && (!element || pal.elements.includes(element)) && (!favoritesOnly || entry.favorite) && (!passiveFilter || entry.passives.includes(passiveFilter)))
      .sort((a, b) => recentFirst ? (b.entry.addedAt ?? 0) - (a.entry.addedAt ?? 0) : a.pal.dex - b.pal.dex)
  }, [db.pals, element, favoritesOnly, ownedIds, passiveFilter, recentFirst, search, state.owned, view])
  // Cada filtro vuelve a la primera pagina. Renderizar las 299 cartas no solo
  // alarga el scroll: tambien decodifica muchos retratos que el jugador aun
  // no ha pedido ver. Aplica tanto a "missing" como a colecciones grandes en "owned".
  useEffect(() => setLimit(PAGE_SIZE), [element, favoritesOnly, passiveFilter, recentFirst, search, view])
  const displayed = visible.slice(0, limit)

  const elementProgress = useMemo(() => {
    const counts = new Map<ElementType, { owned: number; total: number }>()
    for (const value of ELEMENTS) counts.set(value, { owned: 0, total: 0 })
    for (const pal of db.pals) {
      for (const value of pal.elements) {
        const entry = counts.get(value)
        if (!entry) continue
        entry.total += 1
        if (ownedIds.has(pal.id)) entry.owned += 1
      }
    }
    return counts
  }, [db.pals, ownedIds])

  const passiveIds = useMemo(() => new Set(state.owned.flatMap((entry) => entry.passives)), [state.owned])
  const favorites = state.owned.filter((entry) => entry.favorite)
  const favoriteWorkers = favorites.filter((entry) => (db.palById.get(entry.palId)?.work.length ?? 0) > 0).length
  const favoriteFighters = favorites.filter((entry) => entry.passives.some((id) => (db.passiveById.get(id)?.rank ?? 0) > 0)).length
  // El progreso de la Pokédex mide especies distintas. La colección sí puede
  // guardar varios ejemplares de una especie para representar reproductores.
  const ownedSpecies = ownedIds.size
  const progress = db.pals.length ? Math.round((ownedSpecies / db.pals.length) * 100) : 0
  const missingDesired = state.desiredPassives.filter((id) => !state.owned.some((entry) => entry.passives.includes(id)))

  return (
    <Card className={cn('collection-panel', embedded && 'border-0 bg-transparent shadow-none')}>
      {!embedded && (
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>{t('collectionPanel.title')}</CardTitle>
              <CardDescription>{t('collectionPanel.description')}</CardDescription>
            </div>
            <span className="collection-panel__progress" title={t('collectionPanel.progress', { value: progress })}>{progress}%</span>
          </div>
        </CardHeader>
      )}
      <CardContent className={cn('space-y-4', embedded && 'p-0')}>
        <section className="collection-dashboard" aria-label={t('collectionPanel.dashboard')}>
          {[
            [t('collectionPanel.ownedMetric'), ownedSpecies],
            [t('collectionPanel.missingMetric'), Math.max(0, db.pals.length - ownedSpecies)],
            [t('collectionPanel.uniquePassives'), passiveIds.size],
            [t('collectionPanel.favoriteWorkers'), favoriteWorkers],
            [t('collectionPanel.favoriteFighters'), favoriteFighters],
            [t('collectionPanel.progressMetric'), `${progress}%`],
          ].map(([label, value]) => <div key={label} className="collection-dashboard__metric"><span title={String(label)}>{label}</span><strong>{value}</strong></div>)}
        </section>

        <div className="collection-panel__add-actions">
          <PalPicker label={t('collectionPanel.addPlaceholder')} onSelect={(palId) => dispatch({ type: 'addOwned', palId })} closeOnSelect={false} disabledIds={[...ownedIds]} />
          <CollectionImportDialog />
        </div>

        <section className="collection-intelligence" aria-label={t('collectionPanel.intelligence')}>
          <div className="flex items-center gap-2"><Star className="size-3.5 text-primary" aria-hidden="true" /><strong>{t('collectionPanel.intelligence')}</strong></div>
          {state.desiredPassives.length === 0 ? <p>{t('collectionPanel.noDesired')}</p> : (
            <ul>
              {state.desiredPassives.map((id) => {
                const available = !missingDesired.includes(id)
                return <li key={id}><PassiveBadge passive={db.passiveById.get(id)} className={available ? 'ring-1 ring-emerald-400/60' : 'ring-1 ring-amber-400/60'} /><span>{available ? t('collectionPanel.passiveAvailable') : t('collectionPanel.passiveScout')}</span></li>
              })}
            </ul>
          )}
        </section>

        <div className="collection-filters">
          <label className="collection-search"><Search className="size-3.5" aria-hidden="true" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('collectionPanel.search')} /></label>
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" variant={view === 'owned' ? 'secondary' : 'outline'} onClick={() => setView('owned')}>{t('collectionPanel.ownedView')}</Button>
            <Button size="sm" variant={view === 'missing' ? 'secondary' : 'outline'} onClick={() => setView('missing')}>{t('collectionPanel.missingView')}</Button>
            <Button size="sm" variant={favoritesOnly ? 'secondary' : 'outline'} disabled={view === 'missing'} onClick={() => setFavoritesOnly((value) => !value)}><Heart className="size-3.5" aria-hidden="true" />{t('collectionPanel.favorites')}</Button>
            <Button size="sm" variant={recentFirst ? 'secondary' : 'outline'} disabled={view === 'missing'} onClick={() => setRecentFirst((value) => !value)}>{t('collectionPanel.recent')}</Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" variant={!element ? 'secondary' : 'outline'} onClick={() => setElement(null)}>{t('collectionPanel.allElements')}</Button>
            {ELEMENTS.map((value) => {
              const progress = elementProgress.get(value)
              return (
                <Button key={value} size="sm" variant={element === value ? 'secondary' : 'outline'} className="collection-element-filter" onClick={() => setElement(element === value ? null : value)}>
                  <img src={ELEMENT_INFO[value].icon} alt="" width="13" height="13" />{ELEMENT_INFO[value].label}
                  {progress && <span className="collection-element-filter__count">{progress.owned}/{progress.total}</span>}
                </Button>
              )
            })}
          </div>
          {view === 'owned' && <div className="flex flex-wrap items-center gap-1.5"><PassivePicker selected={passiveFilter ? [passiveFilter] : []} max={1} label={t('collectionPanel.passiveFilter')} onToggle={(id) => setPassiveFilter((current) => current === id ? null : id)} />{passiveFilter && <Button variant="ghost" size="icon-sm" aria-label={t('collectionPanel.clearFilters')} onClick={() => setPassiveFilter(null)}><X className="size-3.5" /></Button>}</div>}
        </div>

        {visible.length === 0 ? <p className="collection-empty-state rounded-md border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">{t('collectionPanel.noResults')}</p> : (
          <>
            <ul className="collection-pokedex-grid">
              {displayed.map(({ pal, entry }) => <li key={entry?.uid ?? pal.id}><PokedexCard pal={pal} entry={entry} desired={desired} onAdd={() => dispatch({ type: 'addOwned', palId: pal.id })} onManage={() => entry && setEditingUid(entry.uid)} onFavorite={() => entry && dispatch({ type: 'updateOwned', uid: entry.uid, patch: { favorite: !entry.favorite } })} /></li>)}
            </ul>
            {displayed.length < visible.length && (
              <Button variant="outline" size="sm" className="w-full" onClick={() => setLimit((current) => current + PAGE_SIZE)}>
                {t('collectionPanel.loadMoreMissing', { shown: displayed.length, total: visible.length })}
              </Button>
            )}
          </>
        )}
      </CardContent>
      {edited && <CollectionEditor entry={edited} onClose={() => setEditingUid(null)} />}
    </Card>
  )
}
