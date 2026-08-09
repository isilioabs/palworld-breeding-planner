#!/usr/bin/env node
/**
 * Parsea scripts/data-sources/game8-partner-skills-raw.json (snapshot
 * capturado a mano de game8.co/games/Palworld/archives/439665, ver ese
 * archivo para el porque) y genera src/data/pal-partner-skills.json:
 * { [palId]: { name, tags: string[], description } }.
 *
 * Reemplaza al Partner Skill que traia pal-wiki-data.json (Fandom): esa
 * fuente tenia descripciones truncadas/incompletas para varios Pals
 * (confirmado a mano con Necromus, Orserk, Cryolinx Terra, Chillet, Pyrin,
 * Azurobe, Maraith -ver conversacion) y no traia categorias curadas.
 *
 * Formato de cada fila cruda: "<NombreSkill> Partner Pal: <Pal(es)> [<tags
 * separados por coma>] <descripcion>". Cuando una fila lista mas de un Pal
 * (ej. "Vanwyrm Vanwyrm Cryst"), ese segmento se separa por coincidencia
 * contra los nombres reales de src/data/pals.json (match mas largo primero,
 * para no cortar "Vanwyrm Cryst" en "Vanwyrm" + "Cryst" suelto).
 *
 * Uso: node scripts/parse-game8-partner-skills.mjs
 */
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

/** Nombres que el propio game8 usa para referirse a un grupo de Pals, no a un Pal real -no tienen fila en pals.json. */
const KNOWN_GROUP_ALIASES = new Set(['Terraria Slimes'])

function splitPalNames(segment, namesSortedByLengthDesc) {
  const names = []
  let remaining = segment.trim()
  while (remaining.length > 0) {
    const match = namesSortedByLengthDesc.find((name) => remaining === name || remaining.startsWith(`${name} `))
    if (!match) break
    names.push(match)
    remaining = remaining.slice(match.length).trim()
  }
  return { names, leftover: remaining }
}

async function main() {
  const [rawFile, palsRaw] = await Promise.all([
    readFile(path.join(ROOT, 'scripts/data-sources/game8-partner-skills-raw.json'), 'utf8').then(JSON.parse),
    readFile(path.join(ROOT, 'src/data/pals.json'), 'utf8').then(JSON.parse),
  ])

  const nameToId = new Map(palsRaw.map((p) => [p.name, p.id]))
  const namesSortedByLengthDesc = [...nameToId.keys()].sort((a, b) => b.length - a.length)

  const result = {}
  let matchedPals = 0
  const unparsedRows = []
  const unmatchedGroups = []

  for (const row of rawFile.rows) {
    const marker = ' Partner Pal: '
    const markerIndex = row.indexOf(marker)
    if (markerIndex === -1) {
      unparsedRows.push(row)
      continue
    }
    const skillName = row.slice(0, markerIndex).trim()
    const rest = row.slice(markerIndex + marker.length)
    const bracketStart = rest.indexOf('[')
    const bracketEnd = rest.indexOf(']')
    if (bracketStart === -1 || bracketEnd === -1) {
      unparsedRows.push(row)
      continue
    }
    const palSegment = rest.slice(0, bracketStart).trim()
    const tagsRaw = rest.slice(bracketStart + 1, bracketEnd).trim()
    const description = rest.slice(bracketEnd + 1).trim()
    const tags = tagsRaw ? tagsRaw.split(',').map((t) => t.trim()) : []

    if (!description || description === 'TBA') continue // sin descripcion real todavia en game8

    const { names, leftover } = splitPalNames(palSegment, namesSortedByLengthDesc)
    if (leftover) {
      if (!KNOWN_GROUP_ALIASES.has(palSegment)) unmatchedGroups.push(palSegment)
      continue
    }
    for (const name of names) {
      const palId = nameToId.get(name)
      if (!palId) continue
      result[palId] = { name: skillName, tags, description }
      matchedPals++
    }
  }

  await writeFile(path.join(ROOT, 'src/data/pal-partner-skills.json'), JSON.stringify(result) + '\n', 'utf8')
  console.log(`> pal-partner-skills.json generado: ${matchedPals}/${palsRaw.length} Pals con Partner Skill de game8.`)
  console.log(`  ${rawFile.rows.length} filas crudas, ${unparsedRows.length} sin parsear, ${unmatchedGroups.length} grupos de Pals no resueltos.`)
  if (unparsedRows.length) console.log('  Sin parsear:', unparsedRows)
  if (unmatchedGroups.length) console.log('  Grupos no resueltos:', unmatchedGroups)

  const missing = palsRaw.filter((p) => !result[p.id]).map((p) => p.name)
  console.log(`  ${missing.length} Pals sin Partner Skill en game8 (quedan sin dato, no se inventa nada):`, missing.slice(0, 20).join(', '), missing.length > 20 ? '...' : '')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
