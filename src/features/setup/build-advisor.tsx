import { Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { PassiveBadge } from '@/components/passive-badge'
import { getBuildsFor } from '@/domain/builds'
import { loadDatabase } from '@/domain/database'
import { useT } from '@/i18n/language-store'
import type { TranslationKey } from '@/i18n/translations'
import { usePlannerStore } from '@/state/planner-store'
import { track } from '@/lib/analytics'
import { cn } from '@/lib/utils'

/**
 * Build Advisor: sugiere hasta 5 builds (Trabajador de base, Combate,
 * Tanque, Rancho, Soporte) para el Pal objetivo, con 4 pasivas cada uno, y
 * las aplica de un clic al selector de "Pasivas deseadas" existente
 * (accion `setDesired`, ya presente en el reducer -no se toca el algoritmo
 * ni el flujo de crianza, solo se rellena lo que el usuario podria escribir
 * a mano en el mismo selector de siempre).
 *
 * Los datos (que rol y cuantas estrellas) salen de src/data/builds.json,
 * generado aparte por scripts/generate-build-advisor.mjs a partir de
 * estadisticas reales del juego -actualizarlo tras un parche no toca este
 * componente ni ningun otro, solo el JSON.
 */
export function BuildAdvisor({ showHeading = true }: { showHeading?: boolean }) {
  const { state, dispatch } = usePlannerStore()
  const t = useT()
  const builds = getBuildsFor(state.targetPalId)

  if (builds.length === 0) return null

  const db = loadDatabase()

  return (
    <div className="space-y-2">
      {showHeading && (
        <div className="flex items-center gap-1.5">
          <Star className="size-3.5 text-amber-400" aria-hidden="true" fill="currentColor" />
          <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{t('buildAdvisor.title')}</h3>
        </div>
      )}
      {/*
        Una columna, no dos: en el ancho real del sidebar (280-480px) un
        grid de 2 columnas deja ~130px por carta, y una pasiva larga como
        "Remarkable Craftsmanship" no cabe -el badge la recorta a
        "Remarkable Cr...". A todo el ancho SI cabe sin recortar. Las
        estrellas van en su propia fila bajo el titulo (no al lado): al
        lado competian por el mismo ancho que el nombre del rol y se
        llegaban a salir de la tarjeta con nombres largos ("Base Worker").
      */}
      <div className="space-y-2">
        {builds.map((build) => {
          const applied =
            state.desiredPassives.length === build.passives.length && build.passives.every((id) => state.desiredPassives.includes(id))
          return (
            <Card
              key={build.role}
              className={cn(
                'group overflow-hidden border-border/80 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md',
                applied && 'ring-1 ring-primary/60',
              )}
            >
              <CardContent className="space-y-2.5 p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-1.5 text-sm font-bold">
                    <span className="shrink-0 text-base" aria-hidden="true">
                      {build.icon}
                    </span>
                    <span className="truncate">{t(`buildAdvisor.role.${build.role}` as TranslationKey)}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-px" aria-label={`${build.rating}/5`}>
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star
                        key={i}
                        className={cn('size-3', i < build.rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/25')}
                        aria-hidden="true"
                      />
                    ))}
                  </span>
                </div>
                <p className="text-[11px] leading-snug text-muted-foreground">{t(build.descKey as TranslationKey)}</p>
                <div className="flex flex-wrap gap-1">
                  {build.passives.map((id) => (
                    <PassiveBadge key={id} passive={db.passiveById.get(id)} />
                  ))}
                </div>
                <Button
                  size="sm"
                  variant={applied ? 'secondary' : 'outline'}
                  className="w-full gap-1.5"
                  onClick={() => { dispatch({ type: 'setDesired', passives: build.passives }); track('build_applied', { role: build.role }) }}
                >
                  {applied ? t('buildAdvisor.applied') : t('buildAdvisor.apply')}
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
