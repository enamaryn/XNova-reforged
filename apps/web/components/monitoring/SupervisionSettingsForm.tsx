"use client";

import { useEffect, useState } from "react";
import type { SentryTestResult, SupervisionConfig, SupervisionUpdatePayload } from "@/lib/api/supervision";
import { useI18n } from "@/lib/i18n";

type Tone = "light" | "dark";

const TONES: Record<Tone, { input: string; label: string; muted: string; box: string; ok: string; error: string; button: string; ghost: string }> = {
  light: {
    input: "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-hidden focus:border-slate-500",
    label: "block text-xs font-medium uppercase tracking-[0.15em] text-slate-500",
    muted: "text-xs text-slate-500",
    box: "rounded-2xl border border-slate-200 bg-white p-4",
    ok: "border-emerald-200 bg-emerald-50 text-emerald-800",
    error: "border-rose-200 bg-rose-50 text-rose-700",
    button: "rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50",
    ghost: "rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-800 disabled:opacity-50",
  },
  dark: {
    input: "w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white outline-hidden focus:border-blue-400/60",
    label: "block text-xs uppercase tracking-[0.2em] text-slate-500",
    muted: "text-xs text-slate-500",
    box: "rounded-2xl border border-slate-800 bg-slate-950/40 p-4",
    ok: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
    error: "border-red-500/30 bg-red-500/10 text-red-200",
    button: "rounded-xl bg-blue-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50",
    ghost: "rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-200 disabled:opacity-50",
  },
};

interface Props {
  config: SupervisionConfig;
  tone: Tone;
  /** Lecture seule (administrateur non super admin). */
  readOnly?: boolean;
  busy?: boolean;
  saveLabel: string;
  onSave: (payload: SupervisionUpdatePayload) => Promise<void> | void;
  onTest: (dsnApi?: string) => Promise<SentryTestResult>;
  onClear?: () => Promise<void> | void;
}

/**
 * Formulaire de supervision partagé par l'assistant d'installation et la console d'administration.
 * La supervision locale est toujours active : on ne choisit que d'y ajouter, ou non, Sentry.
 */
export function SupervisionSettingsForm({ config, tone, readOnly, busy, saveLabel, onSave, onTest, onClear }: Props) {
  const { t } = useI18n();
  const c = TONES[tone];
  const [withSentry, setWithSentry] = useState(config.sentry.enabled);
  const [local, setLocal] = useState({
    retentionDays: String(config.local.retentionDays),
    maxIncidents: String(config.local.maxIncidents),
    minLevel: config.local.minLevel,
    warningsEnabled: config.local.warningsEnabled,
    autoPurge: config.local.autoPurge,
  });
  const [sentry, setSentry] = useState({
    dsnApi: "",
    dsnBrowser: "",
    environment: config.sentry.environment || "production",
    sampleRate: String(config.sentry.sampleRate),
  });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<SentryTestResult | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  // Le formulaire n'est resynchronisé que si la configuration enregistrée change réellement (pas à chaque
  // rafraîchissement périodique ni après un test Sentry) : la saisie en cours n'est jamais écrasée.
  const signature = JSON.stringify([config.local, { ...config.sentry, lastTest: null }]);
  useEffect(() => {
    setWithSentry(config.sentry.enabled);
    setLocal({
      retentionDays: String(config.local.retentionDays),
      maxIncidents: String(config.local.maxIncidents),
      minLevel: config.local.minLevel,
      warningsEnabled: config.local.warningsEnabled,
      autoPurge: config.local.autoPurge,
    });
    setSentry((prev) => ({ ...prev, environment: config.sentry.environment || "production", sampleRate: String(config.sentry.sampleRate) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  const fromEnvironment = config.sentry.source === "environment";
  const dsnKnown = config.sentry.dsnApiSet || sentry.dsnApi.trim() !== "";

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLocalError(null);
    if (withSentry && !dsnKnown) {
      setLocalError(t("supervision.errors.dsnRequired"));
      return;
    }
    const payload: SupervisionUpdatePayload = {
      local: {
        retentionDays: Number(local.retentionDays),
        maxIncidents: Number(local.maxIncidents),
        minLevel: local.minLevel,
        warningsEnabled: local.warningsEnabled,
        autoPurge: local.autoPurge,
      },
      sentry: { enabled: withSentry },
    };
    if (withSentry) {
      if (sentry.dsnApi.trim()) payload.sentry!.dsnApi = sentry.dsnApi.trim();
      if (sentry.dsnBrowser.trim()) payload.sentry!.dsnBrowser = sentry.dsnBrowser.trim();
      payload.sentry!.environment = sentry.environment.trim() || "production";
      payload.sentry!.sampleRate = Number(sentry.sampleRate);
    }
    await onSave(payload);
    // Le DSN saisi n'est jamais conservé dans l'interface une fois enregistré
    setSentry((prev) => ({ ...prev, dsnApi: "", dsnBrowser: "" }));
  };

  const runTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      setTestResult(await onTest(sentry.dsnApi.trim() || undefined));
    } catch (error) {
      setTestResult({ ok: false, code: "unreachable", httpStatus: null, message: (error as Error).message, lastTest: null });
    } finally {
      setTesting(false);
    }
  };

  const lastTest = testResult?.lastTest ?? config.sentry.lastTest;
  const dateFormat = (iso: string) => new Date(iso).toLocaleString();

  return (
    <form onSubmit={submit} className="space-y-5" data-testid="supervision-form" noValidate>
      <fieldset className="space-y-3" disabled={readOnly}>
        <legend className={c.label}>{t("supervision.mode.title")}</legend>
        <label className={`${c.box} flex cursor-pointer items-start gap-3`}>
          <input
            type="radio"
            name="supervision-mode"
            value="local"
            checked={!withSentry}
            onChange={() => setWithSentry(false)}
            className="mt-1"
            data-testid="mode-local"
          />
          <span>
            <span className="block text-sm font-medium">{t("supervision.mode.local")}</span>
            <span className={c.muted}>{t("supervision.mode.localHint")}</span>
          </span>
        </label>
        <label className={`${c.box} flex cursor-pointer items-start gap-3`}>
          <input
            type="radio"
            name="supervision-mode"
            value="sentry"
            checked={withSentry}
            onChange={() => setWithSentry(true)}
            className="mt-1"
            data-testid="mode-sentry"
          />
          <span>
            <span className="block text-sm font-medium">{t("supervision.mode.sentry")}</span>
            <span className={c.muted}>{t("supervision.mode.sentryHint")}</span>
          </span>
        </label>
      </fieldset>

      <fieldset className="space-y-3" disabled={readOnly}>
        <legend className={c.label}>{t("supervision.local.title")}</legend>
        <p className={c.muted}>{t("supervision.local.alwaysOn")}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1">
            <span className={c.label}>{t("supervision.local.retentionDays")}</span>
            <input className={c.input} type="number" min={1} max={365} value={local.retentionDays} onChange={(e) => setLocal({ ...local, retentionDays: e.target.value })} />
          </label>
          <label className="space-y-1">
            <span className={c.label}>{t("supervision.local.maxIncidents")}</span>
            <input className={c.input} type="number" min={100} max={50000} value={local.maxIncidents} onChange={(e) => setLocal({ ...local, maxIncidents: e.target.value })} />
          </label>
          <label className="space-y-1">
            <span className={c.label}>{t("supervision.local.minLevel")}</span>
            <select className={c.input} value={local.minLevel} onChange={(e) => setLocal({ ...local, minLevel: e.target.value as "error" | "fatal" })}>
              <option value="error">{t("supervision.local.minLevelError")}</option>
              <option value="fatal">{t("supervision.local.minLevelFatal")}</option>
            </select>
          </label>
          <div className="space-y-2 self-end text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={local.warningsEnabled} onChange={(e) => setLocal({ ...local, warningsEnabled: e.target.checked })} />
              {t("supervision.local.warnings")}
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={local.autoPurge} onChange={(e) => setLocal({ ...local, autoPurge: e.target.checked })} />
              {t("supervision.local.autoPurge")}
            </label>
          </div>
        </div>
      </fieldset>

      {withSentry && (
        <fieldset className="space-y-3" disabled={readOnly} data-testid="sentry-fields">
          <legend className={c.label}>{t("supervision.sentry.title")}</legend>
          {fromEnvironment && <p className={`rounded-xl border p-3 text-xs ${c.ok}`}>{t("supervision.sentry.fromEnvironment")}</p>}
          <p className={c.muted}>{t("supervision.sentry.privacy")}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1 sm:col-span-2">
              <span className={c.label}>{t("supervision.sentry.dsnApi")}</span>
              <input
                className={c.input}
                type="password"
                autoComplete="off"
                spellCheck={false}
                value={sentry.dsnApi}
                onChange={(e) => setSentry({ ...sentry, dsnApi: e.target.value })}
                placeholder={config.sentry.dsnApiSet ? t("supervision.sentry.dsnKept", { hint: config.sentry.dsnApiHint ?? "" }) : "https://…@…/…"}
                data-testid="sentry-dsn-api"
              />
              {config.sentry.dsnApiUnreadable && <span className="block text-xs text-amber-500">{t("supervision.sentry.dsnUnreadable")}</span>}
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className={c.label}>{t("supervision.sentry.dsnBrowser")}</span>
              <input
                className={c.input}
                type="password"
                autoComplete="off"
                spellCheck={false}
                value={sentry.dsnBrowser}
                onChange={(e) => setSentry({ ...sentry, dsnBrowser: e.target.value })}
                placeholder={config.sentry.dsnBrowserSet ? t("supervision.sentry.dsnKept", { hint: config.sentry.dsnBrowserHint ?? "" }) : t("supervision.sentry.optional")}
              />
              <span className={c.muted}>{t("supervision.sentry.dsnBrowserHint")}</span>
            </label>
            <label className="space-y-1">
              <span className={c.label}>{t("supervision.sentry.environment")}</span>
              <input className={c.input} value={sentry.environment} onChange={(e) => setSentry({ ...sentry, environment: e.target.value })} />
            </label>
            <label className="space-y-1">
              <span className={c.label}>{t("supervision.sentry.sampleRate", { max: config.sentry.sampleRateMax })}</span>
              <input className={c.input} type="number" step="0.05" min={0} max={config.sentry.sampleRateMax} value={sentry.sampleRate} onChange={(e) => setSentry({ ...sentry, sampleRate: e.target.value })} />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className={c.ghost} disabled={testing || readOnly} onClick={runTest} data-testid="sentry-test">
              {testing ? t("supervision.sentry.testing") : t("supervision.sentry.test")}
            </button>
            {onClear && (config.sentry.dsnApiSet || config.sentry.enabled) && !readOnly && !fromEnvironment && (
              <button
                type="button"
                className={c.ghost}
                onClick={() => {
                  if (window.confirm(t("supervision.sentry.clearConfirm"))) void onClear();
                }}
              >
                {t("supervision.sentry.clear")}
              </button>
            )}
          </div>
          {testResult && (
            <p role="status" data-testid="sentry-test-result" className={`rounded-xl border p-3 text-sm ${testResult.ok ? c.ok : c.error}`}>
              {t(`supervision.sentry.result.${testResult.code}`)}
              {testResult.ok ? "" : ` ${t("supervision.sentry.nonBlocking")}`}
            </p>
          )}
          {lastTest && (
            <p className={c.muted} data-testid="sentry-last-test">
              {t("supervision.sentry.lastTest", {
                date: dateFormat(lastTest.at),
                result: lastTest.ok ? t("supervision.sentry.resultOk") : t(`supervision.sentry.result.${lastTest.code}`),
              })}
            </p>
          )}
        </fieldset>
      )}

      {localError && <p role="alert" className={`rounded-xl border p-3 text-sm ${c.error}`}>{localError}</p>}
      {!readOnly && (
        <button type="submit" className={c.button} disabled={busy} data-testid="supervision-save">
          {saveLabel}
        </button>
      )}
    </form>
  );
}
