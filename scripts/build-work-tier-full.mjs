import { readFile, writeFile } from 'node:fs/promises'

const pals = JSON.parse(await readFile('src/data/pals.json', 'utf8'))
const palByName = new Map(pals.map((p) => [p.name, p]))

// Farming y Generating Electricity: a diferencia de los otros 10 trabajos,
// aca el bucketing por WorkSuitability crudo (src/domain/tier-list.ts,
// bucketWorkValue) deja Tier A vacio o casi vacio -el umbral minimo (>=3)
// excluye directamente a la mayoria de los mejores picks reales de estos dos
// trabajos, cuyo WorkSuitability crudo es bajo (1-2) en casi todo el roster.
// Por eso, solo para estos dos, se cura A-D completo (no solo S) desde
// op.gg/palworld/tiers?tab=workers, en vez de intentar forzar el mismo
// umbral generico que si funciona para el resto.
const FULL_TIERS = {
  GenerateElectricity: {
    5: ['Solmora Lux', 'Orserk', 'Dynamoff'],
    4: ['Grizzbolt', 'Azurmane', 'Fenglope Lux', 'Puffolt'],
    3: ['Helzephyr Lux', 'Beakon', 'Mossanda Lux', 'Snock', 'Snock Lux', 'Rayhound', 'Relaxaurus Lux'],
    2: ['Dazzi', 'Slowatt', 'Univolt', 'Prixter Lux', 'Penking Lux', 'Dinossom Lux'],
    1: ['Pengullet Lux', 'Jolthog', 'Celaray Lux', 'Dazzi Noct', 'Sparkit'],
  },
  Farming: {
    5: ['Dumud Gild', 'Sibelyx Primo', 'Beegarde', 'Foxcicle', 'Sibelyx', 'Shroomer', 'Woolipop', 'Woolipop Terra'],
    4: ['Cremis', 'Melpaca', 'Mozzarina', 'Surfent', 'Sootseer', 'Caprity Noct', 'Lamball', 'Chikipi', 'Depresso', 'Flambelle', 'Rooby', 'Mau Cryst', 'Sparkit', 'Kelpsea', 'Kelpsea Ignis', 'Cawgnito', 'Dumud'],
    3: ['Caprity', 'Mau', 'Vaelet', 'Vixy'],
    2: [],
    1: [],
  },
}

const out = {}
for (const [workType, tiers] of Object.entries(FULL_TIERS)) {
  const entry = {}
  for (const [tierNumber, names] of Object.entries(tiers)) {
    for (const name of names) {
      const pal = palByName.get(name)
      if (!pal) { console.log('MISSING', workType, name); continue }
      entry[pal.id] = Number(tierNumber)
    }
  }
  out[workType] = entry
  console.log(workType, 'total', Object.keys(entry).length)
}

await writeFile('src/data/work-tier-full.json', JSON.stringify(out, null, 2) + '\n')
console.log('done')
