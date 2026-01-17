interface AuthHeaderProps {
  eyebrow: string;
  title: string;
  subtitle?: string;
}

export function AuthHeader({ eyebrow, title, subtitle }: AuthHeaderProps) {
  return (
    <div className="space-y-2">
      <p className="text-xs uppercase tracking-[0.35em] text-slate-400">
        {eyebrow}
      </p>
      <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">{title}</h1>
      {subtitle ? (
        <p className="text-sm text-slate-500">{subtitle}</p>
      ) : null}
    </div>
  );
}
