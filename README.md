# Palaxis — Palworld Breeding Nexus

> Consulta [CHANGELOG.md](./CHANGELOG.md) para las notas completas de la
> version actual de **Palaxis**: coleccion, Paldex, proyectos, rutas,
> rendimiento, experiencia movil y lanzamiento.

Planificador de crianza para Palworld. Le dices qué Pal quieres, qué pasivas quieres que lleve y qué Pals tienes ya en la caja, y calcula el árbol de cruces óptimo mediante búsqueda en grafos.

**Funciona 100 % sin conexión**: toda la base de datos va incluida como JSON estático. No hay backend, ni API, ni telemetría.

```bash
npm install
npm run data:icons   # descarga los sprites de los 299 Pals a public/pals
npm run dev
```

Si te saltas `data:icons` la app funciona igual: donde iría el sprite aparece un monograma con las iniciales del Pal.

---

## Qué incluye

| | |
|---|---|
| Pals | 299 (todos los del Paldex actual, incluidas variantes) |
| Parejas de crianza | 44.849 resultados reproducidos **exactamente** |
| Combinaciones únicas | 232 + 2 que dependen del sexo |
| Pasivas | 115, con nombre **y efecto** en español e inglés |
| Peso de la base de datos | ~96 kB |
| Sprites | 299 PNG de 100×100 (~4,8 MB, en `public/pals/`) |

### Sobre la versión de los datos

Los datos provienen de la tabla `v27` extraída del juego, que es un **superconjunto** de Palworld 1.0: incluye todo lo de 1.0 más lo añadido en parches posteriores (Feybreak, Palfarm, colaboraciones). Si necesitas restringirlo a un parche concreto, filtra `src/data/pals.json` por `dex` y vuelve a ejecutar `npm run data:verify`.

---

## Cómo se resuelve "padre A + padre B = ?"

El juego usa un número oculto por especie, el **CombiRank** (`power` en `pals.json`):

1. Si la pareja está en la tabla de **combinaciones únicas**, manda esa.
2. Si no: `objetivo = floor((powerA + powerB + 1) / 2)`, y la cría es el Pal cuyo CombiRank queda más cerca.

El paso 2 tiene excepciones de desempate que no se documentan en ningún sitio. En lugar de adivinarlas, `scripts/build-data.mjs` **deriva** la tabla `objetivo → hijo` (616 entradas) a partir de la tabla completa del juego y luego **verifica** que la versión compacta reproduce las 44.849 parejas una por una. Si falla aunque sea una, el script aborta.

```bash
npm run data:verify
# Parejas revisadas: 44851
# OK: la base de datos compacta coincide al 100% con la tabla del juego.
```

## Cómo se calculan las probabilidades

Pesos reales del juego (`DT_PalCombiInheritance`):

- Se juntan las pasivas de ambos padres en un bote sin repetidos.
- Se hereda **1** (40 %), **2** (30 %), **3** (20 %) o **4** (10 %), elegidas al azar del bote.
- Aparte se añaden **0** (40 %), **1** (30 %), **2** (20 %) o **3** (10 %) pasivas aleatorias.

De ahí sale la probabilidad de que una cría concreta traiga las `want` pasivas deseadas cuando el bote tiene `pool`:

```
P = Σ_k  peso(k) · C(pool − want, k − want) / C(pool, k)
```

Los "huevos estimados" de cada paso son `1 / P` (valor esperado, no un máximo).

---

## El algoritmo

Búsqueda en un hipergrafo, donde cada arista toma **dos** nodos y produce uno:

```
estado = (especie, máscara de pasivas deseadas que porta)
```

Con 4 pasivas como máximo hay 16 máscaras → 299 × 16 = **4.784 estados**.

Se usa **Dijkstra generalizado a hiperaristas** (algoritmo de Knuth para *superior functions*), válido porque cada paso cuesta estrictamente más que cualquiera de sus dos padres:

```
coste(hijo) = coste(padreA) + coste(padreB) + costePaso     costePaso > 0
```

Se extrae el estado pendiente más barato, se marca como definitivo y se combina con todos los ya definitivos. Cuando el objetivo se marca como definitivo, su ruta es óptima. Explorar el espacio entero cuesta ~250 ms, así que corre en un **Web Worker** y se recalcula solo (con *debounce*) cada vez que cambia cualquier entrada.

A* sería posible con una heurística admisible, pero con 4.784 estados Dijkstra ya termina en milisegundos y evita el riesgo de una heurística mal calibrada.

### Modos

El eje no es "rápido vs fácil" sino **cuánto estás dispuesto a capturar**. Un árbol con menos generaciones no sirve de nada si te manda cazar un boss de nivel 74.

| Modo | Qué puede capturar | Qué optimiza |
|---|---|---|
| **Solo mi colección** | Nada | Parte únicamente de tus Pals. |
| **Full breeding** | Solo Pals accesibles | Minimiza huevos. Los bosses y todo lo de nivel alto hay que **criarlo**, aunque el árbol salga más largo. |
| **Breeding + captura** | Cualquier cosa | Minimiza **generaciones**, dando por hecho que puedes cazar lo que sea. |

Caso real, Eidrolon con Beakon + Direhowl:

| | Generaciones | Huevos | Capturas |
|---|---|---|---|
| Full breeding | 5 | 8,3 | Cryolinx (nv42), Whalaska (nv42), Blazehowl (nv30), Dualith (nv46) |
| Breeding + captura | 3 | 5 | Cryolinx (nv42) + **Orserk (nv74)** |

### Dónde está la frontera

Un Pal es "accesible" si tiene **rareza < 9 y nivel salvaje < 50** (`isEasyToCatch` en `cost.ts`). Está calibrado con los datos, no a ojo: la dificultad de captura es un continuo sin corte natural (Orserk 0,57 · Cryolinx 0,37 · Beakon 0,30 · comunes ~0,00), así que el límite se pone sobre las dos señales interpretables. Rareza ≥ 8 sería demasiado —dejaría fuera a Kingpaca (nv 23) o Mammorest (nv 26), que no son bosses—; con rareza ≥ 9 caen Orserk, Blazamut, Anubis, Shadowbeak y los legendarios, y con nivel ≥ 50 caen Eidrolon (65), Jormuntide (55), Aegidron (79) y Bastigor (75).

Hay Pals que **no se pueden criar desde otras especies**: Orserk, Grizzbolt, Jetragon y compañía solo salen de la captura o de cruzar dos iguales. Si pides uno de ellos en Full breeding, la app lo detecta antes de buscar y te ofrece cambiar de modo de un clic, en vez de darte un "no hay ruta" a secas.

"Breeding + captura" ordena por `(profundidad, coste)` de forma lexicográfica: el coste por paso solo minimizaría el *número* de cruces, que no es lo mismo que las generaciones — un árbol equilibrado de 7 cruces tiene menos generaciones que una cadena de 5.

Los pesos y umbrales de cada modo están en un único sitio, `src/domain/breeding/cost.ts`.

### Supuestos (a propósito, y documentados)

- Una cría intermedia se considera **limpia**: se asume que sigues incubando hasta sacar una que solo lleve las pasivas objetivo. Sin esto el bote crecería sin control.
- Un Pal **capturado** se considera sin pasivas útiles (~20 % de los salvajes salen con 0). Por eso las pasivas solo pueden entrar en el árbol a través de tu colección.
- El sexo solo se modela en las dos combinaciones que lo exigen.
- Cada Pal de tu colección se usa **como máximo una vez** en todo el árbol (control por máscara de bits, hasta 30 ejemplares).
- Si tienes dos ejemplares idénticos de la misma especie con las mismas pasivas, el planificador solo cuenta con uno.

---

## Estructura

## El selector de pasivas

Cada fila muestra el efecto real del juego bajo el nombre (`Maestría trascendental` → `Vel. de trabajo +75%`), y al pasar el ratón o navegar con el teclado, el panel inferior despliega el efecto completo con su rango. El resumen va siempre visible en la fila porque en el móvil no hay hover, y el buscador filtra también por efecto: escribir "trabajo" saca todas las que lo afectan.

## El árbol

Se dibuja como un diagrama de nodos de arriba abajo: **el objetivo va arriba con corona** y de él cuelgan, unidos por líneas, los dos padres que lo producen. La unión de las dos ramas lleva un `+` para que se lea como "este `+` este `=` el de arriba".

Cada tarjeta dice de dónde sale el Pal sin ambigüedad: `TU OBJETIVO`, `CRIAR · PASO N`, `YA LO TIENES` o `CAPTURAR NV x-y`, con color propio. Los nodos de crianza se pliegan (muestran "+ N cruces ocultos") y hay zoom del 50 % al 120 % para ver árboles grandes de un vistazo.

Dos detalles de maquetación que importan:

- Las ramas usan **ancho natural**, no columnas iguales. Forzarlas iguales centra el hijo exactamente entre sus padres, pero duplica el ancho en cada nivel: el mismo árbol pasaba de 1.520 px a 3.568 px. Con ancho natural el hijo se centra sobre su fila, y como el centro de la fila siempre cae entre los centros de los dos padres, el tronco aterriza siempre sobre la barra.
- El contenedor es `w-max min-w-full` dentro de un `overflow-x-auto`. Con `flex justify-center` a secas el desbordamiento no se puede desplazar y el árbol se recortaba.

```
scripts/
  build-data.mjs        descarga, deriva y verifica la base de datos
  verify-data.mjs       revalida src/data contra la tabla completa del juego
  fetch-icons.mjs       descarga los sprites a public/pals
src/
  data/                 pals · breeding · passives · mechanics  (JSON estático)
  domain/
    types.ts            tipos compartidos (sin React ni DOM)
    database.ts         carga e indexado
    projects.ts         guardar / cargar / exportar proyectos
    breeding/
      resolver.ts       padre + padre = hijo
      inheritance.ts    probabilidades de herencia
      cost.ts           función de coste y modos
      planner.ts        la búsqueda
      planner.worker.ts worker
  state/                contexto + reducer
  hooks/use-planner.ts  recálculo automático
  features/             setup · collection · plan · projects
  components/ui/        shadcn/ui (Radix + Tailwind v4)
```

La UI nunca toca la base de datos directamente: pasa siempre por `domain/`. Eso es lo que permite cambiar la fuente de datos, añadir un importador de partidas o meter un algoritmo distinto sin tocar los componentes.

---

## Actualizar la base de datos

Cuando salga un parche con Pals o recetas nuevas:

```bash
npm run data:build      # descarga, deriva y verifica
npm test                # 27 tests sobre resolución, probabilidades y planificador
```

No hay nada codificado a mano en `src/data`. Si un parche cambia un CombiRank, la verificación lo detecta antes de que la app dé una receta falsa.

## Extensiones previstas

La arquitectura ya deja hueco para:

- **Importar la colección** desde una partida guardada — `OwnedPal[]` es el único contrato que hace falta cumplir.
- **Proyectos** — ya implementado: guardar, cargar, exportar e importar JSON versionado (`PROJECT_FORMAT`).
- **IVs** — `mechanics.json` ya trae `ivInheritanceWeights`; falta añadirlos al estado y al coste.

---

## Comandos

```bash
npm run dev          # servidor de desarrollo
npm run build        # build de producción
npm test             # tests
npm run typecheck    # comprobación de tipos
npm run data:build   # regenerar la base de datos
npm run data:verify  # verificar la base de datos
npm run data:icons   # descargar los sprites que falten (--force para todos)
```

## Créditos

Las tablas de crianza y los sprites provienen del proyecto [PalCalc](https://github.com/tylercamp/palcalc), que los extrae directamente de los archivos del juego. Palworld y sus sprites son propiedad de Pocketpair, Inc.; este proyecto no está afiliado con ellos.
