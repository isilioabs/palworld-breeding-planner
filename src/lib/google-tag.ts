import type { ProductEvent } from './analytics'

export type TrackingConsent = 'unknown' | 'granted' | 'denied'

const CONSENT_KEY = 'palaxis:tracking-consent'
const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim()
const GOOGLE_ADS_ID = import.meta.env.VITE_GOOGLE_ADS_ID?.trim()
const destinations = [...new Set([GA_MEASUREMENT_ID, GOOGLE_ADS_ID].filter(Boolean))] as string[]

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

let consent: TrackingConsent = readConsent()
let tagReady = false
const listeners = new Set<() => void>()

function readConsent(): TrackingConsent {
  try {
    const value = localStorage.getItem(CONSENT_KEY)
    return value === 'granted' || value === 'denied' ? value : 'unknown'
  } catch {
    return 'unknown'
  }
}

export function isGoogleTrackingConfigured(): boolean {
  return destinations.length > 0
}

export function getTrackingConsent(): TrackingConsent {
  return consent
}

export function subscribeTrackingConsent(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function gtag(...args: unknown[]) {
  window.dataLayer ??= []
  window.dataLayer.push(args)
  window.gtag ??= (...queued: unknown[]) => window.dataLayer?.push(queued)
  window.gtag(...args)
}

/** Carga una sola etiqueta Google y añade GA4/Ads como destinos. */
export function initializeGoogleTracking(): void {
  if (typeof window === 'undefined' || consent !== 'granted' || tagReady || destinations.length === 0) return

  tagReady = true
  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
  })
  gtag('consent', 'update', {
    ad_storage: 'granted',
    ad_user_data: 'granted',
    ad_personalization: 'granted',
    analytics_storage: 'granted',
  })
  gtag('js', new Date())
  destinations.forEach((destination) => gtag('config', destination))

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(destinations[0])}`
  document.head.append(script)
}

export function setTrackingConsent(next: Exclude<TrackingConsent, 'unknown'>): void {
  consent = next
  try {
    localStorage.setItem(CONSENT_KEY, next)
  } catch {
    // La decisión sigue vigente durante esta sesión si localStorage falla.
  }

  if (next === 'granted') {
    initializeGoogleTracking()
    window.gtag?.('consent', 'update', {
      ad_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'granted',
      analytics_storage: 'granted',
    })
  }
  if (next === 'denied' && typeof window !== 'undefined' && window.gtag) {
    window.gtag('consent', 'update', {
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'denied',
    })
  }
  listeners.forEach((listener) => listener())
}

export function trackGoogleEvent(event: ProductEvent, props: Record<string, string | number | boolean>): void {
  if (consent !== 'granted') return
  initializeGoogleTracking()
  window.gtag?.('event', event, props)
}
