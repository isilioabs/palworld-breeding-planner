import { Backpack, Egg, Swords } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MODES, MODE_ORDER } from '@/domain/breeding/cost'
import type { PlannerMode } from '@/domain/types'
import { usePlannerStore } from '@/state/planner-store'

const ICONS: Record<PlannerMode, typeof Egg> = {
  collection: Backpack,
  breeding: Egg,
  hybrid: Swords,
}

const ORDER = MODE_ORDER

export function ModePanel() {
  const { state, dispatch } = usePlannerStore()

  return (
    <Card>
      <CardHeader>
        <CardTitle>3. Como optimizar</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <Tabs value={state.mode} onValueChange={(mode) => dispatch({ type: 'setMode', mode: mode as PlannerMode })}>
          <TabsList className="grid w-full grid-cols-3">
            {ORDER.map((mode) => {
              const Icon = ICONS[mode]
              return (
                <TabsTrigger key={mode} value={mode} className="text-xs" title={MODES[mode].label}>
                  <Icon />
                  <span className="truncate">{MODES[mode].label}</span>
                </TabsTrigger>
              )
            })}
          </TabsList>
        </Tabs>
        <p className="text-xs leading-relaxed text-muted-foreground">{MODES[state.mode].hint}</p>
      </CardContent>
    </Card>
  )
}
