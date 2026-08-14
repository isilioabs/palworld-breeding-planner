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
import type { Lang } from '../src/i18n/lang'

const SITE_URL = 'https://palaxis.app'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const DIST = path.join(ROOT, 'dist')

const LOCALES: Lang[] = ['en', 'es']
const SOCIAL_IMAGE = `${SITE_URL}/social-card.png`

function tFor(locale: Lang) {
  return (key: TranslationKey, vars?: Record<string, string | number>) => interpolate(DICTS[locale][key], vars)
}

function localePath(pathname: string, locale: Lang): string {
  return locale === 'es' ? (pathname === '/' ? '/es' : `/es${pathname}`) : pathname
}

function absoluteUrl(pathname: string, locale: Lang): string {
  return `${SITE_URL}${localePath(pathname, locale)}`
}

const ELEMENT_ES: Record<string, string> = {
  EARTH: 'TIERRA', FIRE: 'FUEGO', WATER: 'AGUA', GRASS: 'PLANTA', ELECTRIC: 'ELÉCTRICO', DARK: 'OSCURIDAD', ICE: 'HIELO', DRAGON: 'DRAGÓN', NEUTRAL: 'NEUTRO',
}

function localizedElementLabel(label: string, locale: Lang): string {
  return locale === 'es' ? ELEMENT_ES[label] ?? label : label
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!)
}
function escapeAttr(value: string): string {
  return escapeHtml(value)
}

function pageTitle(dossier: PalDossier, locale: Lang): string {
  return locale === 'es'
    ? `Cómo criar a ${palName(dossier.pal)} en Palworld | Palaxis`
    : `How to Breed ${palName(dossier.pal)} in Palworld | Palaxis`
}

function pageDescription(dossier: PalDossier, locale: Lang): string {
  const { pal, elementInfo, wildLevelRange } = dossier
  if (locale === 'es') {
    const habitat = wildLevelRange ? `aparece en estado salvaje entre los niveles ${wildLevelRange[0]}-${wildLevelRange[1]}` : 'solo se obtiene mediante crianza'
    return `${palName(pal)} es un Pal de tipo ${localizedElementLabel(elementInfo.label, locale)} en Palworld (${dexLabel(pal)}) que ${habitat}. Consulta sus mejores pasivas y todas sus combinaciones directas.`
  }
  const habitat = wildLevelRange ? `found in the wild at level ${wildLevelRange[0]}-${wildLevelRange[1]}` : 'only obtainable by breeding'
  const elementLabel = elementInfo.label.toLowerCase()
  const article = /^[aeiou]/.test(elementLabel) ? 'an' : 'a'
  return `${palName(pal)} is ${article} ${elementLabel}-type Pal in Palworld (${dexLabel(pal)}), ${habitat}. See its best passive skills and every direct breeding pair.`
}

function relatedLinkHtml(palId: string, slugIndex: Map<string, string>, db: ReturnType<typeof loadDatabase>, locale: Lang): string {
  const pal = db.palById.get(palId)
  if (!pal) return ''
  const slug = [...slugIndex.entries()].find(([, id]) => id === palId)?.[0]
  if (!slug) return ''
  return `<li><a href="${localePath(`/pals/${slug}`, locale)}">${escapeHtml(palName(pal))}</a></li>`
}

/** El markup real que ve un crawler (o el usuario, un instante, antes de que cargue React). */
function renderStaticContent(dossier: PalDossier, slugIndex: Map<string, string>, locale: Lang): string {
  const t = tFor(locale)
  const db = loadDatabase()
  const { pal, elementInfo, bestPassives, recipes, related, wildLevelRange, combatStats, drops, activeSkills, partnerSkill, partnerSkillSource, wildSpawns, wikiSourceUrl } = dossier
  const habitat = wildLevelRange ? t('pokedex.wildRange', { min: wildLevelRange[0], max: wildLevelRange[1] }) : t('pokedex.breedOnly')

  const passivesHtml = bestPassives.map((passive) => `<li>${escapeHtml(locale === 'es' ? passive.nameEs : passive.name)}</li>`).join('')
  const recipesHtml = recipes
    .map(([a, b]) => `<li>${escapeHtml(palName(db.palById.get(a)))} + ${escapeHtml(palName(db.palById.get(b)))} = ${escapeHtml(palName(pal))}</li>`)
    .join('')
  const relatedHtml = related.map((entry) => relatedLinkHtml(entry.id, slugIndex, db, locale)).join('')
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
  <a href="${localePath('/', locale)}">${escapeHtml('Palaxis')}</a>
  <h1>${escapeHtml(palName(pal))}</h1>
  <p>${escapeHtml(dexLabel(pal))} &middot; ${escapeHtml(localizedElementLabel(elementInfo.label, locale))}</p>
  <p>${escapeHtml(t('palPage.intro', { name: palName(pal) }))}</p>
  <a href="${localePath('/planner', locale)}">${escapeHtml(t('palPage.planRoute', { name: palName(pal) }))}</a>
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
function buildStaticPage(baseHtml: string, opts: { pathname: string; locale: Lang; title: string; description: string; jsonLd: Record<string, unknown>; staticContent: string; image?: string; ogType?: 'website' | 'article' }): string {
  const { pathname, locale, title, description, jsonLd, staticContent, image = SOCIAL_IMAGE, ogType = 'website' } = opts
  const url = absoluteUrl(pathname, locale)
  let html = baseHtml
  html = html.replace(/<html lang="[^"]+" class="dark">/, `<html lang="${locale}" class="dark">`)
  html = html.replace(/<title>.*?<\/title>/s, `<title>${escapeHtml(title)}</title>`)
  html = html.replace(/<meta name="description" content=".*?" \/>/, `<meta name="description" content="${escapeAttr(description)}" />`)
  html = html.replace(/<link rel="canonical" href=".*?" \/>/, `<link rel="canonical" href="${escapeAttr(url)}" />`)
  html = html.replace(/<meta property="og:url" content=".*?" \/>/, `<meta property="og:url" content="${escapeAttr(url)}" />`)
  html = html.replace(/<meta property="og:title" content=".*?" \/>/, `<meta property="og:title" content="${escapeAttr(title)}" />`)
  html = html.replace(/<meta property="og:description" content=".*?" \/>/, `<meta property="og:description" content="${escapeAttr(description)}" />`)
  html = html.replace(/<meta property="og:type" content=".*?" \/>/, `<meta property="og:type" content="${ogType}" />`)
  html = html.replace(/<meta property="og:locale" content=".*?" \/>/, `<meta property="og:locale" content="${locale === 'es' ? 'es_ES' : 'en_US'}" />`)
  html = html.replace(/<meta property="og:image" content=".*?" \/>/, `<meta property="og:image" content="${escapeAttr(image)}" />`)
  html = html.replace(/<meta property="og:image:secure_url" content=".*?" \/>/, `<meta property="og:image:secure_url" content="${escapeAttr(image)}" />`)
  html = html.replace(/<meta name="twitter:title" content=".*?" \/>/, `<meta name="twitter:title" content="${escapeAttr(title)}" />`)
  html = html.replace(/<meta name="twitter:description" content=".*?" \/>/, `<meta name="twitter:description" content="${escapeAttr(description)}" />`)
  html = html.replace(/<meta name="twitter:image" content=".*?" \/>/, `<meta name="twitter:image" content="${escapeAttr(image)}" />`)
  html = html.replace(/<link rel="alternate" hreflang="en" href=".*?" \/>/, `<link rel="alternate" hreflang="en" href="${escapeAttr(absoluteUrl(pathname, 'en'))}" />`)
  html = html.replace(/<link rel="alternate" hreflang="es" href=".*?" \/>/, `<link rel="alternate" hreflang="es" href="${escapeAttr(absoluteUrl(pathname, 'es'))}" />`)
  html = html.replace(/<link rel="alternate" hreflang="x-default" href=".*?" \/>/, `<link rel="alternate" hreflang="x-default" href="${escapeAttr(absoluteUrl(pathname, 'en'))}" />`)
  html = html.replace(/<script id="seo-structured-data" type="application\/ld\+json">.*?<\/script>/s, `<script id="seo-structured-data" type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>`)
  html = html.replace('<div id="root"></div>', `<div id="root">${staticContent}</div>`)
  return html
}

function buildPageHtml(baseHtml: string, dossier: PalDossier, slug: string, staticContent: string, locale: Lang): string {
  const pathname = `/pals/${slug}`
  const url = absoluteUrl(pathname, locale)
  const title = pageTitle(dossier, locale)
  const description = pageDescription(dossier, locale)
  const image = `${SITE_URL}/pals/${encodeURIComponent(dossier.pal.id)}.png`
  return buildStaticPage(baseHtml, {
    pathname,
    locale,
    title,
    description,
    staticContent,
    image,
    ogType: 'article',
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'WebSite', '@id': `${SITE_URL}/#website`, name: 'Palaxis', url: SITE_URL, inLanguage: locale },
        { '@type': 'Article', headline: title, name: palName(dossier.pal), about: { '@type': 'Thing', name: `${palName(dossier.pal)} — Palworld` }, description, image, url, inLanguage: locale, isPartOf: { '@id': `${SITE_URL}/#website` } },
        { '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Palaxis', item: absoluteUrl('/', locale) },
          { '@type': 'ListItem', position: 2, name: 'Paldex', item: absoluteUrl('/pals', locale) },
          { '@type': 'ListItem', position: 3, name: palName(dossier.pal), item: url },
        ] },
      ],
    },
  })
}

/** `/pals` -directorio con TODAS las Pals sin paginar (un crawler no hace click en "cargar mas"). */
function renderPalsIndexHtml(baseHtml: string, slugIndex: Map<string, string>, locale: Lang): string {
  const t = tFor(locale)
  const db = loadDatabase()
  const title = locale === 'es' ? 'Paldex de Palworld: Pals, estadísticas y cruces | Palaxis' : 'Palworld Paldex: All Pals, Stats & Breeding Combos | Palaxis'
  const description = locale === 'es'
    ? `Consulta los ${db.pals.length} Pals de Palworld con elementos, poder de crianza, mejores pasivas y cruces directos.`
    : `Browse all ${db.pals.length} Pals in Palworld with elements, breeding power, best passives, and direct breeding routes.`
  const items = [...slugIndex.entries()]
    .flatMap(([slug, palId]) => {
      const pal = db.palById.get(palId)
      return pal ? [{ slug, pal }] : []
    })
    .sort((a, b) => a.pal.dex - b.pal.dex)
  const listHtml = items
    .map(({ slug, pal }) => `<li><a href="${localePath(`/pals/${slug}`, locale)}">${escapeHtml(palName(pal))}</a> — ${escapeHtml(localizedElementLabel(ELEMENT_INFO[pal.elements[0] ?? 'neutral'].label, locale))}</li>`)
    .join('')
  const staticContent = `
<main>
  <a href="${localePath('/', locale)}">Palaxis</a>
  <h1>${escapeHtml(locale === 'es' ? 'Paldex de Palworld' : 'Palworld Paldex')}</h1>
  <p>${escapeHtml(description)}</p>
  <section>
    <h2>${escapeHtml(t('palsIndex.allPals'))}</h2>
    <ul>${listHtml}</ul>
  </section>
</main>`.trim()

  return buildStaticPage(baseHtml, {
    pathname: '/pals',
    locale,
    title,
    description,
    staticContent,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: title,
      description,
      url: absoluteUrl('/pals', locale),
      inLanguage: locale,
      isPartOf: { '@type': 'WebSite', '@id': `${SITE_URL}/#website`, name: 'Palaxis', url: SITE_URL },
    },
  })
}

/** `/feedback` -contenido minimo pero real (2 links a GitHub Issues + changelog), sin depender de JS. */
function renderFeedbackHtml(baseHtml: string, locale: Lang): string {
  const t = tFor(locale)
  const REPOSITORY_URL = 'https://github.com/isilioabs/palworld-breeding-planner'
  const title = locale === 'es' ? 'Feedback, cambios y novedades de Palaxis' : 'Palaxis Feedback, Changelog & Updates'
  const description = locale === 'es'
    ? 'Reporta errores, sugiere funciones y consulta las últimas novedades del companion de crianza de Palworld.'
    : 'Report bugs, suggest features, and review the latest updates to the Palworld breeding companion.'
  const changes = [t('productMenu.changeOne'), t('productMenu.changeTwo'), t('productMenu.changeThree'), t('productMenu.changeFour')]
  const staticContent = `
<main>
  <a href="${localePath('/', locale)}">Palaxis</a>
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
    pathname: '/feedback',
    locale,
    title,
    description,
    staticContent,
    jsonLd: { '@context': 'https://schema.org', '@type': 'WebPage', name: title, description, url: absoluteUrl('/feedback', locale), inLanguage: locale },
  })
}

/** `/tiers` -las 15 categorias completas, 5 bandas S..D cada una, con links reales a cada ficha de Pal. */
function renderTiersHtml(baseHtml: string, slugIndex: Map<string, string>, locale: Lang): string {
  const t = tFor(locale)
  const title = locale === 'es' ? 'Tier List de Palworld: combate, trabajo y monturas | Palaxis' : 'Palworld Tier List: Combat, Work & Mounts | Palaxis'
  const description = locale === 'es'
    ? 'Tier lists S/A/B/C/D de Palworld para combate, monturas y cada habilidad de trabajo, calculadas con estadísticas reales del juego.'
    : 'Data-driven S/A/B/C/D Palworld tier lists for combat, ground mounts, flying mounts, and every work suitability.'
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
          return `<li><a href="${localePath(`/pals/${slug}`, locale)}">${escapeHtml(palName(entry.pal))}</a>${stat}</li>`
        })
        .join('')
      return `<li><strong>${tierLetter(category, tierNumber)}</strong><ul>${chips}</ul></li>`
    }).join('')
    return `<section><h2>${escapeHtml(t(category.labelKey))}</h2><ul>${bandsHtml}</ul></section>`
  }).join('')

  const staticContent = `
<main>
  <a href="${localePath('/', locale)}">Palaxis</a>
  <h1>${escapeHtml(locale === 'es' ? 'Tier List de Palworld' : 'Palworld Tier List')}</h1>
  <p>${escapeHtml(description)}</p>
  ${categoriesHtml}
</main>`.trim()

  return buildStaticPage(baseHtml, {
    pathname: '/tiers',
    locale,
    title,
    description,
    staticContent,
    jsonLd: { '@context': 'https://schema.org', '@type': 'CollectionPage', name: title, description, url: absoluteUrl('/tiers', locale), inLanguage: locale },
  })
}

function renderLandingHtml(baseHtml: string, locale: Lang): string {
  const spanish = locale === 'es'
  const title = spanish ? 'Palaxis — Calculadora de crianza y companion de Palworld' : 'Palaxis — Palworld Breeding Calculator & Companion'
  const description = spanish
    ? 'Planifica rutas óptimas de crianza en Palworld, compara alternativas, gestiona tu colección y descubre las mejores pasivas para cada Pal.'
    : 'Plan optimal Palworld breeding routes, compare alternatives, track your collection, and find the best passives for every Pal.'
  const staticContent = `
<main>
  <header><a href="${localePath('/', locale)}">Palaxis</a><nav><a href="${localePath('/planner', locale)}">${spanish ? 'Planificador' : 'Breeding Planner'}</a> <a href="${localePath('/pals', locale)}">Paldex</a> <a href="${localePath('/tiers', locale)}">Tier List</a></nav></header>
  <h1>${spanish ? 'Planifica Pals perfectos, no solo cruces.' : 'Plan perfect Pals, not just breeding combinations.'}</h1>
  <p>${escapeHtml(description)}</p>
  <a href="${localePath('/planner', locale)}">${spanish ? 'Abrir planificador' : 'Launch breeding planner'}</a>
  <section><h2>${spanish ? 'Tres rutas para cada objetivo' : 'Three routes for every target'}</h2><p>${spanish ? 'Compara la ruta más rápida, la más fácil y la que reutiliza tu colección.' : 'Compare the fastest route, the easiest route, and the route that reuses your collection.'}</p></section>
  <section><h2>${spanish ? 'Un companion personalizado' : 'A personalized companion'}</h2><p>${spanish ? 'Tu colección, pasivas, proyectos y progreso permanecen en tu navegador.' : 'Your collection, passives, breeding projects, and progress remain in your browser.'}</p></section>
  <section><h2>${spanish ? 'Explora todos los Pals' : 'Explore every Pal'}</h2><p><a href="${localePath('/pals', locale)}">${spanish ? 'Abrir Paldex' : 'Open the Paldex'}</a> · <a href="${localePath('/tiers', locale)}">${spanish ? 'Ver Tier List' : 'View the Tier List'}</a></p></section>
</main>`.trim()
  return buildStaticPage(baseHtml, {
    pathname: '/', locale, title, description, staticContent,
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'WebSite', '@id': `${SITE_URL}/#website`, name: 'Palaxis', url: SITE_URL, inLanguage: locale },
        { '@type': 'WebPage', name: title, description, url: absoluteUrl('/', locale), inLanguage: locale, isPartOf: { '@id': `${SITE_URL}/#website` } },
        { '@type': 'SoftwareApplication', name: 'Palaxis', url: SITE_URL, description, applicationCategory: 'GameApplication', applicationSubCategory: 'Palworld breeding planner', operatingSystem: 'Web', browserRequirements: 'Requires JavaScript. Works offline after the first visit.', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, featureList: ['Breeding route comparison', 'Collection tracking', 'Pal database', 'Tier lists', 'Offline planning'] },
      ],
    },
  })
}

function renderToolHtml(baseHtml: string, pathname: '/planner' | '/rapido', locale: Lang): string {
  const spanish = locale === 'es'
  const planner = pathname === '/planner'
  const title = planner
    ? (spanish ? 'Calculadora y planificador de crianza de Palworld | Palaxis' : 'Palworld Breeding Calculator & Planner | Palaxis')
    : (spanish ? 'Combinaciones de crianza y rutas rápidas de Palworld | Palaxis' : 'Palworld Breeding Combos & Quick Path Finder | Palaxis')
  const description = planner
    ? (spanish ? 'Crea un árbol de crianza óptimo usando tu colección y compara rutas rápidas, fáciles y exclusivas de tu colección.' : 'Build an optimal Palworld breeding tree from your collection and compare fastest, easiest, and collection-only routes.')
    : (spanish ? 'Encuentra una combinación directa de crianza o el camino más corto para conseguir cualquier Pal.' : 'Find a direct breeding combination or the shortest path to any Pal in seconds.')
  const staticContent = `
<main>
  <a href="${localePath('/', locale)}">Palaxis</a>
  <h1>${escapeHtml(title.replace(' | Palaxis', ''))}</h1>
  <p>${escapeHtml(description)}</p>
  <section><h2>${planner ? (spanish ? 'Cómo funciona' : 'How it works') : (spanish ? 'Encuentra un cruce' : 'Find a breeding path')}</h2><ol><li>${spanish ? 'Selecciona el Pal objetivo.' : 'Select your target Pal.'}</li><li>${spanish ? 'Añade pasivas y Pals que ya tienes.' : 'Add desired passives and Pals you own.'}</li><li>${spanish ? 'Compara las rutas y abre el árbol.' : 'Compare routes and open the breeding tree.'}</li></ol></section>
  <p><a href="${localePath('/pals', locale)}">${spanish ? 'Explorar Paldex' : 'Browse the Paldex'}</a></p>
</main>`.trim()
  return buildStaticPage(baseHtml, {
    pathname, locale, title, description, staticContent,
    jsonLd: { '@context': 'https://schema.org', '@type': 'WebApplication', name: title.replace(' | Palaxis', ''), description, url: absoluteUrl(pathname, locale), applicationCategory: 'GameApplication', operatingSystem: 'Web', inLanguage: locale, offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } },
  })
}

async function writePage(pathname: string, locale: Lang, html: string) {
  const relative = localePath(pathname, locale).replace(/^\//, '')
  const dir = relative ? path.join(DIST, relative) : DIST
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, 'index.html'), html, 'utf-8')
}

async function main() {
  const baseHtml = await readFile(path.join(DIST, 'index.html'), 'utf-8')
  const db = loadDatabase()
  const slugIndex = buildSlugIndex(db.pals) // lanza si hay colision -mejor fallar el build que publicar una URL pisada
  const paths = ['/', '/planner', '/rapido', '/pals', '/tiers', '/feedback', ...[...slugIndex.keys()].map((slug) => `/pals/${slug}`)]

  for (const locale of LOCALES) {
    setLang(locale)
    await writePage('/', locale, renderLandingHtml(baseHtml, locale))
    await writePage('/planner', locale, renderToolHtml(baseHtml, '/planner', locale))
    await writePage('/rapido', locale, renderToolHtml(baseHtml, '/rapido', locale))
    await writePage('/pals', locale, renderPalsIndexHtml(baseHtml, slugIndex, locale))
    await writePage('/feedback', locale, renderFeedbackHtml(baseHtml, locale))
    await writePage('/tiers', locale, renderTiersHtml(baseHtml, slugIndex, locale))

    for (const [slug, palId] of slugIndex) {
      const dossier = buildPalDossier(palId)
      if (!dossier) continue
      const staticContent = renderStaticContent(dossier, slugIndex, locale)
      await writePage(`/pals/${slug}`, locale, buildPageHtml(baseHtml, dossier, slug, staticContent, locale))
    }
  }

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${paths
    .flatMap((pathname) => LOCALES.map((locale) => {
      const url = absoluteUrl(pathname, locale)
      return `  <url><loc>${escapeXml(url)}</loc><xhtml:link rel="alternate" hreflang="en" href="${escapeXml(absoluteUrl(pathname, 'en'))}"/><xhtml:link rel="alternate" hreflang="es" href="${escapeXml(absoluteUrl(pathname, 'es'))}"/><xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(absoluteUrl(pathname, 'en'))}"/></url>`
    }))
    .join('\n')}\n</urlset>\n`
  await writeFile(path.join(DIST, 'sitemap.xml'), sitemap, 'utf-8')

  console.log(`Prerendered ${paths.length} routes in ${LOCALES.length} languages (${paths.length * LOCALES.length} canonical URLs).`)
}

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
