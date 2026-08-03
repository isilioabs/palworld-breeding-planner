import { useEffect, useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { FileJson, FolderOpen, ImagePlus, ShieldCheck, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PalPicker } from '@/components/pal-picker'
import { PalIcon } from '@/components/pal-icon'
import { candidatesToOwned, parseCollectionImport, type CollectionImportResult } from '@/domain/collection-import'
import { loadDatabase, palName } from '@/domain/database'
import { useT } from '@/i18n/language-store'
import { usePlannerStore } from '@/state/planner-store'

type ImportTab = 'json' | 'screenshots' | 'save'

interface ScreenshotPreview {
  name: string
  url: string
}

export function CollectionImportDialog() {
  const db = loadDatabase()
  const { dispatch } = usePlannerStore()
  const t = useT()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<ImportTab>('json')
  const [result, setResult] = useState<CollectionImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [screenshots, setScreenshots] = useState<ScreenshotPreview[]>([])
  const [screenshotSelection, setScreenshotSelection] = useState<string[]>([])
  const jsonRef = useRef<HTMLInputElement>(null)
  const imageRef = useRef<HTMLInputElement>(null)
  const folderRef = useRef<HTMLInputElement>(null)
  const previewUrlsRef = useRef<string[]>([])

  useEffect(() => () => previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url)), [])

  const resetStatus = () => { setResult(null); setError(null) }
  const readJson = async (file: File) => {
    resetStatus()
    try {
      setResult(parseCollectionImport(await file.text()))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('collectionImport.error'))
    }
  }
  const addCandidates = () => {
    if (!result) return
    dispatch({ type: 'importOwned', entries: candidatesToOwned(result.candidates) })
    setResult(null)
    setOpen(false)
  }
  const addScreenshotSelection = () => {
    if (screenshotSelection.length === 0) return
    dispatch({ type: 'importOwned', entries: candidatesToOwned(screenshotSelection.map((palId, sourceIndex) => ({ sourceIndex, palId, passives: [] }))) })
    setScreenshotSelection([])
    setOpen(false)
  }
  const clearScreenshots = () => {
    previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    previewUrlsRef.current = []
    setScreenshots([])
    setScreenshotSelection([])
  }
  const addScreenshots = (files: FileList | null) => {
    if (!files) return
    const next = Array.from(files).slice(0, Math.max(0, 12 - screenshots.length)).map((file) => ({ name: file.name, url: URL.createObjectURL(file) }))
    previewUrlsRef.current.push(...next.map((entry) => entry.url))
    setScreenshots((current) => [...current, ...next])
  }
  const chooseFolder = (files: FileList | null) => {
    const json = files && Array.from(files).find((file) => file.name.toLocaleLowerCase().endsWith('.json'))
    if (json) void readJson(json)
    else setError(t('collectionImport.saveFolderDescription'))
  }

  return (
    <Dialog.Root open={open} onOpenChange={(next) => { setOpen(next); if (!next) { resetStatus(); clearScreenshots() } }}>
      <Dialog.Trigger asChild><Button variant="outline" size="sm" className="collection-import__trigger"><Upload aria-hidden="true" />{t('collectionImport.trigger')}</Button></Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="collection-import__overlay" />
        <Dialog.Content className="collection-import__dialog" aria-describedby={undefined}>
          <header className="collection-import__header"><div><Dialog.Title>{t('collectionImport.title')}</Dialog.Title><p>{t('collectionImport.subtitle')}</p></div><Dialog.Close asChild><Button variant="ghost" size="icon-sm" aria-label={t('collectionImport.close')}><X /></Button></Dialog.Close></header>
          <div className="collection-import__tabs" role="tablist">
            {(['json', 'screenshots', 'save'] as const).map((entry) => <button type="button" key={entry} role="tab" aria-selected={tab === entry} className={tab === entry ? 'is-active' : ''} onClick={() => { setTab(entry); resetStatus() }}>{t(`collectionImport.tabs.${entry}`)}</button>)}
          </div>
          <section className="collection-import__body">
            {tab === 'json' && <>
              <span className="collection-import__icon"><FileJson /></span><h3>{t('collectionImport.jsonTitle')}</h3><p>{t('collectionImport.jsonDescription')}</p>
              <Button onClick={() => jsonRef.current?.click()}><Upload />{t('collectionImport.chooseJson')}</Button>
              <input ref={jsonRef} type="file" accept="application/json,.json" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void readJson(file); event.target.value = '' }} />
            </>}
            {tab === 'screenshots' && <>
              <span className="collection-import__icon"><ImagePlus /></span><h3>{t('collectionImport.screenshotTitle')}</h3><p>{t('collectionImport.screenshotDescription')}</p>
              <Button variant="outline" onClick={() => imageRef.current?.click()}><ImagePlus />{t('collectionImport.chooseScreenshots')}</Button>
              <input ref={imageRef} type="file" accept="image/png,image/jpeg,image/webp" multiple className="hidden" onChange={(event) => { addScreenshots(event.target.files); event.target.value = '' }} />
              {screenshots.length ? <><ul className="collection-import__screenshots">{screenshots.map((entry) => <li key={entry.url}><img src={entry.url} alt={entry.name} /><span>{entry.name}</span></li>)}</ul><p className="collection-import__ready">{t('collectionImport.screenshotReady', { count: screenshots.length })}</p><PalPicker selectedIds={screenshotSelection} onSelectedIdsChange={setScreenshotSelection} onConfirm={addScreenshotSelection} max={48} label={t('collectionImport.reviewPals')} /></> : <p className="collection-import__empty">{t('collectionImport.screenshotEmpty')}</p>}
            </>}
            {tab === 'save' && <>
              <span className="collection-import__icon"><FolderOpen /></span><h3>{t('collectionImport.saveTitle')}</h3><p>{t('collectionImport.saveDescription')}</p>
              <Button onClick={() => folderRef.current?.click()}><FolderOpen />{t('collectionImport.chooseSave')}</Button>
              <input ref={(node) => { folderRef.current = node; node?.setAttribute('webkitdirectory', ''); node?.setAttribute('directory', '') }} type="file" className="hidden" onChange={(event) => { chooseFolder(event.target.files); event.target.value = '' }} />
              <div className="collection-import__save-note"><ShieldCheck aria-hidden="true" /><span><strong>{t('collectionImport.saveFolder')}</strong>{t('collectionImport.saveFolderDescription')}</span></div>
            </>}
          </section>
          {error && <p className="collection-import__error" role="alert">{error}</p>}
          {result && <section className="collection-import__preview"><header><div><span>{t(`collectionImport.source.${result.source}`)}</span><h3>{t('collectionImport.previewTitle')}</h3><p>{t('collectionImport.previewDescription', { count: result.candidates.length, skipped: result.skipped })}</p></div><Button variant="ghost" size="sm" onClick={() => setResult(null)}>{t('collectionImport.cancelPreview')}</Button></header><ul>{result.candidates.slice(0, 12).map((entry, index) => <li key={`${entry.palId}-${entry.sourceIndex}-${index}`}><PalIcon palId={entry.palId} size={26} /><span>{palName(db.palById.get(entry.palId))}</span><small>{t('collectionImport.passiveCount', { count: entry.passives.length })}</small></li>)}</ul>{result.candidates.length > 12 && <p>+{result.candidates.length - 12}</p>}<Button onClick={addCandidates}>{t('collectionImport.addAll', { count: result.candidates.length })}</Button></section>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
