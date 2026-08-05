import { useMemo, useState, type CSSProperties } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Check, Plus, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PalIcon } from '@/components/pal-icon'
import { loadDatabase, dexLabel, palName } from '@/domain/database'
import { ELEMENT_INFO } from '@/domain/element'
import type { ElementType, Pal } from '@/domain/types'
import { useT } from '@/i18n/language-store'
import { cn } from '@/lib/utils'

const ELEMENTS = Object.keys(ELEMENT_INFO) as ElementType[]
const PAGE_SIZE = 30

interface PalPickerProps {
  value?: string | null
  onSelect?: (palId: string) => void
  selectedIds?: string[]
  onSelectedIdsChange?: (ids: string[]) => void
  onConfirm?: () => void
  max?: number
  label?: string
  placeholder?: string
  className?: string
  disabledIds?: string[]
  /** false mantiene el diálogo abierto tras onSelect, para añadir varios Pals seguidos y cerrarlo a mano. */
  closeOnSelect?: boolean
}

function matchesSearch(pal: Pal, query: string) {
  const needle = query.trim().toLocaleLowerCase()
  return !needle || `${pal.name} ${pal.nameEs} ${pal.dex}`.toLocaleLowerCase().includes(needle)
}

/** Selector visual de Pals, diseñado para reconocer especie y elemento antes
 * de elegirla. En modo múltiple se usa para revisar importaciones por captura. */
export function PalPicker({
  value,
  onSelect,
  selectedIds,
  onSelectedIdsChange,
  onConfirm,
  max = 1,
  label,
  placeholder,
  className,
  disabledIds = [],
  closeOnSelect = true,
}: PalPickerProps) {
  const db = loadDatabase()
  const t = useT()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [element, setElement] = useState<ElementType | null>(null)
  const [limit, setLimit] = useState(PAGE_SIZE)
  const multi = selectedIds !== undefined
  const selected = selectedIds ?? (value ? [value] : [])
  const selectedPal = value ? db.palById.get(value) : undefined
  const disabled = new Set(disabledIds)

  const results = useMemo(() => db.pals
    .filter((pal) => matchesSearch(pal, query) && (!element || pal.elements.includes(element)))
    .sort((a, b) => a.dex - b.dex), [db.pals, element, query])
  const visible = results.slice(0, limit)

  const resetBrowse = () => {
    setQuery('')
    setElement(null)
    setLimit(PAGE_SIZE)
  }
  const toggle = (pal: Pal) => {
    if (disabled.has(pal.id)) return
    if (!multi) {
      onSelect?.(pal.id)
      if (closeOnSelect) {
        setOpen(false)
        resetBrowse()
      }
      return
    }
    const has = selected.includes(pal.id)
    if (!has && selected.length >= max) return
    onSelectedIdsChange?.(has ? selected.filter((id) => id !== pal.id) : [...selected, pal.id])
  }

  return (
    <Dialog.Root open={open} onOpenChange={(next) => { setOpen(next); if (!next) resetBrowse() }}>
      <Dialog.Trigger asChild>
        <Button variant="outline" className={cn('pal-picker__trigger', className)}>
          {selectedPal ? <><PalIcon palId={selectedPal.id} size={22} /><span>{palName(selectedPal)}</span></> : <><Plus aria-hidden="true" /><span>{label ?? placeholder ?? t('palPicker.trigger')}</span></>}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="pal-picker__overlay" />
        <Dialog.Content className="pal-picker__dialog" aria-describedby={undefined}>
          <div className="pal-picker__rivets" aria-hidden="true" />
          <header className="pal-picker__header">
            <span className="pal-picker__lens" aria-hidden="true" style={{ '--lens-color': element ? ELEMENT_INFO[element].color : '#4cc9e8' } as CSSProperties}>
              <span className="pal-picker__lens-glint" />
            </span>
            <div><Dialog.Title>{t('palPicker.title')}</Dialog.Title><p>{multi ? t('palPicker.multiSubtitle', { count: selected.length, max }) : t('palPicker.subtitle')}</p></div>
            <Dialog.Close asChild><Button variant="ghost" size="icon-sm" aria-label={t('palPicker.close')}><X /></Button></Dialog.Close>
          </header>
          <div className="pal-picker__console">
            <label className="pal-picker__search"><Search aria-hidden="true" /><input value={query} onChange={(event) => { setQuery(event.target.value); setLimit(PAGE_SIZE) }} placeholder={t('palPicker.search')} /></label>
            <div className="pal-picker__elements" aria-label={t('palPicker.elements')}>
              <Button type="button" size="sm" variant={!element ? 'secondary' : 'outline'} onClick={() => { setElement(null); setLimit(PAGE_SIZE) }}>{t('palPicker.all')}</Button>
              {ELEMENTS.map((entry) => <Button type="button" key={entry} size="sm" variant={element === entry ? 'secondary' : 'outline'} onClick={() => { setElement(element === entry ? null : entry); setLimit(PAGE_SIZE) }}><img src={ELEMENT_INFO[entry].icon} alt="" width="13" height="13" />{ELEMENT_INFO[entry].label}</Button>)}
            </div>
          </div>
          <div className="pal-picker__screen">
            <div className="pal-picker__summary"><span>{t('palPicker.results', { count: results.length })}</span>{multi && <span>{t('palPicker.selected', { count: selected.length, max })}</span>}</div>
            <ul className="pal-picker__grid" aria-label={t('palPicker.results', { count: results.length })}>
              {visible.map((pal) => {
                const alreadyAdded = !multi && !closeOnSelect && disabled.has(pal.id)
                const isSelected = selected.includes(pal.id) || alreadyAdded
                const isDisabled = disabled.has(pal.id) || (!isSelected && multi && selected.length >= max)
                const primary = pal.elements[0] ?? 'neutral'
                return <li key={pal.id}>
                  <button type="button" className={cn('pal-picker__card', isSelected && 'is-selected')} disabled={isDisabled} aria-pressed={isSelected} onClick={() => toggle(pal)}>
                    <span className="pal-picker__dex">{dexLabel(pal)}</span><span className="pal-picker__element" style={{ color: ELEMENT_INFO[primary].color }}>{ELEMENT_INFO[primary].label}</span>
                    <span className="pal-picker__art"><PalIcon palId={pal.id} size={58} bare /></span>
                    <strong>{palName(pal)}</strong>
                    {isSelected && <span className="pal-picker__led"><Check aria-label={t('palPicker.selectedMark')} /></span>}
                  </button>
                </li>
              })}
            </ul>
            {visible.length < results.length && <Button variant="outline" size="sm" className="pal-picker__more" onClick={() => setLimit((current) => current + PAGE_SIZE)}>{t('palPicker.more', { count: Math.min(PAGE_SIZE, results.length - visible.length) })}</Button>}
          </div>
          {multi && <footer className="pal-picker__footer"><span>{t('palPicker.confirmHint')}</span><Button disabled={selected.length === 0} onClick={() => { onConfirm?.(); setOpen(false); resetBrowse() }}>{t('palPicker.confirm', { count: selected.length })}</Button></footer>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

