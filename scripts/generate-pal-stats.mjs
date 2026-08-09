#!/usr/bin/env node
/**
 * Genera src/data/pal-stats.json (stats de combate + drops reales) a partir
 * de un export de FModel de las DataTables del juego -misma fuente y mismo
 * patron que scripts/generate-build-advisor.mjs.
 *
 * DT_PalMonsterParameter.json: las filas estan indexadas directamente por
 * palId (confirmado: rows['Anubis'] existe, igual que ya asume
 * generate-build-advisor.mjs en su propio cruce). No hace falta resolver por
 * Tribe.
 *
 * DT_PalDropItem.json: filas indexadas por un id propio (p.ej. "Anubis000"),
 * con CharacterID + Level como campos. Cada Pal tiene 2 filas (Level 0 y
 * Level 80+); nos quedamos solo con Level === 0 -es la tabla de drops base,
 * la variante de nivel alto duplica casi todo con cantidades ligeramente
 * mayores y no aporta informacion nueva para una ficha de wiki.
 *
 * Los nombres de item en Text/DT_ItemNameText.json de este export salen en
 * japones (el export no incluye el pak de localizacion EN), asi que en vez
 * de esa tabla se humaniza el ItemId crudo (ya son palabras en ingles:
 * "LargePalSoul" -> "Large Pal Soul").
 *
 * Uso: node scripts/generate-pal-stats.mjs "<ruta a .../DataTable>"
 */
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const dtDir = process.argv[2]
if (!dtDir) {
  console.error('Uso: node scripts/generate-pal-stats.mjs "<ruta a .../DataTable>"')
  process.exit(1)
}

/**
 * WorkType (app, src/domain/types.ts) -> campo WorkSuitability_* del juego.
 * Confirmado contra el export real (Anubis: Handcraft=6, Mining=6,
 * Transport=4, coincide con sus 2 aptitudes ya conocidas en pals.json).
 * WorkSuitability_OilExtraction no tiene WorkType equivalente en la app -se
 * ignora.
 */
const WORK_TYPE_FIELDS = {
  Kindling: 'WorkSuitability_EmitFlame',
  Watering: 'WorkSuitability_Watering',
  Planting: 'WorkSuitability_Seeding',
  GenerateElectricity: 'WorkSuitability_GenerateElectricity',
  Handiwork: 'WorkSuitability_Handcraft',
  Gathering: 'WorkSuitability_Collection',
  Lumbering: 'WorkSuitability_Deforest',
  Mining: 'WorkSuitability_Mining',
  MedicineProduction: 'WorkSuitability_ProductMedicine',
  Cooling: 'WorkSuitability_Cool',
  Transporting: 'WorkSuitability_Transport',
  Farming: 'WorkSuitability_MonsterFarm',
}

/** "LargePalSoul" -> "Large Pal Soul"; "PalEgg_Water_01" -> "Pal Egg Water 01". */
function humanizeItemId(itemId) {
  return itemId
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
}

async function readRows(relPath) {
  const raw = JSON.parse(await readFile(path.join(dtDir, relPath), 'utf8'))
  const table = Array.isArray(raw) ? raw[0] : raw
  return table.Rows
}

async function main() {
  const [monsterRows, dropRows, palsRaw] = await Promise.all([
    readRows('Character/DT_PalMonsterParameter.json'),
    readRows('Character/DT_PalDropItem.json'),
    readFile(path.join(ROOT, 'src/data/pals.json'), 'utf8').then(JSON.parse),
  ])

  // CharacterID -> hasta 10 slots de drop, solo la fila base (Level 0).
  const dropsByCharacterId = new Map()
  for (const row of Object.values(dropRows)) {
    if (row.Level !== 0) continue
    const drops = []
    for (let i = 1; i <= 10; i++) {
      const itemId = row[`ItemId${i}`]
      if (!itemId || itemId === 'None') continue
      drops.push({
        itemId,
        itemName: humanizeItemId(itemId),
        rate: row[`Rate${i}`] ?? 0,
        min: row[`min${i}`] ?? 0,
        max: row[`Max${i}`] ?? 0,
      })
    }
    if (drops.length > 0) dropsByCharacterId.set(row.CharacterID, drops)
  }

  const stats = {}
  let missingStats = 0
  let missingDrops = 0
  for (const pal of palsRaw) {
    const row = monsterRows[pal.id]
    if (!row) {
      missingStats++
      continue
    }
    const workSuitability = {}
    for (const [workType, field] of Object.entries(WORK_TYPE_FIELDS)) {
      const value = row[field] ?? 0
      if (value > 0) workSuitability[workType] = value
    }

    stats[pal.id] = {
      hp: row.Hp ?? 0,
      meleeAttack: row.MeleeAttack ?? 0,
      shotAttack: row.ShotAttack ?? 0,
      defense: row.Defense ?? 0,
      support: row.Support ?? 0,
      craftSpeed: row.CraftSpeed ?? 0,
      stamina: row.Stamina ?? 0,
      walkSpeed: row.WalkSpeed ?? 0,
      runSpeed: row.RunSpeed ?? 0,
      swimSpeed: row.SwimSpeed ?? 0,
      workSuitability,
      drops: dropsByCharacterId.get(pal.id) ?? [],
    }
    if (!dropsByCharacterId.has(pal.id)) missingDrops++
  }

  await writeFile(path.join(ROOT, 'src/data/pal-stats.json'), JSON.stringify(stats) + '\n', 'utf8')
  console.log(`> pal-stats.json generado: ${Object.keys(stats).length}/${palsRaw.length} Pals con stats de combate.`)
  console.log(`  ${missingStats} sin fila en DT_PalMonsterParameter, ${missingDrops} sin drops en DT_PalDropItem.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
