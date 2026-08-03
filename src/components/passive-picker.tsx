import { useEffect, useMemo, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Check, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { HighlightMatch } from '@/components/highlight-match'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { loadDatabase, passiveEffects, passiveName, passiveSummary } from '@/domain/database'
import { getRecentIds, pushRecentId } from '@/domain/recent'
import type { Passive } from '@/domain/types'
import { useT } from '@/i18n/language-store'
import { cn } from '@/lib/utils'

interface PassivePickerProps {
  selected: string[]
  onToggle: (passiveId: string) => void
  max?: number
  label?: string
  className?: string
}

const RECENTS_KEY = 'passive'

const RANK_GROUPS: { min: number; max: number; labelKey: 'passivePicker.groupRainbow' | 'passivePicker.groupGold' | 'passivePicker.groupGray' | 'passivePicker.groupNegative'; tier: string }[] = [
  { min: 4, max: 5, labelKey: 'passivePicker.groupRainbow', tier: 'rainbow' },
  { min: 2, max: 3, labelKey: 'passivePicker.groupGold', tier: 'gold' },
  { min: 0, max: 1, labelKey: 'passivePicker.groupGray', tier: 'gray' },
  { min: -3, max: -1, labelKey: 'passivePicker.groupNegative', tier: 'negative' },
]

const searchKey = (passive: Passive) => `${passiveName(passive)} ${passive.name} ${passiveSummary(passive)}`.toLowerCase()

export function PassivePicker({ selected, onToggle, max = 4, label, className }: PassivePickerProps) {
  const db = loadDatabase()
  const t = useT()
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState('')
  const [query, setQuery] = useState('')
  const [recentIds, setRecentIds] = useState<string[]>([])
  const full = selected.length >= max

  useEffect(() => {
    if (open) setRecentIds(getRecentIds(RECENTS_KEY))
  }, [open])

  const groups = useMemo(() => RANK_GROUPS.map((group) => ({ ...group, label: t(group.labelKey), items: db.passives.filter((p) => p.rank >= group.min && p.rank <= group.max) })).filter((group) => group.items.length > 0), [db.passives, t])
  const byKey = useMemo(() => new Map(db.passives.map((passive) => [searchKey(passive), passive])), [db.passives])
  const active = byKey.get(highlighted)
  const showRecents = query.trim() === '' && recentIds.length > 0
  const recentPassives = showRecents ? recentIds.map((id) => db.passiveById.get(id)).filter((passive): passive is Passive => !!passive) : []
  const recentSet = new Set(recentPassives.map((passive) => passive.id))

  const handleSelect = (passive: Passive) => {
    if (!selected.includes(passive.id)) setRecentIds(pushRecentId(RECENTS_KEY, passive.id))
    onToggle(passive.id)
  }

  const renderItem = (passive: Passive) => {
    const isSelected = selected.includes(passive.id)
    return (
      <CommandItem
        key={passive.id}
        value={searchKey(passive)}
        disabled={!isSelected && full}
        onSelect={() => handleSelect(passive)}
        onMouseEnter={() => setHighlighted(searchKey(passive))}
        className="passive-picker__item"
      >
        <span className="passive-picker__arrows" aria-hidden="true">{Array.from({ length: Math.max(1, Math.min(3, Math.abs(passive.rank))) }, (_, index) => <i key={index} />)}</span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5"><strong><HighlightMatch text={passiveName(passive)} query={query} /></strong><span><HighlightMatch text={passiveEffects(passive).join(' / ')} query={query} /></span></span>
        <Check className={cn('size-4 shrink-0', isSelected ? 'opacity-100' : 'opacity-0')} />
      </CommandItem>
    )
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild><Button variant="outline" size="sm" className={cn('gap-1.5', className)}><Plus className="size-3.5" />{label ?? t('passivePicker.addLabel')}</Button></Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="passive-picker__overlay" />
        <Dialog.Content className="passive-picker__dialog" aria-describedby={undefined}>
          <header className="passive-picker__header"><div><Dialog.Title>{t('passivePicker.title')}</Dialog.Title><p>{t('passivePicker.subtitle', { count: selected.length, max })}</p></div><Dialog.Close asChild><Button variant="ghost" size="icon-sm" aria-label={t('passivePicker.close')}><X /></Button></Dialog.Close></header>
          <section className="passive-picker__selected" aria-label={t('passivePicker.selected')}>
            {Array.from({ length: max }, (_, index) => {
              const passive = db.passiveById.get(selected[index] ?? '')
              return passive ? <button type="button" key={passive.id} onClick={() => handleSelect(passive)} className="passive-picker__selected-card" data-rank={passive.rank}><span>{passiveName(passive)}</span><X aria-hidden="true" /></button> : <div key={index} className="passive-picker__selected-empty">{t('passivePicker.emptySlot')}</div>
            })}
          </section>
          <Command className="passive-picker__command" value={highlighted} onValueChange={setHighlighted}>
            <CommandInput className="passive-picker__search" placeholder={t('passivePicker.searchPlaceholder')} value={query} onValueChange={setQuery} />
            <CommandList className="passive-picker__list">
              <CommandEmpty>{t('passivePicker.empty')}</CommandEmpty>
              {showRecents && <CommandGroup heading={t('passivePicker.recents')} className="passive-picker__group">{recentPassives.map(renderItem)}</CommandGroup>}
              {groups.map((group) => {
                const items = showRecents ? group.items.filter((passive) => !recentSet.has(passive.id)) : group.items
                return items.length ? <CommandGroup key={group.label} heading={group.label} className="passive-picker__group" data-tier={group.tier}>{items.map(renderItem)}</CommandGroup> : null
              })}
            </CommandList>
          </Command>
          <footer className="passive-picker__detail">{active ? <><strong>{passiveName(active)}</strong><span>{passiveEffects(active).join(' / ')}</span></> : <span>{t('passivePicker.hoverHint')}</span>}</footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
