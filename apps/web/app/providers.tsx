"use client";

import { ReactNode } from "react";
import { QueryProvider } from "@/lib/providers/query-provider";
import { SocketProvider } from "@/lib/providers/socket-provider";

interface ProvidersProps {
  children: ReactNode;
}

export default function Providers({ children }: ProvidersProps) {
  return (
    <QueryProvider>
      <SocketProvider>
        {children}
      </SocketProvider>
    </QueryProvider>
  );
}
