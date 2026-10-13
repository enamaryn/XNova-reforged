import { test, expect } from '@playwright/test';
import { prisma } from '@xnova/database';
import { buildCredentials, registerUser } from './helpers';

const NAME = `Fête E2E ${Date.now().toString(36)}`;

test.afterAll(async () => {
  await prisma.worldEvent.deleteMany({ where: { customName: NAME } });
  await prisma.worldEventSetting.deleteMany();
  await prisma.$disconnect();
});

test('un administrateur lance un événement, les joueurs voient la bannière, puis il l’arrête', async ({ page }) => {
  const credentials = buildCredentials('e2e_wevt');
  await registerUser(page, credentials);
  await prisma.user.update({ where: { username: credentials.username }, data: { role: 'ADMIN' } });

  await page.goto('/admin');
  await page.getByRole('tab', { name: /^Événements/ }).click();
  await expect(page.getByTestId('world-events-panel')).toBeVisible();

  // Le calendrier propose les modèles ; la case « automatique » est décochée par défaut
  const template = page.getByTestId('world-template-winter_festival');
  await expect(template).toBeVisible();
  await expect(page.getByTestId('world-auto-winter_festival')).not.toBeChecked();

  // Cocher la case l'enregistre ; la décocher aussi
  await page.getByTestId('world-auto-winter_festival').check();
  await expect.poll(async () => (await prisma.worldEventSetting.findUnique({ where: { templateId: 'winter_festival' } }))?.auto).toBe(true);
  await page.getByTestId('world-auto-winter_festival').uncheck();
  await expect.poll(async () => (await prisma.worldEventSetting.findUnique({ where: { templateId: 'winter_festival' } }))?.auto).toBe(false);

  // Lancement d'un événement personnalisé
  await page.getByTestId('world-custom-name').fill(NAME);
  await page.getByTestId('world-custom-production').fill('50');
  await page.getByTestId('world-custom-launch').click();
  await expect(page.getByTestId('world-event-line').filter({ hasText: NAME })).toBeVisible();
  const stored = await prisma.worldEvent.findFirstOrThrow({ where: { customName: NAME } });
  expect(stored).toMatchObject({ status: 'ACTIVE', productionBonus: 0.5, auto: false });

  // Les joueurs voient la bannière sur les pages du jeu
  await page.goto('/overview');
  await expect(page.getByTestId('world-events-banner')).toContainText(NAME);
  await expect(page.getByTestId('world-events-banner')).toContainText('+50');

  // Arrêt depuis la console
  page.once('dialog', (dialog) => dialog.accept());
  await page.goto('/admin');
  await page.getByRole('tab', { name: /^Événements/ }).click();
  await page.getByTestId('world-event-line').filter({ hasText: NAME }).getByTestId('world-event-end').click();
  await expect.poll(async () => (await prisma.worldEvent.findUniqueOrThrow({ where: { id: stored.id } })).status).toBe('CANCELLED');
  await page.goto('/overview');
  await expect(page.getByTestId('world-events-banner')).toHaveCount(0);
});

test('un joueur ordinaire n’a pas l’onglet Événements', async ({ page }) => {
  const credentials = buildCredentials('e2e_wevp');
  await registerUser(page, credentials);
  await page.goto('/admin');
  await expect(page.getByRole('tab', { name: /^Événements/ })).toHaveCount(0);
});
