export function SkeletonLine({ width = '100%', height = 14, style }) {
  return <div className="skeleton" style={{ width, height, ...style }} />;
}

export function SkeletonCard() {
  return (
    <div className="card" style={{ padding: 16, marginBottom: 12 }}>
      <SkeletonLine width="40%" height={12} style={{ marginBottom: 10 }} />
      <SkeletonLine width="70%" height={18} style={{ marginBottom: 8 }} />
      <SkeletonLine width="55%" height={12} />
    </div>
  );
}

export function SkeletonList({ count = 4 }) {
  return (
    <div>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
