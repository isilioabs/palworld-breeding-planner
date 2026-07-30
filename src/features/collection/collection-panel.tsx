import { useState } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PalCombobox } from '@/components/pal-combobox'
import { PassivePicker } from '@/components/passive-picker'
import { PalIcon } from '@/components/pal-icon'
import { loadDatabase, palName, passiveName, passiveSummary } from '@/domain/database'
import { usePlannerStore } from '@/state/planner-store'
import { cn } from '@/lib/utils'

const MAX_PASSIVES_PER_PAL = 4

export function CollectionPanel() {
  const db = loadDatabase()
  const { state, dispatch } = usePlannerStore()
  const [pendingPal, setPendingPal] = useState<string | null>(null)

  const desiredSet = new Set(state.desiredPassives)

  return (
    <Card>
      <CardHeader>
        <CardTitle>2. Tu coleccion</CardTitle>
        <CardDescription>
          Anade los Pals que ya tienes y marca sus pasivas. El planificador los usara como punto de partida.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <PalCombobox value={pendingPal} onChange={setPendingPal} placeholder="Anadir un Pal a tu caja..." />
          <Button
            size="icon"
            disabled={!pendingPal}
            aria-label="Anadir a la coleccion"
            onClick={() => {
              if (!pendingPal) return
              dispatch({ type: 'addOwned', palId: pendingPal })
              setPendingPal(null)
            }}
          >
            <Plus />
          </Button>
        </div>

        {state.owned.length === 0 ? (
          <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
            Tu coleccion esta vacia.
            <br />
            Sin ella solo se podran planificar rutas partiendo de capturas.
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
                        label="Pasiva"
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
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Quitar ${palName(pal)}`}
                        onClick={() => dispatch({ type: 'removeOwned', uid: entry.uid })}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>

                    {entry.passives.length > 0 && (
                      <ul className="mt-2 flex flex-wrap gap-1">
                        {entry.passives.map((id) => (
                          <li key={id}>
                            <Badge
                              variant={desiredSet.has(id) ? 'good' : 'muted'}
                              className={cn('pr-1', desiredSet.has(id) && 'font-semibold')}
                              title={`${passiveName(db.passiveById.get(id))}\n${passiveSummary(db.passiveById.get(id))}`}
                            >
                              {passiveName(db.passiveById.get(id))}
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="size-4 rounded-sm hover:bg-transparent hover:opacity-70"
                                aria-label="Quitar pasiva"
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
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                )
              })}
            </ul>
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-muted-foreground">{state.owned.length} Pals en tu caja</span>
              <Button variant="ghost" size="sm" onClick={() => dispatch({ type: 'clearOwned' })}>
                Vaciar
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
