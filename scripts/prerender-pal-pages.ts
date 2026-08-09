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
import { getTierList, groupByTier, tierLetter, TIER_CATEGORIES } from '../src/domain/tier-list'
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
  const { pal, elementInfo, bestPassives, recipes, related, wildLevelRange, combatStats, drops, activeSkills, partnerSkill, partnerSkillSource, wildSpawns, wikiSourceUrl } = dossier
  const habitat = wildLevelRange ? t('pokedex.wildRange', { min: wildLevelRange[0], max: wildLevelRange[1] }) : t('pokedex.breedOnly')

  const passivesHtml = bestPassives.map((passive) => `<li>${escapeHtml(passive.name)}</li>`).join('')
  const recipesHtml = recipes
    .map(([a, b]) => `<li>${escapeHtml(palName(db.palById.get(a)))} + ${escapeHtml(palName(db.palById.get(b)))} = ${escapeHtml(palName(pal))}</li>`)
    .join('')
  const relatedHtml = related.map((entry) => relatedLinkHtml(entry.id, slugIndex, db)).join('')
  const workHtml = pal.work.map((entry) => `<li>${escapeHtml(workTypeLabel(entry.type))}: ${entry.value}</li>`).join('')
  const statsHtml = combatStats
    ? `<li>${escapeHtml(t('pokedex.hp'))}: ${combatStats.hp}</li><li>${escapeHtml(t('pokedex.meleeAttack'))}: ${combatStats.meleeAttack}</li><li>${escapeHtml(t('pokedex.shotAttack'))}: ${combatStats.shotAttack}</li><li>${escapeHtml(t('pokedex.defense'))}: ${combatStats.defense}</li><li>${escapeHtml(t('pokedex.support'))}: ${combatStats.support}</li>`
    : ''
  const dropsHtml = drops.map((drop) => `<li>${escapeHtml(drop.itemName)} (${drop.min === drop.max ? drop.min : `${drop.min}-${drop.max}`}, ${drop.rate}%)</li>`).join('')
  const skillsHtml = activeSkills.map((skill) => `<li>${escapeHtml(skill.name)} — ${escapeHtml(t('pokedex.activeSkillLevel', { level: skill.level }))}</li>`).join('')
  const spawnsHtml = wildSpawns.map((spawn) => `<li>${escapeHtml(spawn.region)}${spawn.coordinates ? ` (${spawn.coordinates[0]}, ${spawn.coordinates[1]})` : ''}</li>`).join('')
  const hasWikiData = activeSkills.length > 0 || partnerSkillSource === 'wiki' || wildSpawns.length > 0

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
  ${statsHtml ? `<section><h2>${escapeHtml(t('pokedex.combatStats'))}</h2><ul>${statsHtml}</ul></section>` : ''}
  ${dropsHtml ? `<section><h2>${escapeHtml(t('pokedex.dropItems'))}</h2><ul>${dropsHtml}</ul></section>` : ''}
  ${skillsHtml ? `<section><h2>${escapeHtml(t('pokedex.activeSkills'))}</h2><ul>${skillsHtml}</ul></section>` : ''}
  ${partnerSkill ? `<section><h2>${escapeHtml(t('pokedex.partnerSkill'))}</h2><p>${escapeHtml(partnerSkill.name)} — ${escapeHtml(partnerSkill.description)}</p>${partnerSkillSource === 'game8' ? `<p>${escapeHtml(t('pokedex.partnerSkillAttribution'))}</p>` : ''}</section>` : ''}
  ${spawnsHtml ? `<section><h2>${escapeHtml(t('pokedex.wildSpawn'))}</h2><ul>${spawnsHtml}</ul></section>` : ''}
  <section>
    <h2>${escapeHtml(t('pokedex.recipes'))}</h2>
    ${recipes.length ? `<ul>${recipesHtml}</ul>` : `<p>${escapeHtml(t('pokedex.noRecipes'))}</p>`}
  </section>
  ${related.length ? `<section><h2>${escapeHtml(t('pokedex.related'))}</h2><ul>${relatedHtml}</ul></section>` : ''}
  ${hasWikiData && wikiSourceUrl ? `<p>${escapeHtml(t('pokedex.dataAttribution'))} <a href="${escapeAttr(wikiSourceUrl)}" rel="noopener noreferrer nofollow">${escapeHtml(t('pokedex.viewSource'))}</a></p>` : ''}
</main>`.trim()
}

/** Reescribe SOLO las etiquetas de <head> que cambian por pagina; conserva intacto todo lo demas del index.html ya construido por Vite (scripts/estilos con hash incluidos). */
function buildStaticPage(baseHtml: string, opts: { url: string; title: string; description: string; jsonLd: Record<string, unknown>; staticContent: string }): string {
  const { url, title, description, jsonLd, staticContent } = opts
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
  html = html.replace('</head>', `  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>\n  </head>`)
  html = html.replace('<div id="root"></div>', `<div id="root">${staticContent}</div>`)
  return html
}

function buildPageHtml(baseHtml: string, dossier: PalDossier, slug: string, staticContent: string): string {
  const url = `${SITE_URL}/pals/${slug}`
  const title = pageTitle(dossier)
  const description = pageDescription(dossier)
  return buildStaticPage(baseHtml, {
    url,
    title,
    description,
    staticContent,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: title,
      about: palName(dossier.pal),
      description,
      url,
      isPartOf: { '@type': 'WebSite', name: 'Palaxis', url: SITE_URL },
    },
  })
}

/** `/pals` -directorio con TODAS las Pals sin paginar (un crawler no hace click en "cargar mas"). */
function renderPalsIndexHtml(baseHtml: string, slugIndex: Map<string, string>): string {
  const db = loadDatabase()
  const title = 'Palworld Pal Database | Palaxis'
  const description = `Browse all ${db.pals.length} Pals in Palworld: element, breeding power, best passives, and direct breeding routes for every one.`
  const items = [...slugIndex.entries()]
    .flatMap(([slug, palId]) => {
      const pal = db.palById.get(palId)
      return pal ? [{ slug, pal }] : []
    })
    .sort((a, b) => a.pal.dex - b.pal.dex)
  const listHtml = items
    .map(({ slug, pal }) => `<li><a href="/pals/${slug}">${escapeHtml(palName(pal))}</a> — ${escapeHtml(ELEMENT_INFO[pal.elements[0] ?? 'neutral'].label)}</li>`)
    .join('')
  const staticContent = `
<main>
  <a href="/">Palaxis</a>
  <h1>${escapeHtml(title.replace(' | Palaxis', ''))}</h1>
  <p>${escapeHtml(description)}</p>
  <section>
    <h2>${escapeHtml(t('palsIndex.allPals'))}</h2>
    <ul>${listHtml}</ul>
  </section>
</main>`.trim()

  return buildStaticPage(baseHtml, {
    url: `${SITE_URL}/pals`,
    title,
    description,
    staticContent,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: title,
      description,
      url: `${SITE_URL}/pals`,
      isPartOf: { '@type': 'WebSite', name: 'Palaxis', url: SITE_URL },
    },
  })
}

/** `/feedback` -contenido minimo pero real (2 links a GitHub Issues + changelog), sin depender de JS. */
function renderFeedbackHtml(baseHtml: string): string {
  const REPOSITORY_URL = 'https://github.com/isilioabs/palworld-breeding-planner'
  const title = 'Feedback & Updates | Palaxis'
  const description = 'Report bugs, suggest ideas, and see what changed recently in Palaxis, the Palworld breeding planner.'
  const changes = [t('productMenu.changeOne'), t('productMenu.changeTwo'), t('productMenu.changeThree'), t('productMenu.changeFour')]
  const staticContent = `
<main>
  <a href="/">Palaxis</a>
  <h1>${escapeHtml(t('feedbackPage.title'))}</h1>
  <p>${escapeHtml(t('feedbackPage.intro'))}</p>
  <section>
    <h2>${escapeHtml(t('feedbackPage.reportBug'))}</h2>
    <p>${escapeHtml(t('productMenu.bugDescription'))}</p>
    <a href="${REPOSITORY_URL}/issues/new?title=${encodeURIComponent('[Bug] ')}">${escapeHtml(t('productMenu.bug'))}</a>
  </section>
  <section>
    <h2>${escapeHtml(t('feedbackPage.suggestIdea'))}</h2>
    <p>${escapeHtml(t('productMenu.ideaDescription'))}</p>
    <a href="${REPOSITORY_URL}/issues/new?title=${encodeURIComponent('[Idea] ')}">${escapeHtml(t('productMenu.idea'))}</a>
  </section>
  <section>
    <h2>${escapeHtml(t('feedbackPage.changelog'))}</h2>
    <ul>${changes.map((change) => `<li>${escapeHtml(change)}</li>`).join('')}</ul>
  </section>
</main>`.trim()

  return buildStaticPage(baseHtml, {
    url: `${SITE_URL}/feedback`,
    title,
    description,
    staticContent,
    jsonLd: { '@context': 'https://schema.org', '@type': 'WebPage', name: title, description, url: `${SITE_URL}/feedback` },
  })
}

/** `/tiers` -las 15 categorias completas, 5 bandas S..D cada una, con links reales a cada ficha de Pal. */
function renderTiersHtml(baseHtml: string, slugIndex: Map<string, string>): string {
  const title = 'Palworld Tier List | Palaxis'
  const description = 'S/A/B/C/D tier lists for Palworld combat, ground mounts, flying mounts, and each of the 12 work types -calculated from the game’s real stats.'
  const slugByPalId = new Map([...slugIndex.entries()].map(([slug, palId]) => [palId, slug]))

  const categoriesHtml = TIER_CATEGORIES.map((category) => {
    const groups = groupByTier(getTierList(category.id), category)
    const tierNumbers = Array.from({ length: category.letters.length }, (_, i) => category.letters.length - i)
    const bandsHtml = tierNumbers.map((tierNumber) => {
      const entries = groups[tierNumber]
      if (entries.length === 0) return ''
      const chips = entries
        .map((entry) => {
          const slug = slugByPalId.get(entry.pal.id)
          if (!slug) return ''
          const stat = entry.statLabel ? ` (${escapeHtml(entry.statLabel)})` : ''
          return `<li><a href="/pals/${slug}">${escapeHtml(entry.pal.name)}</a>${stat}</li>`
        })
        .join('')
      return `<li><strong>${tierLetter(category, tierNumber)}</strong><ul>${chips}</ul></li>`
    }).join('')
    return `<section><h2>${escapeHtml(t(category.labelKey))}</h2><ul>${bandsHtml}</ul></section>`
  }).join('')

  const staticContent = `
<main>
  <a href="/">Palaxis</a>
  <h1>${escapeHtml(title.replace(' | Palaxis', ''))}</h1>
  <p>${escapeHtml(description)}</p>
  ${categoriesHtml}
</main>`.trim()

  return buildStaticPage(baseHtml, {
    url: `${SITE_URL}/tiers`,
    title,
    description,
    staticContent,
    jsonLd: { '@context': 'https://schema.org', '@type': 'WebPage', name: title, description, url: `${SITE_URL}/tiers` },
  })
}

async function main() {
  const baseHtml = await readFile(path.join(DIST, 'index.html'), 'utf-8')
  const db = loadDatabase()
  const slugIndex = buildSlugIndex(db.pals) // lanza si hay colision -mejor fallar el build que publicar una URL pisada

  const urls: string[] = [`${SITE_URL}/`, `${SITE_URL}/planner`, `${SITE_URL}/rapido`, `${SITE_URL}/pals`, `${SITE_URL}/tiers`, `${SITE_URL}/feedback`]

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

  await mkdir(path.join(DIST, 'pals'), { recursive: true })
  await writeFile(path.join(DIST, 'pals', 'index.html'), renderPalsIndexHtml(baseHtml, slugIndex), 'utf-8')

  await mkdir(path.join(DIST, 'feedback'), { recursive: true })
  await writeFile(path.join(DIST, 'feedback', 'index.html'), renderFeedbackHtml(baseHtml), 'utf-8')

  await mkdir(path.join(DIST, 'tiers'), { recursive: true })
  await writeFile(path.join(DIST, 'tiers', 'index.html'), renderTiersHtml(baseHtml, slugIndex), 'utf-8')

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((url) => `  <url><loc>${escapeXml(url)}</loc></url>`)
    .join('\n')}\n</urlset>\n`
  await writeFile(path.join(DIST, 'sitemap.xml'), sitemap, 'utf-8')

  console.log(`Prerendered ${slugIndex.size} Pal pages + /pals index + /feedback + sitemap.xml (${urls.length} URLs).`)
}

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
