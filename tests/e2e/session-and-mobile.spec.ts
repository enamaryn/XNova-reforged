import { test, expect } from "@playwright/test";
import { buildCredentials, registerUser } from "./helpers";

test("se souvenir de moi : cookie persistant et restauration après fermeture", async ({
  page,
  browser,
}) => {
  const credentials = buildCredentials("e2e_rem");
  await registerUser(page, credentials);
  await page.getByRole("button", { name: "Menu utilisateur" }).click();
  await page
    .getByRole("menuitem", { name: /D.connexion|Se d.connecter/ })
    .click();
  await page.waitForURL(/\/login$/);
  await page.locator("#identifier").fill(credentials.username);
  await page.locator("#password").fill("Test1234");
  await page.getByLabel("Se souvenir de moi").check();
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await page.waitForURL(/\/overview$/);
  const state = await page.context().storageState();
  expect(
    state.cookies.find((cookie) => cookie.name === "xnova_access")!.expires,
  ).toBeGreaterThan(Date.now() / 1000 + 3600);
  // Après fermeture, seul le stockage persistant et les cookies persistants subsistent.
  state.cookies = state.cookies.filter((cookie) => cookie.expires > 0);
  // Un access token devenu invalide doit être remplacé grâce au refresh token conservé.
  for (const origin of state.origins) {
    const saved = origin.localStorage.find(
      (item) => item.name === "xnova-auth",
    );
    if (saved) {
      const auth = JSON.parse(saved.value);
      auth.state.tokens.accessToken = "expired-access-token";
      saved.value = JSON.stringify(auth);
    }
  }
  await page.close();
  const reopened = await browser.newContext({
    baseURL: test.info().project.use.baseURL,
    storageState: state,
  });
  try {
    const next = await reopened.newPage();
    await next.goto("/login");
    await next.waitForURL(/\/overview$/);
    await expect(
      next.getByRole("heading", { name: "Vue d'ensemble" }),
    ).toBeVisible();
    expect(
      await next.evaluate(
        () =>
          JSON.parse(localStorage.getItem("xnova-auth")!).state.tokens
            .accessToken,
      ),
    ).not.toBe("expired-access-token");
  } finally {
    await reopened.close();
  }
});

test("sans se souvenir : aucune session persistante après fermeture", async ({
  page,
  browser,
}) => {
  const credentials = buildCredentials("e2e_sess");
  await registerUser(page, credentials);
  await page.getByRole("button", { name: "Menu utilisateur" }).click();
  await page
    .getByRole("menuitem", { name: /D.connexion|Se d.connecter/ })
    .click();
  await page.waitForURL(/\/login$/);
  await page.locator("#identifier").fill(credentials.username);
  await page.locator("#password").fill("Test1234");
  await page.getByLabel("Se souvenir de moi").uncheck();
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await page.waitForURL(/\/overview$/);
  expect(
    (await page.context().cookies()).find(
      (cookie) => cookie.name === "xnova_access",
    )!.expires,
  ).toBe(-1);
  expect(
    await page.evaluate(() => localStorage.getItem("xnova-auth")),
  ).toBeNull();
  const state = await page.context().storageState();
  state.cookies = state.cookies.filter((cookie) => cookie.expires > 0);
  await page.close();
  const reopened = await browser.newContext({
    baseURL: test.info().project.use.baseURL,
    storageState: state,
  });
  try {
    const next = await reopened.newPage();
    await next.goto("/overview");
    await expect(next.locator("#identifier")).toBeVisible();
    await expect(next).toHaveURL(/\/login$/);
  } finally {
    await reopened.close();
  }
});

for (const mobile of [false, true]) {
  test.describe(mobile ? "Mobile" : "PC", () => {
    test.use({
      viewport: mobile
        ? { width: 390, height: 844 }
        : { width: 1280, height: 720 },
      isMobile: mobile,
      hasTouch: mobile,
    });
    test("erreur de connexion au premier plan et formulaire conservé", async ({
      page,
    }) => {
      await page.goto("/login");
      await page.locator("#identifier").fill("unknown_player");
      await page.locator("#password").fill("WrongPassword123");
      await page
        .getByRole("button", { name: "Se connecter", exact: true })
        .click();
      const dialog = page.getByRole("alertdialog");
      await expect(dialog).toBeVisible();
      await expect(dialog).toContainText("Identifiants incorrects");
      const bounds = (await dialog.boundingBox())!;
      const viewport = page.viewportSize()!;
      expect(
        Math.abs(bounds.y + bounds.height / 2 - viewport.height / 2),
      ).toBeLessThan(4);
      expect(
        Math.abs(bounds.x + bounds.width / 2 - viewport.width / 2),
      ).toBeLessThan(4);
      await dialog.getByRole("button", { name: "Réessayer" }).click();
      await expect(dialog).not.toBeVisible();
      await expect(page.locator("#password")).toHaveValue("WrongPassword123");
    });
  });
}

test.describe("Navigation mobile et clavier à l’écran", () => {
  test.use({
    viewport: { width: 390, height: 667 },
    isMobile: true,
    hasTouch: true,
  });
  test("menu entier visible et défilement tactile jusqu’au dernier bloc de la vue générale", async ({
    page,
  }) => {
    await registerUser(page, buildCredentials("e2e_scroll"));
    await expect(
      page.getByRole("heading", { name: "Vue d'ensemble" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    const menu = page.getByRole("navigation", { name: "Menu du jeu" });
    await expect(
      menu.getByRole("link", { name: /Param.tres|Options/ }),
    ).toBeVisible();
    expect(
      await menu.evaluate(
        (element) => element.scrollHeight <= element.clientHeight + 1,
      ),
    ).toBe(true);
    await expect(page.getByText("Accès rapide", { exact: true })).toHaveCount(
      0,
    );
    for (const link of await menu.getByRole("link").all()) {
      const bounds = (await link.boundingBox())!;
      expect(bounds.y).toBeGreaterThanOrEqual(56);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(603);
    }
    await page.touchscreen.tap(350, 180); // Fermer le menu par le voile mobile.
    await expect
      .poll(async () => {
        const bounds = (await menu.boundingBox())!;
        return bounds.x + bounds.width;
      })
      .toBeLessThanOrEqual(0);
    const touch = await page.context().newCDPSession(page);
    // Gestes du doigt dans la zone visible, sans scrollTo qui masquerait un blocage tactile.
    for (let gesture = 0; gesture < 8; gesture++) {
      await touch.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x: 195, y: 500 }],
      });
      for (let y = 470; y >= 110; y -= 30) {
        await touch.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x: 195, y }],
        });
        await page.waitForTimeout(20);
      }
      await touch.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      await page.waitForTimeout(100);
    }
    const last = page
      .locator('a[href="/galaxy"]')
      .filter({ hasText: "Explorer les systèmes" });
    await expect(last).toBeVisible();
    await expect
      .poll(
        async () =>
          (await last.boundingBox())!.y + (await last.boundingBox())!.height,
      )
      .toBeLessThan(603);
    await expect
      .poll(() => page.evaluate(() => window.scrollY))
      .toBeGreaterThan(0);
    await touch.detach();
  });

  test("ne remonte pas au focus seul ; révèle le mot de passe quand le clavier réduit la vue", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/login");
    const password = page.locator("#password");
    await expect(password).toBeVisible();
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    const before = await page.evaluate(() => window.scrollY);
    await password.focus();
    expect(await page.evaluate(() => window.scrollY)).toBe(before);
    // Playwright n’ouvre pas un clavier OS : simuler son changement de VisualViewport.
    await page.evaluate(() => {
      Object.defineProperty(window.visualViewport!, "height", {
        configurable: true,
        value: 300,
      });
      window.visualViewport!.dispatchEvent(new Event("resize"));
    });
    await password.fill("Keyboard123");
    await expect
      .poll(
        async () =>
          (await password.boundingBox())!.y +
          (await password.boundingBox())!.height,
      )
      .toBeLessThanOrEqual(277);
    await expect(password).toHaveValue("Keyboard123");
    await page.evaluate(() => {
      Object.defineProperty(window.visualViewport!, "height", {
        configurable: true,
        value: 844,
      });
      window.visualViewport!.dispatchEvent(new Event("resize"));
    });
    await expect
      .poll(() =>
        page
          .locator("form[aria-busy]")
          .evaluate((element) => getComputedStyle(element).paddingBottom),
      )
      .toBe("0px");
  });
});

test("menu PC entièrement visible sur une fenêtre de 600 pixels de haut", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 600 });
  await registerUser(page, buildCredentials("e2e_menu"));
  const menu = page.getByRole("navigation", { name: "Menu du jeu" });
  await expect(menu).toBeVisible();
  expect(
    await menu.evaluate(
      (element) => element.scrollHeight <= element.clientHeight + 1,
    ),
  ).toBe(true);
  for (const link of await menu.getByRole("link").all()) {
    const bounds = (await link.boundingBox())!;
    expect(bounds.y + bounds.height).toBeLessThan(600);
  }
});
