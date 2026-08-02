import { useState } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PassiveBadge } from '@/components/passive-badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PalCombobox } from '@/components/pal-combobox'
import { PassivePicker } from '@/components/passive-picker'
import { PalIcon } from '@/components/pal-icon'
import { RichTooltip } from '@/components/rich-tooltip'
import { loadDatabase, palName } from '@/domain/database'
import { useT } from '@/i18n/language-store'
import { usePlannerStore } from '@/state/planner-store'

const MAX_PASSIVES_PER_PAL = 4

export function CollectionPanel() {
  const db = loadDatabase()
  const { state, dispatch } = usePlannerStore()
  const [pendingPal, setPendingPal] = useState<string | null>(null)
  const t = useT()

  const desiredSet = new Set(state.desiredPassives)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('collectionPanel.title')}</CardTitle>
        <CardDescription>{t('collectionPanel.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <PalCombobox value={pendingPal} onChange={setPendingPal} placeholder={t('collectionPanel.addPlaceholder')} />
          <RichTooltip title={t('collectionPanel.addTitle')} description={t('collectionPanel.addDescription')}>
            <Button
              size="icon"
              disabled={!pendingPal}
              aria-label={t('collectionPanel.addTitle')}
              onClick={() => {
                if (!pendingPal) return
                dispatch({ type: 'addOwned', palId: pendingPal })
                setPendingPal(null)
              }}
            >
              <Plus aria-hidden="true" />
            </Button>
          </RichTooltip>
        </div>

        {state.owned.length === 0 ? (
          <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
            {t('collectionPanel.emptyLine1')}
            <br />
            {t('collectionPanel.emptyLine2')}
          </p>
        ) : (
          <>
            <ul className="space-y-2">
              {state.owned.map((entry) => {
                const pal = db.palById.get(entry.palId)
                return (
                  <li key={entry.uid} className="rounded-lg border border-border bg-background/40 p-2.5">
                    <div className="flex items-center gap-2">
                      <PalIcon palId={entry.palId} size={30} />
                      <span className="flex-1 truncate text-sm font-medium">{palName(pal)}</span>
                      <PassivePicker
                        selected={entry.passives}
                        max={MAX_PASSIVES_PER_PAL}
                        label={t('collectionPanel.passiveLabel')}
                        onToggle={(passiveId) =>
                          dispatch({
                            type: 'updateOwned',
                            uid: entry.uid,
                            patch: {
                              passives: entry.passives.includes(passiveId)
                                ? entry.passives.filter((p) => p !== passiveId)
                                : [...entry.passives, passiveId].slice(0, MAX_PASSIVES_PER_PAL),
                            },
                          })
                        }
                      />
                      <RichTooltip title={t('collectionPanel.removePal', { name: palName(pal) })} description={t('collectionPanel.removePalDescription')}>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t('collectionPanel.removePal', { name: palName(pal) })}
                          onClick={() => dispatch({ type: 'removeOwned', uid: entry.uid })}
                        >
                          <Trash2 className="size-3.5" aria-hidden="true" />
                        </Button>
                      </RichTooltip>
                    </div>

                    {entry.passives.length > 0 && (
                      <ul className="mt-2 flex flex-wrap gap-1">
                        {entry.passives.map((id) => (
                          <li key={id}>
                            <PassiveBadge
                              passive={db.passiveById.get(id)}
                              className={desiredSet.has(id) ? 'pr-1 ring-1 ring-emerald-400/45' : 'pr-1'}
                            >
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="size-4 rounded-sm hover:bg-transparent hover:opacity-70"
                                aria-label={t('collectionPanel.removePassiveAria')}
                                onClick={() =>
                                  dispatch({
                                    type: 'updateOwned',
                                    uid: entry.uid,
                                    patch: { passives: entry.passives.filter((p) => p !== id) },
                                  })
                                }
                              >
                                <X className="size-3" />
                              </Button>
                            </PassiveBadge>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                )
              })}
            </ul>
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-muted-foreground">{t('collectionPanel.count', { count: state.owned.length })}</span>
              <Button variant="ghost" size="sm" onClick={() => dispatch({ type: 'clearOwned' })}>
                {t('collectionPanel.clear')}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
