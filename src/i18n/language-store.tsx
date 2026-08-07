import { useSyncExternalStore } from 'react'
import { getLang, setLang, subscribeLang, type Lang } from './lang'
import { DICTS, type TranslationKey } from './translations'

/** Sustituye `{token}` en la plantilla por `vars.token`. Sin libreria: solo hay interpolacion simple, sin plurales complejos ni ICU.
 * Exportada para poder traducir fuera de React (ej. el script de prerenderizado de paginas por Pal, que no puede usar el hook `useT`). */
export function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (match, key) => (key in vars ? String(vars[key]) : match))
}

/**
 * `lang` se lee de un store externo a React (ver lang.ts) para que las
 * funciones de dominio (palName, workTypeLabel...) puedan ser lang-aware sin
 * depender de un Context. `useSyncExternalStore` es lo que mantiene a React
 * sincronizado con ese store: sin el, cambiar de idioma no re-renderizaria
 * los componentes que ya se montaron antes del cambio.
 */
export function useLang(): [Lang, (lang: Lang) => void] {
  const lang = useSyncExternalStore(subscribeLang, getLang, getLang)
  return [lang, setLang]
}

export function useT() {
  const [lang] = useLang()
  const dict = DICTS[lang]
  return (key: TranslationKey, vars?: Record<string, string | number>) => interpolate(dict[key], vars)
}
