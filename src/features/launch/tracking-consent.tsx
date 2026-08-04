import { useEffect, useState, useSyncExternalStore } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { BarChart3, ShieldCheck, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  getTrackingConsent,
  initializeGoogleTracking,
  isGoogleTrackingConfigured,
  setTrackingConsent,
  subscribeTrackingConsent,
} from '@/lib/google-tag'
import { useT } from '@/i18n/language-store'

function useTrackingConsent() {
  return useSyncExternalStore(subscribeTrackingConsent, getTrackingConsent, getTrackingConsent)
}

export function TrackingConsent() {
  const t = useT()
  const consent = useTrackingConsent()
  const [preferencesOpen, setPreferencesOpen] = useState(false)
  const configured = isGoogleTrackingConfigured()

  useEffect(() => {
    if (consent === 'granted') initializeGoogleTracking()
  }, [consent])

  if (!configured) return null

  const choose = (next: 'granted' | 'denied') => {
    setTrackingConsent(next)
    setPreferencesOpen(false)
  }

  return (
    <>
      {consent === 'unknown' && (
        <aside className="tracking-consent" aria-labelledby="tracking-consent-title" aria-live="polite">
          <span className="tracking-consent__icon"><ShieldCheck aria-hidden="true" /></span>
          <div>
            <h2 id="tracking-consent-title">{t('tracking.title')}</h2>
            <p>{t('tracking.description')}</p>
          </div>
          <div className="tracking-consent__actions">
            <Button size="sm" variant="outline" onClick={() => choose('denied')}>{t('tracking.reject')}</Button>
            <Button size="sm" onClick={() => choose('granted')}>{t('tracking.accept')}</Button>
          </div>
        </aside>
      )}

      {consent !== 'unknown' && (
        <button type="button" className="tracking-preferences" onClick={() => setPreferencesOpen(true)} aria-label={t('tracking.openPreferences')}>
          <BarChart3 aria-hidden="true" />
        </button>
      )}

      <Dialog.Root open={preferencesOpen} onOpenChange={setPreferencesOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="product-dialog__overlay" />
          <Dialog.Content className="product-dialog tracking-dialog" aria-describedby="tracking-dialog-description">
            <Dialog.Close asChild><button className="product-dialog__close" aria-label={t('tracking.close')}><X aria-hidden="true" /></button></Dialog.Close>
            <span className="product-dialog__icon"><ShieldCheck aria-hidden="true" /></span>
            <Dialog.Title>{t('tracking.preferencesTitle')}</Dialog.Title>
            <Dialog.Description id="tracking-dialog-description">{t('tracking.preferencesDescription')}</Dialog.Description>
            <div className="tracking-dialog__status"><span>{t('tracking.status')}</span><strong>{t(consent === 'granted' ? 'tracking.statusEnabled' : 'tracking.statusDisabled')}</strong></div>
            <div className="tracking-dialog__actions">
              <Button variant="outline" onClick={() => choose('denied')}>{t('tracking.reject')}</Button>
              <Button onClick={() => choose('granted')}>{t('tracking.accept')}</Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}
