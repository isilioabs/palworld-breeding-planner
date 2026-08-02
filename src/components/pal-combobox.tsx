import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { PalIcon } from '@/components/pal-icon'
import { HighlightMatch } from '@/components/highlight-match'
import { dexLabel, loadDatabase, palName } from '@/domain/database'
import { getRecentIds, pushRecentId } from '@/domain/recent'
import { useT } from '@/i18n/language-store'
import { cn } from '@/lib/utils'

const RECENTS_KEY = 'target-pal'

interface PalComboboxProps {
  value: string | null
  onChange: (palId: string) => void
  placeholder?: string
  className?: string
  size?: 'default' | 'sm'
  /** Id del boton disparador, para poder abrirlo desde fuera (p.ej. el CTA del estado vacio). */
  triggerId?: string
}

export function PalCombobox({
  value,
  onChange,
  placeholder,
  className,
  size = 'default',
  triggerId,
}: PalComboboxProps) {
  const db = loadDatabase()
  const t = useT()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [recentIds, setRecentIds] = useState<string[]>([])
  const selected = value ? db.palById.get(value) : undefined

  // Se relee al abrir: puede haber cambiado desde otro combobox de Pals.
  useEffect(() => {
    if (open) setRecentIds(getRecentIds(RECENTS_KEY))
  }, [open])

  // cmdk filtra por el texto del `value`; incluimos ambos idiomas y el numero.
  const items = useMemo(
    () =>
      db.pals.map((pal) => ({
        pal,
        search: `${palName(pal)} ${pal.name} ${dexLabel(pal)} ${pal.dex}`,
      })),
    [db.pals],
  )

  const showRecents = query.trim() === '' && recentIds.length > 0
  const recentPals = showRecents
    ? recentIds.map((id) => db.palById.get(id)).filter((p): p is NonNullable<typeof p> => !!p)
    : []
  const recentSet = new Set(recentPals.map((p) => p.id))

  const select = (palId: string) => {
    onChange(palId)
    setRecentIds(pushRecentId(RECENTS_KEY, palId))
    setOpen(false)
    setQuery('')
  }

  const renderItem = (pal: (typeof items)[number]['pal'], search: string) => (
    <CommandItem key={pal.id} value={search} onSelect={() => select(pal.id)}>
      <PalIcon palId={pal.id} size={26} />
      <span className="flex-1 truncate">
        <HighlightMatch text={palName(pal)} query={query} />
      </span>
      {pal.variant && <span className="text-[10px] uppercase text-muted-foreground">{t('combobox.variant')}</span>}
      <span className="font-mono text-[10px] text-muted-foreground">{dexLabel(pal)}</span>
      <Check className={cn('size-4', value === pal.id ? 'opacity-100' : 'opacity-0')} />
    </CommandItem>
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={triggerId}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          size={size}
          className={cn('w-full justify-between font-normal', className)}
        >
          <span className={cn('flex min-w-0 items-center gap-2', !selected && 'text-muted-foreground')}>
            {selected && <PalIcon palId={selected.id} size={22} />}
            <span className="truncate">{selected ? palName(selected) : (placeholder ?? t('combobox.placeholder'))}</span>
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(28rem,90vw)] p-0">
        <Command>
          <CommandInput placeholder={t('combobox.searchPlaceholder')} value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>{t('combobox.empty')}</CommandEmpty>
            {showRecents ? (
              <>
                <CommandGroup heading={t('combobox.recents')}>
                  {recentPals.map((pal) => {
                    const found = items.find((i) => i.pal.id === pal.id)
                    return found ? renderItem(found.pal, found.search) : null
                  })}
                </CommandGroup>
                <CommandGroup heading={t('combobox.all')}>
                  {items.filter(({ pal }) => !recentSet.has(pal.id)).map(({ pal, search }) => renderItem(pal, search))}
                </CommandGroup>
              </>
            ) : (
              items.map(({ pal, search }) => renderItem(pal, search))
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
