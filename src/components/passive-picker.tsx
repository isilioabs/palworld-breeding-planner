import { useEffect, useMemo, useState } from 'react'
import { Check, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PassiveBadge } from '@/components/passive-badge'
import { HighlightMatch } from '@/components/highlight-match'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
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

const RANK_GROUPS: { min: number; max: number; labelKey: 'passivePicker.groupGreat' | 'passivePicker.groupUseful' | 'passivePicker.groupNegative' }[] = [
  { min: 3, max: 5, labelKey: 'passivePicker.groupGreat' },
  { min: 1, max: 2, labelKey: 'passivePicker.groupUseful' },
  { min: -3, max: 0, labelKey: 'passivePicker.groupNegative' },
]

/** cmdk normaliza el `value` a minusculas, asi que la clave tambien. */
const searchKey = (passive: Passive) =>
  `${passiveName(passive)} ${passive.name} ${passiveSummary(passive)}`.toLowerCase()

export function PassivePicker({ selected, onToggle, max = 4, label, className }: PassivePickerProps) {
  const db = loadDatabase()
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState('')
  const [query, setQuery] = useState('')
  const [recentIds, setRecentIds] = useState<string[]>([])
  const full = selected.length >= max
  const t = useT()

  // Se relee al abrir: puede haber cambiado desde otro selector de pasivas.
  useEffect(() => {
    if (open) setRecentIds(getRecentIds(RECENTS_KEY))
  }, [open])

  const groups = useMemo(
    () =>
      RANK_GROUPS.map((group) => ({
        ...group,
        label: t(group.labelKey),
        items: db.passives.filter((p) => p.rank >= group.min && p.rank <= group.max),
      })).filter((g) => g.items.length > 0),
    [db.passives, t],
  )

  // Para poder mostrar el detalle de la pasiva sobre la que esta el cursor.
  const byKey = useMemo(() => new Map(db.passives.map((p) => [searchKey(p), p])), [db.passives])
  const active = byKey.get(highlighted)

  const showRecents = query.trim() === '' && recentIds.length > 0
  const recentPassives = showRecents
    ? recentIds.map((id) => db.passiveById.get(id)).filter((p): p is Passive => !!p)
    : []
  const recentSet = new Set(recentPassives.map((p) => p.id))

  const handleSelect = (passive: Passive) => {
    if (!selected.includes(passive.id)) setRecentIds(pushRecentId(RECENTS_KEY, passive.id))
    onToggle(passive.id)
  }

  const renderItem = (passive: Passive) => {
    const isSelected = selected.includes(passive.id)
    const effects = passiveEffects(passive)
    return (
      <CommandItem
        key={passive.id}
        value={searchKey(passive)}
        disabled={!isSelected && full}
        onSelect={() => handleSelect(passive)}
        // cmdk desactiva su propio `onPointerMove` en items deshabilitados
        // (los que superan el maximo de pasivas), asi que el hover deja de
        // mover el resaltado justo cuando el usuario mas quiere comparar
        // opciones con la lista llena. `onMouseEnter` no lo gestiona cmdk,
        // asi que sirve de via alternativa que funciona este o no deshabilitado.
        onMouseEnter={() => setHighlighted(searchKey(passive))}
        title={`${passiveName(passive)}\n${effects.join('\n')}`}
        className="items-start py-1.5"
      >
        <PassiveBadge passive={passive} query={query} className="mt-0.5 shrink-0" />
        <span className="flex min-w-0 flex-1 flex-col">
          {/* Resumen del efecto: en movil no hay hover, asi que va siempre visible. */}
          <span className="truncate text-[11px] text-muted-foreground">
            <HighlightMatch text={effects.join(' · ')} query={query} />
          </span>
        </span>
        <Check className={cn('mt-0.5 size-4 shrink-0', isSelected ? 'opacity-100' : 'opacity-0')} />
      </CommandItem>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn('gap-1.5', className)}>
          <Plus className="size-3.5" />
          {label ?? t('passivePicker.addLabel')}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(26rem,92vw)] p-0">
        <Command value={highlighted} onValueChange={setHighlighted}>
          <CommandInput
            placeholder={t('passivePicker.searchPlaceholder')}
            value={query}
            onValueChange={setQuery}
          />
          <CommandList className="max-h-[19rem]">
            <CommandEmpty>{t('passivePicker.empty')}</CommandEmpty>
            {showRecents && (
              <CommandGroup heading={t('passivePicker.recents')}>{recentPassives.map(renderItem)}</CommandGroup>
            )}
            {groups.map((group) => {
              const groupItems = showRecents ? group.items.filter((p) => !recentSet.has(p.id)) : group.items
              if (groupItems.length === 0) return null
              return (
                <CommandGroup key={group.label} heading={group.label}>
                  {groupItems.map(renderItem)}
                </CommandGroup>
              )
            })}
          </CommandList>

          {/* Detalle completo de la pasiva bajo el cursor o el teclado. */}
          <div className="min-h-[3.75rem] border-t border-border bg-muted/40 px-3 py-2">
            {active ? (
              <>
                <p className="flex items-center gap-1.5 text-xs font-semibold">
                  <PassiveBadge passive={active} />
                  <span
                    className={cn(
                      'font-mono text-[10px] font-normal',
                      active.rank > 2
                        ? 'text-emerald-400'
                        : active.rank > 0
                          ? 'text-sky-400'
                          : 'text-rose-400',
                    )}
                  >
                    {t('passivePicker.rank', { rank: active.rank > 0 ? `+${active.rank}` : active.rank })}
                  </span>
                </p>
                <ul className="mt-0.5 space-y-0.5">
                  {passiveEffects(active).map((effect) => (
                    <li key={effect} className="text-[11px] leading-snug text-muted-foreground">
                      {effect}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                {t('passivePicker.hoverHint')}
              </p>
            )}
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
