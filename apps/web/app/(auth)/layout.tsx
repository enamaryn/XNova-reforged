export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <section className="mx-auto w-full max-w-lg">
      <div className="rounded-3xl border border-slate-200 bg-white/80 p-8 shadow-lg">
        {children}
      </div>
    </section>
  );
}
