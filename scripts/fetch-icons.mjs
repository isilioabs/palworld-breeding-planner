#!/usr/bin/env node
/**
 * Descarga los iconos de los Pals a public/pals/<id>.png.
 *
 * Se guardan en local a proposito: la app tiene que seguir funcionando sin
 * conexion. Los ficheros del repositorio de origen estan nombrados por el
 * nombre visible en ingles ("Azurobe Cryst.png"), asi que aqui se renombran al
 * id interno para que el lookup en la UI sea directo.
 *
 *   npm run data:icons          descarga los que falten
 *   npm run data:icons -- --force   vuelve a descargar todos
 *
 * Los sprites son propiedad de Pocketpair, Inc.
 */
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT = path.join(ROOT, 'public', 'pals')
const BASE = 'https://raw.githubusercontent.com/tylercamp/palcalc/main/PalCalc.UI/Resources/Pals'

const force = process.argv.includes('--force')
const CONCURRENCY = 8

async function main() {
  const pals = JSON.parse(await readFile(path.join(ROOT, 'src/data/pals.json'), 'utf8'))
  await mkdir(OUT, { recursive: true })

  const existing = new Set(await readdir(OUT).catch(() => []))
  const pending = pals.filter((p) => force || !existing.has(`${p.id}.png`))

  console.log(`> ${pals.length} Pals, ${pending.length} iconos por descargar`)
  if (pending.length === 0) {
    console.log('> Nada que hacer')
    return
  }

  let done = 0
  const failed = []

  const worker = async (queue) => {
    for (const pal of queue) {
      const url = `${BASE}/${encodeURIComponent(pal.name)}.png`
      try {
        const res = await fetch(url)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        await writeFile(path.join(OUT, `${pal.id}.png`), Buffer.from(await res.arrayBuffer()))
      } catch (error) {
        failed.push(`${pal.name} (${pal.id}): ${error.message}`)
      }
      done++
      if (done % 25 === 0 || done === pending.length) {
        process.stdout.write(`\r  ${done}/${pending.length}`)
      }
    }
  }

  const slices = Array.from({ length: CONCURRENCY }, (_, i) =>
    pending.filter((_, index) => index % CONCURRENCY === i),
  )
  await Promise.all(slices.map(worker))
  console.log()

  if (failed.length) {
    console.error(`x ${failed.length} fallos:`)
    console.error(failed.slice(0, 20).join('\n'))
    process.exitCode = 1
  } else {
    console.log('> Todos los iconos descargados en public/pals/')
  }

  // La UI necesita saber que iconos existen para no pedir 404s.
  const files = new Set(await readdir(OUT))
  const withIcon = pals.filter((p) => files.has(`${p.id}.png`)).map((p) => p.id)
  await writeFile(
    path.join(ROOT, 'src/data/icons.json'),
    JSON.stringify(withIcon) + '\n',
    'utf8',
  )
  console.log(`> src/data/icons.json  ${withIcon.length} entradas`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
