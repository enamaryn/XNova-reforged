import { test, expect } from '@playwright/test';
import { prisma } from '@xnova/database';
import { buildCredentials, registerUser } from './helpers';

/**
 * Premier cycle joueur de bout en bout : inscription → centrale/mines/énergie → laboratoire →
 * recherche → hangar → vaisseau → flotte → rapport de combat, avec le guide d'objectifs de la vue
 * d'ensemble comme fil conducteur.
 *
 * Les règles du serveur restent réelles (coûts débités, prérequis, files, croisières, combat).
 * Seuls deux raccourcis sont pris, car le rythme du jeu est mesuré par ailleurs
 * (`first-cycle-progression.integration.spec.ts`) :
 *   - une dotation unique de ressources au départ ;
 *   - l'échéance des files et du vol est avancée à « maintenant » pour ne pas attendre le temps réel.
 */
const API_URL = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:3001';
const PASSWORD = 'Test1234';

const BUILDINGS = [4, 1, 2, 3, 4, 31, 21, 4]; // centrale, mines, énergie, labo, hangar, centrale
const RESEARCHES = [113, 115];

test.afterAll(async () => {
  await prisma.$disconnect();
});

async function waitFor<T>(label: string, probe: () => Promise<T | null | false>, timeoutMs = 60_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await probe();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Délai dépassé : ${label}`);
}

test('premier cycle complet jusqu\'au rapport de mission', async ({ page, request }) => {
  test.setTimeout(480_000);
  const credentials = buildCredentials('e2e_cycle');
  await registerUser(page, credentials);

  const user = await prisma.user.findUniqueOrThrow({
    where: { username: credentials.username },
    include: { planets: true },
  });
  const planet = user.planets[0];

  // --- 1. Le guide accueille le nouveau joueur
  await page.goto('/overview');
  const guide = page.getByTestId('onboarding-guide');
  await expect(guide).toBeVisible();
  await expect(page.getByTestId('onboarding-progress')).toContainText('0 / 11');
  await expect(page.getByTestId('onboarding-current')).toHaveAttribute('data-step', 'solar_plant');
  await expect(page.getByTestId('help-energy')).toBeVisible();

  // « Y aller » mène à la page des bâtiments
  await guide.getByRole('link').first().click();
  await expect(page).toHaveURL(/\/buildings$/);

  // --- 2. Session API du joueur (mêmes endpoints que l'interface)
  const login = await request.post(`${API_URL}/auth/login`, {
    data: { identifier: credentials.username, password: PASSWORD },
  });
  expect(login.status()).toBe(200);
  const token: string = (await login.json()).tokens.accessToken;
  const headers = { Authorization: `Bearer ${token}` };
  const api = (path: string) => `${API_URL}${path}`;

  // Dotation unique de départ (raccourci documenté ci-dessus)
  await prisma.planet.update({
    where: { id: planet.id },
    data: { metal: 200_000, crystal: 200_000, deuterium: 200_000 },
  });

  const advanceQueues = async () => {
    const now = new Date();
    await prisma.buildQueue.updateMany({ where: { planetId: planet.id, completed: false }, data: { endTime: now } });
    await prisma.researchQueue.updateMany({ where: { userId: user.id, completed: false }, data: { endTime: now } });
    await prisma.shipQueue.updateMany({ where: { planetId: planet.id, completed: false }, data: { endTime: now } });
  };

  const buildOne = async (buildingId: number) => {
    const response = await request.post(api(`/planets/${planet.id}/build`), { headers, data: { buildingId } });
    expect(response.status(), `construction ${buildingId}`).toBe(201);
    const queueId = (await response.json()).queueId;
    await advanceQueues();
    await waitFor(`bâtiment ${buildingId} terminé`, async () =>
      (await prisma.buildQueue.findUnique({ where: { id: queueId } }))?.completed,
    );
  };

  // --- 3. Énergie, mines, équilibre
  for (const id of BUILDINGS.slice(0, 5)) await buildOne(id);
  await page.goto('/overview');
  await expect(page.getByTestId('onboarding-current')).toHaveAttribute('data-step', 'research_lab', { timeout: 30_000 });

  // --- 4. Laboratoire, recherches (l'énergie d'abord, puis la combustion), hangar
  await buildOne(BUILDINGS[5]);
  for (const techId of RESEARCHES) {
    const started = await request.post(api('/research'), { headers, data: { planetId: planet.id, techId } });
    expect(started.status(), `recherche ${techId}`).toBe(201);
    await advanceQueues();
    await waitFor(`recherche ${techId} terminée`, async () =>
      (await prisma.technology.findFirst({ where: { userId: user.id, techId, level: { gte: 1 } } })) !== null,
    );
  }
  await buildOne(BUILDINGS[6]);
  await buildOne(BUILDINGS[7]);

  // --- 5. Premier vaisseau
  const ordered = await request.post(api('/shipyard/build'), {
    headers,
    data: { planetId: planet.id, shipId: 204, amount: 1 },
  });
  expect(ordered.status()).toBe(201);
  await advanceQueues();
  await waitFor('chasseur construit', async () =>
    (await prisma.ship.findFirst({ where: { planetId: planet.id, shipId: 204, amount: { gte: 1 } } })) !== null,
  );

  // --- 6. Première mission : attaque d'une planète abandonnée
  const target = await prisma.planet.findFirstOrThrow({
    where: { user: { username: '__abandoned__' } },
    orderBy: [{ galaxy: 'asc' }, { system: 'asc' }, { position: 'asc' }],
  });
  const sent = await request.post(api('/fleet/send'), {
    headers,
    data: {
      planetId: planet.id,
      toGalaxy: target.galaxy,
      toSystem: target.system,
      toPosition: target.position,
      mission: 1,
      speedPercent: 100,
      ships: { '204': 1 },
    },
  });
  expect(sent.status(), await sent.text()).toBe(201);
  const fleetId: string = (await sent.json()).fleetId;
  await prisma.fleet.update({ where: { id: fleetId }, data: { arrivalTime: new Date() } });

  const report = await waitFor('rapport de combat', async () =>
    prisma.combatReport.findFirst({ where: { attackerId: user.id } }),
  );

  // --- 7. Le guide est terminé et le rapport est consultable
  await page.goto('/overview');
  await expect(page.getByTestId('onboarding-progress')).toContainText('11 / 11', { timeout: 30_000 });
  await expect(page.getByTestId('onboarding-current')).toHaveCount(0);

  await page.goto('/reports');
  const reportLink = page.locator(`a[href$="/reports/${report.id}"]`);
  await expect(reportLink).toBeVisible();
  await reportLink.click();
  await expect(page.getByText('Rapport de combat')).toBeVisible();
});

