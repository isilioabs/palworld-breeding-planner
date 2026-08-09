/**
 * Version cliente, interactiva, de la ficha publica de un Pal
 * (`/pals/<slug>`). El HTML que ve un crawler o el primer pintado viene del
 * script de prerenderizado (`scripts/prerender-pal-pages.ts`, mismo
 * `buildPalDossier()`) -esta es la que React monta de verdad al cargar la
 * pagina (`createRoot().render()` reemplaza el contenido, no lo reconcilia:
 * no hace falta que coincidan byte a byte, ver plan).
 */
import { useMemo } from 'react'
import { ArrowLeft, Compass, Crosshair, MapPin, Package, Shield, Sparkles, Swords, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { PalIcon } from '@/components/pal-icon'
import { PassiveBadge } from '@/components/passive-badge'
import { PageSection } from '@/components/page-heading'
import { buildPalDossier } from '@/domain/pal-dossier'
import { getPalSlugIndex, palSlug } from '@/domain/slug'
import { dexLabel, loadDatabase, palName } from '@/domain/database'
import { ELEMENT_INFO } from '@/domain/element'
import type { Pal } from '@/domain/types'
import { useT } from '@/i18n/language-store'
import { usePlannerStore } from '@/state/planner-store'
import { track } from '@/lib/analytics'

interface PalPageProps {
  slug: string
  /** Vuelve a la landing o al planificador, segun de donde se venga. */
  onExit: () => void
  /** Siembra este Pal como objetivo y abre el planificador completo. */
  onOpenTarget: (palId: string) => void
  /** Navega a la ficha de OTRO Pal (enlaces internos entre fichas). */
  onNavigate: (slug: string) => void
}

export function PalPage({ slug, onExit, onOpenTarget, onNavigate }: PalPageProps) {
  const db = loadDatabase()
  const t = useT()
  const { dispatch } = usePlannerStore()
  const dossier = useMemo(() => {
    const palId = getPalSlugIndex(db.pals).get(slug)
    return palId ? buildPalDossier(palId) : null
  }, [db.pals, slug])

  const openInPlanner = () => {
    if (!dossier) return
    dispatch({ type: 'setTarget', palId: dossier.pal.id })
    track('quick_path_open_full_planner')
    onOpenTarget(dossier.pal.id)
  }

  if (!dossier) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-sm text-muted-foreground">{t('palPage.notFound')}</p>
        <Button variant="outline" onClick={onExit}><ArrowLeft className="size-4" aria-hidden="true" />{t('quickPath.back')}</Button>
      </div>
    )
  }

  const { pal, elementInfo, bestPassives, recipes, related, wildLevelRange, combatStats, drops, activeSkills, partnerSkill, partnerSkillSource, wildSpawns, wikiSourceUrl } = dossier
  const hasWikiData = activeSkills.length > 0 || partnerSkillSource === 'wiki' || wildSpawns.length > 0

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <button type="button" className="flex w-fit items-center gap-2 rounded-lg text-left text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={onExit}>
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t('quickPath.back')}
      </button>

      <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:items-start sm:text-left">
        <PalIcon palId={pal.id} size={110} bare />
        <div className="space-y-1.5">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">{dexLabel(pal)} · {elementInfo.label}</p>
          <h1 className="text-3xl font-bold tracking-tight">{palName(pal)}</h1>
          <p className="max-w-xl text-sm text-muted-foreground">{t('palPage.intro', { name: palName(pal) })}</p>
        </div>
      </div>

      <Button size="lg" className="w-full sm:w-auto" onClick={openInPlanner}>
        {t('palPage.planRoute', { name: palName(pal) })}
      </Button>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile label={t('pokedex.element')} value={pal.elements.map((el) => ELEMENT_INFO[el].label).join(' / ')} />
        <StatTile label={t('pokedex.habitat')} value={wildLevelRange ? t('pokedex.wildRange', { min: wildLevelRange[0], max: wildLevelRange[1] }) : t('pokedex.breedOnly')} />
        <StatTile label={t('pokedex.breedingPower')} value={pal.power.toLocaleString()} />
        <StatTile label={t('pokedex.drops')} value={t('pokedex.marketValue', { value: pal.price.toLocaleString() })} />
      </div>

      <Card>
        <CardContent className="space-y-2 p-4">
          <PageSection icon={Sparkles} title={t('pokedex.bestPassives')} />
          <div className="flex flex-wrap gap-1.5">
            {bestPassives.map((passive) => <PassiveBadge key={passive.id} passive={passive} />)}
          </div>
        </CardContent>
      </Card>

      {combatStats && (
        <Card>
          <CardContent className="space-y-2 p-4">
            <PageSection icon={Swords} title={t('pokedex.combatStats')} />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <StatTile label={t('pokedex.hp')} value={String(combatStats.hp)} />
              <StatTile label={t('pokedex.meleeAttack')} value={String(combatStats.meleeAttack)} />
              <StatTile label={t('pokedex.shotAttack')} value={String(combatStats.shotAttack)} />
              <StatTile label={t('pokedex.defense')} value={String(combatStats.defense)} />
              <StatTile label={t('pokedex.support')} value={String(combatStats.support)} />
            </div>
          </CardContent>
        </Card>
      )}

      {drops.length > 0 && (
        <Card>
          <CardContent className="space-y-2 p-4">
            <PageSection icon={Package} title={t('pokedex.dropItems')} />
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {drops.map((drop) => (
                <li key={drop.itemId} className="flex items-center justify-between gap-2 rounded-lg border border-border/70 px-2.5 py-1.5 text-sm">
                  <span className="truncate">{drop.itemName}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{drop.min === drop.max ? drop.min : `${drop.min}-${drop.max}`} · {drop.rate}%</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {activeSkills.length > 0 && (
        <Card>
          <CardContent className="space-y-2 p-4">
            <PageSection icon={Zap} title={t('pokedex.activeSkills')} />
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {activeSkills.map((skill) => (
                <li key={skill.name} className="flex items-center justify-between gap-2 rounded-lg border border-border/70 px-2.5 py-1.5 text-sm">
                  <span className="truncate">{skill.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{t('pokedex.activeSkillLevel', { level: skill.level })}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {partnerSkill && (
        <Card>
          <CardContent className="space-y-2 p-4">
            <PageSection icon={Shield} title={t('pokedex.partnerSkill')} />
            <p className="text-sm"><strong>{partnerSkill.name}</strong> {partnerSkill.description && `— ${partnerSkill.description}`}</p>
            {partnerSkillSource === 'game8' && <p className="text-[11px] text-muted-foreground">{t('pokedex.partnerSkillAttribution')}</p>}
          </CardContent>
        </Card>
      )}

      {wildSpawns.length > 0 && (
        <Card>
          <CardContent className="space-y-2 p-4">
            <PageSection icon={Compass} title={t('pokedex.wildSpawn')} />
            <ul className="flex flex-wrap gap-2">
              {wildSpawns.map((spawn, i) => (
                <li key={`${spawn.region}-${i}`} className="rounded-full border border-border bg-card px-2.5 py-1 text-xs font-semibold">
                  {spawn.region}{spawn.coordinates ? ` (${spawn.coordinates[0]}, ${spawn.coordinates[1]})` : ''}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {hasWikiData && wikiSourceUrl && (
        <p className="text-center text-[11px] text-muted-foreground">
          {t('pokedex.dataAttribution')}{' '}
          <a href={wikiSourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="underline hover:text-foreground">{t('pokedex.viewSource')}</a>
        </p>
      )}

      <Card>
        <CardContent className="space-y-2 p-4">
          <PageSection icon={Crosshair} title={t('pokedex.recipes')} />
          {recipes.length ? (
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {recipes.map(([a, b]) => (
                <li key={`${a}-${b}`} className="flex items-center gap-2 rounded-lg border border-border/70 px-2.5 py-1.5 text-sm">
                  <PalIcon palId={a} size={22} /><span className="truncate">{palName(db.palById.get(a))}</span>
                  <span className="text-muted-foreground">+</span>
                  <PalIcon palId={b} size={22} /><span className="truncate">{palName(db.palById.get(b))}</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted-foreground">{t('pokedex.noRecipes')}</p>}
        </CardContent>
      </Card>

      {related.length > 0 && (
        <Card>
          <CardContent className="space-y-2 p-4">
            <PageSection icon={MapPin} title={t('pokedex.related')} />
            <ul className="flex flex-wrap gap-2">
              {related.map((entry) => <li key={entry.id}><PalPageRelatedLink pal={entry} onNavigate={onNavigate} /></li>)}
            </ul>
          </CardContent>
        </Card>
      )}

      <footer className="pt-4 text-center text-xs text-muted-foreground">
        <Swords className="mx-auto mb-2 size-4 opacity-60" aria-hidden="true" />
        {t('layout.footer')}
      </footer>
    </div>
  )
}

/**
 * Enlace real (`<a href>`), no un boton: es exactamente el tipo de enlace
 * interno que un crawler necesita seguir para descubrir el resto de fichas
 * de Pal. `onNavigate` intercepta el click para que, dentro de la app, no
 * recargue toda la pagina -pero clic con Ctrl/rueda/"abrir en pestaña nueva"
 * sigue funcionando como un link normal (sin preventDefault en esos casos).
 */
function PalPageRelatedLink({ pal, onNavigate }: { pal: Pal; onNavigate: (slug: string) => void }) {
  const slug = palSlug(pal)
  return (
    <a
      href={`/pals/${slug}`}
      onClick={(event) => {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
        event.preventDefault()
        onNavigate(slug)
      }}
      className="flex items-center gap-1.5 rounded-full border border-border bg-card py-1 pl-1 pr-2.5 text-xs font-semibold no-underline transition-colors hover:border-primary/50"
    >
      <PalIcon palId={pal.id} size={22} />
      {palName(pal)}
    </a>
  )
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-center">
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  )
}
