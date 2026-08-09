import { readFile, writeFile } from 'node:fs/promises'

const pals = JSON.parse(await readFile('src/data/pals.json', 'utf8'))
const palByName = new Map(pals.map((p) => [p.name, p]))

// Fuente: https://game8.co/games/Palworld/archives/440432 ("Best Base Pals
// Tier List"), scrapeado a mano via Browser MCP (tablas SS/S/A/B, filas de
// NPCs/vendors descartadas -esta app no modela NPCs). SS/S/A/B tal cual
// publica game8; sin C/D -el sitio no rankea mas alla de B, y no hay una
// metrica propia con la que completar el resto del roster (a diferencia de
// Player DMG/Work, donde el ATK/WorkSuitability crudo sirve de respaldo).
const TIERS = {
  SS: ['Anubis','Sekhmet','Knocklem','Knocklem Ignis','Eidrolon','Solenne','Renjishi','Orserk','Faleris Aqua','Bastigor','Shaolong','Dandilord'],
  S: ['Eye of Cthulhu','Rayhound','Menasting Terra','Jormuntide','Jormuntide Ignis','Suzaku Aqua','Starryon Primo','Cryolinx Terra','Wumpo','Blazamut','Blazamut Ryu','Dualith','Dualith Noct','Mimog','Whalaska Ignis','Splatterina','Celesdir','Celesdir Noct','Astegon','Silvegis','Eidrolon Ignis','Dynamoff','Flaracle','Ophydia','Dupin','Venusa','Wistella','Aegidron','Lyleen','Lyleen Noct','Faleris','Selyne','Silvance','Bellanoir Libero','Hartalis','Paladius','Necromus','Frostallion','Frostallion Noct','Neptilius','Jetragon'],
  A: ['Lamball','Cremis','Flambelle','Mau Cryst','Woolipop Terra','Kelpsea','Jelliette','Cawgnito','Surfent','Bushi Noct','Petallia','Beakon','Mossanda Lux','Dumud','Majex','Shroomer','Suzaku','Lullu','Cryolinx','Carnibora','Solmora Lux','Mycora','Panthalus'],
  B: ['Kingpaca Cryst','Elphidran Aqua','Wixen Noct','Fenglope Lux','Pyrin','Ghangler','Chillet Ignis','Digtoise','Kitsun Noct','Warsect','Gildra','Pierdon Cryst','Nyafia','Nitemary','Dogen','Snock','Solmora'],
}
const TIER_NUMBER = { SS: 4, S: 3, A: 2, B: 1 }

const out = {}
for (const [label, names] of Object.entries(TIERS)) {
  for (const name of names) {
    const pal = palByName.get(name)
    if (!pal) { console.log('MISSING', label, name); continue }
    out[pal.id] = TIER_NUMBER[label]
  }
}
console.log('SS', TIERS.SS.length, 'S', TIERS.S.length, 'A', TIERS.A.length, 'B', TIERS.B.length, 'total', Object.keys(out).length)
await writeFile('src/data/base-pal-tiers.json', JSON.stringify(out, null, 2) + '\n')
