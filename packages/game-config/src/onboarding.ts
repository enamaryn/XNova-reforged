// Objectifs débutants : étapes ordonnées du premier cycle joueur.
// Logique pure (aucune dépendance à la base) : l'API fournit un instantané de l'état du joueur.

/** Instantané minimal de l'état d'un joueur, agrégé sur toutes ses planètes. */
export interface OnboardingSnapshot {
  /** Niveau maximal de chaque bâtiment, toutes planètes confondues. */
  buildings: {
    metalMine: number
    crystalMine: number
    deuteriumMine: number
    solarPlant: number
    researchLab: number
    shipyard: number
  }
  /** Une planète a de l'énergie pour toutes ses mines (production à 100 %). */
  energyBalanced: boolean
  /** Nombre de technologies de niveau ≥ 1 ou en cours de recherche. */
  researchStarted: number
  /** Vaisseaux possédés (au sol ou en vol). */
  ships: number
  /** Flottes envoyées au moins une fois. */
  fleetsSent: number
  /** Une mission a abouti : rapport d'espionnage ou de combat, ou flotte rentrée/en retour. */
  missionResults: number
}

export type OnboardingStepId =
  | 'solar_plant'
  | 'metal_mine'
  | 'crystal_mine'
  | 'deuterium_mine'
  | 'energy_balance'
  | 'research_lab'
  | 'first_research'
  | 'shipyard'
  | 'first_ship'
  | 'first_mission'
  | 'mission_report'

export type OnboardingRoute =
  | 'buildings'
  | 'research'
  | 'shipyard'
  | 'fleet'
  | 'reports'
  | 'overview'

export interface OnboardingStepDefinition {
  id: OnboardingStepId
  /** Page du jeu où réaliser l'étape. */
  route: OnboardingRoute
  /** Identifiant du bâtiment ou de la technologie à lancer (pour pointer vers la bonne carte). */
  targetId?: number
  isDone: (snapshot: OnboardingSnapshot) => boolean
}

/** Ordre recommandé : énergie d'abord (sans elle les mines tournent au ralenti), puis les trois mines. */
export const ONBOARDING_STEPS: readonly OnboardingStepDefinition[] = [
  { id: 'solar_plant', route: 'buildings', targetId: 4, isDone: (s) => s.buildings.solarPlant >= 1 },
  { id: 'metal_mine', route: 'buildings', targetId: 1, isDone: (s) => s.buildings.metalMine >= 1 },
  { id: 'crystal_mine', route: 'buildings', targetId: 2, isDone: (s) => s.buildings.crystalMine >= 1 },
  { id: 'deuterium_mine', route: 'buildings', targetId: 3, isDone: (s) => s.buildings.deuteriumMine >= 1 },
  {
    id: 'energy_balance',
    route: 'buildings',
    targetId: 4,
    isDone: (s) => s.energyBalanced && s.buildings.deuteriumMine >= 1,
  },
  { id: 'research_lab', route: 'buildings', targetId: 31, isDone: (s) => s.buildings.researchLab >= 1 },
  { id: 'first_research', route: 'research', isDone: (s) => s.researchStarted >= 1 },
  { id: 'shipyard', route: 'buildings', targetId: 21, isDone: (s) => s.buildings.shipyard >= 1 },
  { id: 'first_ship', route: 'shipyard', isDone: (s) => s.ships >= 1 },
  { id: 'first_mission', route: 'fleet', isDone: (s) => s.fleetsSent >= 1 },
  { id: 'mission_report', route: 'reports', isDone: (s) => s.missionResults >= 1 },
]

export type OnboardingStepStatus = 'done' | 'current' | 'upcoming'

export interface OnboardingStep {
  id: OnboardingStepId
  route: OnboardingRoute
  targetId?: number
  status: OnboardingStepStatus
}

export interface OnboardingProgress {
  steps: OnboardingStep[]
  completed: number
  total: number
  /** Étape à réaliser maintenant ; `null` quand tout est terminé. */
  currentStepId: OnboardingStepId | null
  finished: boolean
}

/**
 * Évalue la progression : une étape déjà réalisée reste « terminée » même si une autre précède,
 * l'étape courante est la première non réalisée dans l'ordre recommandé.
 */
export function evaluateOnboarding(snapshot: OnboardingSnapshot): OnboardingProgress {
  let currentFound = false
  const steps = ONBOARDING_STEPS.map<OnboardingStep>((definition) => {
    const done = definition.isDone(snapshot)
    let status: OnboardingStepStatus
    if (done) {
      status = 'done'
    } else if (!currentFound) {
      status = 'current'
      currentFound = true
    } else {
      status = 'upcoming'
    }
    return { id: definition.id, route: definition.route, targetId: definition.targetId, status }
  })

  const completed = steps.filter((step) => step.status === 'done').length
  const current = steps.find((step) => step.status === 'current')
  return {
    steps,
    completed,
    total: steps.length,
    currentStepId: current ? current.id : null,
    finished: completed === steps.length,
  }
}
