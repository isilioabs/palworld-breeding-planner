/**
 * Build Advisor: recomienda hasta 5 "builds" (Trabajador de base, Combate,
 * Tanque, Rancho, Soporte) por Pal, con 4 pasivas cada uno.
 *
 * Los datos viven en src/data/builds.json, generado por
 * scripts/generate-build-advisor.mjs a partir de las estadisticas REALES del
 * juego (Hp/Ataque/Defensa/Soporte/aptitud de Rancho), no inventados a mano.
 * Regenerar ese JSON (tras un parche de Palworld, por ejemplo) no requiere
 * tocar ningun componente de React: por eso vive separado del codigo, igual
 * que pals.json/passives.json.
 */
import buildsJson from '@/data/builds.json'

export type BuildRole = 'Base Worker' | 'Combat' | 'Tank' | 'Mount' | 'Transport'

export interface PalBuild {
  role: BuildRole
  icon: string
  /** 1-5, calculado a partir de la estadistica real que justifica el rol. */
  rating: number
  /** Clave de traduccion para la descripcion corta (ver i18n/translations.ts). */
  descKey: string
  /** Ids de pasiva (src/data/passives.json), 4 por build. */
  passives: string[]
}

const BUILDS = buildsJson as unknown as Record<string, PalBuild[]>

/** Builds recomendados para un Pal, de mas a menos estrellas. Vacio si el Pal no destaca en ningun rol. */
export function getBuildsFor(palId: string | null | undefined): PalBuild[] {
  if (!palId) return []
  return BUILDS[palId] ?? []
}
