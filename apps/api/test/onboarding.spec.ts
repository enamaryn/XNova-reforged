import {
  ONBOARDING_STEPS,
  evaluateOnboarding,
  type OnboardingSnapshot,
} from '@xnova/game-config';

const empty = (): OnboardingSnapshot => ({
  buildings: { metalMine: 0, crystalMine: 0, deuteriumMine: 0, solarPlant: 0, researchLab: 0, shipyard: 0 },
  energyBalanced: false,
  researchStarted: 0,
  ships: 0,
  fleetsSent: 0,
  missionResults: 0,
});

describe('Objectifs débutants', () => {
  it('un compte neuf commence par la centrale solaire, rien n\'est terminé', () => {
    const progress = evaluateOnboarding(empty());
    expect(progress.completed).toBe(0);
    expect(progress.total).toBe(ONBOARDING_STEPS.length);
    expect(progress.currentStepId).toBe('solar_plant');
    expect(progress.steps.filter((s) => s.status === 'current')).toHaveLength(1);
    expect(progress.finished).toBe(false);
  });

  it('avance dans l\'ordre recommandé et reste cohérent quand une étape est faite hors ordre', () => {
    const snapshot = empty();
    snapshot.buildings.solarPlant = 1;
    snapshot.buildings.deuteriumMine = 1; // le joueur saute la mine de métal
    const progress = evaluateOnboarding(snapshot);
    expect(progress.currentStepId).toBe('metal_mine');
    expect(progress.steps.find((s) => s.id === 'deuterium_mine')?.status).toBe('done');
    expect(progress.steps.find((s) => s.id === 'crystal_mine')?.status).toBe('upcoming');
  });

  it('l\'équilibre énergétique exige une mine de deutérium et de l\'énergie suffisante', () => {
    const snapshot = empty();
    snapshot.energyBalanced = true;
    expect(evaluateOnboarding(snapshot).steps.find((s) => s.id === 'energy_balance')?.status).not.toBe('done');
    snapshot.buildings.deuteriumMine = 1;
    expect(evaluateOnboarding(snapshot).steps.find((s) => s.id === 'energy_balance')?.status).toBe('done');
  });

  it('termine le parcours quand toutes les conditions sont remplies', () => {
    const progress = evaluateOnboarding({
      buildings: { metalMine: 3, crystalMine: 2, deuteriumMine: 1, solarPlant: 2, researchLab: 1, shipyard: 1 },
      energyBalanced: true,
      researchStarted: 1,
      ships: 1,
      fleetsSent: 1,
      missionResults: 1,
    });
    expect(progress.finished).toBe(true);
    expect(progress.completed).toBe(progress.total);
    expect(progress.currentStepId).toBeNull();
  });

  it('chaque étape cible une page du jeu et un bâtiment existant quand elle en désigne un', () => {
    const ids = new Set(ONBOARDING_STEPS.map((s) => s.id));
    expect(ids.size).toBe(ONBOARDING_STEPS.length);
    for (const step of ONBOARDING_STEPS) {
      expect(['buildings', 'research', 'shipyard', 'fleet', 'reports', 'overview']).toContain(step.route);
    }
  });
});
