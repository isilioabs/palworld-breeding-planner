# Novedades de Palaxis

## Rendimiento y carga por rutas

- Landing, planner, Quick Path, Paldex, Tier List, feedback y onboarding se cargan como modulos independientes.
- El arbol, la comparacion de rutas y el panel Paldex ya no se descargan antes de abrir el planner.
- Estadisticas, lore, drops, Partner Skills y tiers de montura viven en un dataset avanzado bajo demanda.
- El bundle principal baja de aproximadamente 852 kB a 244 kB y queda protegido por presupuestos gzip automaticos durante el build.
- Una pantalla bilingue de recuperacion evita estados en blanco si un archivo cambia durante un deploy o una vista falla inesperadamente.
- El cache offline avanza a una nueva version para retirar recursos antiguos de forma segura tras publicar.

## SEO internacional

- Paginas prerenderizadas en ingles y espanol para landing, planner, Quick Path, Paldex, Tier List, feedback y las 299 fichas de Pal.
- Canonical y `hreflang` reciprocos, junto a un sitemap localizado de 610 URLs.
- Titulos, descripciones, Open Graph/X, JSON-LD, arte del Pal y breadcrumbs especificos por ruta.
- Social card PNG e iconos PWA instalables de 192 y 512 px.
- Jerarquia de encabezados corregida para que el contenido de cada pagina tenga el H1 principal.

## Axis Core - nueva identidad visual

- Nuevo simbolo vectorial Axis Core para el producto, favicon, PWA y tarjetas sociales.
- Wordmark PALAXIS con tipografia tecnica Oxanium y acento cyan en el eje central.
- Sistema cromatico unificado: negro `#050A0E`, teal `#6CD9CC`, cyan `#42E7E0`, dorado `#F1C653` y blanco `#F4F6F2`.
- Marca responsive y ligera: un mismo SVG funciona desde 16 px hasta el fondo del hero, sin imagenes raster pesadas.
- Header, landing, estados vacios y planner comparten ahora la misma identidad.

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
- Marca simplificada a **Palaxis**; el logotipo del planner regresa a la
  landing page sin perder los datos locales.
- Metadatos SEO, Open Graph, manifest, favicon, robots y sitemap.
- Compartir plan, feedback enlazado a GitHub, changelog y eventos de analitica
  local-first preparados para Plausible.

### Validacion

- TypeScript estricto, 37 pruebas automatizadas y build de produccion con Vite.
- La importacion de `.sav` binarios no se hace en el navegador: requiere un
  conversor local especifico que exporte JSON. Los saves no se suben a ningun
  servicio.
