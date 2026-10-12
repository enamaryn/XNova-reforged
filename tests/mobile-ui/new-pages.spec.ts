import { test, expect, type Page } from "@playwright/test";

// Pages ajoutées par les lots Officiers, Commandants de flotte, Attaques groupées et Lunes :
// aucun débordement horizontal, boutons entiers dans l'écran, en français et en allemand (textes les plus longs).
const planet = { id: "ui-planet", name: "Planète principale", galaxy: 1, system: 1, position: 1, isMoon: false };
const moon = { id: "ui-moon", name: "Lune", galaxy: 1, system: 1, position: 1, isMoon: true };

const officers = {
  cost: 500000,
  officers: [
    { type: "intendant", bonus: { energy: 0.1, extraBuildSlots: 1 }, hired: false, hiredAt: null },
    { type: "admiral", bonus: { fleetSpeed: 0.1, extraExpeditions: 2 }, hired: true, hiredAt: "2026-10-01T00:00:00Z" },
    { type: "engineer", bonus: { buildTimeReduction: 0.1 }, hired: false, hiredAt: null },
    { type: "geologist", bonus: { mineProduction: 0.1, storage: 0.1 }, hired: false, hiredAt: null },
    { type: "technocrat", bonus: { researchTimeReduction: 0.1, espionageLevels: 2 }, hired: false, hiredAt: null },
  ],
  active: {},
};

const commanders = {
  cost: 250000,
  max: 3,
  maxLevel: 20,
  maxSkill: 10,
  commanders: [
    {
      id: "c1", name: "Aldric", level: 3, experience: 2600, levelStartExperience: 2500, nextLevelExperience: 4750,
      skillPoints: 2, skills: { attack: 3, defense: 1, speed: 0, cargo: 2 },
      bonuses: { attack: 0.03, defense: 0.01, speed: 0, cargo: 0.02 }, busy: false,
    },
    {
      id: "c2", name: "Brenn le Redoutable", level: 12, experience: 90000, levelStartExperience: 80000, nextLevelExperience: 120000,
      skillPoints: 0, skills: { attack: 10, defense: 10, speed: 10, cargo: 10 },
      bonuses: { attack: 0.1, defense: 0.1, speed: 0.1, cargo: 0.1 }, busy: true,
    },
  ],
};

const moonOverview = {
  moonId: moon.id,
  deuterium: 120000,
  phalanx: { level: 3, range: 8, cost: 5000, galaxy: 1, system: 1 },
  jumpGate: {
    level: 1,
    readyAt: null,
    cooldownSeconds: 3600,
    destinations: [{ id: "m2", name: "Lune lointaine", galaxy: 2, system: 40, position: 7, jumpGate: 2, jumpGateReadyAt: null }],
  },
};

async function fixture(page: Page, locale: string, withMoon = false) {
  const planets = withMoon ? [planet, moon] : [planet];
  const user = {
    id: "ui-player", username: "Joueur", email: "ui@example.test", points: 0, rank: 1,
    createdAt: new Date().toISOString(), planets,
  };
  await page.context().addCookies([{ name: "xnova_access", value: "ui-fixture", url: "http://127.0.0.1:3100" }]);
  await page.addInitScript(
    ({ user, planetId }) => {
      sessionStorage.setItem(
        "xnova-auth",
        JSON.stringify({ state: { user, tokens: { accessToken: "ui-fixture", refreshToken: "ui-refresh" }, remember: false }, version: 0 }),
      );
      localStorage.setItem("xnova-planet", JSON.stringify({ state: { selectedPlanetId: planetId }, version: 0 }));
    },
    { user, planetId: withMoon ? moon.id : planet.id },
  );
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.port !== "3001") return route.continue();
    const path = url.pathname;
    let body: unknown;
    if (path === "/auth/me") body = user;
    else if (path.endsWith("/resources")) body = { metal: 598, crystal: 654, deuterium: 120000, energy: { available: 100, used: 69 } };
    else if (path === "/officers") body = officers;
    else if (path === "/fleet-commanders") body = commanders;
    else if (path.startsWith("/fleet/available/"))
      body = { planetId: planet.id, ships: [{ shipId: 206, name: "Croiseur", amount: 30 }, { shipId: 203, name: "Grand transporteur", amount: 10 }], fleetSlots: { inFlight: 0, max: 3 } };
    else if (path === "/fleet/active") body = [];
    else if (path === "/fleet/attack-groups")
      body = { max: 5, groups: [{ id: "g1", creator: "Capitaine Aldebaran", target: { galaxy: 1, system: 1, position: 1, moon: false }, arrivalTime: new Date(Date.now() + 3600000).toISOString(), fleets: 2 }] };
    else if (path === `/moons/${moon.id}`) body = moonOverview;
    else if (path === "/technologies") body = { technologies: [], labNetwork: { networkLevel: 0, ownLab: 0, effectiveLab: 0, linked: 0 } };
    else return route.fulfill({ status: 404, json: { message: "UI fixture not defined" } });
    await route.fulfill({ json: body });
  });
  void locale;
}

const noOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);

/**
 * Aucun bouton de la page n'est coupé par le bord de l'écran. Les boutons d'une zone qui défile
 * volontairement (bandeau de ressources, par exemple) sont ignorés : leur débordement est prévu.
 */
async function buttonsFit(page: Page) {
  const offenders = await page.evaluate(() => {
    const width = innerWidth;
    const scrolls = (el: Element | null) => {
      for (let node = el?.parentElement ?? null; node; node = node.parentElement) {
        const overflow = getComputedStyle(node).overflowX;
        if ((overflow === "auto" || overflow === "scroll") && node.scrollWidth > node.clientWidth) return true;
      }
      return false;
    };
    return Array.from(document.querySelectorAll("main button"))
      .filter((button) => (button as HTMLElement).offsetParent !== null && !scrolls(button))
      .map((button) => ({ text: (button.textContent ?? "").trim().slice(0, 40), box: button.getBoundingClientRect() }))
      .filter(({ box }) => box.left < -1 || box.right > width + 1)
      .map(({ text, box }) => `${text} [${Math.round(box.left)}..${Math.round(box.right)}]`);
  });
  expect(offenders).toEqual([]);
}

for (const locale of ["fr", "de"]) {
  test.describe(`nouvelles pages (${locale})`, () => {
    test("officiers : cartes lisibles et bouton d'embauche entier", async ({ page }) => {
      await fixture(page, locale);
      await page.goto(`/${locale}/officers`);
      await expect(page.getByTestId("officer-geologist")).toBeVisible();
      await expect(page.getByTestId("hire-geologist")).toBeVisible();
      expect(await noOverflow(page)).toBe(true);
      await buttonsFit(page);
    });

    test("commandants : formulaire, compétences et noms longs sans débordement", async ({ page }) => {
      await fixture(page, locale);
      await page.goto(`/${locale}/commanders`);
      await expect(page.getByTestId("commander-Aldric")).toBeVisible();
      await expect(page.getByTestId("commander-Brenn le Redoutable")).toBeVisible();
      await expect(page.getByTestId("skill-Aldric-attack")).toBeEnabled();
      expect(await noOverflow(page)).toBe(true);
      await buttonsFit(page);
    });

    test("flotte : liste des commandants et des groupes d'attaque groupée sans débordement", async ({ page }) => {
      await fixture(page, locale);
      await page.goto(`/${locale}/fleet?mission=acs&galaxy=1&system=1&position=1`);
      await expect(page.getByTestId("acs-options")).toBeVisible();
      await expect(page.getByTestId("acs-group").locator("option")).toHaveCount(2);
      await expect(page.getByTestId("fleet-commander-select")).toBeVisible();
      expect(await noOverflow(page)).toBe(true);
      await buttonsFit(page);
    });

    test("lune : phalange et porte de saut sans débordement", async ({ page }) => {
      await fixture(page, locale, true);
      await page.goto(`/${locale}/moon`);
      await expect(page.getByTestId("phalanx-panel")).toBeVisible();
      expect(await noOverflow(page)).toBe(true);
      await buttonsFit(page);
    });
  });
}
