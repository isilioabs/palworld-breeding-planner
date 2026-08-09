/**
 * Pagina "Feedback & Updates" (`/feedback`): combina el contenido de los DOS
 * dialogos que hoy vive en `product-menu.tsx` (Feedback + Changelog) en una
 * sola pagina real e indexable, en vez de dejarlos solo dentro de un dialogo
 * aislado. El dialogo de `ProductMenu` se queda intacto como atajo rapido
 * dentro de una sesion activa -ambos leen las mismas keys de i18n.
 */
import { Bug, History, Lightbulb, MessageCircle, Send } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { PageH1, PageSection } from '@/components/page-heading'
import { useT } from '@/i18n/language-store'

const REPOSITORY_URL = 'https://github.com/isilioabs/palworld-breeding-planner'

export function FeedbackPage() {
  const t = useT()
  const changes = [t('productMenu.changeOne'), t('productMenu.changeTwo'), t('productMenu.changeThree'), t('productMenu.changeFour')]

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="space-y-2">
        <PageH1 icon={MessageCircle}>{t('feedbackPage.title')}</PageH1>
        <p className="max-w-xl text-sm text-muted-foreground">{t('feedbackPage.intro')}</p>
      </div>

      <Card>
        <CardContent className="space-y-2 p-4">
          <PageSection icon={Bug} title={t('feedbackPage.reportBug')} />
          <p className="text-sm text-muted-foreground">{t('productMenu.bugDescription')}</p>
          <a
            href={`${REPOSITORY_URL}/issues/new?title=${encodeURIComponent('[Bug] ')}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-sm font-semibold no-underline transition-colors hover:border-primary/50"
          >
            {t('productMenu.bug')}
            <Send className="size-4 shrink-0" aria-hidden="true" />
          </a>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2 p-4">
          <PageSection icon={Lightbulb} title={t('feedbackPage.suggestIdea')} />
          <p className="text-sm text-muted-foreground">{t('productMenu.ideaDescription')}</p>
          <a
            href={`${REPOSITORY_URL}/issues/new?title=${encodeURIComponent('[Idea] ')}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-sm font-semibold no-underline transition-colors hover:border-primary/50"
          >
            {t('productMenu.idea')}
            <Send className="size-4 shrink-0" aria-hidden="true" />
          </a>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2 p-4">
          <PageSection icon={History} title={t('feedbackPage.changelog')} />
          <p className="text-sm text-muted-foreground">{t('feedbackPage.changelogIntro')}</p>
          <ol className="space-y-1.5 pl-5 text-sm">
            {changes.map((change) => <li key={change} className="list-disc">{change}</li>)}
          </ol>
        </CardContent>
      </Card>
    </div>
  )
}
