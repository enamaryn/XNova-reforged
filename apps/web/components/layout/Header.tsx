import Link from "next/link";

import { PrimaryNav } from "@/components/layout/PrimaryNav";

export function Header() {
  return (
    <header className="border-b border-[hsl(var(--border))] bg-white/70 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-xl font-semibold tracking-tight">
          XNova Reforged
        </Link>
        <PrimaryNav />
      </div>
    </header>
  );
}
