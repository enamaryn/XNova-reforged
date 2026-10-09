import { test, expect, type Page } from "@playwright/test";

async function fixture(page: Page, failProgression = false, power = 1180000) {
  const user = {
    id: "header-player",
    username: "Commandant",
    email: "header@example.test",
    role: "PLAYER",
    rank: 0,
    points: 999999,
    planets: [
      {
        id: "header-planet",
        name: "Planète Mère",
        galaxy: 1,
        system: 1,
        position: 1,
      },
    ],
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
  let unavailable = failProgression;
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.port !== "3001") return route.continue();
    if (url.pathname === "/auth/me") return route.fulfill({ json: user });
    if (url.pathname === "/statistics")
      return route.fulfill({
        json: {
          personal: {
            id: user.id,
            username: user.username,
            rank: 1,
            points: 1180000,
            planets: 1,
          },
          topPlayers: [
            { id: user.id, username: user.username, rank: 1, points: 1180000 },
          ],
          topAlliances: [],
        },
      });
    if (url.pathname === "/progression") {
      if (unavailable)
        return route.fulfill({
          status: 503,
          json: { message: "Indisponible" },
        });
      return route.fulfill({
        json: {
          commanderLevel: 50,
          power,
          development: 1176490,
          levelDevelopment: 1176490,
          nextLevelDevelopment: 1250000,
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
        },
      });
    }
    if (url.pathname.endsWith("/resources"))
      return route.fulfill({
        json: {
          planetId: "header-planet",
          resources: { metal: 1000, crystal: 500, deuterium: 200 },
          production: { metal: 30, crystal: 15, deuterium: 0 },
          energy: { available: 100, used: 20, productionLevel: 1 },
          storage: { metal: 1000000, crystal: 1000000, deuterium: 1000000 },
        },
      });
    return route.fulfill({
      status: 404,
      json: { message: "Donnée non définie dans la simulation" },
    });
  });
  await page.goto("/fr/overview");
  return () => {
    unavailable = false;
  };
}

test("niveau et puissance restent visibles dans le bandeau sans ouvrir le menu", async ({
  page,
}) => {
  await fixture(page);
  const header = page.locator("header");
  const status = header.getByRole("group", {
    name: "Niveau et puissance du commandant",
  });
  await expect(status).toContainText("Niveau 50/100");
  await expect(status).toContainText(/Puissance 1\s180\s000/);
  await expect(status).toBeInViewport();
  await expect(
    page.getByRole("heading", { name: "Vue d'ensemble" }),
  ).toBeVisible();
  const summary = page.getByRole("region", {
    name: "Développement et puissance",
  });
  expect((await summary.boundingBox())!.y).toBeGreaterThanOrEqual(
    (await header.boundingBox())!.height,
  );
  await page.evaluate(() =>
    window.scrollTo(0, document.documentElement.scrollHeight),
  );
  await expect(status).toBeInViewport();
  await expect(page.getByText("Rang #0", { exact: false })).toHaveCount(0);
  await header.getByRole("button", { name: "Menu utilisateur" }).click();
  await expect(
    header.getByRole("menuitem", {
      name: "Rang au classement : #1",
      exact: true,
    }),
  ).toHaveAttribute("href", "/statistics");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: test.info().outputPath("commander-header.png"),
    fullPage: true,
  });
});

test("une panne ne présente pas de faux niveau et le bandeau permet de réessayer", async ({
  page,
}) => {
  const recover = await fixture(page, true);
  const status = page
    .locator("header")
    .getByRole("group", { name: "Niveau et puissance du commandant" });
  await expect(status).toContainText("Niveau —/100");
  await expect(status).toContainText("Puissance —");
  const retry = status.getByRole("button", {
    name: "Réessayer le chargement du niveau et de la puissance",
  });
  await expect(retry).toBeVisible();
  recover();
  await retry.click();
  await expect(status).toContainText("Niveau 50/100");
  await expect(status).toContainText(/Puissance 1\s180\s000/);
});

test("le bandeau conserve une puissance très élevée sans déborder", async ({
  page,
}) => {
  await fixture(page, false, Number.MAX_SAFE_INTEGER);
  const status = page
    .locator("header")
    .getByRole("group", { name: "Niveau et puissance du commandant" });
  await expect(status).toContainText(
    new Intl.NumberFormat("fr-FR").format(Number.MAX_SAFE_INTEGER),
  );
  const box = (await status.boundingBox())!;
  for (const value of await status.locator("strong").all()) {
    const bounds = (await value.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(box.x);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(box.x + box.width);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(box.y + box.height);
  }
});
