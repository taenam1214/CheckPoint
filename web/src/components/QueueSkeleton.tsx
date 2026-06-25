import { Skeleton } from "./ui/skeleton";

function QueueCardSkeleton() {
  return (
    <div className="flex flex-col gap-2 border-b border-border px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-5 w-14 rounded-full" />
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-1.5 w-16 rounded-full" />
        <Skeleton className="h-3 w-12" />
      </div>
    </div>
  );
}

export function QueueSkeleton() {
  return (
    <div className="flex flex-col">
      {Array.from({ length: 6 }).map((_, i) => (
        <QueueCardSkeleton key={i} />
      ))}
    </div>
  );
}
