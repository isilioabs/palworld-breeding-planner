import { describe, expect, it } from 'vitest'
import { detectBrowserLang } from '../lang'

describe('detectBrowserLang', () => {
  it('uses Spanish for Spanish-language browser preferences', () => {
    expect(detectBrowserLang(['es-MX', 'en-US'])).toBe('es')
    expect(detectBrowserLang(['es-419'])).toBe('es')
  })

  it('uses Spanish for a Spanish-speaking country even with a non-Spanish locale', () => {
    expect(detectBrowserLang(['en-ES'])).toBe('es')
  })

  it('uses English for all other browser regions and for unavailable browser data', () => {
    expect(detectBrowserLang(['en-US', 'es-ES'])).toBe('en')
    expect(detectBrowserLang(['pt-BR'])).toBe('en')
    expect(detectBrowserLang([])).toBe('en')
  })
})
