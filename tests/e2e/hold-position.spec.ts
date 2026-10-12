import { test, expect } from '@playwright/test';
import { prisma } from '@xnova/database';
import { buildCredentials, registerUser } from './helpers';

test.afterAll(async () => {
  await prisma.$disconnect();
});

test('maintien de position : lien allié dans la Galaxie, envoi avec durée, état « en maintien » et rappel', async ({ page, browser }) => {
  const credentials = buildCredentials('e2e_hold');
  await registerUser(page, credentials);
  const user = await prisma.user.findUniqueOrThrow({
    where: { username: credentials.username },
    include: { planets: true },
  });
  const planet = user.planets[0];
  await prisma.planet.update({ where: { id: planet.id }, data: { deuterium: 100000 } });
  await prisma.ship.create({ data: { planetId: planet.id, shipId: 202, amount: 5 } });

  const otherContext = await browser.newContext();
  const otherPage = await otherContext.newPage();
  const hostCredentials = buildCredentials('e2e_host');
  await registerUser(otherPage, hostCredentials);
  const host = await prisma.user.findUniqueOrThrow({
    where: { username: hostCredentials.username },
    include: { planets: true },
  });
  const hostPlanet = host.planets[0];

  // Les deux joueurs sont dans la même alliance
  const alliance = await prisma.alliance.create({
    data: { tag: `E${Math.random().toString(36).slice(2, 6).toUpperCase()}`.slice(0, 5), name: 'E2E hold', founderId: user.id },
  });
  await prisma.allianceMember.create({ data: { allianceId: alliance.id, userId: user.id, rank: 'founder' } });
  await prisma.allianceMember.create({ data: { allianceId: alliance.id, userId: host.id, rank: 'member' } });

  await page.goto('/galaxy');
  // Le système de l'hôte est affiché via les champs de coordonnées
  const inputs = page.locator('input[type="number"]');
  await inputs.nth(0).fill(String(hostPlanet.galaxy));
  await inputs.nth(1).fill(String(hostPlanet.system));
  await expect(page.getByTestId('hold-link')).toBeVisible();
  await page.getByTestId('hold-link').click();

  await expect(page.getByTestId('hold-options')).toBeVisible();
  await page.getByTestId('hold-hours').fill('3');
  const shipRow = page.getByText('Petit Transporteur');
  await expect(shipRow).toBeVisible();
  await shipRow.locator('..').locator('..').getByRole('spinbutton').fill('2');
  await page.getByRole('button', { name: 'Envoyer la flotte' }).click();
  await expect(page.getByText(/Mission 5/)).toBeVisible();

  const fleet = await prisma.fleet.findFirstOrThrow({ where: { userId: user.id, mission: 5 } });
  expect(fleet.holdHours).toBe(3);
  expect(fleet.toSystem).toBe(hostPlanet.system);

  // Arrivée : la tâche planifiée (10 s) pose la flotte en maintien
  await prisma.fleet.update({
    where: { id: fleet.id },
    data: { startTime: new Date(Date.now() - 360_000), arrivalTime: new Date(Date.now() - 60_000) },
  });
  await expect(async () => {
    const current = await prisma.fleet.findUniqueOrThrow({ where: { id: fleet.id } });
    expect(current.status).toBe('holding');
  }).toPass({ timeout: 60_000, intervals: [2000] });

  await page.goto('/movement');
  await expect(page.getByText('Fin du maintien dans')).toBeVisible();
  await page.getByRole('button', { name: /Rappeler/ }).click();
  await expect(async () => {
    const current = await prisma.fleet.findUniqueOrThrow({ where: { id: fleet.id } });
    expect(current.status).toBe('returning');
  }).toPass({ timeout: 15_000, intervals: [1000] });
  await otherContext.close();
});
