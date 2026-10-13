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

const quests = {
  rewardMultiplier: 1.4,
  commanderLevel: 5,
  daily: {
    periodKey: "2026-10-13",
    resetsAt: new Date(Date.now() + 5 * 3600000).toISOString(),
    quests: [
      { id: "daily_build_3", metric: "buildings", target: 3, progress: 3, reward: { metal: 28000, crystal: 0, deuterium: 0 }, claimed: false, claimable: true },
      { id: "daily_units_50", metric: "units", target: 50, progress: 12, reward: { metal: 0, crystal: 0, deuterium: 11200 }, claimed: false, claimable: false },
      { id: "daily_research_1", metric: "research", target: 1, progress: 1, reward: { metal: 0, crystal: 21000, deuterium: 0 }, claimed: true, claimable: false },
    ],
  },
  weekly: {
    periodKey: "2026-W42",
    resetsAt: new Date(Date.now() + 3 * 86400000).toISOString(),
    quests: [
      { id: "weekly_expedition_5", metric: "expeditions", target: 5, progress: 2, reward: { metal: 0, crystal: 70000, deuterium: 112000 }, claimed: false, claimable: false },
      { id: "weekly_combat_5", metric: "combatsWon", target: 5, progress: 0, reward: { metal: 140000, crystal: 0, deuterium: 84000 }, claimed: false, claimable: false },
    ],
  },
};

const achievements = {
  total: 6,
  unlocked: 2,
  percent: 33,
  newlyUnlocked: ["buildings_10"],
  categories: [
    {
      category: "build",
      achievements: [
        { id: "buildings_10", category: "build", metric: "buildings", target: 10, progress: 10, unlocked: true, unlockedAt: "2026-10-12T10:00:00Z" },
        { id: "buildings_100", category: "build", metric: "buildings", target: 100, progress: 12, unlocked: false, unlockedAt: null },
      ],
    },
    {
      category: "progression",
      achievements: [
        { id: "commanderLevel_5", category: "progression", metric: "commanderLevel", target: 5, progress: 5, unlocked: true, unlockedAt: "2026-10-11T10:00:00Z" },
        { id: "commanderLevel_10", category: "progression", metric: "commanderLevel", target: 10, progress: 5, unlocked: false, unlockedAt: null },
      ],
    },
    {
      category: "social",
      achievements: [{ id: "groupAttacks_1", category: "social", metric: "groupAttacks", target: 1, progress: 0, unlocked: false, unlockedAt: null }],
    },
    {
      category: "exploration",
      achievements: [{ id: "expeditions_50", category: "exploration", metric: "expeditions", target: 50, progress: 2, unlocked: false, unlockedAt: null }],
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
    else if (path === "/quests") body = quests;
    else if (path === "/achievements") body = achievements;
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

    test("quêtes : cartes, barres de progression et boutons sans débordement", async ({ page }) => {
      await fixture(page, locale);
      await page.goto(`/${locale}/quests`);
      await expect(page.getByTestId("quest-daily_build_3")).toHaveAttribute("data-state", "claimable");
      await expect(page.getByTestId("claim-daily_build_3")).toBeEnabled();
      await expect(page.getByTestId("claim-daily_units_50")).toBeDisabled();
      await expect(page.getByTestId("quest-daily_research_1")).toHaveAttribute("data-state", "claimed");
      await expect(page.getByTestId("quests-weekly")).toBeVisible();
      expect(await noOverflow(page)).toBe(true);
      await buttonsFit(page);
    });

    test("succès : grille par catégorie sans débordement", async ({ page }) => {
      await fixture(page, locale);
      await page.goto(`/${locale}/achievements`);
      await expect(page.getByTestId("achievements-summary")).toBeVisible();
      await expect(page.getByTestId("achievement-buildings_10")).toHaveAttribute("data-unlocked", "true");
      await expect(page.getByTestId("achievement-buildings_100")).toHaveAttribute("data-unlocked", "false");
      expect(await noOverflow(page)).toBe(true);
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
