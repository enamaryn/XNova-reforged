import Link from "next/link";
import { ArrowRight, Orbit, Rocket, Shield, Sparkles } from "lucide-react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { BuildVersion } from "@/components/BuildVersion";

export const metadata = {
  title: "XNova Reforged — Une galaxie à conquérir",
  description:
    "Développez votre empire, protégez vos planètes et déployez votre flotte dans un univers stratégique persistant.",
};

const features = [
  {
    title: "Planètes",
    description: "Colonisez, développez et optimisez vos mondes.",
    icon: Orbit,
    imagePosition: "45% 54%",
    href: "/overview",
  },
  {
    title: "Défense spatiale",
    description: "Protégez votre système avec stations et batteries orbitales.",
    icon: Shield,
    imagePosition: "82% 40%",
    href: "/defense",
  },
  {
    title: "Flottes",
    description: "Assemblez vos vaisseaux et imposez votre stratégie.",
    icon: Rocket,
    imagePosition: "34% 75%",
    href: "/fleet",
  },
];

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#020812] text-slate-50">
      <div
        className="pointer-events-none fixed inset-0 bg-cover bg-center opacity-25 blur-[2px]"
        style={{ backgroundImage: "url('/landing/space-hero.webp')" }}
      />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_20%,transparent_0%,rgba(2,8,18,0.3)_55%,#020812_100%)]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1600px] flex-col px-3 py-3 sm:px-6 sm:py-5 lg:px-8">
        <header className="flex min-h-16 items-center justify-between gap-3 rounded-2xl border border-sky-400/20 bg-[#041224]/80 px-4 shadow-[0_18px_60px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:px-7">
          <Link
            href="/"
            aria-label="Accueil XNova Reforged"
            className="shrink-0 text-xl font-bold tracking-[-0.04em] text-white sm:text-2xl lg:text-3xl"
          >
            XNova <span className="text-sky-400">Reforged</span>
          </Link>
          <div className="flex min-w-0 items-center gap-2 sm:gap-5">
            <nav
              aria-label="Navigation publique"
              className="hidden items-center gap-6 text-sm text-slate-200 lg:flex"
            >
              <Link href="/overview" className="transition hover:text-sky-300">
                Vue
              </Link>
              <Link href="/buildings" className="transition hover:text-sky-300">
                Bâtiments
              </Link>
              <Link href="/research" className="transition hover:text-sky-300">
                Recherche
              </Link>
            </nav>
            <Link
              href="/login"
              aria-label="Accès commandant"
              className="flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl border border-sky-300/40 bg-gradient-to-b from-sky-400 to-blue-600 px-3 text-xs font-semibold text-white shadow-[0_0_24px_rgba(14,165,233,0.32)] transition hover:brightness-110 sm:px-6 sm:text-sm"
            >
              <Rocket className="h-4 w-4" aria-hidden="true" />{" "}
              <span className="hidden sm:inline">Accès</span>
            </Link>
            <LanguageSwitcher />
          </div>
        </header>

        <section
          aria-labelledby="home-title"
          className="relative mt-4 isolate flex min-h-[620px] overflow-hidden rounded-[1.75rem] border border-sky-300/60 bg-[#03101f] shadow-[0_30px_90px_rgba(0,0,0,0.55)] sm:min-h-[680px] lg:min-h-[700px]"
        >
          <div
            className="absolute inset-0 -z-20 bg-cover bg-[62%_center] lg:bg-center"
            style={{ backgroundImage: "url('/landing/space-hero.webp')" }}
          />
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#020812]/95 via-[#020812]/65 to-transparent lg:via-[#020812]/20" />
          <div className="absolute inset-x-0 bottom-0 -z-10 h-48 bg-gradient-to-t from-[#020812]/70 to-transparent" />
          <div className="flex w-full items-end px-6 pb-10 pt-32 sm:px-10 sm:pb-14 lg:items-center lg:px-14 lg:pb-0 lg:pt-0">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.55em] text-sky-400 sm:text-sm">
                Commandement
              </p>
              <h1
                id="home-title"
                className="mt-5 text-4xl font-bold leading-[0.95] tracking-[-0.045em] text-white drop-shadow-2xl sm:text-6xl lg:text-7xl"
              >
                Une galaxie entière
                <span className="mt-2 block bg-gradient-to-r from-sky-400 to-blue-500 bg-clip-text text-transparent">
                  à conquérir.
                </span>
              </h1>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-slate-200 drop-shadow sm:text-lg">
                Développez votre empire, érigez vos défenses orbitales et
                déployez votre flotte dans un univers stratégique persistant.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/login"
                  className="flex min-h-14 items-center justify-center gap-3 rounded-xl border border-sky-300/50 bg-gradient-to-b from-sky-400 to-blue-600 px-7 text-xs font-semibold uppercase tracking-[0.18em] text-white shadow-[0_0_30px_rgba(14,165,233,0.35)] transition hover:-translate-y-0.5 hover:brightness-110 sm:text-sm"
                >
                  <Rocket className="h-5 w-5" aria-hidden="true" /> Accès
                  commandant{" "}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <a
                  href="#univers"
                  className="flex min-h-14 items-center justify-center gap-3 rounded-xl border border-sky-200/40 bg-[#061326]/70 px-7 text-xs font-semibold uppercase tracking-[0.18em] text-slate-100 backdrop-blur transition hover:border-sky-300 hover:bg-sky-900/30 sm:text-sm"
                >
                  <Orbit className="h-5 w-5 text-blue-300" aria-hidden="true" />{" "}
                  Voir l’univers{" "}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </a>
              </div>
            </div>
          </div>
        </section>

        <section
          id="univers"
          aria-label="Découvrez l'univers"
          className="grid scroll-mt-6 gap-4 py-5 md:grid-cols-3"
        >
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <Link
                key={feature.title}
                href={feature.href}
                className="group relative isolate min-h-52 overflow-hidden rounded-2xl border border-sky-400/50 bg-[#03101f] shadow-[0_18px_50px_rgba(0,0,0,0.3)] transition hover:-translate-y-1 hover:border-sky-300"
              >
                <div
                  className="absolute inset-0 -z-20 bg-cover transition duration-500 group-hover:scale-105"
                  style={{
                    backgroundImage: "url('/landing/space-hero.webp')",
                    backgroundPosition: feature.imagePosition,
                  }}
                />
                <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[#020812] via-[#020812]/70 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 flex items-end gap-4 p-5 sm:p-6">
                  <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-sky-400/50 bg-[#061326]/90 text-blue-300 backdrop-blur">
                    <Icon className="h-8 w-8" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="block text-xl font-semibold text-white">
                      {feature.title}
                    </strong>
                    <span className="mt-1 block text-sm leading-snug text-slate-300">
                      {feature.description}
                    </span>
                  </span>
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-sky-400/40 bg-[#061326]/80 text-blue-300 transition group-hover:bg-blue-600 group-hover:text-white">
                    <ArrowRight className="h-5 w-5" aria-hidden="true" />
                  </span>
                </div>
              </Link>
            );
          })}
        </section>

        <footer className="mt-auto flex flex-col items-center justify-center gap-2 pb-3 pt-5 text-[10px] uppercase tracking-[0.48em] text-blue-300/70 sm:flex-row sm:gap-5">
          <span className="hidden h-px w-40 bg-gradient-to-r from-transparent to-sky-400/50 sm:block" />
          <span className="flex items-center gap-3">
            <Sparkles className="h-3 w-3" aria-hidden="true" /> XNova Reforged
          </span>
          <span className="normal-case tracking-normal text-slate-500">
            <BuildVersion />
          </span>
          <span className="hidden h-px w-40 bg-gradient-to-l from-transparent to-sky-400/50 sm:block" />
        </footer>
      </div>
    </main>
  );
}
