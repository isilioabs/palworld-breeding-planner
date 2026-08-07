/**
 * Slug de URL publica para un Pal, derivado de su nombre en ingles (no de su
 * `id` interno, que a veces es opaco -"GrassGolem" para Dualith, "CatVampire"
 * para Selyne...). Las paginas SEO buscan coincidir con lo que la gente
 * escribe en Google ("how to breed anubis"), no con el nombre interno del juego.
 */
import type { Pal } from './types'

export function palSlug(pal: Pal): string {
  const base = pal.name
    .toLocaleLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // acentos, por si acaso
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  // Algunas variantes (`variant: true`, la "B" de dexLabel()) comparten el
  // mismo nombre visible que su base -ej. Gumoss normal y Gumoss (flor),
  // ambos "Gumoss"- asi que sin esto colisionarian en la misma URL.
  return pal.variant ? `${base}-variant` : base
}

/**
 * slug -> palId para las ~300 entradas reales. Si dos Pals colisionaran en
 * el mismo slug (no ocurre hoy, pero mejor fallar alto y claro que pisar una
 * pagina en silencio durante el prerenderizado), se lanza con los dos ids.
 */
export function buildSlugIndex(pals: Pal[]): Map<string, string> {
  const index = new Map<string, string>()
  for (const pal of pals) {
    const slug = palSlug(pal)
    const existing = index.get(slug)
    if (existing) throw new Error(`Slug duplicado "${slug}": ${existing} y ${pal.id} generan la misma URL.`)
    index.set(slug, pal.id)
  }
  return index
}

let cachedIndex: Map<string, string> | null = null

/** Version cacheada para el cliente (no reconstruye las ~300 entradas en cada render). */
export function getPalSlugIndex(pals: Pal[]): Map<string, string> {
  if (!cachedIndex) cachedIndex = buildSlugIndex(pals)
  return cachedIndex
}
