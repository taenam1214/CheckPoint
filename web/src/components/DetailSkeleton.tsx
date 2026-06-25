import { Skeleton } from "./ui/skeleton";

export function DetailSkeleton() {
  return (
    <div className="flex h-full flex-col">
      {/* Header skeleton */}
      <div className="border-b border-border px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-5 w-20" />
        </div>
        <Skeleton className="mt-2 h-4 w-full" />
        <Skeleton className="mt-1 h-4 w-1/2" />
        <div className="mt-3 flex items-center gap-4">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>

      {/* Facts skeleton */}
      <div className="border-b border-border px-6 py-4">
        <Skeleton className="mb-3 h-3 w-20" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded-md" />
          ))}
        </div>
      </div>

      {/* Policy skeleton */}
      <div className="border-b border-border px-6 py-4">
        <Skeleton className="mb-3 h-3 w-16" />
        <Skeleton className="h-10 w-full rounded-md" />
      </div>

      {/* Similar cases skeleton */}
      <div className="border-b border-border px-6 py-4">
        <Skeleton className="mb-3 h-3 w-24" />
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-5 w-full" />
          ))}
        </div>
      </div>

      {/* Action bar skeleton */}
      <div className="mt-auto border-t border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-28 rounded-md" />
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="h-9 w-32 rounded-md" />
        </div>
      </div>
    </div>
  );
}
