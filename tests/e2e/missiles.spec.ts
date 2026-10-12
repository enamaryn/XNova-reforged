import { test, expect } from '@playwright/test';
import { prisma } from '@xnova/database';
import { buildCredentials, registerUser } from './helpers';

test.afterAll(async () => {
  await prisma.$disconnect();
});

test('missiles : sans silo le panneau l\'explique, avec silo on lance et on voit les défenses détruites', async ({ page, browser }) => {
  const attackerCredentials = buildCredentials('e2e_missile');
  await registerUser(page, attackerCredentials);
  const attacker = await prisma.user.findUniqueOrThrow({
    where: { username: attackerCredentials.username },
    include: { planets: true },
  });
  const attackerPlanet = attacker.planets[0];

  // Sans silo : explication, pas de formulaire de lancement
  await page.goto('/defense');
  await expect(page.getByTestId('missile-panel')).toBeVisible();
  await expect(page.getByTestId('missile-no-silo')).toBeVisible();
  await expect(page.getByTestId('missile-launch-form')).toHaveCount(0);

  // Coordonnées aléatoires : les planètes d'une exécution précédente peuvent subsister
  const baseSystem = 100 + Math.floor(Math.random() * 300);

  // Une cible, deux systèmes plus loin, avec 100 lanceurs de missiles
  const otherContext = await browser.newContext();
  const otherPage = await otherContext.newPage();
  const defenderCredentials = buildCredentials('e2e_target');
  await registerUser(otherPage, defenderCredentials);
  const defender = await prisma.user.findUniqueOrThrow({
    where: { username: defenderCredentials.username },
    include: { planets: true },
  });
  const defenderPlanet = defender.planets[0];
  await prisma.planet.update({
    where: { id: attackerPlanet.id },
    data: { galaxy: 3, system: baseSystem, position: 4, missileSilo: 4 },
  });
  await prisma.planet.update({
    where: { id: defenderPlanet.id },
    data: { galaxy: 3, system: baseSystem + 2, position: 7 },
  });
  await prisma.defense.create({ data: { planetId: defenderPlanet.id, defenseId: 401, amount: 100 } });
  await prisma.defense.create({ data: { planetId: attackerPlanet.id, defenseId: 502, amount: 3 } });
  await prisma.technology.upsert({
    where: { userId_techId: { userId: attacker.id, techId: 117 } },
    update: { level: 1 },
    create: { userId: attacker.id, techId: 117, level: 1 },
  });

  await page.reload();
  await expect(page.getByTestId('missile-ipm')).toHaveText('3');
  await expect(page.getByTestId('missile-capacity')).toHaveText('3 / 40');

  await page.getByTestId('missile-system').fill(String(baseSystem + 2));
  await page.getByTestId('missile-position').fill('7');
  await page.getByTestId('missile-amount').fill('2');
  await page.getByTestId('missile-launch').click();
  await expect(page.getByTestId('missile-notice')).toBeVisible();
  await expect(page.getByTestId('missile-ipm')).toHaveText('1');
  await expect(page.getByTestId('missile-strike-out')).toHaveCount(1);

  // Le défenseur est averti de l'arrivée
  await otherPage.goto('/defense');
  await expect(otherPage.getByTestId('missile-incoming-warning')).toBeVisible();

  // Arrivée : on avance l'échéance, la tâche planifiée (10 s) résout la frappe
  await prisma.missileStrike.updateMany({
    where: { userId: attacker.id },
    data: { arrivalTime: new Date(Date.now() - 1000) },
  });
  await expect(async () => {
    await page.reload();
    await expect(page.getByTestId('missile-strike-out')).toContainText('100 × Lanceur de Missiles', { timeout: 2000 });
  }).toPass({ timeout: 60_000, intervals: [3000] });

  const left = await prisma.defense.findFirstOrThrow({ where: { planetId: defenderPlanet.id, defenseId: 401 } });
  expect(left.amount).toBe(0);
  await otherContext.close();
});

test('missiles : une cible hors de portée est refusée avec un message', async ({ page }) => {
  const credentials = buildCredentials('e2e_range');
  await registerUser(page, credentials);
  const user = await prisma.user.findUniqueOrThrow({
    where: { username: credentials.username },
    include: { planets: true },
  });
  await prisma.planet.update({ where: { id: user.planets[0].id }, data: { missileSilo: 1 } });
  await prisma.defense.create({ data: { planetId: user.planets[0].id, defenseId: 502, amount: 1 } });
  await prisma.technology.upsert({
    where: { userId_techId: { userId: user.id, techId: 117 } },
    update: { level: 1 },
    create: { userId: user.id, techId: 117, level: 1 },
  });
  const planet = user.planets[0];

  await page.goto('/defense');
  await page.getByTestId('missile-system').fill(String(((planet.system + 100 - 1) % 499) + 1));
  await page.getByTestId('missile-position').fill('3');
  await page.getByTestId('missile-launch').click();
  await expect(page.getByTestId('missile-error')).toBeVisible();
  await expect(page.getByTestId('missile-ipm')).toHaveText('1');
});
