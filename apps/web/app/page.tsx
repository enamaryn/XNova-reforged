import Link from "next/link";

export default function HomePage() {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-10">
      <div className="grid gap-10">
        <div className="rounded-3xl border border-[hsl(var(--border))] bg-white/80 p-10 shadow-xl">
          <p className="text-xs uppercase tracking-[0.4em] text-slate-400">
            Commandement
          </p>
          <h1 className="mt-4 text-4xl font-semibold text-slate-900">
            Une galaxie entiere a reconstruire.
          </h1>
          <p className="mt-4 max-w-2xl text-base text-slate-600">
            Le coeur de XNova Reforged est en place : une infrastructure solide
            pour l'univers, l'authentification et la gestion du temps. Prochaine
            etape : connecter les pilotes.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/login"
              className="rounded-full bg-[hsl(var(--primary))] px-6 py-3 text-xs font-semibold uppercase tracking-[0.25em] text-[hsl(var(--primary-foreground))]"
            >
              Acces Commandant
            </Link>
            <Link
              href="/overview"
              className="rounded-full border border-slate-200 px-6 py-3 text-xs font-semibold uppercase tracking-[0.25em] text-slate-600"
            >
              Voir l'etat
            </Link>
          </div>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              title: "Infrastructure",
              detail: "Next.js 15 + App Router, TailwindCSS, shadcn/ui.",
            },
            {
              title: "State",
              detail: "Zustand pour l'etat client, React Query pour l'API.",
            },
            {
              title: "Navigation",
              detail: "Layouts partages et routes (auth) / (game).",
            },
          ].map((card) => (
            <div
              key={card.title}
              className="rounded-2xl border border-slate-200 bg-white/70 p-6"
            >
              <h3 className="text-lg font-semibold text-slate-900">
                {card.title}
              </h3>
              <p className="mt-2 text-sm text-slate-600">{card.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
