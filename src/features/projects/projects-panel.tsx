import { useRef, useState } from 'react'
import { Download, FolderOpen, Save, Trash2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { loadDatabase, palName } from '@/domain/database'
import {
  deleteProject,
  exportProject,
  importProject,
  listProjects,
  saveProject,
  type BreedingProject,
} from '@/domain/projects'
import { usePlannerStore } from '@/state/planner-store'

export function ProjectsPanel() {
  const db = loadDatabase()
  const { state, dispatch } = usePlannerStore()
  const [projects, setProjects] = useState<BreedingProject[]>(() => listProjects())
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const refresh = () => setProjects(listProjects())

  const handleSave = () => {
    const fallback = state.targetPalId ? palName(db.palById.get(state.targetPalId)) : 'Proyecto'
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
        <CardTitle>Proyectos guardados</CardTitle>
        <CardDescription>Se guardan en este navegador. Exporta a JSON para compartir o respaldar.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre del proyecto..."
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          />
          <Button onClick={handleSave} className="gap-1.5">
            <Save className="size-4" />
            Guardar
          </Button>
          <Button variant="outline" size="icon" aria-label="Importar" onClick={() => fileRef.current?.click()}>
            <Upload />
          </Button>
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
          <p className="text-xs text-muted-foreground">Todavia no has guardado ningun proyecto.</p>
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
                    {project.targetPalId ? palName(db.palById.get(project.targetPalId)) : 'sin objetivo'} ·{' '}
                    {project.desiredPassives.length} pasivas · {project.owned.length} Pals ·{' '}
                    {new Date(project.updatedAt).toLocaleDateString('es-ES')}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Cargar"
                  onClick={() => dispatch({ type: 'loadDraft', draft: project })}
                >
                  <FolderOpen className="size-3.5" />
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label="Exportar" onClick={() => handleExport(project)}>
                  <Download className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Borrar"
                  onClick={() => {
                    deleteProject(project.id)
                    refresh()
                  }}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
