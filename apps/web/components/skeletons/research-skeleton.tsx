import { Skeleton } from "@/components/ui/skeleton";

export function ResearchSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />

      <div className="rounded-lg border bg-card p-4">
        <Skeleton className="mb-3 h-5 w-40" />
        <Skeleton className="h-2 w-full" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(12)].map((_, i) => (
          <div key={i} className="rounded-lg border bg-card p-6">
            <Skeleton className="mb-2 h-6 w-40" />
            <Skeleton className="mb-4 h-4 w-24" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
            <Skeleton className="mt-4 h-10 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
