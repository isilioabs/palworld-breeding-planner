import { useMemo, useRef, useState } from 'react'
import { CheckCircle2, Circle, Download, Factory, FolderOpen, Save, Trash2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { RichTooltip } from '@/components/rich-tooltip'
import { loadDatabase, palName } from '@/domain/database'
import {
  deleteProject,
  exportProject,
  getProjectProgress,
  importProject,
  listProjects,
  saveProject,
  setProjectTargetCompletion,
  type BreedingProject,
} from '@/domain/projects'
import { useLang, useT } from '@/i18n/language-store'
import { cn } from '@/lib/utils'
import { usePlannerStore } from '@/state/planner-store'

export function ProjectsPanel({ embedded = false }: { embedded?: boolean }) {
  const db = loadDatabase()
  const { state, dispatch } = usePlannerStore()
  const [projects, setProjects] = useState<BreedingProject[]>(() => listProjects())
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const t = useT()
  const [lang] = useLang()
  const ownedPalIds = useMemo(() => new Set(state.owned.map((entry) => entry.palId)), [state.owned])

  const refresh = () => setProjects(listProjects())

  const handleSave = () => {
    const fallback = state.targetPalId ? palName(db.palById.get(state.targetPalId)) : t('projectsPanel.nameFallback')
    saveProject(name || fallback, {
      targetPalId: state.targetPalId,
      targetPalIds: state.targetPalIds,
      completedTargetPalIds: [],
      desiredPassives: state.desiredPassives,
      owned: state.owned,
      mode: state.mode,
    })
    setName('')
    refresh()
  }

  const mergeCollection = (project: BreedingProject) => {
    // Una especie puede existir varias veces con géneros o pasivas distintas.
    // La identidad estable de una captura es uid, no palId.
    const seen = new Set(state.owned.map((entry) => entry.uid))
    return [...state.owned, ...project.owned.filter((entry) => !seen.has(entry.uid))]
  }

  const handleLoad = (project: BreedingProject) => {
    dispatch({ type: 'loadDraft', draft: { ...project, owned: mergeCollection(project) } })
  }

  const handleCompletion = (project: BreedingProject, palId: string) => {
    const progress = getProjectProgress(project, ownedPalIds)
    const complete = progress.completedTargetPalIds.includes(palId)
    const owned = ownedPalIds.has(palId)
    if (owned) return
    if (!complete) dispatch({ type: 'addOwned', palId })
    if (!owned) setProjectTargetCompletion(project.id, palId, !complete)
    refresh()
  }

  const handleImport = async (file: File) => {
    setError(null)
    try {
      const project = importProject(await file.text())
      handleLoad(project)
      saveProject(project.name, project, project.id)
      refresh()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const handleExport = (project: BreedingProject) => {
    const blob = new Blob([exportProject(project)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${project.name.replace(/[^\w\-]+/g, '_')}.pbp.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Card className={cn(embedded && 'border-0 bg-transparent shadow-none')}>
      {!embedded && (
        <CardHeader>
          <CardTitle>{t('projectsPanel.title')}</CardTitle>
          <CardDescription>{t('projectsPanel.description')}</CardDescription>
        </CardHeader>
      )}
      <CardContent className={cn('space-y-3', embedded && 'p-0')}>
        <div className="flex gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('projectsPanel.namePlaceholder')} onKeyDown={(e) => e.key === 'Enter' && handleSave()} />
          <RichTooltip title={t('projectsPanel.saveTitle')} description={t('projectsPanel.saveDescription')}>
            <Button onClick={handleSave} className="gap-1.5"><Save className="size-4" aria-hidden="true" />{t('projectsPanel.save')}</Button>
          </RichTooltip>
          <RichTooltip title={t('projectsPanel.importTitle')} description={t('projectsPanel.importDescription')}>
            <Button variant="outline" size="icon" aria-label={t('projectsPanel.import')} onClick={() => fileRef.current?.click()}><Upload aria-hidden="true" /></Button>
          </RichTooltip>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void handleImport(file)
            e.target.value = ''
          }} />
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        {projects.length === 0 ? (
          <p className="projects-empty-state text-xs text-muted-foreground">{t('projectsPanel.empty')}</p>
        ) : (
          <ul className="space-y-2">
            {projects.map((project) => {
              const progress = getProjectProgress(project, ownedPalIds)
              return (
                <li key={project.id} className={cn('breeding-project', progress.percent === 100 && 'is-complete')}>
                  <header className="breeding-project__header">
                    <div className="min-w-0 flex-1">
                      <span className="breeding-project__eyebrow"><Factory aria-hidden="true" />{t('projectsPanel.projectEyebrow')}</span>
                      <p className="truncate text-sm font-semibold">{project.name}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{t('projectsPanel.summary', {
                        passives: project.desiredPassives.length,
                        pals: project.owned.length,
                        date: new Date(project.updatedAt).toLocaleDateString(lang === 'en' ? 'en-US' : 'es-ES'),
                      })}</p>
                    </div>
                    <div className="breeding-project__progress" aria-label={t('projectsPanel.progress', { completed: progress.completed, total: progress.total, percent: progress.percent })}>
                      <strong>{progress.percent}%</strong><span>{progress.completed}/{progress.total}</span>
                    </div>
                  </header>
                  <div className="breeding-project__bar" aria-hidden="true"><span style={{ width: `${progress.percent}%` }} /></div>
                  <ul className="breeding-project__targets" aria-label={t('projectsPanel.targetsLabel')}>
                    {project.targetPalIds.map((palId) => {
                      const complete = progress.completedTargetPalIds.includes(palId)
                      const owned = ownedPalIds.has(palId)
                      const palLabel = palName(db.palById.get(palId))
                      return (
                        <li key={palId}>
                          <button type="button" className={cn('breeding-project__target', complete && 'is-complete')} aria-pressed={complete} disabled={owned}
                            aria-label={t(owned ? 'projectsPanel.fromCollectionAria' : complete ? 'projectsPanel.markIncomplete' : 'projectsPanel.markComplete', { name: palLabel })}
                            onClick={() => handleCompletion(project, palId)}>
                            {complete ? <CheckCircle2 aria-hidden="true" /> : <Circle aria-hidden="true" />}
                            <span>{palLabel}</span>
                            {owned && <small>{t('projectsPanel.fromCollection')}</small>}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                  <footer className="breeding-project__actions">
                    <RichTooltip title={t('projectsPanel.loadTitle')} description={t('projectsPanel.loadDescription')}>
                      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handleLoad(project)}><FolderOpen className="size-3.5" aria-hidden="true" />{t('projectsPanel.open')}</Button>
                    </RichTooltip>
                    <div className="flex items-center gap-0.5">
                      <RichTooltip title={t('projectsPanel.exportTitle')} description={t('projectsPanel.exportDescription')}>
                        <Button variant="ghost" size="icon-sm" aria-label={t('projectsPanel.export')} onClick={() => handleExport(project)}><Download className="size-3.5" aria-hidden="true" /></Button>
                      </RichTooltip>
                      <RichTooltip title={t('projectsPanel.deleteTitle')} description={t('projectsPanel.deleteDescription')}>
                        <Button variant="ghost" size="icon-sm" aria-label={t('projectsPanel.delete')} onClick={() => { deleteProject(project.id); refresh() }}><Trash2 className="size-3.5" aria-hidden="true" /></Button>
                      </RichTooltip>
                    </div>
                  </footer>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
