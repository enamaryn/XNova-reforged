'use client';

import { useState } from 'react';

export default function FleetPage() {
  const [mission, setMission] = useState('transport');

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Commandement</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Flotte</h1>
        <p className="text-sm text-slate-400">
          Préparez vos mouvements et missions. Interface complète en cours.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-3xl border border-slate-800/80 bg-slate-950/60 p-6">
          <h2 className="text-xs uppercase tracking-[0.3em] text-slate-500">
            Composer une flotte
          </h2>
          <div className="mt-4 grid gap-4">
            <div className="rounded-2xl bg-slate-900/60 p-4">
              <p className="text-sm text-slate-300">Vaisseaux disponibles</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {['Petit transporteur', 'Chasseur léger', 'Sonde espionnage', 'Recycleur'].map(
                  (ship) => (
                    <div
                      key={ship}
                      className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-400"
                    >
                      <span>{ship}</span>
                      <span className="font-mono text-slate-500">0</span>
                    </div>
                  ),
                )}
              </div>
            </div>

            <div className="rounded-2xl bg-slate-900/60 p-4">
              <p className="text-sm text-slate-300">Mission</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  { id: 'transport', label: 'Transport' },
                  { id: 'attaque', label: 'Attaque' },
                  { id: 'espionnage', label: 'Espionnage' },
                  { id: 'colonisation', label: 'Colonisation' },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setMission(item.id)}
                    className={`rounded-full border px-4 py-2 text-xs uppercase tracking-[0.2em] transition ${
                      mission === item.id
                        ? 'border-blue-400/60 bg-blue-500/10 text-blue-200'
                        : 'border-slate-800 text-slate-400 hover:border-slate-600 hover:text-white'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl bg-slate-900/60 p-4">
              <p className="text-sm text-slate-300">Destination</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {['Galaxie', 'Système', 'Position'].map((label) => (
                  <label key={label} className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    {label}
                    <input
                      type="number"
                      min={1}
                      className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-blue-400/60"
                      placeholder="0"
                    />
                  </label>
                ))}
              </div>
            </div>
          </div>

          <button
            disabled
            className="mt-6 w-full rounded-xl bg-slate-800 py-3 text-sm font-semibold text-slate-500"
          >
            Envoyer la flotte (bientôt)
          </button>
        </div>

        <div className="rounded-3xl border border-slate-800/80 bg-slate-950/60 p-6">
          <h2 className="text-xs uppercase tracking-[0.3em] text-slate-500">
            Flottes en cours
          </h2>
          <div className="mt-4 space-y-3 text-sm text-slate-400">
            <div className="rounded-2xl border border-slate-800/60 bg-slate-900/60 p-4">
              Aucune flotte en déplacement.
            </div>
            <div className="rounded-2xl border border-slate-800/60 bg-slate-900/60 p-4">
              Dernière mission : aucune.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
