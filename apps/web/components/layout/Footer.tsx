import { BuildVersion } from '@/components/BuildVersion';
import { LegalLinks } from '@/components/legal/LegalLinks';

export function Footer() {
  return (
    <footer className="border-t border-[hsl(var(--border))] bg-white/70">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-4 text-[10px] uppercase tracking-[0.3em] text-slate-400 sm:px-6 sm:py-6 sm:text-xs">
        <span>XNova Reforged</span>
        <LegalLinks />
        <span className="normal-case tracking-normal"><BuildVersion /></span>
      </div>
    </footer>
  );
}
