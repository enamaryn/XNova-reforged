import { test, expect } from '@playwright/test';
import { prisma } from '@xnova/database';
import { BOSS_CONFIG_KEY } from '@xnova/game-config';
import { buildCredentials, registerUser } from './helpers';

test.afterEach(async () => {
  await prisma.galacticBoss.deleteMany();
  await prisma.gameConfig.deleteMany({ where: { key: BOSS_CONFIG_KEY } });
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

test('un administrateur règle le boss, le fait apparaître puis le retire', async ({ page }) => {
  const credentials = buildCredentials('e2e_bossadm');
  await registerUser(page, credentials);
  await prisma.user.update({ where: { username: credentials.username }, data: { role: 'ADMIN' } });

  await page.goto('/admin');
  await page.getByTestId('admin-tab-boss').click();
  await expect(page.getByTestId('boss-panel')).toBeVisible();
  await expect(page.getByTestId('boss-admin-enabled')).not.toBeChecked(); // désactivé par défaut

  // Valeur invalide refusée par le serveur, rien n'est enregistré
  await page.getByTestId('boss-admin-aggroPercent').fill('150');
  await page.getByTestId('boss-admin-save').click();
  await expect(page.getByTestId('boss-admin-error')).toContainText('aggroChance');
  expect(await prisma.gameConfig.count({ where: { key: BOSS_CONFIG_KEY } })).toBe(0);

  // Flotte réduite à 5 sondes d'espionnage, activation, enregistrement
  await page.getByTestId('boss-admin-aggroPercent').fill('50');
  for (const id of [204, 205, 206, 207]) await page.getByTestId(`boss-admin-remove-${id}`).click();
  await page.getByTestId('boss-admin-add-select').selectOption('210');
  await page.getByTestId('boss-admin-add').click();
  await page.getByTestId('boss-admin-ship-210').fill('5');
  await page.getByTestId('boss-admin-enabled').check();
  await page.getByTestId('boss-admin-save').click();
  await expect(page.getByTestId('boss-admin-saved')).toBeVisible();
  const stored = JSON.parse((await prisma.gameConfig.findUniqueOrThrow({ where: { key: BOSS_CONFIG_KEY } })).value);
  expect(stored).toMatchObject({ enabled: true, aggroChance: 0.5, ships: { 210: 5 } });

  // Apparition à des coordonnées choisies, puis retrait
  await page.getByTestId('boss-admin-galaxy').fill('4');
  await page.getByTestId('boss-admin-system').fill('44');
  await page.getByTestId('boss-admin-spawn').click();
  await expect(page.getByTestId('boss-admin-status')).toContainText('44');
  expect(await prisma.galacticBoss.count({ where: { status: 'ALIVE', galaxy: 4, system: 44 } })).toBe(1);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByTestId('boss-admin-despawn').click();
  await expect.poll(() => prisma.galacticBoss.count({ where: { status: 'ALIVE' } })).toBe(0);
});

test('un joueur voit le boss, sa position, et prépare une attaque vers la position 16', async ({ page }) => {
  const credentials = buildCredentials('e2e_bossplr');
  await registerUser(page, credentials);
  const config = {
    enabled: true, respawnDays: 7, aggroChance: 0.5, regenPercentPerHour: 2, ships: { 210: 5 },
    tech: { weapon: 0, shield: 0, armor: 0 }, loot: { metal: 1000, crystal: 500, deuterium: 100 },
  };
  await prisma.gameConfig.upsert({ where: { key: BOSS_CONFIG_KEY }, create: { key: BOSS_CONFIG_KEY, value: JSON.stringify(config) }, update: { value: JSON.stringify(config) } });
  await prisma.galacticBoss.create({
    data: { nameId: 1, galaxy: 4, system: 44, status: 'ALIVE', activeSlot: 1, ships: { 210: 5 }, maxShips: { 210: 5 } },
  });

  await page.goto('/boss');
  await expect(page.getByTestId('boss-alive')).toBeVisible();
  await expect(page.getByTestId('boss-location')).toContainText('4');
  await expect(page.getByTestId('boss-location')).toContainText('44');
  await expect(page.getByTestId('boss-location')).toContainText('16');
  await expect(page.getByTestId('boss-health')).toContainText('100');

  await page.getByTestId('boss-attack-link').click();
  await expect(page).toHaveURL(/mission=attack/);
  await expect(page.getByTestId('mission-attaque')).toBeVisible();
  // Destination préremplie : galaxie 4, système 44, position 16 (l'attaque la conserve)
  const values = await page.locator('input[type="number"]').evaluateAll((nodes) => (nodes as HTMLInputElement[]).map((n) => n.value));
  expect(values).toEqual(expect.arrayContaining(['4', '44', '16']));

  // Boss mort : la page annonce la prochaine apparition
  await prisma.galacticBoss.updateMany({ data: { status: 'DEAD', activeSlot: null, diedAt: new Date(), respawnAt: new Date(Date.now() + 86_400_000) } });
  await page.goto('/boss');
  await expect(page.getByTestId('boss-waiting')).toBeVisible();
});
