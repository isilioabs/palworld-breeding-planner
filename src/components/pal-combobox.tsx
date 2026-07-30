import { useMemo, useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { PalIcon } from '@/components/pal-icon'
import { dexLabel, loadDatabase, palName } from '@/domain/database'
import { cn } from '@/lib/utils'

interface PalComboboxProps {
  value: string | null
  onChange: (palId: string) => void
  placeholder?: string
  className?: string
  size?: 'default' | 'sm'
}

export function PalCombobox({ value, onChange, placeholder = 'Elige un Pal...', className, size = 'default' }: PalComboboxProps) {
  const db = loadDatabase()
  const [open, setOpen] = useState(false)
  const selected = value ? db.palById.get(value) : undefined

  // cmdk filtra por el texto del `value`; incluimos ambos idiomas y el numero.
  const items = useMemo(
    () =>
      db.pals.map((pal) => ({
        pal,
        search: `${palName(pal)} ${pal.name} ${dexLabel(pal)} ${pal.dex}`,
      })),
    [db.pals],
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          size={size}
          className={cn('w-full justify-between font-normal', className)}
        >
          <span className={cn('flex min-w-0 items-center gap-2', !selected && 'text-muted-foreground')}>
            {selected && <PalIcon palId={selected.id} size={22} />}
            <span className="truncate">{selected ? palName(selected) : placeholder}</span>
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(28rem,90vw)] p-0">
        <Command>
          <CommandInput placeholder="Buscar por nombre o numero..." />
          <CommandList>
            <CommandEmpty>Ningun Pal coincide.</CommandEmpty>
            {items.map(({ pal, search }) => (
              <CommandItem
                key={pal.id}
                value={search}
                onSelect={() => {
                  onChange(pal.id)
                  setOpen(false)
                }}
              >
                <PalIcon palId={pal.id} size={26} />
                <span className="flex-1 truncate">{palName(pal)}</span>
                {pal.variant && <span className="text-[10px] uppercase text-muted-foreground">variante</span>}
                <span className="font-mono text-[10px] text-muted-foreground">{dexLabel(pal)}</span>
                <Check className={cn('size-4', value === pal.id ? 'opacity-100' : 'opacity-0')} />
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
