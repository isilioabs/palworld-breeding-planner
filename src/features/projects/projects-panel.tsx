import { useRef, useState } from 'react'
import { Download, FolderOpen, Save, Trash2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { RichTooltip } from '@/components/rich-tooltip'
import { loadDatabase, palName } from '@/domain/database'
import {
  deleteProject,
  exportProject,
  importProject,
  listProjects,
  saveProject,
  type BreedingProject,
} from '@/domain/projects'
import { useLang, useT } from '@/i18n/language-store'
import { usePlannerStore } from '@/state/planner-store'

export function ProjectsPanel() {
  const db = loadDatabase()
  const { state, dispatch } = usePlannerStore()
  const [projects, setProjects] = useState<BreedingProject[]>(() => listProjects())
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const t = useT()
  const [lang] = useLang()

  const refresh = () => setProjects(listProjects())

  const handleSave = () => {
    const fallback = state.targetPalId ? palName(db.palById.get(state.targetPalId)) : t('projectsPanel.nameFallback')
    saveProject(name || fallback, {
      targetPalId: state.targetPalId,
      desiredPassives: state.desiredPassives,
      owned: state.owned,
      mode: state.mode,
    })
    setName('')
    refresh()
  }

  const handleImport = async (file: File) => {
    setError(null)
    try {
      const project = importProject(await file.text())
      dispatch({ type: 'loadDraft', draft: project })
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
    <Card>
      <CardHeader>
        <CardTitle>{t('projectsPanel.title')}</CardTitle>
        <CardDescription>{t('projectsPanel.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('projectsPanel.namePlaceholder')}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          />
          <RichTooltip title={t('projectsPanel.saveTitle')} description={t('projectsPanel.saveDescription')}>
            <Button onClick={handleSave} className="gap-1.5">
              <Save className="size-4" aria-hidden="true" />
              {t('projectsPanel.save')}
            </Button>
          </RichTooltip>
          <RichTooltip title={t('projectsPanel.importTitle')} description={t('projectsPanel.importDescription')}>
            <Button variant="outline" size="icon" aria-label={t('projectsPanel.import')} onClick={() => fileRef.current?.click()}>
              <Upload aria-hidden="true" />
            </Button>
          </RichTooltip>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleImport(file)
              e.target.value = ''
            }}
          />
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        {projects.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t('projectsPanel.empty')}</p>
        ) : (
          <ul className="space-y-1.5">
            {projects.map((project) => (
              <li
                key={project.id}
                className="flex items-center gap-2 rounded-lg border border-border bg-background/40 px-2.5 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{project.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {project.targetPalId ? palName(db.palById.get(project.targetPalId)) : t('projectsPanel.noTarget')} ·{' '}
                    {t('projectsPanel.summary', {
                      passives: project.desiredPassives.length,
                      pals: project.owned.length,
                      date: new Date(project.updatedAt).toLocaleDateString(lang === 'en' ? 'en-US' : 'es-ES'),
                    })}
                  </p>
                </div>
                <RichTooltip title={t('projectsPanel.loadTitle')} description={t('projectsPanel.loadDescription')}>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t('projectsPanel.load')}
                    onClick={() => dispatch({ type: 'loadDraft', draft: project })}
                  >
                    <FolderOpen className="size-3.5" aria-hidden="true" />
                  </Button>
                </RichTooltip>
                <RichTooltip title={t('projectsPanel.exportTitle')} description={t('projectsPanel.exportDescription')}>
                  <Button variant="ghost" size="icon-sm" aria-label={t('projectsPanel.export')} onClick={() => handleExport(project)}>
                    <Download className="size-3.5" aria-hidden="true" />
                  </Button>
                </RichTooltip>
                <RichTooltip title={t('projectsPanel.deleteTitle')} description={t('projectsPanel.deleteDescription')}>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t('projectsPanel.delete')}
                    onClick={() => {
                      deleteProject(project.id)
                      refresh()
                    }}
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  </Button>
                </RichTooltip>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
