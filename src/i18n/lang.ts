/**
 * Idioma actual, en un modulo plano sin React: lo leen tanto componentes
 * (via language-store.tsx) como funciones de dominio puras (palName,
 * workTypeLabel...) que no pueden depender de un Context. Un solo valor
 * mutable + pub/sub basta -la app es de un unico usuario, sin SSR ni
 * concurrencia real que journalizar.
 */
export type Lang = 'es' | 'en'

const KEY = 'pbp:lang'

function loadInitialLang(): Lang {
  try {
    const raw = localStorage.getItem(KEY)
    return raw === 'en' ? 'en' : 'es'
  } catch {
    return 'es'
  }
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
