import { useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { captureDifficulty, getResolver } from '@/domain/breeding'
import { PalIcon } from '@/components/pal-icon'
import { loadDatabase, palName } from '@/domain/database'

const PAGE = 24

/** Todas las parejas de padres que producen el Pal objetivo. */
export function DirectRecipes({ targetPalId }: { targetPalId: string }) {
  const db = loadDatabase()
  const [limit, setLimit] = useState(PAGE)

  const pairs = useMemo(() => {
    // Se ordena por la misma dificultad de captura que usa el planificador, para
    // que arriba queden las parejas realmente faciles de montar (los Pals que
    // solo salen criando puntuan Infinity y caen al final).
    const difficulty = (id: string) => {
      const pal = db.palById.get(id)
      if (!pal) return Number.POSITIVE_INFINITY
      const d = captureDifficulty(pal)
      return Number.isFinite(d) ? d : 10
    }
    return getResolver()
      .parentsOf(targetPalId)
      .map(([a, b]) => ({ a, b, cost: difficulty(a) + difficulty(b) }))
      .sort((x, y) => x.cost - y.cost)
  }, [targetPalId, db.palById])

  const target = db.palById.get(targetPalId)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Combinaciones directas para {palName(target)}</CardTitle>
        <CardDescription>
          {pairs.length === 0
            ? 'Ninguna pareja produce este Pal: solo se consigue capturandolo.'
            : `${pairs.length} parejas dan este Pal, ordenadas de mas comun a mas rara.`}
        </CardDescription>
      </CardHeader>
      {pairs.length > 0 && (
        <CardContent className="space-y-2">
          <ul className="grid gap-1 sm:grid-cols-2">
            {pairs.slice(0, limit).map(({ a, b }) => (
              <li
                key={`${a}|${b}`}
                className="flex items-center gap-1.5 rounded-md border border-border bg-background/40 px-2 py-1.5 text-xs"
              >
                <PalIcon palId={a} size={24} />
                <span className="min-w-0 flex-1 truncate">{palName(db.palById.get(a))}</span>
                <span className="shrink-0 text-muted-foreground">+</span>
                <PalIcon palId={b} size={24} />
                <span className="min-w-0 flex-1 truncate">{palName(db.palById.get(b))}</span>
              </li>
            ))}
          </ul>
          {limit < pairs.length && (
            <Button variant="outline" size="sm" className="w-full" onClick={() => setLimit((l) => l + PAGE * 2)}>
              Ver mas ({pairs.length - limit} restantes)
            </Button>
          )}
        </CardContent>
      )}
    </Card>
  )
}
