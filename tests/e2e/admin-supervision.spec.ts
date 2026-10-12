import { test, expect, type Page } from '@playwright/test';
import { prisma } from '@xnova/database';
import { buildCredentials, registerUser } from './helpers';

const TAG = `e2esup-${Date.now().toString(36)}`;
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

test.afterAll(async () => {
  await prisma.incident.deleteMany({ where: { message: { contains: TAG } } });
  await prisma.gameConfig.deleteMany({ where: { key: { startsWith: 'monitoring.sentry.' } } });
  await prisma.$disconnect();
});


/** Incident préparé directement en base : la route publique est limitée par adresse IP (20/min) et les autres parcours E2E y consomment déjà leur part. */
async function seedIncident(message: string, source = 'frontend') {
  await prisma.incident.create({
    data: { fingerprint: `${TAG}-${message}`, level: 'error', source, message: `${TAG} ${message}`, errorType: 'TypeError', occurrences: 1 },
  });
}

async function signIn(page: Page, prefix: string, role: 'ADMIN' | 'SUPER_ADMIN') {
  const credentials = buildCredentials(prefix);
  await registerUser(page, credentials);
  await prisma.user.update({ where: { username: credentials.username }, data: { role } });
  return credentials;
}

test('supervision : un admin simple consulte l’état et les incidents mais ne modifie rien', async ({ page }) => {
  await seedIncident('lecture seule');
  await signIn(page, 'e2e_supa', 'ADMIN');
  await page.goto('/admin');
  await page.getByRole('tab', { name: 'Supervision', exact: true }).click();

  await expect(page.getByTestId('supervision-panel')).toBeVisible();
  await expect(page.getByTestId('overall-status')).toBeVisible();
  await expect(page.getByTestId('check-database')).toContainText('PostgreSQL');
  await expect(page.getByTestId('check-api')).toBeVisible();
  await expect(page.getByTestId('uptime-section')).toBeVisible();
  await expect(page.getByText('Lecture seule : seul le super admin')).toBeVisible();
  await expect(page.getByTestId('supervision-save')).toHaveCount(0);
  await expect(page.getByTestId('purge-button')).toHaveCount(0);

  await page.getByLabel('Rechercher').fill(`${TAG} lecture`);
  await expect(page.getByTestId('incident-list')).toContainText(`${TAG} lecture seule`);
  await page.getByTestId('incident-list').getByRole('button').first().click();
  await expect(page.getByTestId('incident-detail')).toBeVisible();
  await expect(page.getByTestId('incident-resolve')).toHaveCount(0);
});

test('supervision : le super admin traite un incident et bascule local ↔ Sentry sans jamais voir le DSN', async ({ page }) => {
  await seedIncident('traitement');
  await signIn(page, 'e2e_sups', 'SUPER_ADMIN');
  await page.goto('/admin');
  await page.getByRole('tab', { name: 'Supervision', exact: true }).click();

  // Incident : consulter puis résoudre
  await page.getByLabel('Rechercher').fill(`${TAG} traitement`);
  const row = page.getByTestId('incident-list').getByRole('button').first();
  await expect(row).toContainText(`${TAG} traitement`);
  await row.click();
  await page.getByTestId('incident-resolve').click();
  await expect.poll(async () => (await prisma.incident.findFirstOrThrow({ where: { message: { startsWith: `${TAG} traitement` } } })).status).toBe('resolved');

  // Mode local par défaut ; Sentry reste facultatif
  await expect(page.getByTestId('mode-local')).toBeChecked();
  await expect(page.getByTestId('sentry-fields')).toHaveCount(0);

  // Test Sentry avec un DSN invalide : message clair, rien de bloqué
  await page.getByTestId('mode-sentry').check();
  await page.getByTestId('sentry-dsn-api').fill('pas-un-dsn');
  await page.getByTestId('sentry-test').click();
  await expect(page.getByTestId('sentry-test-result')).toContainText('invalide');
  await expect(page.getByTestId('overall-status')).toBeVisible();

  // Activer sans DSN valide est refusé côté interface puis côté API
  await page.getByTestId('sentry-dsn-api').fill('');
  await page.getByTestId('supervision-save').click();
  await expect(page.getByTestId('supervision-form').getByRole('alert')).toContainText('DSN');

  // DSN valide (Sentry fictif injoignable) : enregistré chiffré, jamais réaffiché
  const dsn = 'http://abcdef0123456789abcd@127.0.0.1:9/5';
  await page.getByTestId('sentry-dsn-api').fill(dsn);
  await page.getByTestId('supervision-save').click();
  await expect(page.getByText('Configuration de supervision enregistrée.')).toBeVisible();
  await expect(page.locator('body')).not.toContainText('abcdef0123456789abcd');
  await expect(page.getByTestId('sentry-dsn-api')).toHaveValue('');
  const stored = await prisma.gameConfig.findUniqueOrThrow({ where: { key: 'monitoring.sentry.dsnApi' } });
  expect(stored.value.startsWith('enc:v1:')).toBe(true);
  expect(stored.value).not.toContain('abcdef0123456789abcd');

  // Sentry injoignable : le test échoue proprement, le résultat est conservé et affiché avec sa date
  await page.getByTestId('sentry-test').click();
  await expect(page.getByTestId('sentry-test-result')).toContainText('injoignable');
  await expect(page.getByTestId('sentry-last-test')).toBeVisible();
  await expect(page.getByTestId('supervision-panel')).toBeVisible();

  // Retour au local seul
  await page.getByTestId('mode-local').check();
  await page.getByTestId('supervision-save').click();
  await expect(page.getByTestId('overall-status')).toBeVisible();
  await expect(page.getByTestId('mode-local')).toBeChecked();
});

test('supervision : export CSV, interface en allemand et configuration publique du navigateur', async ({ page, request }) => {
  await seedIncident('export');
  await signIn(page, 'e2e_supx', 'SUPER_ADMIN');
  await page.goto('/de/admin');
  await page.getByRole('tab', { name: 'Überwachung', exact: true }).click();
  await expect(page.getByTestId('supervision-panel')).toContainText('Die lokale Überwachung ist immer aktiv');

  await page.getByLabel('Suchen').fill(`${TAG} export`);
  await expect(page.getByTestId('incident-list')).toContainText(`${TAG} export`);
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Als CSV exportieren' }).click()]);
  expect(download.suggestedFilename()).toBe('incidents.csv');

  // Sentry désactivé : la configuration publique ne contient aucun DSN
  const publicConfig = await (await request.get(`${API_URL}/monitoring/public-config`)).json();
  expect(publicConfig.sentry.enabled).toBe(false);
  expect(JSON.stringify(publicConfig)).not.toContain('@');
});

test('supervision : une erreur de rendu du navigateur remonte dans le journal local', async ({ page }) => {
  await signIn(page, 'e2e_supr', 'SUPER_ADMIN');
  await page.goto('/overview');
  await page.evaluate((tag) => {
    setTimeout(() => {
      throw new Error(`${tag} erreur globale du navigateur`);
    }, 0);
  }, TAG);
  await expect
    .poll(async () => prisma.incident.count({ where: { source: 'frontend', message: { contains: `${TAG} erreur globale` } } }), { timeout: 20_000 })
    .toBeGreaterThan(0);
});
