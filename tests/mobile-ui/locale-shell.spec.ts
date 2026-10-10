import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test, expect, type Page } from "@playwright/test";

/**
 * Le cadre de jeu (barre du bas sur mobile, sélecteur de planète, menu utilisateur) suit la langue
 * de l'URL, y compris le nom de planète créé par défaut en français par le serveur.
 */
const dictionary = (locale: string) =>
  JSON.parse(
    readFileSync(
      join(process.cwd(), "apps/web/i18n/game", `${locale}.json`),
      "utf8",
    ),
  );

async function fixture(page: Page, locale: string, path = "overview") {
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
      return route.fulfill({
        json: {
          commanderLevel: 50,
          power: 1180000,
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
    if (url.pathname === "/reports" || url.pathname === "/spy-reports")
      return route.fulfill({ json: [] });
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
  await page.goto(`/${locale}/${path}`);
}

for (const locale of ["fr", "en", "es", "de", "it"]) {
  test(`cadre de jeu en ${locale} : navigation, planète par défaut et menu`, async ({
    page,
  }) => {
    const t = dictionary(locale);
    await fixture(page, locale);
    const mobile = (page.viewportSize()?.width ?? 1280) < 768;

    // Nom de planète par défaut traduit (tronqué à 8 caractères sur mobile)
    const homeworld: string = t.planet.homeworld;
    await expect(
      page
        .getByText(mobile ? homeworld.substring(0, 8) : homeworld, {
          exact: true,
        })
        .first(),
    ).toBeVisible();
    if (locale !== "fr")
      await expect(page.getByText("Planète Mère")).toHaveCount(0);

    // Barre de navigation rapide du bas (mobile uniquement)
    if (mobile) {
      const bar = page.locator("div.fixed.bottom-0");
      for (const [href, key] of [
        ["/overview", "overview"],
        ["/buildings", "buildings"],
        ["/research", "research"],
        ["/fleet", "fleet"],
        ["/galaxy", "galaxy"],
      ]) {
        await expect(bar.locator(`a[href="${href}"]`)).toContainText(
          t.nav[key],
        );
      }
    }

    // Menu utilisateur
    await page.getByRole("button", { name: t.nav.userMenu }).click();
    const menu = page.getByRole("menu", { name: t.nav.userMenu });
    await expect(
      menu.getByRole("menuitem", { name: t.nav.settings }),
    ).toBeVisible();
    await expect(
      menu.getByRole("menuitem", { name: t.nav.logout }),
    ).toBeVisible();
  });
}

for (const locale of ["fr", "en", "es", "de", "it"]) {
  test(`rapports en ${locale} : titres, filtres et états vides traduits`, async ({
    page,
  }) => {
    const t = dictionary(locale);
    await fixture(page, locale, "reports");
    await expect(
      page.getByRole("heading", { name: t.reports.title, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(t.reports.empty, { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: t.reports.filterWins, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(t.reports.spyEmpty, { exact: true }),
    ).toBeVisible();
  });

  test(`page publique et récupération de mot de passe en ${locale}`, async ({
    page,
  }) => {
    const messages = JSON.parse(
      readFileSync(
        join(process.cwd(), "apps/web/i18n/messages", `${locale}.json`),
        "utf8",
      ),
    );
    await page.goto(`/${locale}`);
    await expect(page.getByText(messages.home.titleLine1)).toBeVisible();
    await expect(
      page.getByRole("region", { name: messages.home.universeAria }),
    ).toBeVisible();

    await page.goto(`/${locale}/forgot-password`);
    await expect(
      page.getByRole("heading", { name: messages.recovery.forgotTitle }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: messages.recovery.sendLink }),
    ).toBeVisible();
  });
}
