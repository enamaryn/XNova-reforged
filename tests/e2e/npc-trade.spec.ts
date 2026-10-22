import { test, expect } from '@playwright/test';
import { prisma } from '@xnova/database';
import { NPC_TRADE_CONFIG_KEY } from '@xnova/game-config';
import { buildCredentials, registerUser } from './helpers';

test.afterEach(async () => {
  await prisma.gameConfig.deleteMany({ where: { key: NPC_TRADE_CONFIG_KEY } });
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

// La planète du joueur produit pendant le test : on compare à une unité près
const near = (value: number, expected: number) => Math.abs(value - expected) < 2;

test('un joueur échange des ressources et achète un vaisseau au marchand', async ({ page }) => {
  const credentials = buildCredentials('e2e_npc');
  await registerUser(page, credentials);
  const user = await prisma.user.findUniqueOrThrow({ where: { username: credentials.username }, include: { planets: true } });
  const planetId = user.planets[0].id;
  // sous la capacité de stockage de départ, pour que rien ne soit rogné
  await prisma.planet.update({ where: { id: planetId }, data: { metal: 400_000, crystal: 100_000, deuterium: 50_000 } });

  await page.goto('/npc-trade');
  await expect(page.getByTestId('npc-season')).toBeVisible();
  await expect(page.getByTestId('npc-rates').locator('li')).toHaveCount(6);

  await page.getByTestId('npc-give').selectOption('metal');
  await page.getByTestId('npc-want').selectOption('crystal');
  await page.getByTestId('npc-amount').fill('10000');
  await expect(page.getByTestId('npc-preview')).toBeVisible();
  await page.getByTestId('npc-exchange-submit').click();
  await expect(page.getByTestId('npc-message')).toBeVisible();

  const trade = await prisma.npcTrade.findFirstOrThrow({ where: { userId: user.id, kind: 'EXCHANGE' } });
  expect(trade.giveAmount).toBe(10_000);
  const afterExchange = await prisma.planet.findUniqueOrThrow({ where: { id: planetId } });
  expect(near(afterExchange.metal, 390_000)).toBe(true);
  expect(near(afterExchange.crystal, 100_000 + trade.receiveAmount)).toBe(true);

  await page.getByTestId('npc-ship-amount-202').fill('2');
  await page.getByTestId('npc-ship-buy-202').click();
  await expect(page.getByTestId('npc-message')).toContainText('2');
  await expect.poll(async () => (await prisma.ship.findUnique({ where: { planetId_shipId: { planetId, shipId: 202 } } }))?.amount).toBe(2);
  await expect(page.getByTestId('npc-caps')).toContainText('/');
});

test('un administrateur règle le marchand : les plafonds et les vaisseaux proposés s’appliquent aux joueurs', async ({ page }) => {
  const credentials = buildCredentials('e2e_npcadm');
  await registerUser(page, credentials);
  await prisma.user.update({ where: { username: credentials.username }, data: { role: 'ADMIN' } });

  await page.goto('/admin');
  await page.getByRole('tab', { name: /^Commerce PNJ/ }).click();
  await expect(page.getByTestId('npc-trade-panel')).toBeVisible();

  // Valeurs invalides : refusées par le serveur, rien n'est enregistré
  await page.getByTestId('npc-admin-spread').fill('0.9');
  await page.getByTestId('npc-admin-save').click();
  await expect(page.getByTestId('npc-admin-error')).toContainText('spread');
  expect(await prisma.gameConfig.count({ where: { key: NPC_TRADE_CONFIG_KEY } })).toBe(0);

  // Réglage valide : marge de 30 %, plafond d'échange à 5 000, Croiseur ajouté à la vente
  await page.getByTestId('npc-admin-spread').fill('0.3');
  await page.getByTestId('npc-admin-exchangeDailyCap').fill('5000');
  await page.getByTestId('npc-admin-ship-206').check();
  await page.getByTestId('npc-admin-save').click();
  await expect(page.getByTestId('npc-admin-saved')).toBeVisible();
  const stored = JSON.parse((await prisma.gameConfig.findUniqueOrThrow({ where: { key: NPC_TRADE_CONFIG_KEY } })).value);
  expect(stored).toMatchObject({ spread: 0.3, exchangeDailyCap: 5000 });
  expect(stored.ships).toContain(206);
  const audit = await prisma.adminAuditLog.findFirst({ where: { action: 'update_npc_trade' }, orderBy: { createdAt: 'desc' } });
  expect(audit).not.toBeNull();

  // Le joueur (ici le même compte) voit le Croiseur et se heurte au plafond
  await page.goto('/npc-trade');
  await expect(page.getByTestId('npc-ship-206')).toBeVisible();
  await page.getByTestId('npc-amount').fill('6000');
  await page.getByTestId('npc-exchange-submit').click();
  await expect(page.getByTestId('npc-error')).toContainText(/Plafond/);

  // Retour aux valeurs par défaut
  await page.goto('/admin');
  await page.getByRole('tab', { name: /^Commerce PNJ/ }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByTestId('npc-admin-reset').click();
  await expect.poll(async () => prisma.gameConfig.count({ where: { key: NPC_TRADE_CONFIG_KEY } })).toBe(0);
});
