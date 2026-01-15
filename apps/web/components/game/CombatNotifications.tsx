'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useSocket } from '@/lib/providers/socket-provider';

interface CombatNotification {
  id: string;
  reportId: string;
  result?: string;
  opponentId?: string;
}

function formatResult(result?: string) {
  switch (result) {
    case 'attacker_win':
      return 'Victoire attaquant';
    case 'defender_win':
      return 'Victoire défenseur';
    case 'draw':
      return 'Match nul';
    default:
      return 'Rapport disponible';
  }
}

export function CombatNotifications() {
  const { socket } = useSocket();
  const [notifications, setNotifications] = useState<CombatNotification[]>([]);
  const timeouts = useRef<Record<string, NodeJS.Timeout>>({});

  useEffect(() => {
    if (!socket) return;

    const handleReport = (payload?: {
      reportId?: string;
      result?: string;
      opponentId?: string;
    }) => {
      if (!payload?.reportId) return;
      const id = `${Date.now()}-${Math.random()}`;
      const notification: CombatNotification = {
        id,
        reportId: payload.reportId,
        result: payload.result,
        opponentId: payload.opponentId,
      };

      setNotifications((prev) => [notification, ...prev].slice(0, 3));

      timeouts.current[id] = setTimeout(() => {
        setNotifications((prev) => prev.filter((item) => item.id !== id));
        delete timeouts.current[id];
      }, 8000);
    };

    socket.on('combat:report', handleReport);

    return () => {
      socket.off('combat:report', handleReport);
      Object.values(timeouts.current).forEach((timeout) => clearTimeout(timeout));
      timeouts.current = {};
    };
  }, [socket]);

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-20 right-4 z-50 space-y-3">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className="w-72 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200 shadow-lg backdrop-blur"
        >
          <div className="text-xs uppercase tracking-[0.2em] text-red-300">
            Combat
          </div>
          <div className="mt-2 font-semibold text-red-100">
            {formatResult(notification.result)}
          </div>
          {notification.opponentId && (
            <div className="mt-1 text-xs text-red-200/70">
              Adversaire : {notification.opponentId}
            </div>
          )}
          <Link
            href={`/reports/${notification.reportId}`}
            className="mt-3 inline-flex items-center text-xs uppercase tracking-[0.2em] text-red-100 hover:text-white"
          >
            Voir le rapport
          </Link>
        </div>
      ))}
    </div>
  );
}
