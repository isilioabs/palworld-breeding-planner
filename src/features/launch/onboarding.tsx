import * as Dialog from '@radix-ui/react-dialog'
import { Boxes, Check, Network, Sparkles, Target, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useT } from '@/i18n/language-store'

export function Onboarding({ open, onStart }: { open: boolean; onStart: () => void }) {
  const t = useT()
  const steps = [
    [Target, t('onboarding.stepOne')],
    [Sparkles, t('onboarding.stepTwo')],
    [Boxes, t('onboarding.stepThree')],
    [Network, t('onboarding.stepFour')],
  ] as const
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onStart()}>
      <Dialog.Portal>
        <Dialog.Overlay className="onboarding__overlay" />
        <Dialog.Content className="onboarding" aria-describedby="onboarding-description">
          <button type="button" className="onboarding__skip" onClick={onStart} aria-label={t('onboarding.skip')}><X aria-hidden="true" /></button>
          <span className="onboarding__icon"><Sparkles aria-hidden="true" /></span>
          <Dialog.Title>{t('onboarding.title')}</Dialog.Title>
          <Dialog.Description id="onboarding-description">{t('onboarding.description')}</Dialog.Description>
          <ol>
            {steps.map(([Icon, text], index) => <li key={text}><b>{index + 1}</b><Icon aria-hidden="true" /><span>{text}</span><Check aria-hidden="true" /></li>)}
          </ol>
          <Button size="lg" className="w-full" onClick={onStart}>{t('onboarding.start')}</Button>
          <p className="onboarding__note">{t('onboarding.note')}</p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
