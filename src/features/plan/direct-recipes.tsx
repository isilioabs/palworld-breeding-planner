import { useMemo, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { ChevronRight, GitFork, X } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { captureDifficulty, getResolver } from '@/domain/breeding'
import { PalIcon } from '@/components/pal-icon'
import { loadDatabase, palName } from '@/domain/database'
import { useT } from '@/i18n/language-store'
import { useMobileLayout } from '@/lib/use-mobile-layout'

const DESKTOP_PAGE = 24
const MOBILE_PAGE = 8

/** All direct parent pairs, deferred behind a compact bottom sheet on mobile. */
export function DirectRecipes({ targetPalId }: { targetPalId: string }) {
  const db = loadDatabase()
  const mobile = useMobileLayout()
  const [open, setOpen] = useState(false)
  const [limit, setLimit] = useState(DESKTOP_PAGE)
  const t = useT()

  // Reading the pair ids gives the CTA an exact count. Capture-cost sorting
  // and row creation are intentionally skipped until the phone sheet opens.
  const rawPairs = useMemo(() => getResolver().parentsOf(targetPalId), [targetPalId])
  const pairs = useMemo(() => {
    if (mobile && !open) return []
    const difficulty = (id: string) => {
      const pal = db.palById.get(id)
      if (!pal) return Number.POSITIVE_INFINITY
      const value = captureDifficulty(pal)
      return Number.isFinite(value) ? value : 10
    }
    return rawPairs
      .map(([a, b]) => ({ a, b, cost: difficulty(a) + difficulty(b) }))
      .sort((x, y) => x.cost - y.cost)
  }, [rawPairs, db.palById, mobile, open])

  const target = db.palById.get(targetPalId)
  const title = t('directRecipes.title', { name: palName(target) })

  if (mobile) {
    if (rawPairs.length === 0) {
      return (
        <Card className="direct-recipes-mobile direct-recipes-mobile--empty">
          <CardContent><GitFork aria-hidden="true" /><p>{t('directRecipes.none')}</p></CardContent>
        </Card>
      )
    }

    return (
      <section className="direct-recipes-mobile" aria-label={title}>
        <Dialog.Root
          open={open}
          onOpenChange={(next) => {
            setOpen(next)
            if (next) setLimit(MOBILE_PAGE)
          }}
        >
          <Dialog.Trigger asChild>
            <button type="button" className="direct-recipes-mobile__trigger">
              <span className="direct-recipes-mobile__icon"><GitFork aria-hidden="true" /></span>
              <span>
                <strong>{t('directRecipes.mobileTitle')}</strong>
                <small>{t('directRecipes.mobileCount', { count: rawPairs.length })}</small>
              </span>
              <ChevronRight aria-hidden="true" />
            </button>
          </Dialog.Trigger>

          {open && (
            <Dialog.Portal>
              <Dialog.Overlay className="plan-sheet__overlay" />
              <Dialog.Content className="plan-sheet" aria-describedby="direct-recipes-description">
                <header className="plan-sheet__header">
                  <div>
                    <Dialog.Title>{title}</Dialog.Title>
                    <Dialog.Description id="direct-recipes-description">
                      {t('directRecipes.mobileDescription', { count: rawPairs.length })}
                    </Dialog.Description>
                  </div>
                  <Dialog.Close asChild>
                    <Button variant="ghost" size="icon-sm" aria-label={t('directRecipes.close')}><X aria-hidden="true" /></Button>
                  </Dialog.Close>
                </header>
                <div className="plan-sheet__body">
                  <RecipeList pairs={pairs} limit={limit} />
                  {limit < pairs.length && (
                    <Button variant="outline" size="sm" className="mt-3 w-full" onClick={() => setLimit((current) => current + MOBILE_PAGE)}>
                      {t('directRecipes.more', { count: pairs.length - limit })}
                    </Button>
                  )}
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          )}
        </Dialog.Root>
      </section>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          {pairs.length === 0 ? t('directRecipes.none') : t('directRecipes.count', { count: pairs.length })}
        </CardDescription>
      </CardHeader>
      {pairs.length > 0 && (
        <CardContent className="space-y-2">
          <RecipeList pairs={pairs} limit={limit} desktop />
          {limit < pairs.length && (
            <Button variant="outline" size="sm" className="w-full" onClick={() => setLimit((current) => current + DESKTOP_PAGE * 2)}>
              {t('directRecipes.more', { count: pairs.length - limit })}
            </Button>
          )}
        </CardContent>
      )}
    </Card>
  )
}

function RecipeList({ pairs, limit, desktop = false }: {
  pairs: Array<{ a: string; b: string; cost: number }>
  limit: number
  desktop?: boolean
}) {
  const db = loadDatabase()
  return (
    <ul className={desktop ? 'grid gap-1 sm:grid-cols-2 xl:grid-cols-3' : 'direct-recipes-mobile__list'}>
      {pairs.slice(0, limit).map(({ a, b }) => (
        <li key={`${a}|${b}`} className="recipe-row flex items-center gap-1.5 rounded-md border border-border bg-background/40 px-2 py-1.5 text-xs">
          <PalIcon palId={a} size={24} />
          <span className="min-w-0 flex-1 truncate">{palName(db.palById.get(a))}</span>
          <span className="shrink-0 text-muted-foreground">+</span>
          <PalIcon palId={b} size={24} />
          <span className="min-w-0 flex-1 truncate">{palName(db.palById.get(b))}</span>
        </li>
      ))}
    </ul>
  )
}
