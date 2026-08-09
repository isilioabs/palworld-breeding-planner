import { createContext, useContext, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { BookOpen, Box, ChevronRight, Compass, Crosshair, MapPin, Package, PackageCheck, Shield, Sparkles, Swords, X, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PassiveBadge } from '@/components/passive-badge'
import { PalIcon } from '@/components/pal-icon'
import { buildPalDossier } from '@/domain/pal-dossier'
import { dexLabel, loadDatabase, palName, workTypeLabel } from '@/domain/database'
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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- buildPalDossier ya lee loadDatabase() internamente; solo el id decide si hay que recalcular.
  const dossier = useMemo(() => (palId ? buildPalDossier(palId) : null), [palId])

  if (!pal || !dossier) return null
  const { elementInfo, bestPassives, recipes, related, combatStats, drops, activeSkills, partnerSkill, partnerSkillSource, wildSpawns, wikiSourceUrl } = dossier
  const hasWikiData = activeSkills.length > 0 || partnerSkillSource === 'wiki' || wildSpawns.length > 0
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
              <div className="flex flex-wrap gap-1.5">{bestPassives.map((passive) => <PassiveBadge key={passive.id} passive={passive} />)}</div>
            </section>

            {combatStats && (
              <section className="pokedex-dossier__section">
                <div className="pokedex-dossier__section-heading"><Swords aria-hidden="true" /> <h3>{t('pokedex.combatStats')}</h3></div>
                <ul className="pokedex-work-grid">
                  <li><span>{t('pokedex.hp')}</span><b>{combatStats.hp}</b><i aria-hidden="true" /></li>
                  <li><span>{t('pokedex.meleeAttack')}</span><b>{combatStats.meleeAttack}</b><i aria-hidden="true" /></li>
                  <li><span>{t('pokedex.shotAttack')}</span><b>{combatStats.shotAttack}</b><i aria-hidden="true" /></li>
                  <li><span>{t('pokedex.defense')}</span><b>{combatStats.defense}</b><i aria-hidden="true" /></li>
                  <li><span>{t('pokedex.support')}</span><b>{combatStats.support}</b><i aria-hidden="true" /></li>
                </ul>
              </section>
            )}

            {drops.length > 0 && (
              <section className="pokedex-dossier__section">
                <div className="pokedex-dossier__section-heading"><Package aria-hidden="true" /> <h3>{t('pokedex.dropItems')}</h3></div>
                <ul className="pokedex-recipe-list">
                  {drops.map((drop) => (
                    <li key={drop.itemId}><span>{drop.itemName}</span><span className="pokedex-dossier__muted">{drop.min === drop.max ? drop.min : `${drop.min}-${drop.max}`} · {drop.rate}%</span></li>
                  ))}
                </ul>
              </section>
            )}

            {activeSkills.length > 0 && (
              <section className="pokedex-dossier__section">
                <div className="pokedex-dossier__section-heading"><Zap aria-hidden="true" /> <h3>{t('pokedex.activeSkills')}</h3></div>
                <ul className="pokedex-recipe-list">
                  {activeSkills.map((skill) => (
                    <li key={skill.name}><span>{skill.name}</span><span className="pokedex-dossier__muted">{t('pokedex.activeSkillLevel', { level: skill.level })}</span></li>
                  ))}
                </ul>
              </section>
            )}

            {partnerSkill && (
              <section className="pokedex-dossier__section">
                <div className="pokedex-dossier__section-heading"><Shield aria-hidden="true" /> <h3>{t('pokedex.partnerSkill')}</h3></div>
                <p className="pokedex-dossier__partner"><strong>{partnerSkill.name}</strong> {partnerSkill.description}</p>
                {partnerSkillSource === 'game8' && <p className="pokedex-dossier__muted" style={{ fontSize: '11px' }}>{t('pokedex.partnerSkillAttribution')}</p>}
              </section>
            )}

            {wildSpawns.length > 0 && (
              <section className="pokedex-dossier__section">
                <div className="pokedex-dossier__section-heading"><Compass aria-hidden="true" /> <h3>{t('pokedex.wildSpawn')}</h3></div>
                <ul className="pokedex-related-grid">
                  {wildSpawns.map((spawn, i) => (
                    <li key={`${spawn.region}-${i}`}>{spawn.region}{spawn.coordinates ? ` (${spawn.coordinates[0]}, ${spawn.coordinates[1]})` : ''}</li>
                  ))}
                </ul>
              </section>
            )}

            {hasWikiData && wikiSourceUrl && (
              <p className="pokedex-dossier__muted" style={{ fontSize: '11px', textAlign: 'center' }}>
                {t('pokedex.dataAttribution')}{' '}
                <a href={wikiSourceUrl} target="_blank" rel="noopener noreferrer nofollow">{t('pokedex.viewSource')}</a>
              </p>
            )}

            <section className="pokedex-dossier__section">
              <div className="pokedex-dossier__section-heading"><Box aria-hidden="true" /> <h3>{t('pokedex.recommendedBuilds')}</h3></div>
              {dossier.builds.length ? <ul className="pokedex-build-list">{dossier.builds.slice(0, 3).map((build) => { const RoleIcon = ROLE_ICON[build.role].icon; return <li key={build.role}><span><RoleIcon className={cn('size-3.5', ROLE_ICON[build.role].className)} aria-hidden="true" /> {t(`buildAdvisor.role.${build.role}` as TranslationKey)}</span><b>{build.rating}/5</b></li> })}</ul> : <p className="pokedex-dossier__muted">{t('pokedex.noBuilds')}</p>}
            </section>

            <section className="pokedex-dossier__section">
              <div className="pokedex-dossier__section-heading"><MapPin aria-hidden="true" /> <h3>{t('pokedex.related')}</h3></div>
              <ul className="pokedex-related-grid">{related.map((entry) => <li key={entry.id}><button type="button" onClick={() => onOpen(entry.id)}><PalIcon palId={entry.id} size={34} bare /><span>{palName(entry)}</span><ChevronRight aria-hidden="true" /></button></li>)}</ul>
            </section>

            <section className="pokedex-dossier__section">
              <div className="pokedex-dossier__section-heading"><Crosshair aria-hidden="true" /> <h3>{t('pokedex.recipes')}</h3></div>
              {recipes.length ? <ul className="pokedex-recipe-list">{recipes.map(([a, b]) => <li key={`${a}-${b}`}><button type="button" onClick={() => onOpen(a)}>{palName(db.palById.get(a))}</button><span>+</span><button type="button" onClick={() => onOpen(b)}>{palName(db.palById.get(b))}</button></li>)}</ul> : <p className="pokedex-dossier__muted">{t('pokedex.noRecipes')}</p>}
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
