import { describe, expect, it } from 'vitest'
import { localeFromPath, localizedPath, stripLocalePrefix } from '../seo'

describe('localized SEO paths', () => {
  it('maps Spanish pages to a stable /es URL', () => {
    expect(localizedPath('/', 'es')).toBe('/es')
    expect(localizedPath('/pals/anubis', 'es')).toBe('/es/pals/anubis')
    expect(localizedPath('/es/tiers', 'es')).toBe('/es/tiers')
  })

  it('keeps English as the x-default root URL', () => {
    expect(localizedPath('/es/pals/anubis', 'en')).toBe('/pals/anubis')
    expect(stripLocalePrefix('/es')).toBe('/')
    expect(stripLocalePrefix('/es/planner')).toBe('/planner')
  })

  it('detects only the explicit Spanish URL prefix', () => {
    expect(localeFromPath('/es/pals/anubis')).toBe('es')
    expect(localeFromPath('/planner')).toBeNull()
  })
})
