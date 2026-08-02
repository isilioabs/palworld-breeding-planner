#!/usr/bin/env node
/**
 * Sustituye los retratos de PalCalc (100x100, en public/pals/) por los
 * oficiales del juego (128x128), extraidos directamente de
 * Pal/Content/Pal/Texture/PalIcon/Normal/ con FModel.
 *
 * A diferencia de fetch-icons.mjs, esta fuente NO es una URL: es una carpeta
 * local que solo existe tras una extraccion manual con FModel, asi que el
 * origen se pasa como argumento en vez de estar hardcodeado.
 *
 *   node scripts/import-pal-portraits.mjs "<ruta a .../PalIcon/Normal>"
 *
 * Los nombres de archivo en esa carpeta siguen el patron
 * T_<InternalName>_icon_normal.png (con los eventos especiales tipo
 * Yakushima en su propio subdirectorio), y <InternalName> es exactamente el
 * `id` que ya usa toda la app.
 */
import { copyFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT = path.join(ROOT, 'public', 'pals')

const sourceDir = process.argv[2]
if (!sourceDir) {
  console.error('Uso: node scripts/import-pal-portraits.mjs "<ruta a .../PalIcon/Normal>"')
  process.exit(1)
}

const filenameFor = (id) => `T_${id}_icon_normal.png`

async function main() {
  const pals = JSON.parse(await readFile(path.join(ROOT, 'src/data/pals.json'), 'utf8'))
  await mkdir(OUT, { recursive: true })

  const topLevel = await readdir(sourceDir)
  const subdirs = []
  for (const entry of topLevel) {
    const full = path.join(sourceDir, entry)
    if (!entry.endsWith('.png')) subdirs.push(full)
  }
  // Mapa nombre de fichero -> ruta completa, buscando primero en la raiz y
  // luego en cualquier subcarpeta (eventos especiales como Yakushima).
  const available = new Map()
  for (const f of topLevel) if (f.endsWith('.png')) available.set(f, path.join(sourceDir, f))
  for (const dir of subdirs) {
    for (const f of await readdir(dir).catch(() => [])) {
      if (f.endsWith('.png')) available.set(f, path.join(dir, f))
    }
  }

  const missing = []
  let copied = 0
  for (const pal of pals) {
    const fname = filenameFor(pal.id)
    const src = available.get(fname)
    if (!src) {
      missing.push(`${pal.id} (${pal.name})`)
      continue
    }
    await copyFile(src, path.join(OUT, `${pal.id}.png`))
    copied++
  }

  console.log(`> ${copied}/${pals.length} retratos copiados a public/pals/ (128x128, fuente: extraccion FModel)`)
  if (missing.length) {
    console.log(`  sin retrato oficial (se queda sin icono, respaldo al monograma): ${missing.join(', ')}`)
  }

  // Igual que al final de fetch-icons.mjs: la UI necesita saber que iconos existen.
  const files = new Set(await readdir(OUT))
  const withIcon = pals.filter((p) => files.has(`${p.id}.png`)).map((p) => p.id)
  await writeFile(path.join(ROOT, 'src/data/icons.json'), JSON.stringify(withIcon) + '\n', 'utf8')
  console.log(`> src/data/icons.json actualizado: ${withIcon.length} entradas`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
