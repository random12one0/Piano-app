export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-6 pb-24 pt-16 sm:px-10" aria-busy="true">
      <span className="sr-only">Loading…</span>
      <div className="animate-pulse">
        <div className="h-9 w-64 bg-surface-raised" />
        <div className="mt-4 h-[2px] w-16 bg-surface-raised" />
        <div className="mt-12 flex flex-col gap-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex gap-4">
              <div className="h-16 w-24 shrink-0 bg-surface-raised sm:h-20 sm:w-28" />
              <div className="flex-1">
                <div className="h-5 w-1/2 bg-surface-raised" />
                <div className="mt-2 h-3 w-1/3 bg-surface-raised" />
                <div className="mt-4 h-[3px] w-full bg-surface-raised" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
