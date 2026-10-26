import { test, expect } from '@playwright/test';
import { prisma } from '@xnova/database';
import { MULTI_ACCOUNT_CONFIG_KEY } from '@xnova/game-config';
import { buildCredentials, registerUser } from './helpers';

const createdIds: string[] = [];

test.afterAll(async () => {
  await prisma.accountLinkExemption.deleteMany({ where: { OR: [{ userA: { in: createdIds } }, { userB: { in: createdIds } }] } });
  await prisma.user.deleteMany({ where: { id: { in: createdIds } } });
  await prisma.gameConfig.deleteMany({ where: { key: MULTI_ACCOUNT_CONFIG_KEY } });
  await prisma.$disconnect();
});

test('un administrateur voit les comptes liés, les exempte et règle les limites', async ({ page }) => {
  const credentials = buildCredentials('e2e_linked');
  await registerUser(page, credentials);
  await prisma.user.update({ where: { username: credentials.username }, data: { role: 'ADMIN' } });

  // Deux comptes qui partagent une adresse IP récente
  const suffix = Date.now().toString(36);
  const ip = `203.0.113.${Math.floor(Math.random() * 250)}`;
  const first = await prisma.user.create({ data: { username: `lk1_${suffix}`.slice(0, 20), email: `lk1_${suffix}@example.test`, password: 'x' } });
  const second = await prisma.user.create({ data: { username: `lk2_${suffix}`.slice(0, 20), email: `lk2_${suffix}@example.test`, password: 'x' } });
  createdIds.push(first.id, second.id);
  await prisma.accountIp.createMany({ data: [{ userId: first.id, ip }, { userId: second.id, ip }] });

  await page.goto('/admin');
  await page.getByRole('tab', { name: /^Comptes liés/ }).click();
  await expect(page.getByTestId('multi-account-panel')).toBeVisible();
  const group = page.getByTestId('linked-group').filter({ hasText: first.username });
  await expect(group).toBeVisible();
  await expect(group).toHaveAttribute('data-open', 'true');
  await expect(group).toContainText(ip);

  // Exemption avec motif
  const [a, b] = first.id < second.id ? [first.id, second.id] : [second.id, first.id];
  await expect(page.getByTestId(`linked-exempt-${a}-${b}`)).toBeDisabled();
  await page.getByTestId(`linked-reason-${a}-${b}`).fill('même foyer');
  await page.getByTestId(`linked-exempt-${a}-${b}`).click();
  await expect(group).toHaveAttribute('data-open', 'false');
  expect(await prisma.accountLinkExemption.count({ where: { userA: a, userB: b } })).toBe(1);
  await page.getByTestId(`linked-remove-${a}-${b}`).click();
  await expect(group).toHaveAttribute('data-open', 'true');

  // Réglage invalide refusé, puis valide enregistré
  await page.getByTestId('linked-config-ipWindowDays').fill('400');
  await page.getByTestId('linked-save').click();
  await expect(page.getByTestId('linked-error')).toContainText('ipWindowDays');
  expect(await prisma.gameConfig.count({ where: { key: MULTI_ACCOUNT_CONFIG_KEY } })).toBe(0);
  await page.getByTestId('linked-config-ipWindowDays').fill('30');
  await page.getByTestId('linked-config-maxAccountsPerIp').fill('2');
  await page.getByTestId('linked-save').click();
  await expect(page.getByTestId('linked-saved')).toBeVisible();
  const stored = JSON.parse((await prisma.gameConfig.findUniqueOrThrow({ where: { key: MULTI_ACCOUNT_CONFIG_KEY } })).value);
  expect(stored).toMatchObject({ maxAccountsPerIp: 2, ipWindowDays: 30 });
});
