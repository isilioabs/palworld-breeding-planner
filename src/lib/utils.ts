import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** 0.0734 -> "7,3 %" */
export function formatPercent(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return '-'
  const pct = value * 100
  const d = pct < 1 && pct > 0 ? 2 : digits
  return `${pct.toFixed(d).replace('.', ',')} %`
}

export function formatNumber(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return '∞'
  return value.toFixed(digits).replace('.', ',').replace(/,0$/, '')
}
