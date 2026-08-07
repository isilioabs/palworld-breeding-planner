import { createContext, useContext, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { BookOpen, Box, ChevronRight, Crosshair, MapPin, PackageCheck, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PassiveBadge } from '@/components/passive-badge'
import { PalIcon } from '@/components/pal-icon'
import { getBuildsFor } from '@/domain/builds'
import { dexLabel, loadDatabase, palName, workTypeLabel } from '@/domain/database'
import { getResolver } from '@/domain/breeding'
import { ELEMENT_INFO } from '@/domain/element'
import type { Pal } from '@/domain/types'
import { ROLE_ICON } from '@/features/setup/build-advisor'
import { useLang, useT } from '@/i18n/language-store'
import type { TranslationKey } from '@/i18n/translations'
import { usePlannerStore } from '@/state/planner-store'
import { cn } from '@/lib/utils'

interface PokedexControls {
  openPal: (palId: string) => void
}

const PokedexContext = createContext<PokedexControls | null>(null)

export function usePokedex() {
  const context = useContext(PokedexContext)
  if (!context) throw new Error('usePokedex must be used within PokedexProvider')
  return context
}

function PokedexWork({ pal }: { pal: Pal }) {
  const t = useT()
  return (
    <section className="pokedex-dossier__section">
      <div className="pokedex-dossier__section-heading"><Crosshair aria-hidden="true" /> <h3>{t('pokedex.work')}</h3></div>
      {pal.work.length ? (
        <ul className="pokedex-work-grid">
          {pal.work.map((work) => (
            <li key={work.type} style={{ '--work-level': `${work.value * 10}%` } as CSSProperties}>
              <span>{workTypeLabel(work.type)}</span><b>{work.value}</b><i aria-hidden="true" />
            </li>
          ))}
        </ul>
      ) : <p className="pokedex-dossier__muted">{t('pokedex.noWork')}</p>}
    </section>
  )
}

function PokedexPanel({ palId, onClose, onOpen }: { palId: string | null; onClose: () => void; onOpen: (id: string) => void }) {
  const db = loadDatabase()
  const { state } = usePlannerStore()
  const t = useT()
  const [lang] = useLang()
  const pal = palId ? db.palById.get(palId) : undefined
  const owned = !!pal && state.owned.some((entry) => entry.palId === pal.id)
  const locale = lang === 'en' ? 'en-US' : 'es-ES'
  const dossier = useMemo(() => {
    if (!pal) return null
    const builds = getBuildsFor(pal.id)
    const buildPassives = [...new Set(builds.flatMap((build) => build.passives))]
    const bestPassives = (buildPassives.length ? buildPassives : db.passives.filter((passive) => passive.rank > 0).sort((a, b) => b.rank - a.rank).map((passive) => passive.id)).slice(0, 6)
    const related = db.pals
      .filter((candidate) => candidate.id !== pal.id && candidate.elements.some((element) => pal.elements.includes(element)))
      .sort((a, b) => Math.abs(a.dex - pal.dex) - Math.abs(b.dex - pal.dex))
      .slice(0, 6)
    const recipes = getResolver().parentsOf(pal.id).slice(0, 8)
    return { builds, bestPassives, related, recipes }
  }, [db.pals, db.passives, pal])

  if (!pal || !dossier) return null
  const mainElement = pal.elements[0] ?? 'neutral'
  const elementInfo = ELEMENT_INFO[mainElement]
  const topWork = pal.work[0] ? workTypeLabel(pal.work[0].type) : t('pokedex.noWork')
  const wildRange = pal.wild ? t('pokedex.wildRange', { min: pal.wild[0], max: pal.wild[1] }) : t('pokedex.breedOnly')

  return (
    <Dialog.Root open={!!palId} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="pokedex-dossier__overlay" />
        <Dialog.Content className="pokedex-dossier" aria-describedby={undefined} style={{ '--pokedex-element': elementInfo.color } as CSSProperties}>
          <div className="pokedex-dossier__hero">
            <div className="pokedex-dossier__hero-meta"><span>{dexLabel(pal)}</span><span>{elementInfo.label}</span></div>
            <Button variant="ghost" size="icon-sm" className="pokedex-dossier__close" aria-label={t('pokedex.close')} onClick={onClose}><X aria-hidden="true" /></Button>
            <PalIcon palId={pal.id} size={188} bare className="pokedex-dossier__art" />
            <div className="pokedex-dossier__title">
              <Dialog.Title>{palName(pal)}</Dialog.Title>
              <span className={owned ? 'is-owned' : 'is-missing'}>{owned ? <><PackageCheck aria-hidden="true" /> {t('pokedex.owned')}</> : <><Crosshair aria-hidden="true" /> {t('pokedex.needsCapture')}</>}</span>
            </div>
          </div>

          <div className="pokedex-dossier__content">
            <section className="pokedex-dossier__lore">
              <div className="pokedex-dossier__section-heading"><BookOpen aria-hidden="true" /> <h3>{t('pokedex.lore')}</h3></div>
              <p>{t('pokedex.loreText', { name: palName(pal), element: elementInfo.label.toLowerCase(), dex: dexLabel(pal) })}</p>
            </section>

            <div className="pokedex-dossier__facts">
              <div><span>{t('pokedex.element')}</span><strong>{pal.elements.map((element) => ELEMENT_INFO[element].label).join(' / ')}</strong></div>
              <div><span>{t('pokedex.breedingPower')}</span><strong>{pal.power.toLocaleString(locale)}</strong></div>
              <div><span>{t('pokedex.habitat')}</span><strong>{wildRange}</strong></div>
              <div><span>{t('pokedex.drops')}</span><strong>{t('pokedex.marketValue', { value: pal.price.toLocaleString(locale) })}</strong></div>
            </div>

            <PokedexWork pal={pal} />

            <section className="pokedex-dossier__section">
              <div className="pokedex-dossier__section-heading"><Sparkles aria-hidden="true" /> <h3>{t('pokedex.partnerSkill')}</h3></div>
              <p className="pokedex-dossier__partner"><strong>{t('pokedex.partnerProfile')}</strong> {t('pokedex.partnerText', { work: topWork })}</p>
            </section>

            <section className="pokedex-dossier__section">
              <div className="pokedex-dossier__section-heading"><Sparkles aria-hidden="true" /> <h3>{t('pokedex.bestPassives')}</h3></div>
              <div className="flex flex-wrap gap-1.5">{dossier.bestPassives.map((id) => <PassiveBadge key={id} passive={db.passiveById.get(id)} />)}</div>
            </section>

            <section className="pokedex-dossier__section">
              <div className="pokedex-dossier__section-heading"><Box aria-hidden="true" /> <h3>{t('pokedex.recommendedBuilds')}</h3></div>
              {dossier.builds.length ? <ul className="pokedex-build-list">{dossier.builds.slice(0, 3).map((build) => { const RoleIcon = ROLE_ICON[build.role].icon; return <li key={build.role}><span><RoleIcon className={cn('size-3.5', ROLE_ICON[build.role].className)} aria-hidden="true" /> {t(`buildAdvisor.role.${build.role}` as TranslationKey)}</span><b>{build.rating}/5</b></li> })}</ul> : <p className="pokedex-dossier__muted">{t('pokedex.noBuilds')}</p>}
            </section>

            <section className="pokedex-dossier__section">
              <div className="pokedex-dossier__section-heading"><MapPin aria-hidden="true" /> <h3>{t('pokedex.related')}</h3></div>
              <ul className="pokedex-related-grid">{dossier.related.map((related) => <li key={related.id}><button type="button" onClick={() => onOpen(related.id)}><PalIcon palId={related.id} size={34} bare /><span>{palName(related)}</span><ChevronRight aria-hidden="true" /></button></li>)}</ul>
            </section>

            <section className="pokedex-dossier__section">
              <div className="pokedex-dossier__section-heading"><Crosshair aria-hidden="true" /> <h3>{t('pokedex.recipes')}</h3></div>
              {dossier.recipes.length ? <ul className="pokedex-recipe-list">{dossier.recipes.map(([a, b]) => <li key={`${a}-${b}`}><button type="button" onClick={() => onOpen(a)}>{palName(db.palById.get(a))}</button><span>+</span><button type="button" onClick={() => onOpen(b)}>{palName(db.palById.get(b))}</button></li>)}</ul> : <p className="pokedex-dossier__muted">{t('pokedex.noRecipes')}</p>}
            </section>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export function PokedexProvider({ children }: { children: ReactNode }) {
  const [palId, setPalId] = useState<string | null>(null)
  const controls = useMemo(() => ({ openPal: setPalId }), [])
  return <PokedexContext.Provider value={controls}>{children}<PokedexPanel palId={palId} onClose={() => setPalId(null)} onOpen={setPalId} /></PokedexContext.Provider>
}
