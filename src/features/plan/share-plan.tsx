import { useState } from 'react'
import { Check, Copy, Download, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useT } from '@/i18n/language-store'
import { track } from '@/lib/analytics'

interface ShareMetric { label: string; value: string }

export function SharePlan({ title, metrics }: { title: string; metrics: ShareMetric[] }) {
  const t = useT()
  const [copied, setCopied] = useState(false)
  const text = `${title} · ${metrics.map((metric) => `${metric.label}: ${metric.value}`).join(' · ')} · Palaxis`

  const copyLink = async () => {
    await navigator.clipboard?.writeText(window.location.href)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
    track('plan_shared', { method: 'copy_link' })
  }
  const share = async () => {
    const canShare = typeof (navigator as Navigator & { share?: unknown }).share === 'function'
    if (canShare) await navigator.share({ title: 'Palaxis', text, url: window.location.href })
    else await copyLink()
    track('plan_shared', { method: canShare ? 'native' : 'copy_link' })
  }
  const download = () => {
    const canvas = document.createElement('canvas')
    canvas.width = 1200
    canvas.height = 630
    const context = canvas.getContext('2d')
    if (!context) return
    const gradient = context.createLinearGradient(0, 0, 1200, 630)
    gradient.addColorStop(0, '#071016')
    gradient.addColorStop(1, '#123941')
    context.fillStyle = gradient
    context.fillRect(0, 0, 1200, 630)
    context.strokeStyle = '#6bded1'
    context.globalAlpha = .32
    for (let x = 0; x < 1200; x += 56) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, 630); context.stroke() }
    for (let y = 0; y < 630; y += 56) { context.beginPath(); context.moveTo(0, y); context.lineTo(1200, y); context.stroke() }
    context.globalAlpha = 1
    context.fillStyle = '#f3c653'
    context.font = '800 23px sans-serif'
    context.fillText('PALAXIS · BREEDING PLAN', 82, 105)
    context.fillStyle = '#eef8f8'
    context.font = '800 66px sans-serif'
    context.fillText(title.slice(0, 28), 82, 188)
    metrics.slice(0, 4).forEach((metric, index) => {
      const x = 82 + (index % 2) * 500
      const y = 290 + Math.floor(index / 2) * 145
      context.fillStyle = 'rgba(5, 14, 19, .7)'
      context.fillRect(x, y, 420, 105)
      context.fillStyle = '#94adb5'
      context.font = '700 18px sans-serif'
      context.fillText(metric.label.toUpperCase(), x + 24, y + 35)
      context.fillStyle = '#edf8f7'
      context.font = '800 38px sans-serif'
      context.fillText(metric.value, x + 24, y + 82)
    })
    const anchor = document.createElement('a')
    anchor.href = canvas.toDataURL('image/png')
    anchor.download = 'palaxis-plan.png'
    anchor.click()
    track('plan_shared', { method: 'png' })
  }

  return <div className="share-plan" aria-label={t('sharePlan.label')}>
    <Button variant="outline" size="sm" onClick={() => void share()}><Share2 aria-hidden="true" />{t('sharePlan.share')}</Button>
    <Button variant="ghost" size="icon-sm" aria-label={t('sharePlan.copy')} onClick={() => void copyLink()}>{copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}</Button>
    <Button variant="ghost" size="icon-sm" aria-label={t('sharePlan.download')} onClick={download}><Download aria-hidden="true" /></Button>
  </div>
}
