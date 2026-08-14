# Palaxis SEO architecture

## Indexable URL strategy

- English is the default and `x-default` version: `/`, `/pals`, `/pals/<slug>`, `/tiers`, `/planner`, `/rapido`, `/feedback`.
- Spanish uses a stable `/es` prefix with the same route structure.
- Every indexable page contains a self-referencing canonical plus reciprocal `hreflang="en"`, `hreflang="es"`, and `hreflang="x-default"` links.
- Browser language detection still personalizes the first visit. Choosing a language updates the visible URL so it remains shareable and indexable.

## Build output

`npm run build` prerenders 305 routes in both languages, producing 610 canonical HTML pages. The generated sitemap contains the same reciprocal language alternates.

Each generated page includes:

- A unique title and meta description.
- Canonical and language alternate links.
- Open Graph and X/Twitter metadata.
- Visible semantic HTML before React loads.
- JSON-LD appropriate to the route.

Pal detail pages additionally include Pal artwork, `Article`, and `BreadcrumbList` structured data.

## Post-deployment checklist

1. Verify `https://palaxis.app/robots.txt` and `https://palaxis.app/sitemap.xml` return HTTP 200.
2. Submit `https://palaxis.app/sitemap.xml` in Google Search Console and Bing Webmaster Tools.
3. Inspect `/`, `/es`, `/pals/anubis`, and `/es/pals/anubis` with Search Console URL Inspection.
4. Test representative pages with Google's Rich Results Test and Schema.org Validator.
5. Request indexing for the homepage, Paldex, tier list, and one Pal page in each language. The sitemap handles the remaining URLs.
6. Monitor indexed pages, duplicate canonical warnings, Core Web Vitals, search queries, and click-through rate after deployment.

Official references:

- https://developers.google.com/search/docs/fundamentals/get-started-developers
- https://developers.google.com/search/docs/advanced/crawling/localized-versions
- https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data
