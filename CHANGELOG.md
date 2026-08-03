# Novedades de PalBreed

## RC 1 - Companion App

Esta version transforma el planificador en una companion app local-first para
Palworld. No envia la coleccion, los planes ni los datos de juego a un servidor.

### Planificador y rutas

- Comparacion inmediata de rutas alternativas con generaciones, huevos,
  capturas, legendarios, esfuerzo esperado y una recomendacion.
- Multi-Target Planner: varios objetivos se resuelven en un mismo proyecto y
  reutilizan ramas y padres intermedios cuando es posible.
- Breeding Projects persistentes: objetivos, progreso, reproductores y ahorro
  de recursos en un unico flujo.
- Recetas directas visibles antes de anadir restricciones, para empezar rapido.

### Coleccion y Paldex

- Coleccion persistente de ejemplares con especie, genero, pasivas, favorito y
  notas; preparada para IVs, condensacion, Alpha y Lucky.
- Vista Paldex con busqueda, filtros, favoritos, recientes y Pals faltantes.
- Ficha lateral integrada para cada Pal: elemento, aptitudes de trabajo,
  pasivas, recetas, builds, estado de propiedad y relaciones.
- Importacion local de JSON, revision asistida con capturas y deteccion de JSON
  dentro de una carpeta de mundo. Se preservan varios ejemplares de la misma
  especie como reproductores distintos.

### Experiencia de uso

- Selector visual estilo Paldex para objetivos y coleccion, con busqueda y
  filtro por elemento.
- Selector de pasivas por tiers: arcoiris, doradas, grises y negativas.
- Arbol de crianza optimizado para paneo, zoom y arboles grandes; las tarjetas
  usan un modo compacto que conserva retratos y pasivas legibles.
- Animaciones de aparicion, lineas y tarjetas, estados de carga, tooltips y
  controles tactiles coherentes con `prefers-reduced-motion`.
- Sidebar organizado en secciones desplegables y navegacion movil con drawer
  inferior.

### Producto y lanzamiento

- Landing page, onboarding de primera visita y proyecto demo de Anubis.
- Marca simplificada a **PalBreed**; el logotipo del planner regresa a la
  landing page sin perder los datos locales.
- Metadatos SEO, Open Graph, manifest, favicon, robots y sitemap.
- Compartir plan, feedback enlazado a GitHub, changelog y eventos de analitica
  local-first preparados para Plausible.

### Validacion

- TypeScript estricto, 37 pruebas automatizadas y build de produccion con Vite.
- La importacion de `.sav` binarios no se hace en el navegador: requiere un
  conversor local especifico que exporte JSON. Los saves no se suben a ningun
  servicio.

