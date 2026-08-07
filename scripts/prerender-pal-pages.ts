#!/usr/bin/env tsx
/**
 * Paso de build (corre DESPUES de `vite build`, ver package.json): genera
 * una pagina estatica real por cada Pal en dist/pals/<slug>/index.html, mas
 * un dist/sitemap.xml con todas las URLs.
 *
 * Por que hace falta: Palaxis es una SPA pura -sin esto, un crawler que
 * visite /pals/anubis no encontraria ni la ruta ni contenido, solo la SPA
 * vacia que vive en /. `src/main.tsx` monta con `createRoot().render()`, NO
 * `hydrateRoot()`: React REEMPLAZA el contenido de #root al cargar, no lo
 * reconcilia. Por eso el HTML de aqui no necesita coincidir byte a byte con
 * lo que renderiza el cliente (`src/features/pals/pal-page.tsx`) -solo tiene
 * que ser contenido real y correcto para un crawler o el primer pintado.
 *
 * Reutiliza exactamente los mismos datos/calculos que ya usa la app
 * (loadDatabase, buildPalDossier, palSlug) para que nunca pueda desalinearse
 * de lo que el usuario ve despues de que cargue React.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadDatabase, dexLabel, palName, workTypeLabel } from '../src/domain/database'
import { buildPalDossier, type PalDossier } from '../src/domain/pal-dossier'
import { buildSlugIndex, palSlug } from '../src/domain/slug'
import { ELEMENT_INFO } from '../src/domain/element'
import { setLang } from '../src/i18n/lang'
import { DICTS } from '../src/i18n/translations'
import { interpolate } from '../src/i18n/language-store'
import type { TranslationKey } from '../src/i18n/translations'

const SITE_URL = 'https://palaxis.app'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const DIST = path.join(ROOT, 'dist')

setLang('en')
const t = (key: TranslationKey, vars?: Record<string, string | number>) => interpolate(DICTS.en[key], vars)

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!)
}
function escapeAttr(value: string): string {
  return escapeHtml(value)
}

function pageTitle(dossier: PalDossier): string {
  return `How to Breed ${palName(dossier.pal)} in Palworld | Palaxis`
}

function pageDescription(dossier: PalDossier): string {
  const { pal, elementInfo, wildLevelRange } = dossier
  const habitat = wildLevelRange ? `found in the wild at level ${wildLevelRange[0]}-${wildLevelRange[1]}` : 'only obtainable by breeding'
  const elementLabel = elementInfo.label.toLowerCase()
  const article = /^[aeiou]/.test(elementLabel) ? 'an' : 'a'
  return `${palName(pal)} is ${article} ${elementLabel}-type Pal in Palworld (${dexLabel(pal)}), ${habitat}. See its best passive skills and every direct breeding pair.`
}

function relatedLinkHtml(palId: string, slugIndex: Map<string, string>, db: ReturnType<typeof loadDatabase>): string {
  const pal = db.palById.get(palId)
  if (!pal) return ''
  const slug = [...slugIndex.entries()].find(([, id]) => id === palId)?.[0]
  if (!slug) return ''
  return `<li><a href="/pals/${slug}">${escapeHtml(palName(pal))}</a></li>`
}

/** El markup real que ve un crawler (o el usuario, un instante, antes de que cargue React). */
function renderStaticContent(dossier: PalDossier, slugIndex: Map<string, string>): string {
  const db = loadDatabase()
  const { pal, elementInfo, bestPassives, recipes, related, wildLevelRange } = dossier
  const habitat = wildLevelRange ? t('pokedex.wildRange', { min: wildLevelRange[0], max: wildLevelRange[1] }) : t('pokedex.breedOnly')

  const passivesHtml = bestPassives.map((passive) => `<li>${escapeHtml(passive.name)}</li>`).join('')
  const recipesHtml = recipes
    .map(([a, b]) => `<li>${escapeHtml(palName(db.palById.get(a)))} + ${escapeHtml(palName(db.palById.get(b)))} = ${escapeHtml(palName(pal))}</li>`)
    .join('')
  const relatedHtml = related.map((entry) => relatedLinkHtml(entry.id, slugIndex, db)).join('')
  const workHtml = pal.work.map((entry) => `<li>${escapeHtml(workTypeLabel(entry.type))}: ${entry.value}</li>`).join('')

  return `
<main>
  <a href="/">${escapeHtml('Palaxis')}</a>
  <h1>${escapeHtml(palName(pal))}</h1>
  <p>${escapeHtml(dexLabel(pal))} &middot; ${escapeHtml(elementInfo.label)}</p>
  <p>${escapeHtml(t('palPage.intro', { name: palName(pal) }))}</p>
  <a href="/">${escapeHtml(t('palPage.planRoute', { name: palName(pal) }))}</a>
  <section>
    <h2>${escapeHtml(t('pokedex.habitat'))}</h2>
    <p>${escapeHtml(habitat)}</p>
  </section>
  <section>
    <h2>${escapeHtml(t('pokedex.breedingPower'))}</h2>
    <p>${pal.power.toLocaleString('en-US')}</p>
  </section>
  ${workHtml ? `<section><h2>${escapeHtml(t('pokedex.work'))}</h2><ul>${workHtml}</ul></section>` : ''}
  <section>
    <h2>${escapeHtml(t('pokedex.bestPassives'))}</h2>
    <ul>${passivesHtml}</ul>
  </section>
  <section>
    <h2>${escapeHtml(t('pokedex.recipes'))}</h2>
    ${recipes.length ? `<ul>${recipesHtml}</ul>` : `<p>${escapeHtml(t('pokedex.noRecipes'))}</p>`}
  </section>
  ${related.length ? `<section><h2>${escapeHtml(t('pokedex.related'))}</h2><ul>${relatedHtml}</ul></section>` : ''}
</main>`.trim()
}

/** Reescribe SOLO las etiquetas que cambian por Pal; conserva intacto todo lo demas del index.html ya construido por Vite (scripts/estilos con hash incluidos). */
function buildPageHtml(baseHtml: string, dossier: PalDossier, slug: string, staticContent: string): string {
  const url = `${SITE_URL}/pals/${slug}`
  const title = pageTitle(dossier)
  const description = pageDescription(dossier)
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    about: palName(dossier.pal),
    description,
    url,
    isPartOf: { '@type': 'WebSite', name: 'Palaxis', url: SITE_URL },
  })

  let html = baseHtml
  html = html.replace('<html lang="es" class="dark">', '<html lang="en" class="dark">')
  html = html.replace(/<title>.*?<\/title>/s, `<title>${escapeHtml(title)}</title>`)
  html = html.replace(/<meta name="description" content=".*?" \/>/, `<meta name="description" content="${escapeAttr(description)}" />`)
  html = html.replace(/<link rel="canonical" href=".*?" \/>/, `<link rel="canonical" href="${escapeAttr(url)}" />`)
  html = html.replace(/<meta property="og:url" content=".*?" \/>/, `<meta property="og:url" content="${escapeAttr(url)}" />`)
  html = html.replace(/<meta property="og:title" content=".*?" \/>/, `<meta property="og:title" content="${escapeAttr(title)}" />`)
  html = html.replace(/<meta property="og:description" content=".*?" \/>/, `<meta property="og:description" content="${escapeAttr(description)}" />`)
  html = html.replace(/<meta name="twitter:title" content=".*?" \/>/, `<meta name="twitter:title" content="${escapeAttr(title)}" />`)
  html = html.replace(/<meta name="twitter:description" content=".*?" \/>/, `<meta name="twitter:description" content="${escapeAttr(description)}" />`)
  html = html.replace('</head>', `  <script type="application/ld+json">${jsonLd}</script>\n  </head>`)
  html = html.replace('<div id="root"></div>', `<div id="root">${staticContent}</div>`)
  return html
}

async function main() {
  const baseHtml = await readFile(path.join(DIST, 'index.html'), 'utf-8')
  const db = loadDatabase()
  const slugIndex = buildSlugIndex(db.pals) // lanza si hay colision -mejor fallar el build que publicar una URL pisada

  const urls: string[] = [`${SITE_URL}/`, `${SITE_URL}/rapido`]

  for (const [slug, palId] of slugIndex) {
    const dossier = buildPalDossier(palId)
    if (!dossier) continue
    const staticContent = renderStaticContent(dossier, slugIndex)
    const html = buildPageHtml(baseHtml, dossier, slug, staticContent)
    const dir = path.join(DIST, 'pals', slug)
    await mkdir(dir, { recursive: true })
    await writeFile(path.join(dir, 'index.html'), html, 'utf-8')
    urls.push(`${SITE_URL}/pals/${slug}`)
  }

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((url) => `  <url><loc>${escapeXml(url)}</loc></url>`)
    .join('\n')}\n</urlset>\n`
  await writeFile(path.join(DIST, 'sitemap.xml'), sitemap, 'utf-8')

  console.log(`Prerendered ${slugIndex.size} Pal pages + sitemap.xml (${urls.length} URLs).`)
}

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
