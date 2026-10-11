"use client";

import { RECOMMENDED_SPEED_PROFILE, SPEED_PROFILES } from "@xnova/game-config";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { localeFlags, localeNames, locales, pathWithLocale, persistLocaleCookie, type Locale } from "@/lib/i18n/locale";
import { ApiError } from "@/lib/api/client";
import {
  createSetupAdmin,
  getSetupState,
  getSetupStatus,
  resendSetupAdmin,
  saveSetupLanguage,
  saveSetupSettings,
  saveSetupSmtp,
  testSetupSmtp,
  type ServerSettings,
  type SetupState,
} from "@/lib/api/setup";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Step = "code" | "smtp" | "settings" | "admin" | "validation" | "done";

const TOKEN_KEY = "xnova-setup-token";
const STEPS: Array<{ id: Exclude<Step, "done"> }> = [
  { id: "code" },
  { id: "smtp" },
  { id: "settings" },
  { id: "admin" },
  { id: "validation" },
];

const SETTING_FIELDS: Array<{ key: keyof ServerSettings; step?: string }> = [
  { key: "gameSpeed", step: "any" },
  { key: "fleetSpeed", step: "any" },
  { key: "resourceMultiplier", step: "any" },
  { key: "buildingCostMultiplier", step: "any" },
  { key: "researchCostMultiplier", step: "any" },
  { key: "shipCostMultiplier", step: "any" },
  { key: "planetSize" },
  { key: "maxBuildingLevel" },
  { key: "maxTechnologyLevel" },
  { key: "baseMetal", step: "any" },
  { key: "baseCrystal", step: "any" },
  { key: "baseDeuterium", step: "any" },
];

const messageOf = (error: unknown, fallback: string) => (error instanceof ApiError ? error.message : fallback);

function firstIncomplete(state: SetupState): Step {
  if (!state.smtp.tested) return "smtp";
  if (!state.settings.saved) return "settings";
  if (!state.admin) return "admin";
  return "validation";
}

function Notice({ kind, children }: { kind: "ok" | "error"; children: React.ReactNode }) {
  return (
    <p
      role={kind === "error" ? "alert" : "status"}
      data-testid={kind === "error" ? "setup-error" : "setup-notice"}
      className={`rounded-2xl border p-3 text-sm ${
        kind === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-700"
      }`}
    >
      {children}
    </p>
  );
}

/**
 * Parcours d'installation du serveur (SETUP-01) : code lu dans le terminal, SMTP testé, réglages, super admin,
 * puis validation du compte par le lien reçu par email. La validation termine et verrouille l'installation.
 */
export function SetupWizard() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const [token, setToken] = useState<string>("");
  const [state, setState] = useState<SetupState | null>(null);
  const [step, setStep] = useState<Step>("code");
  const [booting, setBooting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [codeInput, setCodeInput] = useState("");
  const [smtp, setSmtp] = useState({ host: "", port: "587", secure: false, username: "", password: "", fromEmail: "", fromName: "XNova Reforged" });
  const [testTo, setTestTo] = useState("");
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [admin, setAdmin] = useState({ username: "", email: "", password: "", confirmation: "" });
  const stepRef = useRef<Step>("code");
  stepRef.current = step;

  const adopt = useCallback((next: SetupState, goTo?: Step) => {
    setState(next);
    setSmtp((prev) => ({
      ...prev,
      host: next.smtp.host,
      port: String(next.smtp.port),
      secure: next.smtp.secure,
      username: next.smtp.username,
      fromEmail: next.smtp.fromEmail,
      fromName: next.smtp.fromName || prev.fromName,
    }));
    setTestTo((prev) => prev || next.smtp.fromEmail);
    setSettings(Object.fromEntries(Object.entries(next.settings.values).map(([k, v]) => [k, String(v)])));
    if (next.admin) setAdmin((prev) => ({ ...prev, username: next.admin!.username, email: next.admin!.email }));
    if (goTo) setStep(goTo);
  }, []);

  const finish = useCallback(() => {
    sessionStorage.removeItem(TOKEN_KEY);
    setStep("done");
  }, []);

  // Démarrage : installation déjà terminée ? code mémorisé encore valide ?
  useEffect(() => {
    (async () => {
      try {
        // Le bootstrap transmet le code dans le fragment : jamais dans les logs HTTP ni le Referer.
        const bootstrapToken = new URLSearchParams(window.location.hash.slice(1)).get("bootstrap-token");
        if (bootstrapToken) {
          window.history.replaceState(null, "", window.location.pathname + window.location.search);
          if (/^[a-f0-9]{64}$/.test(bootstrapToken)) sessionStorage.setItem(TOKEN_KEY, bootstrapToken);
        }
        const status = await getSetupStatus();
        if (!status.setupRequired) {
          window.location.replace("/login");
          return;
        }
        const saved = sessionStorage.getItem(TOKEN_KEY);
        if (saved) {
          try {
            const next = await getSetupState(saved);
            setToken(saved);
            adopt(next, firstIncomplete(next));
          } catch {
            sessionStorage.removeItem(TOKEN_KEY);
          }
        }
      } catch (e) {
        setError(messageOf(e, t("setup.genericError")));
      } finally {
        setBooting(false);
      }
    })();
  }, [adopt]); // eslint-disable-line react-hooks/exhaustive-deps

  // Étape de validation : on attend le clic sur le lien (l'installation se termine alors côté serveur)
  useEffect(() => {
    if (step !== "validation") return;
    const timer = window.setInterval(async () => {
      try {
        const status = await getSetupStatus();
        if (!status.setupRequired) finish();
      } catch {
        // coupure passagère : on réessaie au prochain passage
      }
    }, 3000);
    return () => window.clearInterval(timer);
  }, [step, finish]);

  const run = async (action: () => Promise<void>) => {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      await action();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        sessionStorage.removeItem(TOKEN_KEY);
        setToken("");
        setStep("code");
      } else if (e instanceof ApiError && e.status === 404) {
        finish();
        return;
      }
      setError(messageOf(e, t("setup.genericError")));
    } finally {
      setBusy(false);
    }
  };

  const submitCode = (event: React.FormEvent) => {
    event.preventDefault();
    run(async () => {
      const code = codeInput.trim();
      const next = await getSetupState(code);
      sessionStorage.setItem(TOKEN_KEY, code);
      setToken(code);
      // La langue d'installation (celle de l'interface) devient la langue du serveur dès que le code est accepté
      await saveSetupLanguage(code, locale);
      adopt(next, firstIncomplete(next));
    });
  };

  const submitSmtp = (event: React.FormEvent) => {
    event.preventDefault();
    run(async () => {
      const payload: Record<string, unknown> = {
        host: smtp.host.trim(),
        port: Number(smtp.port),
        secure: smtp.secure,
        username: smtp.username.trim(),
        fromEmail: smtp.fromEmail.trim(),
        fromName: smtp.fromName.trim(),
      };
      if (smtp.password) payload.password = smtp.password;
      adopt(await saveSetupSmtp(token, payload));
      setSmtp((prev) => ({ ...prev, password: "" }));
      setNotice(t("setup.smtp.saved"));
    });
  };

  const sendTest = () =>
    run(async () => {
      const result = await testSetupSmtp(token, testTo.trim());
      adopt(await getSetupState(token));
      setNotice(t("setup.smtp.testSent", { to: result.to }));
    });

  const submitSettings = (event: React.FormEvent) => {
    event.preventDefault();
    run(async () => {
      const payload: Record<string, number> = {};
      for (const field of SETTING_FIELDS) {
        const raw = settings[field.key];
        if (raw !== undefined && raw !== "") payload[field.key] = Number(raw);
      }
      adopt(await saveSetupSettings(token, payload), "admin");
    });
  };

  const submitAdmin = (event: React.FormEvent) => {
    event.preventDefault();
    if (admin.password !== admin.confirmation) {
      setError(t("setup.admin.mismatch"));
      return;
    }
    run(async () => {
      const next = await createSetupAdmin(token, {
        username: admin.username.trim(),
        email: admin.email.trim(),
        password: admin.password,
      });
      setAdmin((prev) => ({ ...prev, password: "", confirmation: "" }));
      adopt(next, "validation");
    });
  };

  const changeLanguage = (next: Locale) => {
    if (next === locale) return;
    persistLocaleCookie(next);
    // Le serveur mémorise la langue dès que le code d'installation est connu ; sinon à la validation du code
    if (token) void saveSetupLanguage(token, next).catch(() => undefined);
    router.replace(pathWithLocale(pathname, next));
  };

  const resend = () =>
    run(async () => {
      const result = await resendSetupAdmin(token);
      setNotice(result.message);
    });

  if (booting) return <p className="text-sm text-slate-500">{t("setup.loading")}</p>;

  if (step === "done") {
    return (
      <div className="space-y-5" data-testid="setup-done">
        <p className="text-xs uppercase tracking-[0.35em] text-slate-400">{t("setup.done.kicker")}</p>
        <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">{t("setup.done.title")}</h1>
        <Notice kind="ok">
          {t("setup.done.notice")}
        </Notice>
        <Link href="/login" className="text-sm font-semibold text-slate-900">
          {t("setup.done.login")}
        </Link>
      </div>
    );
  }

  const current = STEPS.findIndex((s) => s.id === step);
  const reachable = (id: Step) => {
    if (!state) return id === "code";
    const order: string[] = STEPS.map((s) => s.id);
    return order.indexOf(id) <= order.indexOf(firstIncomplete(state));
  };

  return (
    <div className="space-y-6" data-testid="setup-wizard">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.35em] text-slate-400">{t("setup.kicker")}</p>
        <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">{t("setup.title")}</h1>
      </div>

      <div className="space-y-2" data-testid="setup-language">
        <p className="text-sm font-semibold text-slate-800">{t("setup.language.title")}</p>
        <p className="text-xs text-slate-500">{t("setup.language.hint")}</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label={t("setup.language.title")}>
          {locales.map((item) => (
            <button
              key={item}
              type="button"
              lang={item}
              aria-pressed={item === locale}
              data-testid={`setup-language-${item}`}
              onClick={() => changeLanguage(item)}
              className={`rounded-full border px-3 py-1 text-sm ${
                item === locale ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-600 hover:border-slate-400"
              }`}
            >
              {localeFlags[item]} {localeNames[item]}
            </button>
          ))}
        </div>
      </div>

      <ol className="flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.15em]" aria-label={t("setup.stepsLabel")}>
        {STEPS.map((s, index) => {
          const clickable = token && s.id !== "code" && s.id !== "validation" && reachable(s.id);
          return (
            <li key={s.id}>
              <button
                type="button"
                disabled={!clickable}
                onClick={() => clickable && setStep(s.id)}
                aria-current={index === current ? "step" : undefined}
                className={`rounded-full border px-3 py-1 ${
                  index === current
                    ? "border-slate-900 bg-slate-900 text-white"
                    : index < current
                      ? "border-emerald-300 text-emerald-700"
                      : "border-slate-200 text-slate-400"
                }`}
              >
                {index + 1}. {t(`setup.steps.${s.id}`)}
              </button>
            </li>
          );
        })}
      </ol>

      {error ? <Notice kind="error">{error}</Notice> : null}
      {notice ? <Notice kind="ok">{notice}</Notice> : null}

      {step === "code" && (
        <form className="space-y-5" onSubmit={submitCode}>
          <p className="text-sm text-slate-600">
            {t("setup.code.intro")}
          </p>
          <pre className="overflow-x-auto rounded-2xl bg-slate-900 p-3 text-xs text-slate-100">
            journalctl -u xnova-api | grep -A3 &quot;Code d&apos;installation&quot;
          </pre>
          <p className="text-xs text-slate-500">
            {t("setup.code.regenerate")} <code>npm run setup:token</code> {t("setup.code.regenerateSuffix")}
          </p>
          <div className="space-y-2">
            <Label htmlFor="setup-code">{t("setup.code.label")}</Label>
            <Input
              id="setup-code"
              autoComplete="off"
              spellCheck={false}
              placeholder="XXXX-XXXX-XXXX-XXXX"
              value={codeInput}
              onChange={(event) => setCodeInput(event.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {t("setup.continue")}
          </Button>
        </form>
      )}

      {step === "smtp" && (
        <form className="space-y-5" onSubmit={submitSmtp}>
          <p className="text-sm text-slate-600">
            {t("setup.smtp.intro")}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="smtp-host">{t("setup.smtp.host")}</Label>
              <Input id="smtp-host" required value={smtp.host} onChange={(e) => setSmtp({ ...smtp, host: e.target.value })} placeholder="mail.exemple.fr" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtp-port">{t("setup.smtp.port")}</Label>
              <Input id="smtp-port" type="number" required min={1} max={65535} value={smtp.port} onChange={(e) => setSmtp({ ...smtp, port: e.target.value })} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={smtp.secure} onChange={(e) => setSmtp({ ...smtp, secure: e.target.checked })} />
            {t("setup.smtp.secure")}
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="smtp-user">{t("setup.smtp.username")}</Label>
              <Input id="smtp-user" autoComplete="off" value={smtp.username} onChange={(e) => setSmtp({ ...smtp, username: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtp-password">{t("setup.smtp.password")}</Label>
              <Input
                id="smtp-password"
                type="password"
                autoComplete="new-password"
                value={smtp.password}
                onChange={(e) => setSmtp({ ...smtp, password: e.target.value })}
                placeholder={state?.smtp.passwordSet ? t("setup.smtp.passwordKept") : ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtp-from">{t("setup.smtp.fromEmail")}</Label>
              <Input id="smtp-from" type="email" required value={smtp.fromEmail} onChange={(e) => setSmtp({ ...smtp, fromEmail: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtp-name">{t("setup.smtp.fromName")}</Label>
              <Input id="smtp-name" value={smtp.fromName} onChange={(e) => setSmtp({ ...smtp, fromName: e.target.value })} />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {t("setup.smtp.save")}
          </Button>

          {state?.smtp.configured && (
            <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
              <p className="text-sm font-semibold text-slate-800">
                {t("setup.smtp.testTitle")} {state.smtp.tested ? t("setup.smtp.testOk") : t("setup.smtp.testTodo")}
              </p>
              <div className="space-y-2">
                <Label htmlFor="smtp-test-to">{t("setup.smtp.testTo")}</Label>
                <Input id="smtp-test-to" type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} />
              </div>
              <Button type="button" variant="outline" className="w-full" disabled={busy || !testTo} onClick={sendTest}>
                {t("setup.smtp.testSend")}
              </Button>
              {state.smtp.tested && (
                <Button type="button" className="w-full" onClick={() => setStep("settings")}>
                  {t("setup.continue")}
                </Button>
              )}
            </div>
          )}
        </form>
      )}

      {step === "settings" && (
        <form className="space-y-5" onSubmit={submitSettings}>
          <p className="text-sm text-slate-600">
            {t("setup.settings.intro")}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              data-testid="apply-speed-profile"
              onClick={() =>
                setSettings({
                  ...settings,
                  ...Object.fromEntries(
                    Object.entries(SPEED_PROFILES[RECOMMENDED_SPEED_PROFILE]).map(([k, v]) => [k, String(v)]),
                  ),
                })
              }
            >
              {t("setup.settings.applyProfile")}
            </Button>
            <span className="text-xs text-slate-500">{t("setup.settings.profileHint")}</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {SETTING_FIELDS.map((field) => (
              <div key={field.key} className="space-y-1">
                <Label htmlFor={`set-${field.key}`}>{t(`setup.fields.${field.key}.label`)}</Label>
                <Input
                  id={`set-${field.key}`}
                  type="number"
                  step={field.step ?? "1"}
                  value={settings[field.key] ?? ""}
                  onChange={(e) => setSettings({ ...settings, [field.key]: e.target.value })}
                />
                <p className="text-[11px] text-slate-500">{t(`setup.fields.${field.key}.hint`)}</p>
              </div>
            ))}
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {t("setup.settings.save")}
          </Button>
        </form>
      )}

      {step === "admin" && (
        <form className="space-y-5" onSubmit={submitAdmin}>
          <p className="text-sm text-slate-600">
            {t("setup.admin.intro")}
          </p>
          <div className="space-y-2">
            <Label htmlFor="admin-username">{t("setup.admin.username")}</Label>
            <Input id="admin-username" required minLength={3} maxLength={20} value={admin.username} onChange={(e) => setAdmin({ ...admin, username: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-email">{t("setup.admin.email")}</Label>
            <Input id="admin-email" type="email" required value={admin.email} onChange={(e) => setAdmin({ ...admin, email: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-password">{t("setup.admin.password")}</Label>
            <Input id="admin-password" type="password" autoComplete="new-password" required value={admin.password} onChange={(e) => setAdmin({ ...admin, password: e.target.value })} />
            <p className="text-[11px] text-slate-500">{t("setup.admin.passwordHint")}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-confirmation">{t("setup.admin.confirmation")}</Label>
            <Input id="admin-confirmation" type="password" autoComplete="new-password" required value={admin.confirmation} onChange={(e) => setAdmin({ ...admin, confirmation: e.target.value })} />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {t("setup.admin.submit")}
          </Button>
        </form>
      )}

      {step === "validation" && state?.admin && (
        <div className="space-y-5" data-testid="setup-validation">
          <p className="text-sm text-slate-600">
            {t("setup.validation.sentTo")} <strong>{state.admin.email}</strong>. {t("setup.validation.instructions")}
          </p>
          <p className="text-xs text-slate-500">{t("setup.validation.waiting")}</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button type="button" variant="outline" disabled={busy} onClick={resend}>
              {t("setup.validation.resend")}
            </Button>
            <Button type="button" variant="outline" disabled={busy} onClick={() => setStep("admin")}>
              {t("setup.validation.fix")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
