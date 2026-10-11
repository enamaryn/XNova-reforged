import { test, expect, type Page } from "@playwright/test";

const adminId = "a2948452-38c5-4d6a-888a-a2c644409e68";
const now = new Date().toISOString();

const checks = ["database", "redis", "api", "frontend", "websocket", "smtp", "disk", "system", "cron", "queues", "version"].map((id) => ({
  id,
  status: id === "redis" ? "down" : id === "smtp" ? "degraded" : "ok",
  code: id === "redis" ? "unreachable" : id === "smtp" ? "never_tested" : "ok",
  message: "x",
  durationMs: 12,
  checkedAt: now,
  details: id === "version" ? { version: "0.2.0", commit: "abc1234", startedAt: now, lastBackupAt: null } : { latencyMs: 4 },
}));

const incident = (n: number) => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
  level: n % 2 ? "error" : "fatal",
  source: n % 2 ? "api" : "frontend",
  status: "new",
  message: `Erreur de test numéro ${n} avec un message assez long pour vérifier que la ligne ne déborde pas de l'écran`,
  errorType: "TypeError",
  operation: "GET /planets/:id",
  httpStatus: 500,
  firstSeen: now,
  lastSeen: now,
  occurrences: n,
});

async function fixture(page: Page, role: "ADMIN" | "SUPER_ADMIN") {
  const user = { id: adminId, username: "Administrateur", role, email: "admin@example.test", planets: [] };
  await page.context().addCookies([{ name: "xnova_access", value: "ui-fixture", url: "http://127.0.0.1:3100" }]);
  await page.addInitScript(
    (u) =>
      sessionStorage.setItem(
        "xnova-auth",
        JSON.stringify({ state: { user: u, tokens: { accessToken: "ui-fixture", refreshToken: "ui-refresh" }, remember: false }, version: 0 }),
      ),
    user,
  );
  const config = {
    local: { retentionDays: 30, maxIncidents: 5000, minLevel: "error", warningsEnabled: false, autoPurge: true, alwaysActive: true },
    sentry: { enabled: false, active: false, source: "none", dsnApiSet: false, dsnApiUnreadable: false, dsnApiHint: null, dsnBrowserSet: false, dsnBrowserHint: null, environment: "production", sampleRate: 0.1, sampleRateMax: 0.5, lastTest: null },
  };
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.port !== "3001") return route.continue();
    if (url.pathname === "/auth/me") return route.fulfill({ json: user });
    if (url.pathname === "/admin/players") return route.fulfill({ json: { total: 0, page: 1, pageSize: 25, players: [] } });
    if (url.pathname === "/admin/supervision/overview")
      return route.fulfill({
        json: {
          localActive: true,
          health: { status: "degraded", checkedAt: now, checks },
          stats: { open: 7, total: 12, last24h: 5, occurrences24h: 40, byLevel: {}, bySource: {}, top: [incident(1), incident(2)] },
          config,
        },
      });
    if (url.pathname === "/admin/supervision/incidents")
      return route.fulfill({ json: { items: [incident(1), incident(2), incident(3)], total: 3, page: 1, pageSize: 20, pages: 1 } });
    if (url.pathname.startsWith("/admin/supervision/incidents/"))
      return route.fulfill({ json: { ...incident(1), userId: null, planetId: null, version: "0.2.0", commit: "abc1234", context: { kind: "react" }, stack: "TypeError: x\n    at f (a.js:1:2)", resolvedAt: null } });
    if (url.pathname === "/monitoring/public-config") return route.fulfill({ json: { clientReporting: true, sentry: { enabled: false } } });
    if (url.pathname === "/monitoring/client-errors") return route.fulfill({ status: 202, json: { accepted: true } });
    return route.fulfill({ status: 404, json: { message: "Fixture non définie" } });
  });
}

const noHorizontalOverflow = async (page: Page) => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
};

for (const locale of ["fr", "en", "es", "de", "it"] as const) {
  test(`supervision responsive (${locale}) : aucune barre de défilement horizontale, cartes et incidents lisibles`, async ({ page }) => {
    await fixture(page, "SUPER_ADMIN");
    await page.goto(`/${locale}/admin`);
    // Onglets du super admin : Joueurs, Général, Supervision, SMTP
    await page.getByRole("tab").nth(2).click();
    await expect(page.getByTestId("supervision-panel")).toBeVisible();
    await expect(page.getByTestId("overall-status")).toBeVisible();
    await expect(page.getByTestId("check-redis")).toBeVisible();
    await expect(page.getByTestId("incident-list").getByRole("button").first()).toBeVisible();
    await noHorizontalOverflow(page);

    await page.getByTestId("incident-list").getByRole("button").first().click();
    await expect(page.getByTestId("incident-detail")).toBeVisible();
    await noHorizontalOverflow(page);

    await page.getByTestId("mode-sentry").check();
    await expect(page.getByTestId("sentry-fields")).toBeVisible();
    await noHorizontalOverflow(page);
  });
}

test("un admin simple voit la supervision en lecture seule", async ({ page }) => {
  await fixture(page, "ADMIN");
  await page.goto("/fr/admin");
  await page.getByRole("tab", { name: "Supervision" }).click();
  await expect(page.getByTestId("supervision-panel")).toBeVisible();
  await expect(page.getByTestId("supervision-save")).toHaveCount(0);
  await expect(page.getByTestId("purge-button")).toHaveCount(0);
  await noHorizontalOverflow(page);
});
