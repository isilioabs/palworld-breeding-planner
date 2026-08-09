#!/usr/bin/env node
/**
 * Genera src/data/builds.json (recomendaciones de "build" por Pal para el
 * Build Advisor) a partir de dos fuentes verificables, nunca inventadas:
 *
 *  1. Las estadisticas REALES del juego (DT_PalMonsterParameter, extraida
 *     con FModel -misma fuente que import-pal-portraits.mjs) para Trabajador
 *     de base / Combate / Tanque / Transporte: alto ataque -> Combate, alta
 *     vida+defensa -> Tanque, aptitud de Transporte -> Transporte, etc.
 *  2. Para Montura (terrestre y voladora) el juego no expone en las
 *     DataTables ninguna bandera de "es montable": se uso en su lugar la
 *     tabla S/A/B/C/D de palworld.gg/tier-list (ground-mounts y
 *     flying-mounts), pedida explicitamente por el usuario como referencia,
 *     resuelta contra nuestro propio pals.json por NOMBRE (los alt-text de
 *     esa web coinciden 1:1 con pal.name). Es la unica parte de este script
 *     que es una lista curada de fuera en vez de una stat propia -por eso
 *     esta separada y documentada aqui.
 *
 * Las 4 pasivas de cada build tambien son curadas a mano (ver ROLES abajo),
 * calcadas de la tabla de referencia que paso el usuario (variante Reddit de
 * las guias de palworld.gg/TFTAcademy), pero cruzadas 1:1 contra
 * src/data/passives.json antes de escribir nada: si un nombre no existe en
 * nuestro propio dataset, el script falla en vez de escribir un id
 * inventado (la leccion de "Golden Touch" de la investigacion previa).
 *
 * Uso: node scripts/generate-build-advisor.mjs "<ruta a DT_PalMonsterParameter.json>"
 */
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const dtPath = process.argv[2]
if (!dtPath) {
  console.error('Uso: node scripts/generate-build-advisor.mjs "<ruta a .../DataTable/Character/DT_PalMonsterParameter.json>"')
  process.exit(1)
}

/**
 * Montura: S/A/B/C/D de palworld.gg/tier-list/ground-mounts y
 * /flying-mounts (leido el 2026-08-02). Nombre = pal.name exacto.
 */
const GROUND_MOUNT_TIERS = {
  S: ['Necromus', 'Paladius', 'Ophydia', 'Pyrin', 'Azurmane', 'Dazemu', 'Starryon', 'Starryon Primo', 'Gildane', 'Fenglope'],
  A: ['Xenogard', 'Bastigor', 'Rayhound', 'Rayhound Cryst', 'Direhowl', 'Univolt', 'Univolt Cryst', 'Aegidron', 'Silvegis'],
  B: ['Blazamut', 'Blazehowl', 'Celesdir', 'Celesdir Noct', 'Kitsun', 'Maraith', 'Arsox', 'Shroomer', 'Chillet', 'Grintale', 'Azurobe', 'Eikthyrdeer', 'Solmora', 'Solmora Lux'],
  C: ['Reindrix', 'Shroomer Noct', 'Kingpaca', 'Dinossom', 'Jormuntide', 'Jormuntide Ignis', 'Melpaca', 'Moldron', 'Moldron Cryst', 'Bulldosu', 'Rushoar', 'Dualith', 'Dualith Noct', 'Surfent'],
  D: ['Yakumo', 'Wumpo', 'Mammorest', 'Sweepa', 'Broncherry', 'Reptyro', 'Tetroise', 'Tetroise Primo', 'Polapup Terra'],
}
const FLYING_MOUNT_TIERS = {
  S: ['Jetragon', 'Panthalus', 'Shaolong', 'Eidrolon', 'Eidrolon Ignis'],
  A: ['Frostallion', 'Frostallion Noct', 'Selyne', 'Faleris', 'Faleris Aqua'],
  B: ['Roujay', 'Shadowbeak', 'Ragnahawk', 'Suzaku', 'Suzaku Aqua'],
  C: ['Beakon', 'Beakon Cryst', 'Astegon', 'Helzephyr', 'Helzephyr Lux', 'Dynamoff', 'Quivern', 'Quivern Botan'],
  D: ['Vanwyrm', 'Vanwyrm Cryst', 'Elphidran', 'Elphidran Aqua', 'Nitewing', 'Xenolord'],
}
const TIER_STARS = { S: 5, A: 4, B: 3, C: 2, D: 1 }

/** name -> mejores estrellas entre montura terrestre y voladora (si sale en ambas, se queda con la mejor). */
function buildMountStars() {
  const stars = new Map()
  for (const tiers of [GROUND_MOUNT_TIERS, FLYING_MOUNT_TIERS]) {
    for (const [tier, names] of Object.entries(tiers)) {
      for (const name of names) {
        const s = TIER_STARS[tier]
        if (!stars.has(name) || stars.get(name) < s) stars.set(name, s)
      }
    }
  }
  return stars
}

/**
 * Roles con sus pasivas (nombre real del juego -> se resuelve el id contra
 * passives.json) y la funcion que decide, a partir de las stats reales de un
 * Pal, si aplica el rol y con cuantas estrellas (1-5).
 */
const ROLES = [
  {
    role: 'Base Worker',
    icon: '⚒',
    descKey: 'buildAdvisor.desc.worker',
    // Calcado de la fila "Base Worker/Ranch" de la tabla de referencia.
    passiveNames: ['Demon’s Hand', 'Remarkable Craftsmanship', 'Artisan', 'Work Slave'],
    evaluate: (s) => {
      const best = s.bestWork
      if (best < 3) return null
      return best >= 7 ? 5 : best >= 6 ? 4 : best >= 5 ? 3 : best >= 4 ? 2 : 1
    },
  },
  {
    role: 'Combat',
    icon: '⚔',
    descKey: 'buildAdvisor.desc.combat',
    // Fila "Standard (Party)" de la tabla: el pick "de andar por casa" mas que el nuke maximo.
    passiveNames: ['Immortality', 'Legend', 'Demon God', 'Serenity'],
    evaluate: (s) => {
      const atk = Math.max(s.melee, s.shot)
      if (atk < 110) return null
      return atk >= 142 ? 5 : atk >= 134 ? 4 : atk >= 126 ? 3 : atk >= 118 ? 2 : 1
    },
  },
  {
    role: 'Tank',
    icon: '🏔',
    descKey: 'buildAdvisor.desc.tank',
    // Fila "Raid Def" de la tabla.
    passiveNames: ['Legend', 'Immortality', 'Diamond Body', 'Serenity'],
    evaluate: (s) => {
      const bulk = s.hp + s.def
      if (bulk < 210) return null
      return bulk >= 250 ? 5 : bulk >= 240 ? 4 : bulk >= 230 ? 3 : bulk >= 220 ? 2 : 1
    },
  },
  {
    role: 'Mount',
    icon: '🐴',
    descKey: 'buildAdvisor.desc.mount',
    // Fila "Mount" de la tabla.
    passiveNames: ['Dimensional Leap', 'Legend', 'Swift', 'Runner'],
    // Se evalua aparte por nombre (ver mountStars), no por stats: null aqui.
    evaluate: () => null,
  },
  {
    role: 'Transport',
    icon: '📦',
    descKey: 'buildAdvisor.desc.transport',
    // Fila "Transport" de la tabla.
    passiveNames: ['Dimensional Leap', 'Swift', 'Legend', 'Insomnia'],
    evaluate: (s) => {
      if (s.transport < 3) return null
      return s.transport >= 7 ? 5 : s.transport >= 6 ? 4 : s.transport >= 5 ? 3 : s.transport >= 4 ? 2 : 1
    },
  },
]

async function main() {
  const [dt, palsRaw, passivesRaw] = await Promise.all([
    readFile(dtPath, 'utf8').then(JSON.parse),
    readFile(path.join(ROOT, 'src/data/pals.json'), 'utf8').then(JSON.parse),
    readFile(path.join(ROOT, 'src/data/passives.json'), 'utf8').then(JSON.parse),
  ])
  const rows = dt[0].Rows
  const mountStars = buildMountStars()
  const palByName = new Map(palsRaw.map((p) => [p.name, p]))

  // Todo nombre de la tabla de monturas debe existir en pals.json: si no,
  // mejor fallar aqui que servir un build a un Pal que no existe.
  for (const name of mountStars.keys()) {
    if (!palByName.has(name)) throw new Error(`Montura "${name}" (palworld.gg/tier-list) no existe en src/data/pals.json`)
  }

  // Resolver nombre de pasiva -> id real, y fallar fuerte si falta una: mejor
  // un error en build-time que un id inventado silencioso en produccion.
  const passiveIdByName = new Map(passivesRaw.map((p) => [p.name, p.id]))
  for (const r of ROLES) {
    r.passiveIds = r.passiveNames.map((name) => {
      const id = passiveIdByName.get(name)
      if (!id) throw new Error(`Pasiva "${name}" (rol ${r.role}) no existe en src/data/passives.json`)
      return id
    })
  }

  const builds = {}
  let missing = 0
  for (const pal of palsRaw) {
    const row = rows[pal.id]
    if (!row) {
      missing++
      continue
    }
    const bestWork = Math.max(0, ...(pal.work ?? []).map((w) => w.value))
    const stats = {
      hp: row.Hp ?? 0,
      melee: row.MeleeAttack ?? 0,
      shot: row.ShotAttack ?? 0,
      def: row.Defense ?? 0,
      transport: row.WorkSuitability_Transport ?? 0,
      bestWork,
    }

    const entries = []
    for (const r of ROLES) {
      const stars = r.role === 'Mount' ? mountStars.get(pal.name) ?? null : r.evaluate(stats)
      if (stars === null || stars === undefined) continue
      entries.push({ role: r.role, icon: r.icon, rating: stars, descKey: r.descKey, passives: r.passiveIds })
    }
    // De mas a menos estrellas: el build mas representativo del Pal va primero.
    entries.sort((a, b) => b.rating - a.rating)
    if (entries.length > 0) builds[pal.id] = entries
  }

  await writeFile(path.join(ROOT, 'src/data/builds.json'), JSON.stringify(builds) + '\n', 'utf8')
  const withBuilds = Object.keys(builds).length
  console.log(`> builds.json generado: ${withBuilds}/${palsRaw.length} Pals con al menos un build recomendado (${missing} sin fila en la tabla del juego)`)
  const perRole = Object.fromEntries(ROLES.map((r) => [r.role, 0]))
  for (const entries of Object.values(builds)) for (const e of entries) perRole[e.role]++
  console.log('> Pals por rol:', perRole)

  // mount-tiers.json: ground/flying POR SEPARADO (a diferencia del build
  // "Mount" de arriba, que se queda con el mejor de los dos) -para la Tier
  // List, que quiere 2 categorias distintas en vez de una fusionada.
  const tiersByPalId = (tiers) => {
    const out = {}
    for (const [tier, names] of Object.entries(tiers)) {
      for (const name of names) out[palByName.get(name).id] = TIER_STARS[tier]
    }
    return out
  }
  const mountTiers = { ground: tiersByPalId(GROUND_MOUNT_TIERS), flying: tiersByPalId(FLYING_MOUNT_TIERS) }
  await writeFile(path.join(ROOT, 'src/data/mount-tiers.json'), JSON.stringify(mountTiers) + '\n', 'utf8')
  console.log(`> mount-tiers.json generado: ${Object.keys(mountTiers.ground).length} monturas terrestres, ${Object.keys(mountTiers.flying).length} voladoras.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
