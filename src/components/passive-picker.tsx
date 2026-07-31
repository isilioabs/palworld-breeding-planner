import { useMemo, useState } from 'react'
import { Check, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PassiveBadge } from '@/components/passive-badge'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { loadDatabase, passiveEffects, passiveName, passiveSummary } from '@/domain/database'
import type { Passive } from '@/domain/types'
import { cn } from '@/lib/utils'

interface PassivePickerProps {
  selected: string[]
  onToggle: (passiveId: string) => void
  max?: number
  label?: string
  className?: string
}

const RANK_GROUPS: { min: number; max: number; label: string }[] = [
  { min: 3, max: 5, label: 'Excelentes' },
  { min: 1, max: 2, label: 'Utiles' },
  { min: -3, max: 0, label: 'Negativas' },
]

/** cmdk normaliza el `value` a minusculas, asi que la clave tambien. */
const searchKey = (passive: Passive) =>
  `${passiveName(passive)} ${passive.name} ${passiveSummary(passive)}`.toLowerCase()

export function PassivePicker({ selected, onToggle, max = 4, label = 'Anadir pasiva', className }: PassivePickerProps) {
  const db = loadDatabase()
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState('')
  const full = selected.length >= max

  const groups = useMemo(
    () =>
      RANK_GROUPS.map((group) => ({
        ...group,
        items: db.passives.filter((p) => p.rank >= group.min && p.rank <= group.max),
      })).filter((g) => g.items.length > 0),
    [db.passives],
  )

  // Para poder mostrar el detalle de la pasiva sobre la que esta el cursor.
  const byKey = useMemo(() => new Map(db.passives.map((p) => [searchKey(p), p])), [db.passives])
  const active = byKey.get(highlighted)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn('gap-1.5', className)}>
          <Plus className="size-3.5" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(26rem,92vw)] p-0">
        <Command value={highlighted} onValueChange={setHighlighted}>
          <CommandInput placeholder="Buscar pasiva o efecto..." />
          <CommandList className="max-h-[19rem]">
            <CommandEmpty>Ninguna pasiva coincide.</CommandEmpty>
            {groups.map((group) => (
              <CommandGroup key={group.label} heading={group.label}>
                {group.items.map((passive) => {
                  const isSelected = selected.includes(passive.id)
                  const effects = passiveEffects(passive)
                  return (
                    <CommandItem
                      key={passive.id}
                      value={searchKey(passive)}
                      disabled={!isSelected && full}
                      onSelect={() => onToggle(passive.id)}
                      title={`${passiveName(passive)}\n${effects.join('\n')}`}
                      className="items-start py-1.5"
                    >
                      <PassiveBadge passive={passive} className="mt-0.5 shrink-0" />
                      <span className="flex min-w-0 flex-1 flex-col">
                        {/* Resumen del efecto: en movil no hay hover, asi que va siempre visible. */}
                        <span className="truncate text-[11px] text-muted-foreground">
                          {effects.join(' · ')}
                        </span>
                      </span>
                      <Check className={cn('mt-0.5 size-4 shrink-0', isSelected ? 'opacity-100' : 'opacity-0')} />
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            ))}
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
                    rango {active.rank > 0 ? `+${active.rank}` : active.rank}
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
                Pasa el raton por una pasiva para ver que hace.
              </p>
            )}
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
