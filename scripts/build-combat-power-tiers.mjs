import { readFile, writeFile } from 'node:fs/promises'

const pals = JSON.parse(await readFile('src/data/pals.json', 'utf8'))

function slugify(name) {
  return name
    .toLocaleLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
const slugToId = new Map()
for (const p of pals) {
  const base = slugify(p.name)
  slugToId.set(p.variant ? `${base}-variant` : base, p.id)
}

// Fuente: https://palworld.gg/tier-list/combat -"Best Pals for Combat", el
// Pal's PROPIO poder de combate (stats + habilidades activas), no el buff
// que su Partner Skill le da al jugador (eso es Player DMG, otra categoria).
// Cubre practicamente todo el roster (298/299 -"Astralym" es un Pal nuevo
// que nuestra data v27 todavia no tiene, se omite en vez de inventar un
// tier). Curado 100%, sin respaldo calculado -mismo criterio que Best Base
// Pals: fuera de esta lista, un Pal simplemente no aparece.
const TIERS = {
  S: ['astralym', 'panthalus', 'frostallion-noct', 'frostallion', 'necromus', 'shaolong', 'bastigor', 'neptilius', 'paladius', 'jetragon', 'bellanoir', 'bellanoir-libero', 'hartalis', 'dandilord', 'shadowbeak'],
  A: ['eidrolon-ignis', 'orserk', 'aegidron', 'xenolord', 'blazamut-ryu', 'silvance', 'jormuntide-ignis', 'eidrolon', 'ophydia', 'moldron-cryst', 'xenogard', 'azurmane', 'anubis', 'moldron', 'astegon', 'lyleen-noct', 'relaxaurus-lux', 'lyleen', 'selyne', 'blazamut', 'knocklem-ignis', 'jormuntide', 'flaracle', 'relaxaurus', 'knocklem', 'solenne', 'silvegis', 'dualith-noct', 'whalaska-ignis', 'helzephyr-lux', 'gildane', 'ghangler-ignis', 'warsect-terra', 'gildra', 'celesdir-noct', 'reptyro-cryst', 'helzephyr', 'faleris-aqua', 'whalaska', 'dualith', 'renjishi', 'ghangler', 'sootseer', 'palumba', 'faleris'],
  B: ['reptyro', 'sekhmet', 'pierdon-cryst', 'celesdir', 'suzaku-aqua', 'warsect', 'menasting-terra', 'braloha', 'suzaku', 'grizzbolt', 'kitsun-noct', 'roujay', 'azurobe-cryst', 'tetroise-primo', 'pierdon', 'kitsun', 'icelyn', 'splatterina', 'fenglope-lux', 'majex', 'menasting', 'tetroise', 'elgrove', 'elgrove-cryst', 'ragnahawk', 'leafan', 'vanwyrm-cryst', 'felbat', 'starryon-primo', 'cryolinx-terra', 'dupin', 'demon-eye', 'vaelet', 'fenglope', 'xenovader', 'beakon-cryst', 'quivern-botan', 'polapup-terra', 'eye-of-cthulhu', 'beakon', 'blazehowl-noct', 'azurobe', 'tarantriss', 'frostplume', 'starryon', 'cryolinx', 'nyafia', 'polapup', 'broncherry-aqua', 'bushi-noct', 'vanwyrm', 'prixter-lux', 'verdash', 'quivern', 'lapure', 'petallia-ignis', 'omascul', 'nitemary-botan', 'bulldosu', 'blazehowl', 'penking-lux', 'bushi', 'mossanda-lux', 'nitemary', 'rainbow-slime', 'elizabee', 'wumpo-botan', 'prixter', 'mammorest', 'mammorest-cryst', 'broncherry', 'univolt-cryst', 'prunelia', 'katress-ignis', 'enchanted-sword'],
  C: ['sibelyx-primo', 'univolt', 'croajiro-noct', 'wixen-noct', 'petallia', 'dogen', 'wumpo', 'katress', 'sibelyx', 'incineram-noct', 'wixen', 'digtoise', 'loomen', 'foxcicle', 'mycora', 'penking', 'pyrin', 'pyrin-noct', 'gorirat-terra', 'lunaris', 'incineram', 'dinossom-lux', 'reindrix', 'robinquill', 'robinquill-terra', 'rayhound-cryst', 'kingpaca', 'kingpaca-cryst', 'turtacle-terra', 'gorirat', 'sweepa', 'surfent-terra', 'mossanda', 'arsox', 'nitewing', 'rayhound', 'dinossom', 'shroomer-noct', 'loupmoon-cryst', 'elphidran-aqua', 'solmora-lux', 'tombat', 'croajiro', 'maraith', 'loupmoon', 'elphidran', 'shroomer', 'smokie-cryst', 'solmora', 'skutlass-ignis', 'dazemu', 'dumud-gild', 'carnibora', 'smokie', 'beegarde', 'surfent', 'lullu', 'grintale', 'skutlass', 'tropicaw', 'gobfin', 'gobfin-ignis', 'cawgnito', 'wispaw', 'yakumo', 'chillet-ignis', 'venusa', 'caprity-noct', 'eikthyrdeer', 'eikthyrdeer-terra', 'illuminant-bat', 'direhowl', 'finsider-ignis', 'turtacle', 'dumud', 'chillet', 'melpaca', 'caprity', 'finsider', 'dynamoff', 'jelliette', 'needoll-noct', 'lovander', 'bristla', 'munchill', 'hoodle', 'bakemi', 'wistella', 'snugloo', 'illuminant-slime'],
  D: ['jellroy', 'nox', 'gloopie-primo', 'needoll', 'celaray-lux', 'hangyu-cryst', 'cinnamoth', 'gloopie', 'herbil', 'puffolt', 'dazzi-noct', 'valentail', 'red-slime', 'kikit', 'woolipop-terra', 'galeclaw', 'jolthog-cryst', 'tanzee-ignis', 'lapiron', 'slowatt', 'celaray', 'pupperai', 'pengullet-lux', 'dazzi', 'woolipop', 'purple-slime', 'cave-bat', 'foxparks-cryst', 'mimog', 'jolthog', 'pengullet', 'rooby', 'hoocrates', 'tanzee', 'rushoar', 'hangyu', 'blue-slime', 'fuack-ignis', 'lifmunk', 'cremis', 'leezpunk', 'leezpunk-ignis', 'foxparks', 'snock-lux', 'green-slime', 'lamball', 'cattiva', 'vixy', 'gumoss', 'depresso', 'kelpsea', 'kelpsea-ignis', 'snock', 'ribbuny-botan', 'daedream', 'sparkit', 'tocotoco', 'souffline', 'flambelle', 'fuack', 'ribbuny', 'flopie', 'clovee', 'muffly', 'fuddler', 'mau-cryst', 'amione', 'mozzarina', 'teafant', 'mau', 'killamari-primo', 'killamari', 'chikipi', 'swee'],
}
const TIER_NUMBER = { S: 5, A: 4, B: 3, C: 2, D: 1 }

const out = {}
let missing = 0
for (const [label, slugs] of Object.entries(TIERS)) {
  for (const slug of slugs) {
    const pid = slugToId.get(slug) ?? slugToId.get(`${slug}-variant`)
    if (!pid) { console.log('SIN MATCH (omitido)', label, slug); missing++; continue }
    out[pid] = TIER_NUMBER[label]
  }
}
console.log('total curado', Object.keys(out).length, '| sin match', missing)
await writeFile('src/data/combat-power-tiers.json', JSON.stringify(out, null, 2) + '\n')
