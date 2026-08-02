import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { getLang } from '@/i18n/lang'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** ES: 0.0734 -> "7,3 %" · EN: 0.0734 -> "7.3%" */
export function formatPercent(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return '-'
  const pct = value * 100
  const d = pct < 1 && pct > 0 ? 2 : digits
  if (getLang() === 'en') return `${pct.toFixed(d)}%`
  return `${pct.toFixed(d).replace('.', ',')} %`
}

export function formatNumber(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return '∞'
  if (getLang() === 'en') return value.toFixed(digits).replace(/\.0$/, '')
  return value.toFixed(digits).replace('.', ',').replace(/,0$/, '')
}
