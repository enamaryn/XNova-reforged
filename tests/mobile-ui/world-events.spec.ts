import { test, expect, type Page } from "@playwright/test";

const adminId = "a2948452-38c5-4d6a-888a-a2c644409e68";
const iso = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();
const effects = (productionBonus: number, marketTaxReduction: number) => ({ productionBonus, marketTaxReduction });

const templates = ["spring_festival", "summer_solstice", "harvest_moon", "dark_nebula", "winter_festival"].map((id, index) => ({
  id,
  kind: "SEASONAL",
  effects: id === "dark_nebula" ? effects(0.1, 0.5) : id === "summer_solstice" ? effects(0, 0.5) : effects(0.25, 0),
  auto: index === 1,
  phase: index === 3 ? "reminder" : index === 4 ? "active" : "later",
  year: 2026,
  startsAt: iso(index * 40 - 20),
  endsAt: iso(index * 40 - 12),
  launched: index === 2,
  reminder: index === 3,
}));
const longName = "Festival intergalactique des moissons de la nébuleuse sombre";
const active = [
  { id: "00000000-0000-4000-8000-000000000001", kind: "SEASONAL", templateId: null, name: longName, status: "ACTIVE", startsAt: iso(-1), endsAt: iso(5), endedAt: null, auto: false, effects: effects(0.5, 0.5) },
];

async function fixture(page: Page, role: "ADMIN" | "SUPER_ADMIN" | "PLAYER") {
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
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.port !== "3001") return route.continue();
    if (url.pathname === "/auth/me") return route.fulfill({ json: user });
    if (url.pathname === "/admin/players") return route.fulfill({ json: { total: 0, page: 1, pageSize: 25, players: [] } });
    if (url.pathname === "/admin/world-events")
      return route.fulfill({ json: { active, history: [{ ...active[0], id: "00000000-0000-4000-8000-000000000002", status: "ENDED", endedAt: iso(-3) }], templates, reminders: 1 } });
    if (url.pathname === "/world-events/active") return route.fulfill({ json: { events: active, effects: effects(0.5, 0.5) } });
    if (url.pathname === "/monitoring/public-config") return route.fulfill({ json: { clientReporting: true, sentry: { enabled: false } } });
    return route.fulfill({ status: 404, json: { message: "Fixture non définie" } });
  });
}

const noHorizontalOverflow = async (page: Page) => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
};

for (const locale of ["fr", "en", "es", "de", "it"] as const) {
  test(`événements du monde (${locale}) : console lisible, case automatique et rappel, sans défilement horizontal`, async ({ page }) => {
    await fixture(page, "ADMIN");
    await page.goto(`/${locale}/admin`);
    // Onglets de l'admin : Joueurs, Général, Événements, Supervision
    await expect(page.getByTestId("events-reminder-badge")).toHaveText("1");
    await page.getByRole("tab").nth(2).click();
    await expect(page.getByTestId("world-events-panel")).toBeVisible();
    await expect(page.getByTestId("world-reminders")).toBeVisible();
    await expect(page.getByTestId("world-template-dark_nebula")).toBeVisible();
    await expect(page.getByTestId("world-auto-summer_solstice")).toBeChecked();
    await expect(page.getByTestId("world-auto-spring_festival")).not.toBeChecked();
    await expect(page.getByTestId("world-launch-spring_festival")).toBeVisible();
    await expect(page.getByTestId("world-launch-harvest_moon")).toHaveCount(0); // déjà lancé cette année
    await expect(page.getByTestId("world-event-line").first()).toContainText(longName);
    await noHorizontalOverflow(page);
  });
}

test("un joueur ne voit pas l'onglet Événements, mais la bannière d'un événement en cours", async ({ page }) => {
  await fixture(page, "PLAYER");
  await page.goto("/fr/admin");
  await expect(page.getByTestId("events-reminder-badge")).toHaveCount(0);
  await page.goto("/fr/overview");
  const banner = page.getByTestId("world-events-banner");
  await expect(banner).toContainText(longName);
  await expect(banner).toContainText("+50");
  await noHorizontalOverflow(page);
});
