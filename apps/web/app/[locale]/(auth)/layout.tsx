import { SetupRedirect } from "@/components/setup/SetupRedirect";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <section className="mx-auto w-full max-w-lg px-4 py-6 sm:py-10">
      <SetupRedirect />
      <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-lg sm:p-8">
        {children}
      </div>
    </section>
  );
}
