import { readFile, writeFile } from 'node:fs/promises'

const pals = JSON.parse(await readFile('src/data/pals.json', 'utf8'))
const stats = JSON.parse(await readFile('src/data/pal-stats.json', 'utf8'))
const palByName = new Map(pals.map((p) => [p.name, p]))

// S curado a mano: primero por el usuario (mejores picks reales por tipo de
// trabajo, no solo el numero crudo de WorkSuitability -misma logica que
// Player DMG: el numero solo no capta cosas como velocidad de movimiento o
// facilidad de condensar), despues sumado con el S-tier de
// op.gg/palworld/tiers?tab=workers (mismo criterio -union, nunca resta: si
// op.gg y el usuario difieren en un Pal, el original se queda igual, solo se
// agregan los picks nuevos que op.gg confirma como S). Ejemplo citado por el
// usuario: Jellroy/Jelliette en Watering, WorkSuitability=2 nada mas, pero
// su pasiva de velocidad los hace top real subiendolos con libros.
// A/B/C/D se quedan con el bucketing existente por WorkSuitability crudo.
const S_TIER = {
  Kindling: ['Jormuntide Ignis', 'Renjishi', 'Katress Ignis'],
  Watering: ['Jormuntide', 'Suzaku Aqua', 'Shaolong', 'Neptilius', 'Jellroy', 'Jelliette'],
  Planting: ['Ophydia', 'Dandilord', 'Shroomer Noct', 'Prunelia', 'Lullu', 'Lyleen', 'Braloha'],
  GenerateElectricity: ['Orserk', 'Solmora Lux', 'Dynamoff'],
  Handiwork: ['Solenne', 'Sekhmet', 'Anubis'],
  Gathering: ['Starryon Primo', 'Hartalis', 'Frostallion Noct', 'Jetragon', 'Shroomer Noct', 'Prunelia', 'Lullu', 'Lyleen', 'Braloha'],
  Lumbering: ['Celesdir', 'Celesdir Noct', 'Silvegis', 'Shroomer Noct'],
  Mining: ['Blazamut', 'Blazamut Ryu', 'Astegon', 'Aegidron', 'Anubis'],
  MedicineProduction: ['Silvance', 'Mycora', 'Bellanoir Libero', 'Lyleen Noct'],
  Cooling: ['Bastigor', 'Frostallion', 'Smokie Cryst'],
  Transporting: ['Eye of Cthulhu', 'Mimog', 'Eidrolon', 'Faleris Aqua', 'Faleris', 'Roujay', 'Eidrolon Ignis', 'Anubis'],
  Farming: ['Dumud Gild', 'Sibelyx Primo', 'Beegarde', 'Foxcicle', 'Sibelyx', 'Shroomer', 'Woolipop', 'Woolipop Terra'],
}

const out = {}
for (const [workType, names] of Object.entries(S_TIER)) {
  const ids = []
  for (const name of names) {
    const pal = palByName.get(name)
    if (!pal) { console.log('MISSING', workType, name); continue }
    const value = stats[pal.id]?.workSuitability?.[workType]
    ids.push(pal.id)
    console.log(workType, name, 'WorkSuitability=', value ?? 'none')
  }
  out[workType] = ids
}

await writeFile('src/data/work-tier-s.json', JSON.stringify(out, null, 2) + '\n')
console.log('done')
