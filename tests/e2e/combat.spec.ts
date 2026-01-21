import { test, expect } from '@playwright/test';
import { prisma } from '@xnova/database';
import { buildCredentials, registerUser } from './helpers';

async function seedCombatReport(username: string, seed: number) {
  const user = await prisma.user.findUnique({
    where: { username },
    include: { planets: true },
  });

  if (!user || user.planets.length === 0) {
    throw new Error('Utilisateur E2E introuvable');
  }

  const defender = await prisma.user.create({
    data: {
      username: `e2e_def_${seed}`,
      email: `e2e_def_${seed}@xnova.local`,
      password: 'seeded',
      points: 0,
      rank: 0,
    },
  });

  const planet = user.planets[0];

  const report = await prisma.combatReport.create({
    data: {
      attackerId: user.id,
      defenderId: defender.id,
      attackerShips: { 204: 3 },
      defenderShips: { 204: 2 },
      defenderDefs: {},
      attackerLosses: { 204: 1 },
      defenderLosses: { 204: 2 },
      result: 'attacker_win',
      rounds: 1,
      timeline: [],
      loot: { metal: 100, crystal: 50, deuterium: 0 },
      debris: { metal: 30, crystal: 10 },
      galaxy: planet.galaxy,
      system: planet.system,
      position: planet.position,
    },
  });

  return report.id;
}

test.afterAll(async () => {
  await prisma.$disconnect();
});

test('rapport de combat', async ({ page }) => {
  const seed = Date.now();
  const credentials = buildCredentials('e2e_combat');

  await registerUser(page, credentials);

  const reportId = await seedCombatReport(credentials.username, seed);

  await page.goto('/reports');
  await expect(page.locator('h1')).toContainText(/Rapports/);

  const reportLink = page.locator(`a[href="/reports/${reportId}"]`);
  await expect(reportLink).toBeVisible();
  await reportLink.click();

  await expect(page.getByText('Rapport de combat')).toBeVisible();
});
