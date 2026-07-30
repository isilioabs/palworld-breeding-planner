import { describe, expect, it } from 'vitest'
import { loadDatabase } from '../../database'
import { createResolver } from '../resolver'

const db = loadDatabase()
const resolver = createResolver(db.pals, db.breeding)

describe('resolucion de crias', () => {
  it('cubre todos los Pals de la base de datos', () => {
    expect(resolver.size).toBe(db.pals.length)
    expect(db.pals.length).toBe(db.mechanics.counts.pals)
  })

  it('aplica combinaciones unicas conocidas', () => {
    // Surfent Terra, Frostallion Noct y Lyleen Noct: casos clasicos del juego.
    expect(resolver.childId('LazyCatfish', 'Serpent')).toBe('Serpent_Ground')
    expect(resolver.childId('IceHorse', 'HadesBird')).toBe('IceHorse_Dark')
    expect(resolver.childId('LilyQueen', 'DarkScorpion')).toBe('LilyQueen_Dark')
    // Los legendarios solo se crian consigo mismos.
    expect(resolver.childId('JetDragon', 'JetDragon')).toBe('JetDragon')
  })

  it('un Pal cruzado consigo mismo se reproduce a si mismo', () => {
    for (const id of ['SheepBall', 'ChickenPal', 'PinkCat', 'Boar', 'Anubis']) {
      expect(resolver.childId(id, id)).toBe(id)
    }
  })

  it('es simetrico', () => {
    const sample = db.pals.filter((_, i) => i % 17 === 0)
    for (const a of sample) {
      for (const b of sample) {
        expect(resolver.childId(a.id, b.id)).toBe(resolver.childId(b.id, a.id))
      }
    }
  })

  it('la tabla rank->hijo cubre todos los objetivos alcanzables', () => {
    let missing = 0
    for (const a of db.pals) {
      for (const b of db.pals) {
        const target = Math.floor((a.power + b.power + 1) / 2)
        if (db.breeding.rankToChild[String(target)] === undefined) missing++
      }
    }
    expect(missing).toBe(0)
  })

  it('las parejas con sexo obligatorio no dan resultado generico', () => {
    expect(resolver.childId('CatMage', 'FoxMage')).toBeNull()
    const options = resolver.genderOptions(resolver.indexOf('CatMage'), resolver.indexOf('FoxMage'))
    expect(options.map((o) => db.pals[o.childIndex].id).sort()).toEqual(['CatMage_Fire', 'FoxMage_Dark'])
  })

  it('la busqueda inversa es coherente con la directa', () => {
    for (const target of ['Anubis', 'SheepBall', 'Serpent_Ground']) {
      const pairs = resolver.parentsOf(target)
      expect(pairs.length).toBeGreaterThan(0)
      for (const [a, b] of pairs) {
        const generic = resolver.childId(a, b)
        if (generic !== null) {
          expect(generic).toBe(target)
        } else {
          const options = resolver.genderOptions(resolver.indexOf(a), resolver.indexOf(b))
          expect(options.some((o) => db.pals[o.childIndex].id === target)).toBe(true)
        }
      }
    }
  })
})
