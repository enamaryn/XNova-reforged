"use client";

import { ReactNode } from "react";
import { QueryProvider } from "@/lib/providers/query-provider";
import { SocketProvider } from "@/lib/providers/socket-provider";
import { I18nProvider } from "@/lib/i18n";
import { MonitoringBootstrap } from "@/components/monitoring/MonitoringBootstrap";

interface ProvidersProps {
  children: ReactNode;
}

export default function Providers({ children }: ProvidersProps) {
  return (
    <QueryProvider>
      <SocketProvider>
        <I18nProvider>
          <MonitoringBootstrap />
          {children}
        </I18nProvider>
      </SocketProvider>
    </QueryProvider>
  );
}
