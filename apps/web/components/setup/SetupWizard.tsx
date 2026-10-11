"use client";

import { RECOMMENDED_SPEED_PROFILE, SPEED_PROFILES } from "@xnova/game-config";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ApiError } from "@/lib/api/client";
import {
  createSetupAdmin,
  getSetupState,
  getSetupStatus,
  resendSetupAdmin,
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
const STEPS: Array<{ id: Exclude<Step, "done">; label: string }> = [
  { id: "code", label: "Code" },
  { id: "smtp", label: "SMTP" },
  { id: "settings", label: "Réglages" },
  { id: "admin", label: "Super admin" },
  { id: "validation", label: "Validation" },
];

const SETTING_FIELDS: Array<{ key: keyof ServerSettings; label: string; hint: string; step?: string }> = [
  { key: "gameSpeed", label: "Vitesse du jeu", hint: "Accélère les durées et la production (1 = rythme d'origine)", step: "any" },
  { key: "fleetSpeed", label: "Vitesse des flottes", hint: "Accélère les vols (1 = rythme d'origine)", step: "any" },
  { key: "resourceMultiplier", label: "Multiplicateur de production", hint: "S'applique à toutes les ressources produites", step: "any" },
  { key: "buildingCostMultiplier", label: "Coût des bâtiments", hint: "Multiplicateur de coût de construction", step: "any" },
  { key: "researchCostMultiplier", label: "Coût des recherches", hint: "Multiplicateur de coût de recherche", step: "any" },
  { key: "shipCostMultiplier", label: "Coût des vaisseaux et défenses", hint: "Multiplicateur de coût du chantier spatial", step: "any" },
  { key: "planetSize", label: "Taille des planètes (champs)", hint: "Entre 50 et 500" },
  { key: "maxBuildingLevel", label: "Niveau maximal des bâtiments", hint: "Plafond de construction" },
  { key: "maxTechnologyLevel", label: "Niveau maximal des technologies", hint: "Plafond de recherche" },
  { key: "baseMetal", label: "Production de base : métal (par heure)", hint: "Revenu sans mine", step: "any" },
  { key: "baseCrystal", label: "Production de base : cristal (par heure)", hint: "Revenu sans mine", step: "any" },
  { key: "baseDeuterium", label: "Production de base : deutérium (par heure)", hint: "Revenu sans mine", step: "any" },
];

const messageOf = (error: unknown) => (error instanceof ApiError ? error.message : "Une erreur est survenue.");

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
        setError(messageOf(e));
      } finally {
        setBooting(false);
      }
    })();
  }, [adopt]);

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
      setError(messageOf(e));
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
      setNotice("Configuration enregistrée. Envoyez maintenant un email de test.");
    });
  };

  const sendTest = () =>
    run(async () => {
      const result = await testSetupSmtp(token, testTo.trim());
      adopt(await getSetupState(token));
      setNotice(`Email de test envoyé à ${result.to}. Vérifiez sa réception avant de continuer.`);
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
      setError("Les deux mots de passe ne correspondent pas.");
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

  const resend = () =>
    run(async () => {
      const result = await resendSetupAdmin(token);
      setNotice(result.message);
    });

  if (booting) return <p className="text-sm text-slate-500">Chargement...</p>;

  if (step === "done") {
    return (
      <div className="space-y-5" data-testid="setup-done">
        <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Installation</p>
        <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">Installation terminée.</h1>
        <Notice kind="ok">
          Le compte super admin est confirmé et le parcours d&apos;installation est maintenant verrouillé définitivement.
          Il ne peut être rouvert que depuis un terminal sur le serveur.
        </Notice>
        <Link href="/login" className="text-sm font-semibold text-slate-900">
          Aller à la connexion
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
        <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Installation du serveur</p>
        <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">Première configuration.</h1>
      </div>

      <ol className="flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.15em]" aria-label="Étapes">
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
                {index + 1}. {s.label}
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
            Pour protéger le serveur, l&apos;installation est réservée à la personne qui a accès à son terminal. Lisez le
            code d&apos;installation dans le journal de l&apos;API :
          </p>
          <pre className="overflow-x-auto rounded-2xl bg-slate-900 p-3 text-xs text-slate-100">
            journalctl -u xnova-api | grep -A3 &quot;Code d&apos;installation&quot;
          </pre>
          <p className="text-xs text-slate-500">
            Ou en générer un nouveau : <code>npm run setup:token</code> (depuis le dossier du projet sur le serveur).
          </p>
          <div className="space-y-2">
            <Label htmlFor="setup-code">Code d&apos;installation</Label>
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
            Continuer
          </Button>
        </form>
      )}

      {step === "smtp" && (
        <form className="space-y-5" onSubmit={submitSmtp}>
          <p className="text-sm text-slate-600">
            Serveur d&apos;envoi des emails (confirmation de compte, mot de passe oublié). Il sert aussi à valider votre
            compte à la fin de l&apos;installation.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="smtp-host">Hôte</Label>
              <Input id="smtp-host" required value={smtp.host} onChange={(e) => setSmtp({ ...smtp, host: e.target.value })} placeholder="mail.exemple.fr" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtp-port">Port</Label>
              <Input id="smtp-port" type="number" required min={1} max={65535} value={smtp.port} onChange={(e) => setSmtp({ ...smtp, port: e.target.value })} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={smtp.secure} onChange={(e) => setSmtp({ ...smtp, secure: e.target.checked })} />
            Connexion TLS directe (port 465) — décochez pour STARTTLS (port 587)
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="smtp-user">Identifiant</Label>
              <Input id="smtp-user" autoComplete="off" value={smtp.username} onChange={(e) => setSmtp({ ...smtp, username: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtp-password">Mot de passe</Label>
              <Input
                id="smtp-password"
                type="password"
                autoComplete="new-password"
                value={smtp.password}
                onChange={(e) => setSmtp({ ...smtp, password: e.target.value })}
                placeholder={state?.smtp.passwordSet ? "•••••••• (conservé si vide)" : ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtp-from">Adresse d&apos;expédition</Label>
              <Input id="smtp-from" type="email" required value={smtp.fromEmail} onChange={(e) => setSmtp({ ...smtp, fromEmail: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtp-name">Nom d&apos;expéditeur</Label>
              <Input id="smtp-name" value={smtp.fromName} onChange={(e) => setSmtp({ ...smtp, fromName: e.target.value })} />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            Enregistrer la configuration
          </Button>

          {state?.smtp.configured && (
            <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
              <p className="text-sm font-semibold text-slate-800">
                Test d&apos;envoi {state.smtp.tested ? "— réussi ✓" : "— à faire"}
              </p>
              <div className="space-y-2">
                <Label htmlFor="smtp-test-to">Envoyer un email de test à</Label>
                <Input id="smtp-test-to" type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} />
              </div>
              <Button type="button" variant="outline" className="w-full" disabled={busy || !testTo} onClick={sendTest}>
                Envoyer l&apos;email de test
              </Button>
              {state.smtp.tested && (
                <Button type="button" className="w-full" onClick={() => setStep("settings")}>
                  Continuer
                </Button>
              )}
            </div>
          )}
        </form>
      )}

      {step === "settings" && (
        <form className="space-y-5" onSubmit={submitSettings}>
          <p className="text-sm text-slate-600">
            Réglages de l&apos;univers. Ils restent modifiables ensuite depuis l&apos;administration ; laissez les valeurs
            par défaut si vous hésitez.
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
              Appliquer le profil de référence ×50
            </Button>
            <span className="text-xs text-slate-500">
              Vitesse ×50, coûts d&apos;origine : laboratoire en 22 min, premier vaisseau en moins de 2 h.
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {SETTING_FIELDS.map((field) => (
              <div key={field.key} className="space-y-1">
                <Label htmlFor={`set-${field.key}`}>{field.label}</Label>
                <Input
                  id={`set-${field.key}`}
                  type="number"
                  step={field.step ?? "1"}
                  value={settings[field.key] ?? ""}
                  onChange={(e) => setSettings({ ...settings, [field.key]: e.target.value })}
                />
                <p className="text-[11px] text-slate-500">{field.hint}</p>
              </div>
            ))}
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            Enregistrer et continuer
          </Button>
        </form>
      )}

      {step === "admin" && (
        <form className="space-y-5" onSubmit={submitAdmin}>
          <p className="text-sm text-slate-600">
            Compte super admin du serveur. Un lien de confirmation sera envoyé à cette adresse : le cliquer termine
            l&apos;installation. Si l&apos;adresse est erronée, vous pourrez recréer le compte tant qu&apos;il n&apos;est pas confirmé.
          </p>
          <div className="space-y-2">
            <Label htmlFor="admin-username">Identifiant</Label>
            <Input id="admin-username" required minLength={3} maxLength={20} value={admin.username} onChange={(e) => setAdmin({ ...admin, username: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-email">Adresse email</Label>
            <Input id="admin-email" type="email" required value={admin.email} onChange={(e) => setAdmin({ ...admin, email: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-password">Mot de passe</Label>
            <Input id="admin-password" type="password" autoComplete="new-password" required value={admin.password} onChange={(e) => setAdmin({ ...admin, password: e.target.value })} />
            <p className="text-[11px] text-slate-500">8 caractères minimum, avec une minuscule, une majuscule et un chiffre.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-confirmation">Confirmation</Label>
            <Input id="admin-confirmation" type="password" autoComplete="new-password" required value={admin.confirmation} onChange={(e) => setAdmin({ ...admin, confirmation: e.target.value })} />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            Créer le compte et envoyer le lien
          </Button>
        </form>
      )}

      {step === "validation" && state?.admin && (
        <div className="space-y-5" data-testid="setup-validation">
          <p className="text-sm text-slate-600">
            Un email de confirmation a été envoyé à <strong>{state.admin.email}</strong>. Cliquez sur le lien qu&apos;il contient :
            cette page se met à jour toute seule et l&apos;installation se termine dès que le compte est confirmé.
          </p>
          <p className="text-xs text-slate-500">En attente de la confirmation...</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button type="button" variant="outline" disabled={busy} onClick={resend}>
              Renvoyer le lien
            </Button>
            <Button type="button" variant="outline" disabled={busy} onClick={() => setStep("admin")}>
              Corriger l&apos;adresse ou le compte
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
