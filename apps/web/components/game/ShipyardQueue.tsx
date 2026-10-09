"use client";
import { useEffect, useState } from "react";
import type { ShipyardQueueItem } from "@/lib/api/shipyard";

function duration(seconds: number) {
  if (seconds <= 0) return "Finalisation…";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}
function QueueItem({
  item,
  onCancel,
}: {
  item: ShipyardQueueItem;
  onCancel: (id: string) => Promise<void>;
}) {
  const [now, setNow] = useState(Date.now());
  const [confirming, setConfirming] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const start = new Date(item.startTime).getTime(),
    end = new Date(item.endTime).getTime();
  const waiting = now < start;
  const progress = Math.min(
    100,
    Math.max(0, (100 * (now - start)) / Math.max(1, end - start)),
  );
  const cancel = async () => {
    setCanceling(true);
    setError("");
    try {
      await onCancel(item.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCanceling(false);
    }
  };
  return (
    <div className="rounded-xl border border-blue-500/30 bg-slate-900/60 p-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
        <strong className="min-w-0">
          {item.shipName} ×{item.amount}
        </strong>
        <span className={waiting ? "text-amber-300" : "text-blue-300"}>
          {waiting ? "En attente" : "En production"}
        </span>
        <span className="font-mono text-xs">
          {waiting ? "Début dans " : ""}
          {duration(
            Math.max(0, Math.ceil(((waiting ? start : end) - now) / 1000)),
          )}
        </span>
        {waiting && (
          <button
            className="text-xs text-red-300"
            onClick={() => setConfirming(!confirming)}
            disabled={canceling}
          >
            Retirer
          </button>
        )}
      </div>
      {!waiting && (
        <div className="mt-2 h-1 overflow-hidden rounded bg-slate-800">
          <div
            className="h-full bg-blue-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
      <p className="mt-1 text-[11px] text-slate-500">
        Fin estimée : {new Date(item.endTime).toLocaleString("fr-FR")}
      </p>
      {confirming && waiting && (
        <div className="mt-2 space-y-2 text-xs">
          <p>
            Remboursement : 90 % des ressources payées. Les 10 % restants sont
            perdus.
          </p>
          {item.refund && (
            <p>
              Métal : {item.refund.metal} · Cristal : {item.refund.crystal} ·
              Deutérium : {item.refund.deuterium}
            </p>
          )}
          <button
            onClick={cancel}
            disabled={canceling}
            className="rounded border border-red-500/40 px-2 py-1 text-red-300"
          >
            {canceling ? "Retrait…" : "Confirmer le retrait"}
          </button>
          <button onClick={() => setConfirming(false)} className="ml-3">
            Conserver
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
export function ShipyardQueue({
  queue,
  onCancel,
}: {
  queue: ShipyardQueueItem[];
  onCancel: (id: string) => Promise<void>;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const active = queue.filter(
    (q) => new Date(q.startTime).getTime() <= now,
  ).length;
  return (
    <section aria-label="File du chantier" className="space-y-2">
      <h3 className="font-semibold">
        File du chantier · {active} en production · {queue.length - active} en
        attente
      </h3>
      <p className="text-xs text-slate-400">
        Ressources débitées à la commande. Retrait en attente : remboursement à
        90 %. Les lots démarrés terminent normalement.
      </p>
      {queue.length ? (
        queue.map((item) => (
          <QueueItem key={item.id} item={item} onCancel={onCancel} />
        ))
      ) : (
        <p className="text-sm text-slate-400">Aucune construction en cours</p>
      )}
    </section>
  );
}
