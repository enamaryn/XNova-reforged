import { test, expect } from '@playwright/test';
import { prisma } from '@xnova/database';
import { buildCredentials, registerUser } from './helpers';

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("la mission Attaque groupée propose de créer un groupe et liste ceux de l'alliance", async ({ page }) => {
  const credentials = buildCredentials('e2e_acs');
  await registerUser(page, credentials);

  const user = await prisma.user.findUniqueOrThrow({ where: { username: credentials.username } });
  // Un allié a déjà annoncé un groupe vers (3:77:5) : il apparaît dès que ces coordonnées sont saisies
  const ally = await prisma.user.create({
    data: { username: `${credentials.username}_a`.slice(0, 20), email: `acs_${Date.now()}@example.test`, password: 'x' },
  });
  const alliance = await prisma.alliance.create({ data: { tag: `E${Date.now().toString(36).slice(-3).toUpperCase()}`.slice(0, 5), name: 'E2E ACS', founderId: user.id } });
  await prisma.allianceMember.createMany({
    data: [
      { allianceId: alliance.id, userId: user.id, rank: 'member' },
      { allianceId: alliance.id, userId: ally.id, rank: 'member' },
    ],
  });
  const group = await prisma.attackGroup.create({
    data: {
      creatorId: ally.id, allianceId: alliance.id, toGalaxy: 3, toSystem: 77, toPosition: 5, toMoon: false,
      arrivalTime: new Date(Date.now() + 3_600_000),
    },
  });
  await prisma.fleet.create({
    data: {
      userId: ally.id, fromGalaxy: 3, fromSystem: 1, fromPosition: 1, toGalaxy: 3, toSystem: 77, toPosition: 5,
      mission: 2, ships: { '206': 1 }, cargo: {}, startTime: new Date(), arrivalTime: group.arrivalTime, status: 'traveling', groupId: group.id,
    },
  });

  try {
    await page.goto('/fleet?mission=acs&galaxy=3&system=77&position=5');
    await expect(page.getByTestId('acs-options')).toBeVisible();
    const select = page.getByTestId('acs-group');
    await expect(select.locator('option')).toHaveCount(2); // nouveau groupe + celui de l'allié
    await expect(select.locator('option').nth(1)).toContainText('1/5');

    // Autres coordonnées : seule l'option « nouveau groupe » reste
    await page.goto('/fleet?mission=acs&galaxy=4&system=10&position=2');
    await expect(page.getByTestId('acs-group').locator('option')).toHaveCount(1);
  } finally {
    await prisma.fleet.deleteMany({ where: { userId: ally.id } });
    await prisma.attackGroup.deleteMany({ where: { id: group.id } });
    await prisma.alliance.deleteMany({ where: { id: alliance.id } });
    await prisma.user.deleteMany({ where: { id: ally.id } });
  }
});
