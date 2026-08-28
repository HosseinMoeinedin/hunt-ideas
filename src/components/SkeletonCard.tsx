export default function SkeletonCard() {
  return (
    <div aria-hidden="true">
      <div className="skeleton-shimmer aspect-[16/10] rounded-[11px] border border-border" />
      <div className="mt-3 space-y-2">
        <div className="skeleton-shimmer h-4 w-3/5 rounded" />
        <div className="skeleton-shimmer h-3 w-4/5 rounded" />
      </div>
    </div>
  );
}
