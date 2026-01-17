import Link from "next/link";

const links = [
  { href: "/overview", label: "Overview" },
  { href: "/buildings", label: "Buildings" },
  { href: "/research", label: "Research" },
];

export function PrimaryNav() {
  return (
    <nav className="flex items-center gap-3 text-sm font-medium sm:gap-6">
      <div className="hidden items-center gap-6 sm:flex">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="text-slate-600 transition hover:text-slate-900"
          >
            {link.label}
          </Link>
        ))}
      </div>
      <Link
        href="/login"
        className="rounded-full bg-[hsl(var(--primary))] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[hsl(var(--primary-foreground))] sm:text-xs"
      >
        Acces
      </Link>
    </nav>
  );
}
