import { test, expect, type Page } from "@playwright/test";

const targetId = "1eef3389-af19-4bd6-81c9-119d7d906f42";
const adminId = "a2948452-38c5-4d6a-888a-a2c644409e68";
async function fixture(page: Page) {
  const user = {
    id: adminId,
    username: "Administrateur",
    role: "ADMIN",
    email: "admin@example.test",
    planets: [],
  };
  const player = {
    id: targetId,
    username: "JoueurTest",
    email: "joueur@example.test",
    role: "PLAYER",
    emailVerifiedAt: new Date().toISOString(),
    mustVerifyEmail: false,
    points: 1234,
    rank: 4,
    banned: false,
    bannedUntil: null,
    banReason: null,
    createdAt: new Date().toISOString(),
    lastActive: new Date().toISOString(),
    technologies: [{ id: 106, name: "Technologie Espionnage", level: 8 }],
    researchQueue: [],
    fleets: [],
    incomingFleets: [],
    planets: [
      {
        id: "planet-test",
        name: "Planète Test",
        planetType: "normal",
        coordinates: "1:2:3",
        resources: { metal: 12000, crystal: 4500, deuterium: 900 },
        energy: { produced: 100, used: 60 },
        fields: { used: 20, max: 163 },
        lastUpdate: new Date().toISOString(),
        buildings: [{ id: 1, name: "Mine de Métal", level: 12 }],
        ships: [{ id: 202, name: "Petit Transporteur", amount: 42 }],
        defenses: [{ id: 401, name: "Lanceur de Missiles", amount: 15 }],
        buildQueue: [],
        shipQueue: [],
      },
    ],
  };
  await page
    .context()
    .addCookies([
      {
        name: "xnova_access",
        value: "ui-fixture",
        url: "http://127.0.0.1:3100",
      },
    ]);
  await page.addInitScript(
    (user) =>
      sessionStorage.setItem(
        "xnova-auth",
        JSON.stringify({
          state: {
            user,
            tokens: { accessToken: "ui-fixture", refreshToken: "ui-refresh" },
            remember: false,
          },
          version: 0,
        }),
      ),
    user,
  );
  const actions: { method: string; path: string; body: unknown }[] = [];
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.port !== "3001") return route.continue();
    const method = route.request().method();
    if (url.pathname === "/auth/me") return route.fulfill({ json: user });
    if (url.pathname === "/admin/config")
      return route.fulfill({
        status: 500,
        json: { message: "Configuration indisponible" },
      });
    if (url.pathname === "/admin/players")
      return route.fulfill({
        json: {
          total: 1,
          page: 1,
          pageSize: 25,
          players: [{ ...player, planets: 1 }],
        },
      });
    if (url.pathname === `/admin/players/${targetId}` && method === "GET")
      return route.fulfill({ json: player });
    if (method !== "GET") {
      actions.push({
        method,
        path: url.pathname,
        body: route.request().postDataJSON(),
      });
      if (url.pathname.endsWith("/reset")) {
        player.planets[0].ships = [];
        player.planets[0].defenses = [];
        player.technologies[0].level = 0;
        player.planets[0].buildings[0].level = 0;
      }
      if (url.pathname === "/admin/ban") player.banned = true;
      return route.fulfill({ json: { success: true } });
    }
    return route.fulfill({
      status: 404,
      json: { message: "Fixture non définie" },
    });
  });
  return actions;
}

test("admin opens a dedicated player profile even when general configuration is unavailable", async ({
  page,
}) => {
  await fixture(page);
  await page.goto("/fr/admin");
  await page.getByRole("link", { name: "Voir la fiche de JoueurTest" }).click();
  await expect(page).toHaveURL(`/fr/admin/players/${targetId}`);
  const profile = page.getByRole("region", { name: "Fiche de JoueurTest" });
  await expect(profile).toBeVisible();
  await expect(profile.getByText("Petit Transporteur")).toBeVisible();
  await expect(profile.getByText("Lanceur de Missiles")).toBeVisible();
  await expect(profile.getByText("Technologie Espionnage")).toBeVisible();
  await expect(profile.getByText("Niv. 12")).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("region", { name: "Fiche de JoueurTest" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Retour aux joueurs", exact: false }),
  ).toBeVisible();
});

test("reset requires the exact player name and reason, and refreshes the displayed progression", async ({
  page,
}) => {
  const actions = await fixture(page);
  await page.goto(`/fr/admin/players/${targetId}`);
  await page
    .getByRole("button", { name: "Réinitialiser la progression", exact: true })
    .click();
  const confirm = page.getByRole("button", {
    name: "Confirmer réinitialiser la progression",
  });
  await expect(confirm).toBeDisabled();
  await page.getByLabel("Motif", { exact: true }).fill("Correction du compte");
  await page
    .getByLabel("Retapez le pseudo", { exact: false })
    .fill("MauvaisPseudo");
  await expect(confirm).toBeDisabled();
  expect(actions).toHaveLength(0);
  await page
    .getByLabel("Retapez le pseudo", { exact: false })
    .fill("JoueurTest");
  await confirm.click();
  await expect(
    page.getByText("Progression réinitialisée.", { exact: false }),
  ).toBeVisible();
  expect(actions[0]).toMatchObject({
    method: "POST",
    path: `/admin/players/${targetId}/reset`,
    body: {
      confirmationUsername: "JoueurTest",
      reason: "Correction du compte",
    },
  });
  await expect(page.getByText("Niv. 12")).toHaveCount(0);
});

test("ban and deletion are available on the profile, cancellation does not delete", async ({
  page,
}) => {
  const actions = await fixture(page);
  await page.goto(`/fr/admin/players/${targetId}`);
  await page.getByRole("button", { name: "Bannir", exact: true }).click();
  await page.getByLabel("Durée en jours", { exact: false }).fill("7");
  await page
    .getByLabel("Motif", { exact: true })
    .fill("Non-respect des règles");
  await page
    .getByLabel("Retapez le pseudo", { exact: false })
    .fill("JoueurTest");
  await page.getByRole("button", { name: "Confirmer bannir" }).click();
  await expect(
    page.getByRole("button", { name: "Débannir", exact: true }),
  ).toBeVisible();
  expect(actions[0]).toMatchObject({
    path: "/admin/ban",
    body: { username: "JoueurTest", days: 7 },
  });
  await page
    .getByRole("button", { name: "Supprimer le compte", exact: true })
    .click();
  await page.getByRole("button", { name: "Annuler" }).click();
  expect(actions).toHaveLength(1);
  await page
    .getByRole("button", { name: "Supprimer le compte", exact: true })
    .click();
  await page
    .getByLabel("Motif", { exact: true })
    .fill("Demande de suppression");
  await page
    .getByLabel("Retapez le pseudo", { exact: false })
    .fill("JoueurTest");
  await page
    .getByRole("button", { name: "Confirmer supprimer le compte" })
    .click();
  await expect(page).toHaveURL("/fr/admin");
  expect(actions[1]).toMatchObject({
    method: "DELETE",
    path: `/admin/players/${targetId}`,
    body: { confirmationUsername: "JoueurTest" },
  });
});
