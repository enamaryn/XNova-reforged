import Link from "next/link";

import { PrimaryNav } from "@/components/layout/PrimaryNav";
import { LanguageSwitcher } from "@/components/language-switcher";

export function Header() {
  return (
    <header className="border-b border-[hsl(var(--border))] bg-white/70 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
        <Link href="/" className="text-lg font-semibold tracking-tight sm:text-xl">
          XNova Reforged
        </Link>
        <div className="flex items-center gap-4">
          <PrimaryNav />
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
}
