import { test, expect } from '@playwright/test';
import { prisma } from '@xnova/database';
import { INVASION_CONFIG_KEY } from '@xnova/game-config';
import { buildCredentials, registerUser } from './helpers';

test.afterEach(async () => {
  await prisma.invasion.deleteMany();
  await prisma.gameConfig.deleteMany({ where: { key: INVASION_CONFIG_KEY } });
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

test('un administrateur règle les invasions, en lance une puis l’annule', async ({ page }) => {
  const credentials = buildCredentials('e2e_invadm');
  await registerUser(page, credentials);
  await prisma.user.update({ where: { username: credentials.username }, data: { role: 'ADMIN' } });

  await page.goto('/admin');
  await page.getByTestId('admin-tab-invasion').click();
  await expect(page.getByTestId('invasion-panel')).toBeVisible();
  await expect(page.getByTestId('invasion-admin-enabled')).not.toBeChecked(); // désactivées par défaut

  // Valeur invalide refusée par le serveur, rien n'est enregistré
  await page.getByTestId('invasion-admin-waves').fill('0');
  await page.getByTestId('invasion-admin-save').click();
  await expect(page.getByTestId('invasion-admin-error')).toContainText('waves');
  expect(await prisma.gameConfig.count({ where: { key: INVASION_CONFIG_KEY } })).toBe(0);

  // Trois vagues de 5 sondes, activation, enregistrement
  await page.getByTestId('invasion-admin-waves').fill('3');
  for (const id of [204, 205, 206, 207]) await page.getByTestId(`invasion-admin-remove-${id}`).click();
  await page.getByTestId('invasion-admin-add-select').selectOption('210');
  await page.getByTestId('invasion-admin-add').click();
  await page.getByTestId('invasion-admin-ship-210').fill('5');
  await page.getByTestId('invasion-admin-enabled').check();
  await page.getByTestId('invasion-admin-save').click();
  await expect(page.getByTestId('invasion-admin-saved')).toBeVisible();
  const stored = JSON.parse((await prisma.gameConfig.findUniqueOrThrow({ where: { key: INVASION_CONFIG_KEY } })).value);
  expect(stored).toMatchObject({ enabled: true, waves: 3, waveShips: { 210: 5 } });

  // Lancement dans la galaxie 4, puis annulation
  await page.getByTestId('invasion-admin-galaxy').fill('4');
  await page.getByTestId('invasion-admin-start').click();
  await expect(page.getByTestId('invasion-admin-status')).toContainText('galaxie 4');
  await expect(page.getByTestId('invasion-admin-wave')).toBeVisible();
  expect(await prisma.invasion.count({ where: { status: 'ACTIVE', galaxy: 4 } })).toBe(1);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByTestId('invasion-admin-cancel').click();
  await expect.poll(() => prisma.invasion.count({ where: { status: 'ACTIVE' } })).toBe(0);
  await expect(page.getByTestId('invasion-admin-history')).toContainText('annulée');
});

test('un joueur voit l’invasion, la vague en cours, et prépare une attaque vers la position 16', async ({ page }) => {
  const credentials = buildCredentials('e2e_invplr');
  await registerUser(page, credentials);
  const config = {
    enabled: true, autoIntervalDays: 0, waves: 3, durationHours: 48, waveShips: { 210: 5 }, waveGrowth: 1.5,
    tech: { weapon: 0, shield: 0, armor: 0 }, regenPercentPerHour: 3,
    waveLoot: { metal: 1000, crystal: 500, deuterium: 100 }, finalLoot: { metal: 5000, crystal: 2500, deuterium: 500 },
    rewardProductionBonus: 0.2, rewardDays: 3,
  };
  await prisma.gameConfig.upsert({ where: { key: INVASION_CONFIG_KEY }, create: { key: INVASION_CONFIG_KEY, value: JSON.stringify(config) }, update: { value: JSON.stringify(config) } });
  const invasion = await prisma.invasion.create({
    data: { nameId: 1, galaxy: 4, totalWaves: 3, currentWave: 2, activeSlot: 1, endsAt: new Date(Date.now() + 2 * 86_400_000) },
  });
  await prisma.invasionWave.create({ data: { invasionId: invasion.id, index: 1, system: 33, status: 'CLEARED', ships: {}, maxShips: { 210: 5 } } });
  await prisma.invasionWave.create({ data: { invasionId: invasion.id, index: 2, system: 44, status: 'ACTIVE', activeSlot: 1, ships: { 210: 8 }, maxShips: { 210: 8 } } });

  await page.goto('/invasion');
  await expect(page.getByTestId('invasion-active')).toBeVisible();
  await expect(page.getByTestId('invasion-progress')).toContainText('2');
  await expect(page.getByTestId('invasion-progress')).toContainText('3');
  await expect(page.getByTestId('invasion-location')).toContainText('4');
  await expect(page.getByTestId('invasion-location')).toContainText('44');
  await expect(page.getByTestId('invasion-location')).toContainText('16');
  await expect(page.getByTestId('invasion-health')).toContainText('100');
  await expect(page.getByTestId('invasion-deadline')).toBeVisible();

  await page.getByTestId('invasion-attack-link').click();
  await expect(page).toHaveURL(/mission=attack/);
  await expect(page.getByTestId('mission-attaque')).toBeVisible();
  const values = await page.locator('input[type="number"]').evaluateAll((nodes) => (nodes as HTMLInputElement[]).map((n) => n.value));
  expect(values).toEqual(expect.arrayContaining(['4', '44', '16']));

  // Invasion repoussée : la page l'annonce
  await prisma.invasion.update({ where: { id: invasion.id }, data: { status: 'REPELLED', activeSlot: null, finishedAt: new Date() } });
  await prisma.invasionWave.updateMany({ data: { activeSlot: null } });
  await page.goto('/invasion');
  await expect(page.getByTestId('invasion-last')).toContainText('repoussée');
  await expect(page.getByTestId('invasion-waiting')).toBeVisible();
});
