#!/usr/bin/env node
/**
 * Verifica que la base de datos compacta de src/data reproduce EXACTAMENTE la
 * tabla completa de crianza del juego (44.849 parejas).
 *
 * Es la red de seguridad al actualizar datos: si un parche cambia algun
 * CombiRank o anade Pals, este script lo detecta antes de que la app mienta.
 *
 *   npm run data:verify
 */
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const CACHE = path.join(__dirname, '.cache')

const GROUND_TRUTH = 'https://raw.githubusercontent.com/tylercamp/palcalc/main/PalCalc.Model/breeding.json'

const read = async (p) => JSON.parse(await readFile(p, 'utf8'))

async function groundTruth() {
  const file = path.join(CACHE, 'breeding.json')
  if (existsSync(file)) return read(file)
  console.log('  descargando tabla de referencia...')
  const res = await fetch(GROUND_TRUTH)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

async function main() {
  const pals = await read(path.join(ROOT, 'src/data/pals.json'))
  const breeding = await read(path.join(ROOT, 'src/data/breeding.json'))
  const reference = await groundTruth()

  const power = new Map(pals.map((p) => [p.id, p.power]))
  const key = (a, b) => (a < b ? `${a} ${b}` : `${b} ${a}`)
  const unique = new Map(breeding.unique.map(([a, b, child]) => [key(a, b), child]))
  const genderOnly = new Set(breeding.genderUnique.map(([a, , b]) => key(a, b)))

  let checked = 0
  let failed = 0
  const examples = []

  for (const combo of reference.Breeding) {
    const a = combo.Parent1InternalName
    const b = combo.Parent2InternalName
    const expected = combo.ChildInternalName

    if (combo.Parent1Gender !== 'WILDCARD' || combo.Parent2Gender !== 'WILDCARD') {
      const match = breeding.genderUnique.some(
        ([ga, gag, gb, gbg, gc]) =>
          ga === a && gag === combo.Parent1Gender && gb === b && gbg === combo.Parent2Gender && gc === expected,
      )
      checked++
      if (!match) {
        failed++
        if (examples.length < 10) examples.push(`[sexo] ${a} x ${b} -> ${expected}`)
      }
      continue
    }

    const pa = power.get(a)
    const pb = power.get(b)
    if (pa === undefined || pb === undefined) {
      failed++
      if (examples.length < 10) examples.push(`Pal desconocido en ${a} x ${b}`)
      continue
    }

    const k = key(a, b)
    const resolved = genderOnly.has(k)
      ? null
      : (unique.get(k) ?? breeding.rankToChild[String(Math.floor((pa + pb + 1) / 2))])

    checked++
    if (resolved !== expected) {
      failed++
      if (examples.length < 10) examples.push(`${a} x ${b}: esperado ${expected}, obtenido ${resolved}`)
    }
  }

  console.log(`Pals:              ${pals.length}`)
  console.log(`Entradas de rank:  ${Object.keys(breeding.rankToChild).length}`)
  console.log(`Combos unicos:     ${breeding.unique.length} (+${breeding.genderUnique.length} por sexo)`)
  console.log(`Parejas revisadas: ${checked}`)

  if (failed) {
    console.error(`\nx ${failed} discrepancias:`)
    console.error(examples.join('\n'))
    process.exit(1)
  }
  console.log('\nOK: la base de datos compacta coincide al 100% con la tabla del juego.')

  // --- Elementos (cosmetico, fuente Palpedia): solo formato + cobertura ----
  const CANONICAL_ELEMENTS = new Set(['neutral', 'fire', 'water', 'grass', 'electric', 'ice', 'ground', 'dark', 'dragon'])
  const withElements = pals.filter((p) => (p.elements ?? []).length > 0)
  const badValues = pals.flatMap((p) => (p.elements ?? []).filter((e) => !CANONICAL_ELEMENTS.has(e)))
  console.log(`\nElementos:         ${withElements.length}/${pals.length} Pals (fuente: Palpedia, no PalCalc)`)
  if (badValues.length) {
    console.error(`x valores de elemento fuera del set canonico: ${[...new Set(badValues)].join(', ')}`)
    process.exit(1)
  }
  if (withElements.length < pals.length * 0.9) {
    console.warn('x cobertura de elementos por debajo del 90%: revisa si Palpedia cambio de estructura')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
