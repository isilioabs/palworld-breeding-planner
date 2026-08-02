#!/usr/bin/env node
/**
 * Descarga los iconos oficiales de elemento y aptitud de trabajo que usa la
 * carta de Pal, a public/elements/<Elemento>.png y public/work/<Tipo>.png.
 *
 * Misma fuente que los retratos (ver fetch-icons.mjs): PalCalc.UI/Resources.
 * A diferencia de los retratos, los de trabajo NO estan en un subdirectorio.
 *
 *   npm run data:card-assets
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const BASE = 'https://raw.githubusercontent.com/tylercamp/palcalc/main/PalCalc.UI/Resources'

const ELEMENTS = ['Dark', 'Dragon', 'Earth', 'Electricity', 'Fire', 'Ice', 'Leaf', 'Normal', 'Water']
const WORK = [
  'Cooling',
  'ElectricityGeneration',
  'Farming',
  'Gathering',
  'Handiwork',
  'Kindling',
  'Lumbering',
  'MedicineProduction',
  'Mining',
  'Planting',
  'Transporting',
  'Watering',
]

async function fetchAll(names, urlFor, outDir) {
  await mkdir(outDir, { recursive: true })
  const failed = []
  for (const name of names) {
    const url = urlFor(name)
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await writeFile(path.join(outDir, `${name}.png`), Buffer.from(await res.arrayBuffer()))
    } catch (error) {
      failed.push(`${name}: ${error.message}`)
    }
  }
  return failed
}

async function main() {
  console.log('> Descargando iconos de elemento...')
  const elFailed = await fetchAll(ELEMENTS, (n) => `${BASE}/Elements/${n}.png`, path.join(ROOT, 'public', 'elements'))
  console.log(`  ${ELEMENTS.length - elFailed.length}/${ELEMENTS.length} ok`)

  console.log('> Descargando iconos de trabajo...')
  const workFailed = await fetchAll(WORK, (n) => `${BASE}/${n}.png`, path.join(ROOT, 'public', 'work'))
  console.log(`  ${WORK.length - workFailed.length}/${WORK.length} ok`)

  const failed = [...elFailed, ...workFailed]
  if (failed.length) {
    console.error('x Fallos:\n' + failed.join('\n'))
    process.exitCode = 1
  } else {
    console.log('> Listo')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
