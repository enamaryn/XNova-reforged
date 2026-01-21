import { Skeleton } from "@/components/ui/skeleton";

export function BuildingsSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(9)].map((_, i) => (
          <div key={i} className="rounded-lg border bg-card p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <Skeleton className="mb-2 h-6 w-32" />
                <Skeleton className="mb-4 h-4 w-24" />
              </div>
              <Skeleton className="h-10 w-10 rounded-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
            <Skeleton className="mt-4 h-10 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
