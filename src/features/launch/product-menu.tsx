import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Bug, History, Lightbulb, MessageCircle, Send, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useT } from '@/i18n/language-store'

const REPOSITORY_URL = 'https://github.com/isilioabs/palworld-breeding-planner'

export function ProductMenu() {
  const t = useT()
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [changelogOpen, setChangelogOpen] = useState(false)
  return (
    <div className="product-menu">
      <Button variant="ghost" size="icon-sm" aria-label={t('productMenu.feedback')} onClick={() => setFeedbackOpen(true)}><MessageCircle className="size-4" aria-hidden="true" /></Button>
      <Button variant="ghost" size="icon-sm" aria-label={t('productMenu.changelog')} onClick={() => setChangelogOpen(true)}><History className="size-4" aria-hidden="true" /></Button>

      <Dialog.Root open={feedbackOpen} onOpenChange={setFeedbackOpen}>
        <Dialog.Portal><Dialog.Overlay className="product-dialog__overlay" /><Dialog.Content className="product-dialog" aria-describedby="feedback-description">
          <Dialog.Close asChild><button className="product-dialog__close" aria-label={t('productMenu.close')}><X aria-hidden="true" /></button></Dialog.Close>
          <span className="product-dialog__icon"><MessageCircle aria-hidden="true" /></span>
          <Dialog.Title>{t('productMenu.feedbackTitle')}</Dialog.Title><Dialog.Description id="feedback-description">{t('productMenu.feedbackDescription')}</Dialog.Description>
          <div className="product-dialog__options">
            <a href={`${REPOSITORY_URL}/issues/new?title=${encodeURIComponent('[Bug] ')}`} target="_blank" rel="noreferrer"><Bug aria-hidden="true" /><span><strong>{t('productMenu.bug')}</strong><small>{t('productMenu.bugDescription')}</small></span><Send aria-hidden="true" /></a>
            <a href={`${REPOSITORY_URL}/issues/new?title=${encodeURIComponent('[Idea] ')}`} target="_blank" rel="noreferrer"><Lightbulb aria-hidden="true" /><span><strong>{t('productMenu.idea')}</strong><small>{t('productMenu.ideaDescription')}</small></span><Send aria-hidden="true" /></a>
          </div>
          <p className="product-dialog__note">{t('productMenu.feedbackNote')}</p>
        </Dialog.Content></Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={changelogOpen} onOpenChange={setChangelogOpen}>
        <Dialog.Portal><Dialog.Overlay className="product-dialog__overlay" /><Dialog.Content className="product-dialog product-dialog--changes" aria-describedby="changelog-description">
          <Dialog.Close asChild><button className="product-dialog__close" aria-label={t('productMenu.close')}><X aria-hidden="true" /></button></Dialog.Close>
          <span className="product-dialog__icon"><History aria-hidden="true" /></span>
          <Dialog.Title>{t('productMenu.changelogTitle')}</Dialog.Title><Dialog.Description id="changelog-description">{t('productMenu.changelogDescription')}</Dialog.Description>
          <ol className="product-dialog__changes">
            {[t('productMenu.changeOne'), t('productMenu.changeTwo'), t('productMenu.changeThree'), t('productMenu.changeFour')].map((change) => <li key={change}>{change}</li>)}
          </ol>
        </Dialog.Content></Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
