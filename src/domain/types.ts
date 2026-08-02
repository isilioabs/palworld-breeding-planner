/** Tipos del dominio. No dependen de React ni del DOM: se usan tambien en el worker. */

export interface Pal {
  /** Nombre interno del juego. Es la clave primaria en toda la app. */
  id: string
  name: string
  nameEs: string
  dex: number
  variant: boolean
  index: number
  /** CombiRank: la "potencia de crianza" oculta. Mas bajo = mas raro/fuerte. */
  power: number
  priority: number
  rarity: number
  price: number
  /** [nivel min, nivel max] si aparece en estado salvaje; null si no se captura. */
  wild: [number, number] | null
  female: number
  nocturnal: boolean
  /** Las 2 aptitudes de trabajo mas altas (no nulas), de mayor a menor. */
  work: { type: WorkType; value: number }[]
  /**
   * Elemento(s) del Pal (1 o 2). Fuente: palpedia.com, no PalCalc (ver
   * scripts/build-data.mjs). Puramente cosmetico. Vacio si no se pudo enlazar
   * con esa fuente (p.ej. los monstruos del crossover de Terraria).
   */
  elements: ElementType[]
}

export type ElementType = 'neutral' | 'fire' | 'water' | 'grass' | 'electric' | 'ice' | 'ground' | 'dark' | 'dragon'

/** Tipos de trabajo del juego, tal cual los usa WorkSuitability. */
export type WorkType =
  | 'Kindling'
  | 'Watering'
  | 'Planting'
  | 'GenerateElectricity'
  | 'Handiwork'
  | 'Gathering'
  | 'Lumbering'
  | 'Mining'
  | 'MedicineProduction'
  | 'Cooling'
  | 'Transporting'
  | 'Farming'

export interface Passive {
  id: string
  name: string
  nameEs: string
  /** Efecto en juego ("Work Speed +75%"). Varias lineas separadas por \n. */
  desc: string
  descEs: string
  /** -3..5. Positivo = beneficioso. */
  rank: number
  randomInheritable: boolean
}

export interface BreedingData {
  /** CombiRank objetivo -> id del Pal hijo. */
  rankToChild: Record<string, string>
  /** [padreA, padreB, hijo]. Tienen prioridad sobre rankToChild. */
  unique: [string, string, string][]
  /** [padreA, sexoA, padreB, sexoB, hijo]. */
  genderUnique: [string, Gender, string, Gender, string][]
}

export type Gender = 'MALE' | 'FEMALE'

export interface Mechanics {
  generatedAt: string
  sourceVersion: string
  sourceRepo: string
  maxPassives: number
  passiveInheritanceWeights: Record<string, number>
  passiveRandomWeights: Record<string, number>
  ivInheritanceWeights: Record<string, number>
  counts: {
    pals: number
    passives: number
    rankEntries: number
    uniqueCombos: number
    genderCombos: number
    verifiedPairs: number
  }
}

/** Un Pal concreto de la coleccion del jugador. */
export interface OwnedPal {
  uid: string
  palId: string
  passives: string[]
  gender?: Gender
}

export type PlannerMode = 'collection' | 'breeding' | 'hybrid'

export interface PlannerOptions {
  /** Limite duro de estados expandidos, para acotar el tiempo de busqueda. */
  maxSettled: number
  /** Tiempo maximo de busqueda en milisegundos. */
  timeBudgetMs: number
}

export interface PlannerInput {
  targetPalId: string | null
  desiredPassives: string[]
  owned: OwnedPal[]
  mode: PlannerMode
  options?: Partial<PlannerOptions>
}

/** Origen de un Pal dentro del plan. */
export type SourceKind = 'owned' | 'capture' | 'breed'

export interface PlanNode {
  /** Identificador estable del nodo dentro del arbol (para expandir/plegar). */
  key: string
  palId: string
  /** Pasivas deseadas que este Pal debe portar. */
  passives: string[]
  kind: SourceKind
  /** Solo para kind === 'owned'. */
  ownedUid?: string
  /** Solo para kind === 'breed'. */
  parents?: [PlanNode, PlanNode]
  /** Probabilidad de que una cria concreta salga con todas las pasivas pedidas. */
  successChance?: number
  /** Huevos esperados para este paso (1 / successChance). */
  expectedEggs?: number
  /** Tamano del "bote" de pasivas de los dos padres (afecta a la probabilidad). */
  poolSize?: number
  /** Restriccion de sexo para las combinaciones que la exigen. */
  genderRequirement?: { a: Gender; b: Gender }
  /** Este subarbol ya aparece en otra rama: se puede reutilizar el mismo Pal. */
  duplicateOf?: string
  /** Profundidad: 0 = el objetivo. */
  depth: number
}

export interface PlanResult {
  ok: boolean
  reason?: string
  /** Pasivas deseadas que ningun Pal de la coleccion puede aportar. */
  missingPassives?: string[]
  /** Modo con el que si podria haber ruta, para ofrecerlo de un clic. */
  suggestMode?: PlannerMode
  root?: PlanNode
  stats?: {
    steps: number
    generations: number
    totalExpectedEggs: number
    capturesNeeded: number
    ownedUsed: number
    /** Probabilidad de completar toda la ruta si cada paso sale a la primera. */
    combinedChance: number
    settledStates: number
    elapsedMs: number
  }
}
