import Link from "next/link";

const links = [
  { href: "/overview", label: "Overview" },
  { href: "/buildings", label: "Buildings" },
  { href: "/research", label: "Research" },
];

export function PrimaryNav() {
  return (
    <nav className="flex items-center gap-6 text-sm font-medium">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="text-slate-600 transition hover:text-slate-900"
        >
          {link.label}
        </Link>
      ))}
      <Link
        href="/login"
        className="rounded-full bg-[hsl(var(--primary))] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[hsl(var(--primary-foreground))]"
      >
        Acces
      </Link>
    </nav>
  );
}
