import { test, expect } from "@playwright/test";
import type { BuildingInfo } from "../../apps/web/lib/api/buildings";

const names = [
  "Mine de Métal",
  "Mine de Cristal",
  "Centrale Électrique Solaire",
];
const buildings: BuildingInfo[] = names.map((name, index) => ({
  id: index + 1,
  name,
  description: "Produit des ressources pour la construction.",
  category: "resource",
  currentLevel: 2,
  maxLevel: 100,
  isMaxLevel: false,
  cost: { metal: 135, crystal: 33, deuterium: 0, energy: 0 },
  buildTime: 67,
  canBuild: true,
  canAfford: true,
  inQueue: false,
  missingRequirements: [],
  upgrade: {
    nextLevel: 3,
    energyLimited: false,
    unlocks: [],
    effects: [
      {
        key: "production",
        label: "Métal à pleine puissance",
        unit: "perHour",
        current: 100,
        next: 147.2,
        delta: 47.2,
        beneficial: true,
        compact: true,
      },
      {
        key: "energy",
        label: "Solde d’énergie de la planète",
        unit: "energy",
        current: 100,
        next: 84,
        delta: -16,
        beneficial: false,
        compact: true,
      },
    ],
  },
}));

async function fixture(
  page: import("@playwright/test").Page,
  withQueue = false,
) {
  const planet = {
    id: "ui-planet",
    name: "Planète",
    galaxy: 1,
    system: 1,
    position: 1,
  };
  const user = {
    id: "ui-player",
    username: "Joueur",
    email: "ui@example.test",
    points: 0,
    rank: 1,
    createdAt: new Date().toISOString(),
    planets: [planet],
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
    ({ user }) => {
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
      );
    },
    { user },
  );
  let queue = withQueue
    ? names.map((buildingName, i) => ({
        id: `queue-${i}`,
        buildingId: i + 1,
        buildingName,
        targetLevel: 3,
        startTime: new Date(Date.now() - 20000).toISOString(),
        endTime: new Date(Date.now() + 60000).toISOString(),
        remainingSeconds: 60,
      }))
    : [];
  const actions: string[] = [];
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.port !== "3001") return route.continue();
    let body: unknown;
    if (url.pathname === "/auth/me") body = user;
    else if (url.pathname.endsWith("/resources"))
      body = {
        metal: 598,
        crystal: 654,
        deuterium: 0,
        energy: { available: 100, used: 69 },
      };
    else if (url.pathname.endsWith("/buildings"))
      body = {
        planetId: planet.id,
        buildings,
        resources: { metal: 1000, crystal: 1000, deuterium: 0 },
      };
    else if (url.pathname.endsWith("/build-queue")) body = queue;
    else if (route.request().method() === "DELETE") {
      actions.push(url.pathname);
      queue = queue.filter((item) => !url.pathname.endsWith(item.id));
      body = { success: true };
    } else if (url.pathname.endsWith("/build")) {
      actions.push(route.request().postData()!);
      body = { success: true };
    } else
      return route.fulfill({
        status: 404,
        json: { message: "UI fixture not defined" },
      });
    await route.fulfill({ json: body });
  });
  await page.goto("/fr/buildings");
  await expect(page.getByRole("article")).toHaveCount(3);
  return actions;
}

test("compact cards, readable gains, no overflow and usable construction", async ({
  page,
}, info) => {
  const actions = await fixture(page);
  const cards = page.getByRole("article");
  const nav = page.locator("div.fixed.bottom-0");
  const bottom =
    info.project.name === "desktop" ? 800 : (await nav.boundingBox())!.y;
  const first = (await cards.nth(0).boundingBox())!;
  const second = (await cards.nth(1).boundingBox())!;
  if (info.project.name !== "desktop")
    expect(second.y + second.height).toBeLessThanOrEqual(bottom);
  if (info.project.name !== "desktop") {
    expect(first.height).toBeLessThanOrEqual(190);
    if (page.viewportSize()!.height === 844) {
      const third = (await cards.nth(2).boundingBox())!;
      expect(third.y + third.height).toBeLessThanOrEqual(bottom);
    }
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(
    cards.first().getByText("+47,2/h", { exact: true }),
  ).toBeVisible();
  await cards
    .first()
    .getByRole("button", { name: /Construire niveau/ })
    .click();
  await expect.poll(() => actions).toContain('{"buildingId":1}');
  await page.screenshot({
    path: test.info().outputPath("buildings.png"),
    fullPage: true,
  });
});

test("each queue item stays on one row and cancellation targets the correct construction", async ({
  page,
}, info) => {
  const actions = await fixture(page, true);
  const rows = page.locator('div[aria-label$="niveau 3"]');
  await expect(rows).toHaveCount(3);
  for (const row of await rows.all()) {
    expect((await row.boundingBox())!.height).toBeLessThanOrEqual(58);
    const title = (await row.locator("h4").boundingBox())!;
    const cancel = (await row.getByRole("button").boundingBox())!;
    expect(
      Math.abs(title.y + title.height / 2 - cancel.y - cancel.height / 2),
    ).toBeLessThan(2);
    await expect(row.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      /[0-9]+/,
    );
  }
  if (info.project.name === "mobile" || info.project.name === "webkit-mobile") {
    const second = (await page.getByRole("article").nth(1).boundingBox())!;
    expect(second.y + second.height).toBeLessThan(
      (await page.locator("div.fixed.bottom-0").boundingBox())!.y,
    );
  }
  await page
    .getByRole("button", { name: "Annuler Mine de Cristal", exact: true })
    .click();
  await expect(rows).toHaveCount(2);
  expect(actions).toContain("/planets/ui-planet/build-queue/queue-1");
  await page.screenshot({
    path: test.info().outputPath("queue.png"),
    fullPage: true,
  });
});

test("repeated client navigation, history and return to tab keep the page visible", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await fixture(page);
  for (let i = 0; i < 8; i++) {
    await page
      .getByRole("article")
      .first()
      .getByRole("link", { name: "Détails" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Mine de Métal", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "Variation" }),
    ).toBeVisible();
    if (i % 2) await page.goBack();
    else await page.getByRole("link", { name: "Retour", exact: true }).click();
    await expect(page.getByRole("article")).toHaveCount(3);
    await expect(page.getByRole("article").first()).toBeVisible();
    expect(
      await page
        .locator("main")
        .last()
        .evaluate((element) => {
          for (
            let current: Element | null = element.querySelector("article");
            current;
            current = current.parentElement
          ) {
            if (
              getComputedStyle(current).opacity === "0" ||
              getComputedStyle(current).visibility === "hidden"
            )
              return false;
          }
          return true;
        }),
    ).toBe(true);
  }
  const other = await page.context().newPage();
  await other.goto("about:blank");
  await other.bringToFront();
  await page.bringToFront();
  await other.close();
  await expect(page.getByRole("article").first()).toBeVisible();
  expect(errors).toEqual([]);
});
