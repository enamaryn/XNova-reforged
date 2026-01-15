'use client';

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { GameLayout } from "@/components/game/layout";

export default function GameLayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute>
      <GameLayout>{children}</GameLayout>
    </ProtectedRoute>
  );
}
