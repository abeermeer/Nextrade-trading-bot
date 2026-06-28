export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`bg-dark-700 rounded-lg animate-pulse ${className}`} />;
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2">
      {[...Array(rows)].map((_, r) => (
        <div key={r} className="flex gap-4">
          {[...Array(cols)].map((_, c) => (
            <Skeleton key={c} className="h-7 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid md:grid-cols-3 gap-4">
      {[...Array(count)].map((_, i) => (
        <div key={i} className="bg-dark-800 border border-dark-700 rounded-xl p-5">
          <Skeleton className="w-8 h-8 mb-3" />
          <Skeleton className="h-4 w-3/4 mb-2" />
          <Skeleton className="h-3 w-full mb-1" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}
