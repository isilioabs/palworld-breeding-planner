import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PassiveBadge } from '@/components/passive-badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { PalCombobox } from '@/components/pal-combobox'
import { PassivePicker } from '@/components/passive-picker'
import { BuildAdvisor } from './build-advisor'
import { loadDatabase, passiveName } from '@/domain/database'
import { useT } from '@/i18n/language-store'
import { MAX_DESIRED_PASSIVES, usePlannerStore } from '@/state/planner-store'

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
        <div className="space-y-1.5">
          <Label htmlFor="target">{t('targetPanel.targetLabel')}</Label>
          <PalCombobox
            triggerId="target-pal-trigger"
            value={state.targetPalId}
            onChange={(palId) => dispatch({ type: 'setTarget', palId })}
            placeholder={t('targetPanel.targetPlaceholder')}
          />
        </div>

        <BuildAdvisor />

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
            <ul className="flex flex-wrap gap-1.5">
              {state.desiredPassives.map((id) => {
                const passive = db.passiveById.get(id)
                return (
                  <li key={id}>
                    <PassiveBadge passive={passive} className="pr-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="size-4 rounded-sm hover:bg-transparent hover:opacity-70"
                        aria-label={t('targetPanel.removePassive', { name: passiveName(passive) })}
                        onClick={() => dispatch({ type: 'toggleDesired', passiveId: id })}
                      >
                        <X className="size-3" />
                      </Button>
                    </PassiveBadge>
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
