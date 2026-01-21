import { Skeleton } from "@/components/ui/skeleton";

export function GalaxySkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-24" />
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="grid grid-cols-7 border-b bg-slate-50 p-3 text-sm font-medium">
          {[...Array(7)].map((_, i) => (
            <Skeleton key={i} className="h-4" />
          ))}
        </div>
        {[...Array(15)].map((_, i) => (
          <div key={i} className="grid grid-cols-7 border-b p-3">
            {[...Array(7)].map((_, j) => (
              <Skeleton key={j} className="h-6" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
