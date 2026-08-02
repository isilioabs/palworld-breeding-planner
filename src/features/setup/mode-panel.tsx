import { Backpack, Egg, Swords } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RichTooltip } from '@/components/rich-tooltip'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MODE_ORDER, modeHint, modeLabel } from '@/domain/breeding/cost'
import type { PlannerMode } from '@/domain/types'
import { useT } from '@/i18n/language-store'
import { usePlannerStore } from '@/state/planner-store'

const ICONS: Record<PlannerMode, typeof Egg> = {
  collection: Backpack,
  breeding: Egg,
  hybrid: Swords,
}

const ORDER = MODE_ORDER

export function ModePanel() {
  const { state, dispatch } = usePlannerStore()
  const t = useT()

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('modePanel.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {/*
          Icono ENCIMA de la etiqueta (no en fila) y sin truncate: en fila,
          "Explorador"/"Pacifista" en un sidebar de 360px con 3 columnas se
          recortaban a "Explor..." — ilegible. En columna cada pestaña usa
          todo su ancho para el texto en vez de compartirlo con el icono.
        */}
        <Tabs value={state.mode} onValueChange={(mode) => dispatch({ type: 'setMode', mode: mode as PlannerMode })}>
          <TabsList className="grid h-auto w-full grid-cols-3 gap-1">
            {ORDER.map((mode) => {
              const Icon = ICONS[mode]
              return (
                <RichTooltip key={mode} title={modeLabel(mode)} description={modeHint(mode)}>
                  <TabsTrigger value={mode} className="flex-col gap-1 whitespace-normal px-1.5 py-2.5 text-[11px] leading-tight [&_svg]:size-4">
                    <Icon aria-hidden="true" />
                    <span>{modeLabel(mode)}</span>
                  </TabsTrigger>
                </RichTooltip>
              )
            })}
          </TabsList>
        </Tabs>
        <p className="text-xs leading-relaxed text-muted-foreground">{modeHint(state.mode)}</p>
      </CardContent>
    </Card>
  )
}
