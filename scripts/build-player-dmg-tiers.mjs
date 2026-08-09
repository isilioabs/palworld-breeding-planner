import { readFile, writeFile } from 'node:fs/promises'

const pals = JSON.parse(await readFile('src/data/pals.json', 'utf8'))
const stats = JSON.parse(await readFile('src/data/pal-stats.json', 'utf8'))
const palByName = new Map(pals.map((p) => [p.name, p]))

const NAME_FIXES = { Orsek: 'Orserk', Bunshi: 'Bushi' }

const S = ['Vanwyrm','Vanwyrm Cryst','Azurobe','Felbat','Pyrin','Frostallion Noct','Frostallion','Solmora Lux','Solenne','Finsider Ignis','Bellanoir Libero','Orsek','Moldron','Moldron Cryst','Chillet','Cryolinx Terra','Knocklem','Knocklem Ignis','Lovander']
const A = ['Needoll','Aegidron','Maraith','Eidrolon Ignis','Gildane','Blazamut Ryu','Univolt','Loomen','Herbil','Gildra','Bellanoir','Bakemi','Neptilius','Tropicaw','Turtacle Terra','Jormuntide Ignis','Xenogard']
const B = ['Necromus','Shaolong','Pengullet Lux','Dupin','Menasting','Menasting Terra','Wixen','Eidrolon','Croajiro Noct','Blazamut','Silvance','Gobfin','Gobfin Ignis','Silvegis']
const C = ['Anubis','Shadowbeak','Xenolord','Dandilord','Teafant','Whalaska Ignis','Jetragon','Hartalis','Lyleen Noct','Lyleen','Leafan','Bunshi','Prixter','Lapure','Bastigor','Jormuntide','Celesdir Noct']

const tiers = {}
function assign(list, tierNumber, label) {
  for (const rawName of list) {
    const name = NAME_FIXES[rawName] ?? rawName
    const pal = palByName.get(name)
    if (!pal) { console.log('MISSING', label, rawName); continue }
    tiers[pal.id] = tierNumber
  }
}
assign(S, 6, 'S')
assign(A, 5, 'A')
assign(B, 4, 'B')
assign(C, 3, 'C')

// Roster elegible = mismo criterio que ya usaba el bucketing por ATK: >=100
// en Melee o Shot Attack. Los Pals ya asignados arriba se saltan; el resto
// se reparte D/E por ATK descendente (criterio a falta de un juicio manual
// del usuario para esos, igual que el resto de la app usa ATK crudo como
// respaldo cuando no hay una señal mejor).
const remaining = []
for (const p of pals) {
  if (tiers[p.id] !== undefined) continue
  const st = stats[p.id]
  if (!st) continue
  const atk = Math.max(st.meleeAttack ?? 0, st.shotAttack ?? 0)
  if (atk < 100) continue
  remaining.push({ id: p.id, name: p.name, atk })
}
remaining.sort((a, b) => b.atk - a.atk)
const half = Math.ceil(remaining.length / 2)
remaining.forEach((entry, i) => {
  tiers[entry.id] = i < half ? 2 : 1 // D=2, E=1
})

console.log('S', S.length, 'A', A.length, 'B', B.length, 'C', C.length, 'D+E', remaining.length, '(D', half, 'E', remaining.length - half, ')')
console.log('total', Object.keys(tiers).length)

await writeFile('src/data/player-dmg-tiers.json', JSON.stringify(tiers, null, 2) + '\n')
