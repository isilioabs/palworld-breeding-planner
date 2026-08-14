import { buildSlugIndex } from '@/domain/slug'
import { loadDatabase, palName } from '@/domain/database'
import type { Lang } from '@/i18n/lang'

export const SITE_URL = 'https://palaxis.app'
export const SOCIAL_IMAGE = `${SITE_URL}/social-card.png`

const SEO_SCRIPT_ID = 'seo-structured-data'

export function localeFromPath(pathname: string): Lang | null {
  return pathname === '/es' || pathname.startsWith('/es/') ? 'es' : null
}

export function stripLocalePrefix(pathname: string): string {
  if (pathname === '/es') return '/'
  return pathname.startsWith('/es/') ? pathname.slice(3) || '/' : pathname
}

export function localizedPath(pathname: string, lang: Lang): string {
  if (!pathname.startsWith('/') || pathname.startsWith('//')) return pathname
  const clean = stripLocalePrefix(pathname)
  return lang === 'es' ? (clean === '/' ? '/es' : `/es${clean}`) : clean
}

function absolutePath(pathname: string, lang: Lang): string {
  return `${SITE_URL}${localizedPath(pathname, lang)}`
}

interface SeoDescriptor {
  title: string
  description: string
  type: 'website' | 'article'
  image?: string
  structuredData: Record<string, unknown>
}

const copy = {
  en: {
    homeTitle: 'Palaxis — Palworld Breeding Calculator & Companion',
    homeDescription: 'Plan optimal Palworld breeding routes, compare alternatives, track your collection, and find the best passives for every Pal. Fast, private, and offline-ready.',
    plannerTitle: 'Palworld Breeding Calculator & Planner | Palaxis',
    plannerDescription: 'Build an optimal Palworld breeding tree from your own collection. Compare fastest, easiest, and collection-only routes with passives included.',
    quickTitle: 'Palworld Breeding Combos & Quick Path Finder | Palaxis',
    quickDescription: 'Find a direct Palworld breeding combination or the shortest path to any Pal in seconds.',
    palsTitle: 'Palworld Paldex: All Pals, Stats & Breeding Combos | Palaxis',
    palsDescription: 'Browse every Palworld Pal with elements, work suitability, breeding power, best passives, drops, habitats, and direct breeding combinations.',
    tiersTitle: 'Palworld Tier List: Combat, Work & Mounts | Palaxis',
    tiersDescription: 'Data-driven Palworld tier lists for combat, base work, ground mounts, flying mounts, and every work suitability.',
    feedbackTitle: 'Palaxis Feedback, Changelog & Updates',
    feedbackDescription: 'Report a bug, suggest a Palaxis feature, and review the latest updates to the Palworld breeding companion.',
  },
  es: {
    homeTitle: 'Palaxis — Calculadora de crianza y companion de Palworld',
    homeDescription: 'Planifica rutas óptimas de crianza en Palworld, compara alternativas, gestiona tu colección y descubre las mejores pasivas para cada Pal.',
    plannerTitle: 'Calculadora y planificador de crianza de Palworld | Palaxis',
    plannerDescription: 'Crea un árbol de crianza óptimo usando tu colección. Compara rutas rápidas, fáciles y exclusivas de tu colección con pasivas incluidas.',
    quickTitle: 'Combinaciones de crianza y rutas rápidas de Palworld | Palaxis',
    quickDescription: 'Encuentra una combinación directa de crianza o el camino más corto para conseguir cualquier Pal en segundos.',
    palsTitle: 'Paldex de Palworld: Pals, estadísticas y cruces | Palaxis',
    palsDescription: 'Consulta todos los Pals de Palworld con elementos, habilidades de trabajo, poder de crianza, pasivas, drops, hábitats y cruces directos.',
    tiersTitle: 'Tier List de Palworld: combate, trabajo y monturas | Palaxis',
    tiersDescription: 'Tier lists de Palworld basadas en datos para combate, trabajo en base, monturas terrestres y voladoras y cada habilidad de trabajo.',
    feedbackTitle: 'Feedback, cambios y novedades de Palaxis',
    feedbackDescription: 'Reporta errores, sugiere funciones y consulta las últimas novedades del companion de crianza de Palworld.',
  },
} as const

function pageDescriptor(pathname: string, lang: Lang): SeoDescriptor {
  const text = copy[lang]
  const url = absolutePath(pathname, lang)
  const website = { '@type': 'WebSite', '@id': `${SITE_URL}/#website`, name: 'Palaxis', url: SITE_URL, inLanguage: lang }

  if (pathname.startsWith('/pals/')) {
    const slug = pathname.slice('/pals/'.length)
    const db = loadDatabase()
    const palId = buildSlugIndex(db.pals).get(slug)
    const pal = palId ? db.palById.get(palId) : null
    if (pal) {
      const name = palName(pal)
      const title = lang === 'es' ? `Cómo criar a ${name} en Palworld | Palaxis` : `How to Breed ${name} in Palworld | Palaxis`
      const description = lang === 'es'
        ? `Descubre cómo criar a ${name} en Palworld: mejores pasivas, poder de crianza, habilidades de trabajo y todas sus combinaciones directas.`
        : `Learn how to breed ${name} in Palworld, including its best passives, breeding power, work suitability, and every direct breeding combination.`
      const image = `${SITE_URL}/pals/${encodeURIComponent(pal.id)}.png`
      return {
        title,
        description,
        type: 'article',
        image,
        structuredData: {
          '@context': 'https://schema.org',
          '@graph': [
            website,
            {
              '@type': 'Article',
              headline: title,
              name,
              description,
              url,
              image,
              inLanguage: lang,
              isPartOf: { '@id': `${SITE_URL}/#website` },
              about: { '@type': 'Thing', name: `${name} — Palworld` },
            },
            {
              '@type': 'BreadcrumbList',
              itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Palaxis', item: absolutePath('/', lang) },
                { '@type': 'ListItem', position: 2, name: 'Paldex', item: absolutePath('/pals', lang) },
                { '@type': 'ListItem', position: 3, name, item: url },
              ],
            },
          ],
        },
      }
    }
  }

  const routeCopy = pathname === '/planner'
    ? [text.plannerTitle, text.plannerDescription]
    : pathname === '/rapido'
      ? [text.quickTitle, text.quickDescription]
      : pathname === '/pals'
        ? [text.palsTitle, text.palsDescription]
        : pathname === '/tiers'
          ? [text.tiersTitle, text.tiersDescription]
          : pathname === '/feedback'
            ? [text.feedbackTitle, text.feedbackDescription]
            : [text.homeTitle, text.homeDescription]
  const [title, description] = routeCopy
  const pageType = pathname === '/pals' ? 'CollectionPage' : 'WebPage'
  const graph: Record<string, unknown>[] = [website, {
    '@type': pageType,
    name: title,
    description,
    url,
    inLanguage: lang,
    isPartOf: { '@id': `${SITE_URL}/#website` },
  }]

  if (pathname === '/') {
    graph.push({
      '@type': 'SoftwareApplication',
      name: 'Palaxis',
      url: SITE_URL,
      description,
      applicationCategory: 'GameApplication',
      applicationSubCategory: 'Palworld breeding planner',
      operatingSystem: 'Web',
      browserRequirements: 'Requires JavaScript. Works offline after the first visit.',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      featureList: ['Breeding route comparison', 'Collection tracking', 'Pal database', 'Tier lists', 'Offline planning'],
    })
  }

  return {
    title,
    description,
    type: 'website',
    structuredData: { '@context': 'https://schema.org', '@graph': graph },
  }
}

function upsertMeta(selector: string, attributes: Record<string, string>) {
  let element = document.head.querySelector<HTMLMetaElement>(selector)
  if (!element) {
    element = document.createElement('meta')
    document.head.appendChild(element)
  }
  Object.entries(attributes).forEach(([name, value]) => element!.setAttribute(name, value))
}

function upsertLink(selector: string, attributes: Record<string, string>) {
  let element = document.head.querySelector<HTMLLinkElement>(selector)
  if (!element) {
    element = document.createElement('link')
    document.head.appendChild(element)
  }
  Object.entries(attributes).forEach(([name, value]) => element!.setAttribute(name, value))
}

export function syncDocumentSeo(pathname: string, lang: Lang) {
  const cleanPath = stripLocalePrefix(pathname)
  const descriptor = pageDescriptor(cleanPath, lang)
  const canonical = absolutePath(cleanPath, lang)
  const image = descriptor.image ?? SOCIAL_IMAGE

  document.documentElement.lang = lang
  document.title = descriptor.title
  upsertMeta('meta[name="description"]', { name: 'description', content: descriptor.description })
  upsertMeta('meta[name="robots"]', { name: 'robots', content: 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1' })
  upsertMeta('meta[property="og:type"]', { property: 'og:type', content: descriptor.type })
  upsertMeta('meta[property="og:url"]', { property: 'og:url', content: canonical })
  upsertMeta('meta[property="og:title"]', { property: 'og:title', content: descriptor.title })
  upsertMeta('meta[property="og:description"]', { property: 'og:description', content: descriptor.description })
  upsertMeta('meta[property="og:locale"]', { property: 'og:locale', content: lang === 'es' ? 'es_ES' : 'en_US' })
  upsertMeta('meta[property="og:image"]', { property: 'og:image', content: image })
  upsertMeta('meta[property="og:image:alt"]', { property: 'og:image:alt', content: `${descriptor.title} — Palaxis` })
  upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: descriptor.title })
  upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: descriptor.description })
  upsertMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: image })
  upsertMeta('meta[name="twitter:image:alt"]', { name: 'twitter:image:alt', content: `${descriptor.title} — Palaxis` })
  upsertLink('link[rel="canonical"]', { rel: 'canonical', href: canonical })
  upsertLink('link[rel="alternate"][hreflang="en"]', { rel: 'alternate', hreflang: 'en', href: absolutePath(cleanPath, 'en') })
  upsertLink('link[rel="alternate"][hreflang="es"]', { rel: 'alternate', hreflang: 'es', href: absolutePath(cleanPath, 'es') })
  upsertLink('link[rel="alternate"][hreflang="x-default"]', { rel: 'alternate', hreflang: 'x-default', href: absolutePath(cleanPath, 'en') })

  let script = document.getElementById(SEO_SCRIPT_ID) as HTMLScriptElement | null
  if (!script) {
    script = document.createElement('script')
    script.id = SEO_SCRIPT_ID
    script.type = 'application/ld+json'
    document.head.appendChild(script)
  }
  script.textContent = JSON.stringify(descriptor.structuredData).replace(/</g, '\\u003c')
}
