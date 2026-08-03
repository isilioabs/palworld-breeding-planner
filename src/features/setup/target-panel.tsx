import { ChevronUp, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { PalPicker } from '@/components/pal-picker'
import { PassivePicker } from '@/components/passive-picker'
import { PalIcon } from '@/components/pal-icon'
import { loadDatabase, palName, passiveName } from '@/domain/database'
import { useT } from '@/i18n/language-store'
import { MAX_DESIRED_PASSIVES, MAX_PROJECT_TARGETS, usePlannerStore } from '@/state/planner-store'
import { track } from '@/lib/analytics'

export function TargetPanel() {
  const db = loadDatabase()
  const { state, dispatch } = usePlannerStore()
  const t = useT()

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('targetPanel.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="target">{t('targetPanel.projectTargetsLabel', { count: state.targetPalIds.length, max: MAX_PROJECT_TARGETS })}</Label>
          </div>
          <PalPicker
            onSelect={(palId) => { dispatch({ type: 'addTarget', palId }); track('target_selected', { target: palId }) }}
            label={state.targetPalIds.length > 0 ? t('targetPanel.addTargetPlaceholder') : t('targetPanel.targetPlaceholder')}
            className="target-project-picker"
            disabledIds={state.targetPalIds}
          />
          {state.targetPalIds.length > 0 && (
            <ul className="target-project-list">
              {state.targetPalIds.map((palId, index) => {
                const pal = db.palById.get(palId)
                return (
                  <li key={palId}>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="target-project-chip"
                      aria-label={t('targetPanel.removeTarget', { name: palName(pal) })}
                      onClick={() => dispatch({ type: 'removeTarget', palId })}
                    >
                      <PalIcon palId={palId} size={20} />
                      <span className="truncate">{palName(pal)}</span>
                      {index === 0 && <small>1</small>}
                      <X className="size-3.5" aria-hidden="true" />
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
          <p className="text-[11px] leading-snug text-muted-foreground">{t('targetPanel.targetHelp')}</p>
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label>{t('targetPanel.passivesLabel', { count: state.desiredPassives.length, max: MAX_DESIRED_PASSIVES })}</Label>
            <PassivePicker
              selected={state.desiredPassives}
              onToggle={(passiveId) => dispatch({ type: 'toggleDesired', passiveId })}
              max={MAX_DESIRED_PASSIVES}
            />
          </div>

          {state.desiredPassives.length === 0 ? (
            <p className="rounded-md border border-dashed border-border px-3 py-2.5 text-xs text-muted-foreground">
              {t('targetPanel.noPassives')}
            </p>
          ) : (
            <ul className="target-passive-slots">
              {state.desiredPassives.map((id) => {
                const passive = db.passiveById.get(id)
                return (
                  <li key={id}>
                    <Button variant="outline" size="sm" className="target-passive-slot" data-rank={passive?.rank ?? 0} aria-label={t('targetPanel.removePassive', { name: passiveName(passive) })} onClick={() => dispatch({ type: 'toggleDesired', passiveId: id })}>
                      <span className="target-passive-slot__arrows" aria-hidden="true">{Array.from({ length: Math.max(1, Math.min(3, Math.abs(passive?.rank ?? 0))) }, (_, index) => <ChevronUp key={index} />)}</span>
                      <span>{passiveName(passive)}</span><X className="size-3.5" aria-hidden="true" />
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
