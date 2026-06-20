export default function LoadingSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-slate-100 bg-white/60 p-5"
        >
          <div className="shimmer mb-3 h-5 w-3/4 rounded-md" />
          <div className="shimmer h-3 w-1/2 rounded-md" />
          <div className="shimmer mt-4 h-16 w-full rounded-md" />
        </div>
      ))}
    </div>
  )
}
