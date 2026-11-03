import { expect, test } from "@playwright/test";

const TITLES: Record<string, string> = {
  fr: "Support et signalement de bugs",
  en: "Support and bug reports",
  es: "Soporte e informes de errores",
  de: "Support und Fehlermeldungen",
  it: "Supporto e segnalazione di bug",
};

for (const [locale, title] of Object.entries(TITLES)) {
  test(`page de support (${locale}) : lisible, sans défilement horizontal`, async ({ page }) => {
    await page.goto(`/${locale}/support`);
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(page.getByTestId("support-contact")).toBeVisible();
    await expect(page.getByTestId("support-login")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}
