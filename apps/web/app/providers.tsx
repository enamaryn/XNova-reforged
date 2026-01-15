"use client";

import { ReactNode } from "react";
import { QueryProvider } from "@/lib/providers/query-provider";
import { SocketProvider } from "@/lib/providers/socket-provider";
import { I18nProvider } from "@/lib/i18n";

interface ProvidersProps {
  children: ReactNode;
}

export default function Providers({ children }: ProvidersProps) {
  return (
    <QueryProvider>
      <SocketProvider>
        <I18nProvider>{children}</I18nProvider>
      </SocketProvider>
    </QueryProvider>
  );
}
