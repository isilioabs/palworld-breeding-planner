/**
 * "Ficha" de un Pal: exactamente el mismo contenido calculado que ya
 * mostraba `PokedexPanel` (pasivas recomendadas, builds, Pals relacionados,
 * recetas de cria directa) -extraido a una funcion pura, sin React ni
 * hooks, para poder llamarse tanto desde la app (cliente) como desde el
 * script de prerenderizado de paginas por Pal (Node, via `tsx`).
 *
 * Usa `getLang()` (modulo plano en `i18n/lang.ts`, sin Context) igual que
 * `palName()`/`workTypeLabel()` -en Node, sin `localStorage`/`navigator`,
 * cae de forma segura en 'en'.
 */
import { getBuildsFor, type PalBuild } from './builds'
import { getResolver } from './breeding'
import { dexLabel, loadDatabase, palName, workTypeLabel } from './database'
import { getPalCombatStats, getPalDrops, getPalPartnerSkill, getPalWikiData } from './pal-details-data'
import { ELEMENT_INFO, type ElementInfo } from './element'
import type { Pal, PalActiveSkill, PalCombatStats, PalDrop, PalPartnerSkill, PalWildSpawn, Passive } from './types'

export interface PalDossier {
  pal: Pal
  elementInfo: ElementInfo
  /** Hasta 6: de los builds recomendados si hay alguno, si no las mejores pasivas del juego en general. */
  bestPassives: Passive[]
  builds: PalBuild[]
  /** Hasta 6, mismo elemento, ordenados por cercania en el Paldex. */
  related: Pal[]
  /** Hasta 8 parejas [padre, madre] que crian a este Pal directamente. */
  recipes: [string, string][]
  /** null = solo se cria, no existe en estado salvaje. */
  wildLevelRange: [number, number] | null
  topWorkLabel: string
  /** Fuente: DT_PalMonsterParameter (export local del juego). null si el Pal no tiene fila. */
  combatStats: PalCombatStats | null
  /** Fuente: DT_PalDropItem. Vacio si no hay drops registrados. */
  drops: PalDrop[]
  /** Fuente: Palworld Wiki (Fandom), CC BY-SA. Vacio si la pagina no matcheo. */
  activeSkills: PalActiveSkill[]
  /** Fuente: game8.co (respaldo: Palworld Wiki/Fandom para lo que game8 no cubre). null si no hay dato. */
  partnerSkill: PalPartnerSkill | null
  /** De donde vino `partnerSkill` -distinto del resto de wikiSourceUrl/CC BY-SA, que solo cubre Fandom. null si partnerSkill es null. */
  partnerSkillSource: 'game8' | 'wiki' | null
  /** Fuente: Palworld Wiki (Fandom), CC BY-SA. Vacio si no hay dato. */
  wildSpawns: PalWildSpawn[]
  /** URL de la pagina fuente en la Palworld Wiki, para el credito de atribucion CC BY-SA. null si no hay dato de esa fuente. */
  wikiSourceUrl: string | null
}

export function buildPalDossier(palId: string): PalDossier | null {
  const db = loadDatabase()
  const pal = db.palById.get(palId)
  if (!pal) return null

  const builds = getBuildsFor(pal.id)
  const buildPassives = [...new Set(builds.flatMap((build) => build.passives))]
  const bestPassiveIds = (
    buildPassives.length ? buildPassives : db.passives.filter((passive) => passive.rank > 0).sort((a, b) => b.rank - a.rank).map((passive) => passive.id)
  ).slice(0, 6)
  const bestPassives = bestPassiveIds.flatMap((id) => {
    const passive = db.passiveById.get(id)
    return passive ? [passive] : []
  })
  const related = db.pals
    .filter((candidate) => candidate.id !== pal.id && candidate.elements.some((element) => pal.elements.includes(element)))
    .sort((a, b) => Math.abs(a.dex - pal.dex) - Math.abs(b.dex - pal.dex))
    .slice(0, 6)
  const recipes = getResolver().parentsOf(pal.id).slice(0, 8)
  const wikiData = getPalWikiData(pal.id)
  const game8PartnerSkill = getPalPartnerSkill(pal.id)
  const partnerSkill = game8PartnerSkill ?? wikiData?.partnerSkill ?? null
  const partnerSkillSource = game8PartnerSkill ? 'game8' : wikiData?.partnerSkill ? 'wiki' : null

  return {
    pal,
    elementInfo: ELEMENT_INFO[pal.elements[0] ?? 'neutral'],
    bestPassives,
    builds,
    related,
    recipes,
    wildLevelRange: pal.wild,
    topWorkLabel: pal.work[0] ? workTypeLabel(pal.work[0].type) : '',
    combatStats: getPalCombatStats(pal.id),
    drops: getPalDrops(pal.id),
    activeSkills: wikiData?.activeSkills ?? [],
    // game8 primero (mas completo, ver PalPartnerSkill en types.ts); Fandom
    // como respaldo solo para el puñado de Pals que game8 no cubre.
    partnerSkill,
    partnerSkillSource,
    wildSpawns: wikiData?.wildSpawns ?? [],
    wikiSourceUrl: wikiData?.sourceUrl ?? null,
  }
}

/** Etiqueta corta reutilizada por la app y por el script de prerenderizado -mismo texto, un solo sitio. */
export function palDossierTitle(pal: Pal): string {
  return `${palName(pal)} ${dexLabel(pal)}`
}
