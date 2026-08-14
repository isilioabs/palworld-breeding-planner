# Palaxis — Axis Core Brand System

Axis Core is the official Palaxis identity. The approved generated concept board is the visual master reference; the production SVG assets reproduce its geometry and metallic depth without the scaling and background limitations of a raster image. The mark combines three ideas:

- the broken gold ring is the breeding network;
- the cyan core is the selected Pal;
- the vertical teal axis is the optimal route through that network.

## Master palette

| Token | Value | Role |
|---|---|---|
| Ink | `#050A0E` | Main canvas and logo negative space |
| Panel | `#091319` | Elevated application surfaces |
| Teal | `#35C9C4` | Interaction and route axis |
| Cyan | `#62E9DF` | Core, data and active intelligence |
| Gold | `#EAB94F` | Progress, target and premium emphasis |
| White | `#F4F6F2` | Wordmark and primary copy |

The matching CSS variables live at the top of `src/index.css`.

## Typography

- Product UI and display: **Oxanium**, self-hosted in `public/fonts`.
- TCG card names retain **Anton**, where the condensed game-card treatment is intentional.
- The PALAXIS wordmark is custom vector lettering derived from the approved Axis Core concept. It does not depend on a system font; both open A glyphs and the cyan core accent are fixed SVG geometry.

## Assets

- `public/brand/palaxis-mark.svg` — full-color transparent master mark.
- `public/brand/palaxis-mark-mono.svg` — single-color mark for masks and embossing.
- `public/brand/palaxis-lockup.svg` — full horizontal mark and custom vector wordmark.
- `public/favicon.svg` — small-scale mark on the Ink app tile.
- `public/social-card.svg` — Open Graph and social-sharing lockup.
- `src/components/palaxis-mark.tsx` — React mark and wordmark primitives.

## Usage rules

1. Never stretch the mark. Keep a square view box and let the arrow tips project slightly beyond the ring.
2. Keep clear space of at least one central-core radius around the outer silhouette.
3. Use the full-color mark on Ink or Panel. Use the monochrome variant for masks, engraving and one-color reproduction.
4. At 16 px, preserve the ring, axis and center dot; decorative glow is optional and should never affect layout.
5. Gold signals targets, progress or premium moments. Teal remains the primary interactive color.
6. Do not add Pal silhouettes, wings, crowns or official Palworld artwork to the mark.
7. Do not embed the generated concept-board PNG as the site logo. Use it for art direction; use the SVG master assets in production.
