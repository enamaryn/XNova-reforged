import { test, expect, type Page } from "@playwright/test";

async function fixture(page: Page) {
  const planet = {
    id: "production-planet",
    name: "Planète Mère",
    galaxy: 1,
    system: 1,
    position: 1,
  };
  const user = {
    id: "production-player",
    username: "Commandant",
    email: "production@example.test",
    role: "PLAYER",
    planets: [planet],
  };
  await page
    .context()
    .addCookies([
      { name: "xnova_access", value: "fixture", url: "http://127.0.0.1:3100" },
    ]);
  await page.addInitScript(
    (user) =>
      sessionStorage.setItem(
        "xnova-auth",
        JSON.stringify({
          state: {
            user,
            tokens: { accessToken: "fixture", refreshToken: "fixture" },
          },
          version: 0,
        }),
      ),
    user,
  );
  const p = {
    commanderLevel: 50,
    development: 1176490,
    levelDevelopment: 1176490,
    nextLevelDevelopment: 1250000,
    power: 1180000,
    colonies: 2,
    buildingCapacity: 3,
    productionCapacity: 3,
    constructionTechnology: 1,
    productionTechnology: 1,
    breakdown: {
      buildings: 1000000,
      research: 176490,
      ships: 1000,
      defenses: 510,
      colonies: 2000,
    },
  };
  let queue = [
    {
      id: "active",
      shipId: 202,
      shipName: "Petit Transporteur",
      amount: 100,
      startTime: new Date(Date.now() - 1000).toISOString(),
      endTime: new Date(Date.now() + 600000).toISOString(),
      remainingSeconds: 600,
      status: "active",
      canCancel: false,
    },
    {
      id: "waiting",
      shipId: 204,
      shipName: "Chasseur Léger",
      amount: 10,
      startTime: new Date(Date.now() + 600000).toISOString(),
      endTime: new Date(Date.now() + 660000).toISOString(),
      remainingSeconds: 660,
      status: "waiting",
      canCancel: true,
      refund: { metal: 22500, crystal: 7200, deuterium: 0 },
    },
  ];
  const actions: string[] = [];
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.port !== "3001") return route.continue();
    if (route.request().method() === "DELETE") {
      actions.push(url.pathname);
      queue = queue.filter((q) => !url.pathname.endsWith(q.id));
      return route.fulfill({
        json: {
          success: true,
          refund: { metal: 22500, crystal: 7200, deuterium: 0 },
        },
      });
    }
    if (url.pathname === "/auth/me") return route.fulfill({ json: user });
    if (url.pathname === "/progression") return route.fulfill({ json: p });
    if (url.pathname === "/shipyard/queue")
      return route.fulfill({ json: queue });
    if (url.pathname === "/shipyard")
      return route.fulfill({
        json: {
          planetId: planet.id,
          ships: [],
          resources: { metal: 1000, crystal: 1000, deuterium: 0 },
        },
      });
    if (url.pathname.endsWith("/resources"))
      return route.fulfill({
        json: {
          metal: 1000,
          crystal: 1000,
          deuterium: 0,
          energy: { available: 100, used: 20 },
        },
      });
    return route.fulfill({
      status: 404,
      json: { message: "Fixture not defined" },
    });
  });
  await page.goto("/fr/shipyard");
  return actions;
}

test("shows commander, power and separate waiting/active production on narrow screens", async ({
  page,
}) => {
  await fixture(page);
  await expect(
    page.getByText("Commandant : niveau 50/100 · 3 chantiers · 3 lignes"),
  ).toBeVisible();
  await page
    .locator("summary")
    .filter({ hasText: "Commandant : niveau 50/100" })
    .click();
  await expect(
    page.getByText(
      "Par planète : 3 bâtiment(s) simultané(s) · 3 ligne(s) de production.",
    ),
  ).toBeVisible();
  await expect(page.getByText(/Puissance :/)).toBeVisible();
  await page
    .locator("summary")
    .filter({ hasText: "Commandant : niveau 50/100" })
    .click();
  const queue = page.getByRole("region", {
    name: "File du chantier",
    exact: true,
  });
  await expect(queue.getByText("En attente", { exact: true })).toBeVisible();
  await expect(queue.getByText("En production", { exact: true })).toBeVisible();
  await expect(
    queue.getByRole("button", { name: "Retirer", exact: true }),
  ).toHaveCount(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("withdrawal displays exact refund and does nothing before confirmation", async ({
  page,
}) => {
  const actions = await fixture(page);
  await page.getByRole("button", { name: "Retirer", exact: true }).click();
  await expect(
    page.getByText("Métal : 22500 · Cristal : 7200 · Deutérium : 0"),
  ).toBeVisible();
  expect(actions).toHaveLength(0);
  await page.getByRole("button", { name: "Conserver", exact: true }).click();
  expect(actions).toHaveLength(0);
  await page.getByRole("button", { name: "Retirer", exact: true }).click();
  await page
    .getByRole("button", { name: "Confirmer le retrait", exact: true })
    .click();
  await expect(page.getByText("Chasseur Léger ×10")).toHaveCount(0);
  expect(actions).toEqual(["/shipyard/queue/waiting"]);
  await expect(page.getByText("Petit Transporteur ×100")).toBeVisible();
});
