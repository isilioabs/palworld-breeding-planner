/**
 * Idioma actual, en un modulo plano sin React: lo leen tanto componentes
 * (via language-store.tsx) como funciones de dominio puras (palName,
 * workTypeLabel...) que no pueden depender de un Context. Un solo valor
 * mutable + pub/sub basta -la app es de un unico usuario, sin SSR ni
 * concurrencia real que journalizar.
 */
export type Lang = 'es' | 'en'

const KEY = 'pbp:lang'
const SPANISH_REGIONS = new Set([
  'AR', 'BO', 'CL', 'CO', 'CR', 'CU', 'DO', 'EC', 'ES', 'GQ', 'GT', 'HN',
  'MX', 'NI', 'PA', 'PE', 'PR', 'PY', 'SV', 'UY', 'VE',
])

/**
 * El navegador no expone el país por IP (y no debemos pedirlo solo para
 * traducir la interfaz). Su locale sí expresa la preferencia regional del
 * jugador, por ejemplo `es-MX` o `en-US`, y funciona también offline.
 */
export function detectBrowserLang(locales?: readonly string[]): Lang {
  const preferred = locales
    ? locales[0]
    : (typeof navigator !== 'undefined' ? navigator.languages?.[0] ?? navigator.language : undefined)

  if (!preferred) return 'en'

  const parts = preferred.replace('_', '-').split('-')
  const language = parts[0]?.toLowerCase()
  const region = parts.find((part) => /^[a-z]{2}$/i.test(part) && part.toLowerCase() !== language)?.toUpperCase()

  return language === 'es' || (region !== undefined && SPANISH_REGIONS.has(region)) ? 'es' : 'en'
}

function loadInitialLang(): Lang {
  // Las URLs publicas en /es son versiones SEO estables. La URL debe ganar
  // incluso a una preferencia anterior para que contenido, `lang`, canonical
  // y hreflang describan siempre la misma version del documento.
  if (typeof window !== 'undefined' && (window.location.pathname === '/es' || window.location.pathname.startsWith('/es/'))) {
    return 'es'
  }
  try {
    const raw = localStorage.getItem(KEY)
    // Un idioma guardado solo existe tras usar el selector manual, por lo
    // que siempre debe ganar a la detección automática.
    if (raw === 'es' || raw === 'en') return raw
  } catch {
    // En modo privado puede fallar localStorage; la detección sigue siendo
    // suficiente para esta sesión.
  }
  return detectBrowserLang()
}

let lang: Lang = loadInitialLang()
const listeners = new Set<() => void>()

export function getLang(): Lang {
  return lang
}

export function setLang(next: Lang) {
  if (next === lang) return
  lang = next
  try {
    localStorage.setItem(KEY, next)
  } catch {
    // localStorage puede fallar en modo privado; el idioma solo no persiste entre sesiones.
  }
  listeners.forEach((fn) => fn())
}

export function subscribeLang(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
