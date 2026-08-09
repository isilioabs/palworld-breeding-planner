#!/usr/bin/env node
/**
 * Genera src/data/pal-wiki-data.json (habilidades activas, partner skill y
 * ubicaciones de spawn salvaje) leyendo la Palworld Wiki oficial de Fandom
 * (palworld.fandom.com), cuyo contenido esta bajo licencia CC BY-SA.
 *
 * Se descarto scrapear paldb.cc (su dataset de mapa es la compilacion
 * propietaria de un competidor directo) a favor de esta fuente: es contenido
 * de wiki con licencia abierta, accedido via la API publica de MediaWiki
 * (accion "parse", no scraping de HTML), respetando la atribucion que exige
 * la licencia (ver la seccion de creditos que consume este JSON en
 * pal-dossier.ts / pal-page.tsx / prerender-pal-pages.ts).
 *
 * Se corre a mano (no en cada `npm run build`) para no golpear la API de
 * Fandom en cada deploy. Parsea el wikitext con regex dirigidas a los
 * templates confirmados a mano (no es un parser de wikitext generico): si
 * una pagina no matchea el patron esperado, se salta con un warning en vez
 * de romper el batch completo.
 *
 * Uso: node scripts/fetch-wiki-pal-data.mjs [--limit N]
 */
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const API_BASE = 'https://palworld.fandom.com/api.php'
const WIKI_BASE = 'https://palworld.fandom.com/wiki'
const USER_AGENT = 'PalaxisDataBot/1.0 (https://palaxis.app; one-time build-time fetch for wiki content attribution page)'
const DELAY_MS = 300

const limitArg = process.argv.indexOf('--limit')
const LIMIT = limitArg !== -1 ? Number(process.argv[limitArg + 1]) : Infinity

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchWikitext(pageName) {
  const url = `${API_BASE}?action=parse&page=${encodeURIComponent(pageName)}&prop=wikitext&format=json`
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  if (!res.ok) return null
  const json = await res.json()
  if (json.error) return null
  return json.parse?.wikitext?.['*'] ?? null
}

/** {{PalSkillListEntry+|Nombre|level=N}} dentro de {{PalSkillListStart}}...{{PalSkillListEnd}}. */
function parseActiveSkills(wikitext) {
  const block = /\{\{PalSkillListStart\}\}([\s\S]*?)\{\{PalSkillListEnd\}\}/.exec(wikitext)
  if (!block) return []
  const entries = []
  const re = /\{\{PalSkillListEntry\+?\|([^|}]+)\|level=(\d+)\}\}/g
  let m
  while ((m = re.exec(block[1]))) {
    entries.push({ name: m[1].trim(), level: Number(m[2]) })
  }
  return entries
}

/** {{i|Wool}} -> "Wool"; {{i|Alpha Pals|Alpha}} -> "Alpha" (segundo argumento = texto mostrado). */
function stripWikiTemplates(text) {
  return text
    .replace(/\{\{i\|([^}|]+)(?:\|([^}]+))?\}\}/g, (_, a, b) => b ?? a)
    .replace(/\{\{s\|([^}|]+)(?:\|([^}]+))?\}\}/g, (_, a, b) => b ?? a)
    .replace(/<br\s*\/?>/gi, ' ')
    .trim()
}

/** partnerskill = ... / psdesc = ... dentro del template principal {{Pal ... }}. */
function parsePartnerSkill(wikitext) {
  const name = /\|\s*partnerskill\s*=\s*([^\n|]+)/.exec(wikitext)
  const desc = /\|\s*psdesc\s*=\s*([^\n]+?)\s*\n\|/.exec(wikitext)
  if (!name || !name[1].trim()) return null
  return { name: name[1].trim(), description: desc ? stripWikiTemplates(desc[1]) : '' }
}

/**
 * === Wild Spawn === seccion, lineas "* [[Region]] (x, y) - nota". Se procesa
 * linea por linea (no una regex multilinea con \s*, que termina "comiendose"
 * el salto de linea y fusionando la nota de una entrada con el bullet
 * siguiente) e ignora sub-bullets "** " anidados de dungeons/notas internas.
 */
function parseWildSpawns(wikitext) {
  const block = /===\s*Wild Spawn\s*===\s*\n([\s\S]*?)(?=\n===|\n==[^=]|\n<div)/.exec(wikitext)
  if (!block) return []
  const lineRe = /^\*\s*\[\[([^\]|]+)(?:\|[^\]]+)?\]\]\s*(?:\((-?\d+),\s*(-?\d+)\))?\s*-?\s*(.*)$/
  const spawns = []
  for (const rawLine of block[1].split('\n')) {
    const line = rawLine.trim()
    if (!line.startsWith('*') || line.startsWith('**')) continue
    const m = lineRe.exec(line)
    if (!m) continue
    spawns.push({
      region: m[1].trim(),
      coordinates: m[2] && m[3] ? [Number(m[2]), Number(m[3])] : null,
      note: stripWikiTemplates(m[4] || ''),
    })
  }
  return spawns
}

async function main() {
  const palsRaw = JSON.parse(await readFile(path.join(ROOT, 'src/data/pals.json'), 'utf8'))
  const result = {}
  let matched = 0
  let skipped = 0
  const targets = palsRaw.slice(0, LIMIT)

  for (const pal of targets) {
    const wikitext = await fetchWikitext(pal.name)
    if (!wikitext) {
      skipped++
      console.warn(`  (sin pagina) ${pal.id} (${pal.name})`)
      await sleep(DELAY_MS)
      continue
    }

    const activeSkills = parseActiveSkills(wikitext)
    const partnerSkill = parsePartnerSkill(wikitext)
    const wildSpawns = parseWildSpawns(wikitext)

    if (activeSkills.length === 0 && !partnerSkill && wildSpawns.length === 0) {
      skipped++
      console.warn(`  (sin match de templates) ${pal.id} (${pal.name})`)
    } else {
      matched++
      result[pal.id] = {
        activeSkills,
        partnerSkill,
        wildSpawns,
        sourceUrl: `${WIKI_BASE}/${encodeURIComponent(pal.name.replace(/ /g, '_'))}`,
      }
    }
    await sleep(DELAY_MS)
  }

  await writeFile(path.join(ROOT, 'src/data/pal-wiki-data.json'), JSON.stringify(result) + '\n', 'utf8')
  console.log(`> pal-wiki-data.json generado: ${matched}/${targets.length} Pals con datos, ${skipped} sin match/pagina.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
