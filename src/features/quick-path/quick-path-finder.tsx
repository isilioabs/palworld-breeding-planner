/**
 * Búsqueda rápida ("Path Finder"): una sola pantalla para responder "¿cómo
 * llego a este Pal desde lo que ya tengo?" sin pasar por pasivas ni por el
 * flujo completo del planificador. Vive en su PROPIO estado local -no
 * `usePlannerStore`- para no interferir con un proyecto multi-pasiva que el
 * usuario pueda tener en curso en la pantalla principal.
 *
 * El buscador real (`plan()`) ya trata D=0 pasivas como un caso valido -aqui
 * solo se expone como su propio producto, de una sola pantalla, en vez de ser
 * un efecto lateral de no tocar el selector de pasivas en el flujo grande.
 */
import { useMemo, useState } from 'react'
import { ArrowLeft, SlidersHorizontal, X, Zap } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PalIcon } from '@/components/pal-icon'
import { PalPicker } from '@/components/pal-picker'
import { PalaxisMark } from '@/components/palaxis-mark'
import { BreedingTree } from '@/features/plan/breeding-tree'
import { plan } from '@/domain/breeding'
import { loadDatabase, palName } from '@/domain/database'
import type { OwnedPal } from '@/domain/types'
import { useT } from '@/i18n/language-store'
import { usePlannerStore } from '@/state/planner-store'
import { track } from '@/lib/analytics'

const MAX_OWNED = 24

function toOwned(palIds: string[]): OwnedPal[] {
  // Un uid derivado del palId (no aleatorio): esta pantalla no persiste nada,
  // asi que solo hace falta que sea estable durante la sesion, no unico
  // globalmente. `Set`-like via PalPicker en modo multi ya evita duplicados.
  return palIds.map((palId) => ({ uid: `quick_${palId}`, palId, passives: [] }))
}

export function QuickPathFinder({ onExit }: { onExit: () => void }) {
  const db = loadDatabase()
  const t = useT()
  const { dispatch } = usePlannerStore()
  const [targetPalId, setTargetPalId] = useState<string | null>(null)
  const [ownedIds, setOwnedIds] = useState<string[]>([])

  const owned = useMemo(() => toOwned(ownedIds), [ownedIds])
  const result = useMemo(() => {
    if (!targetPalId) return null
    return plan({ targetPalId, targetPalIds: [targetPalId], desiredPassives: [], owned, mode: 'hybrid' })
  }, [targetPalId, owned])

  const openFullPlanner = () => {
    if (targetPalId) dispatch({ type: 'setTarget', palId: targetPalId })
    track('quick_path_open_full_planner')
    onExit()
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex items-center justify-between gap-3">
        <button
          type="button"
          className="flex items-center gap-2 rounded-lg text-left text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={onExit}
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {t('quickPath.back')}
        </button>
        <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
          <PalaxisMark className="size-4 text-primary" />
          Palaxis
        </span>
      </header>

      <div className="space-y-1.5">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
          <Zap className="size-6 text-primary" aria-hidden="true" />
          {t('quickPath.title')}
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">{t('quickPath.subtitle')}</p>
      </div>

      <Card>
        <CardHeader className="gap-1 pb-3">
          <CardTitle className="text-sm font-bold">{t('quickPath.targetLabel')}</CardTitle>
          <p className="text-xs text-muted-foreground">{t('quickPath.targetHint')}</p>
        </CardHeader>
        <CardContent>
          <PalPicker value={targetPalId} onSelect={setTargetPalId} label={t('quickPath.targetPlaceholder')} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-1 pb-3">
          <CardTitle className="text-sm font-bold">{t('quickPath.ownedLabel')}</CardTitle>
          <p className="text-xs text-muted-foreground">{t('quickPath.ownedHint')}</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <PalPicker
            selectedIds={ownedIds}
            onSelectedIdsChange={setOwnedIds}
            max={MAX_OWNED}
            label={t('quickPath.ownedPlaceholder')}
            closeOnSelect={false}
          />
          {ownedIds.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {ownedIds.map((palId) => (
                <li key={palId}>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card py-1 pl-1 pr-2 text-xs font-semibold transition-colors hover:border-destructive/50 hover:bg-destructive/10"
                    onClick={() => setOwnedIds((ids) => ids.filter((id) => id !== palId))}
                    aria-label={t('quickPath.removeOwned', { name: palName(db.palById.get(palId)) })}
                  >
                    <PalIcon palId={palId} size={20} />
                    {palName(db.palById.get(palId))}
                    <X className="size-3" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <QuickPathResult targetPalId={targetPalId} result={result} onOpenFullPlanner={openFullPlanner} />
    </div>
  )
}

function QuickPathResult({
  targetPalId,
  result,
  onOpenFullPlanner,
}: {
  targetPalId: string | null
  result: ReturnType<typeof plan> | null
  onOpenFullPlanner: () => void
}) {
  const t = useT()

  if (!targetPalId) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
          <Zap className="size-6 text-muted-foreground/60" aria-hidden="true" />
          {t('quickPath.emptyState')}
        </CardContent>
      </Card>
    )
  }

  if (!result?.ok) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
          {result?.reason ?? t('quickPath.noRoute')}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-muted-foreground">
        <span className="rounded-full border border-border bg-card px-2.5 py-1">
          {t('quickPath.statGenerations', { count: result.stats!.generations })}
        </span>
        <span className="rounded-full border border-border bg-card px-2.5 py-1">
          {t('quickPath.statSteps', { count: result.stats!.steps })}
        </span>
        <span className="rounded-full border border-border bg-card px-2.5 py-1">
          {t('quickPath.statCaptures', { count: result.stats!.capturesNeeded })}
        </span>
      </div>
      <BreedingTree root={result.root} />
      <button
        type="button"
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border py-3 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
        onClick={onOpenFullPlanner}
      >
        <SlidersHorizontal className="size-3.5" aria-hidden="true" />
        {t('quickPath.openFullPlanner')}
      </button>
    </div>
  )
}
