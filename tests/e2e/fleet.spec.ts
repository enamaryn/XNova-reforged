import { test, expect } from '@playwright/test';
import { prisma } from '@xnova/database';
import { buildCredentials, registerUser } from './helpers';

const rivalUsernames: string[] = [];

/**
 * Crée la planète d'un autre joueur comme destination (GAME-01 exige une cible existante).
 * Choisit une position libre : la base peut contenir des planètes d'exécutions précédentes.
 */
async function seedTarget(username: string) {
  const rival = await prisma.user.create({
    data: { username, email: `${username}@xnova.local`, password: '__e2e__' },
  });
  rivalUsernames.push(username);

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const system = 400 + Math.floor(Math.random() * 90);
    const position = 1 + Math.floor(Math.random() * 15);
    const taken = await prisma.planet.findUnique({
      where: { galaxy_system_position: { galaxy: 8, system, position } },
      select: { id: true },
    });
    if (taken) continue;

    await prisma.planet.create({
      data: { userId: rival.id, name: 'Cible E2E', galaxy: 8, system, position },
    });
    return { galaxy: 8, system, position };
  }
  throw new Error('Aucune position libre pour la cible E2E');
}

async function seedFleet(username: string) {
  const user = await prisma.user.findUnique({
    where: { username },
    include: { planets: true },
  });

  if (!user || user.planets.length === 0) {
    throw new Error('Utilisateur E2E introuvable');
  }

  const planet = user.planets[0];

  await prisma.planet.update({
    where: { id: planet.id },
    data: {
      metal: 100000,
      crystal: 100000,
      deuterium: 100000,
    },
  });

  await prisma.ship.upsert({
    where: {
      planetId_shipId: {
        planetId: planet.id,
        shipId: 202,
      },
    },
    update: { amount: 5 },
    create: {
      planetId: planet.id,
      shipId: 202,
      amount: 5,
    },
  });
}

test.afterAll(async () => {
  // Retire les planètes cibles de cette exécution (suppression en cascade)
  await prisma.user.deleteMany({ where: { username: { in: rivalUsernames } } });
  await prisma.$disconnect();
});

test('envoi flotte', async ({ page }) => {
  const credentials = buildCredentials('e2e_fleet');

  await registerUser(page, credentials);

  await seedFleet(credentials.username);
  const target = await seedTarget(`${credentials.username}_t`.slice(0, 20));

  await page.goto(
    `/fleet?mission=transport&galaxy=${target.galaxy}&system=${target.system}&position=${target.position}`,
  );
  await expect(page.locator('h1')).toContainText(/Flotte/);

  const shipRow = page.getByText('Petit Transporteur');
  await expect(shipRow).toBeVisible();

  const shipInput = shipRow.locator('..').locator('..').getByRole('spinbutton');
  await shipInput.fill('1');

  await page.getByRole('button', { name: 'Envoyer la flotte' }).click();
  // Transport (mission 3) vers la planète cible : la flotte apparaît dans les mouvements actifs
  await expect(page.getByText(/Mission 3/)).toBeVisible();
});
