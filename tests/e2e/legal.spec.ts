import { test, expect } from "@playwright/test";

const TITLES: Record<string, { terms: RegExp; privacy: RegExp }> = {
  fr: { terms: /Conditions d'utilisation/, privacy: /Politique de confidentialité/ },
  en: { terms: /Terms of Use/, privacy: /Privacy Policy/ },
  es: { terms: /Condiciones de uso/, privacy: /Política de privacidad/ },
  de: { terms: /Nutzungsbedingungen/, privacy: /Datenschutzerklärung/ },
  it: { terms: /Condizioni d'uso/, privacy: /Informativa sulla privacy/ },
};

test("conditions et confidentialité sont publiques, dans les cinq langues, sans marqueur non remplacé", async ({ page }) => {
  for (const [locale, titles] of Object.entries(TITLES)) {
    for (const doc of ["terms", "privacy"] as const) {
      await page.goto(`/${locale}/${doc}`);
      await expect(page.getByRole("heading", { level: 1, name: titles[doc] })).toBeVisible();
      const text = await page.getByTestId("legal-document").innerText();
      expect(text).not.toContain("{{");
    }
  }
});

test("le pied de page et l'inscription renvoient vers les deux textes", async ({ page }) => {
  await page.goto("/fr/faq");
  const links = page.getByTestId("legal-links");
  await expect(links.getByRole("link", { name: "Conditions d'utilisation" })).toBeVisible();
  await links.getByRole("link", { name: "Politique de confidentialité" }).click();
  await expect(page).toHaveURL(/\/fr\/privacy$/);
  // Lien croisé dans le texte, vers la même langue
  await page.getByTestId("legal-document").getByRole("link", { name: "conditions d'utilisation" }).click();
  await expect(page).toHaveURL(/\/fr\/terms$/);

  await page.goto("/fr/register");
  const notice = page.getByTestId("legal-accept-notice");
  await expect(notice).toContainText("vous acceptez");
  await expect(notice.getByRole("link", { name: "Politique de confidentialité" })).toHaveAttribute("href", /\/privacy$/);
});
