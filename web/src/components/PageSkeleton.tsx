import { Skeleton } from "@/components/ui/skeleton";

interface PageSkeletonProps {
  cards?: number;
  columns?: string;
  header?: boolean;
}

export function PageSkeleton({
  cards = 6,
  columns = "sm:grid-cols-2 xl:grid-cols-3",
  header = true,
}: PageSkeletonProps) {
  return (
    <div className="space-y-6">
      {header && (
        <div className="space-y-2">
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-4 w-64" />
        </div>
      )}
      <div className={`grid grid-cols-1 gap-4 ${columns}`}>
        {Array.from({ length: cards }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
