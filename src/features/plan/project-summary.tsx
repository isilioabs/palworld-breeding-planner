import { Egg, GitMerge, PackageCheck, Target, Workflow } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { useT } from '@/i18n/language-store'
import { formatNumber } from '@/lib/utils'
import type { ProjectPlan } from '@/domain/types'
import { SharePlan } from '@/features/plan/share-plan'

export function ProjectSummary({ project }: { project: ProjectPlan }) {
  const t = useT()
  const stats = project.stats
  if (!stats) return null

  const metrics = [
    { icon: Target, label: t('projectSummary.targets'), value: String(stats.targets), tone: 'text-primary' },
    { icon: Egg, label: t('projectSummary.eggs'), value: formatNumber(stats.totalExpectedEggs), tone: 'text-amber-400' },
    { icon: PackageCheck, label: t('projectSummary.captures'), value: String(stats.capturesNeeded), tone: 'text-rose-400' },
    { icon: Workflow, label: t('projectSummary.effort'), value: formatNumber(stats.expectedEffort), tone: 'text-sky-400' },
  ]

  return (
    <section className="project-summary" aria-labelledby="project-summary-title">
      <header>
        <div>
          <span className="project-summary__eyebrow"><GitMerge aria-hidden="true" />{t('projectSummary.title')}</span>
          <h2 id="project-summary-title">{t('projectSummary.title')}</h2>
          <p>{t('projectSummary.description', { targets: stats.targets })}</p>
        </div>
        <div className="project-summary__savings">
          <span>{t('projectSummary.breedsSaved')}</span><strong>{stats.duplicateBreedsAvoided}</strong>
          <span>{t('projectSummary.eggsSaved')}</span><strong>{formatNumber(stats.eggsSaved)}</strong>
          <span>{t('projectSummary.capturesSaved')}</span><strong>{stats.capturesSaved}</strong>
        </div>
      </header>
      <div className="project-summary__metrics">
        {metrics.map(({ icon: Icon, label, value, tone }) => (
          <Card key={label} className="project-summary__metric">
            <CardContent>
              <Icon className={tone} aria-hidden="true" />
              <span>{label}</span>
              <strong>{value}</strong>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="project-summary__shared">
        <GitMerge aria-hidden="true" />
        <span>{t('projectSummary.sharedBranches')}: <b>{stats.sharedBranches}</b></span>
        <span>{t('projectSummary.sharedParents')}: <b>{stats.sharedParents}</b></span>
      </div>
      <div className="project-summary__share"><SharePlan title={t('projectSummary.title')} metrics={metrics.map(({ label, value }) => ({ label, value }))} /></div>
    </section>
  )
}
