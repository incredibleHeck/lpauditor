export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-zinc-500 font-semibold text-sm">Loading dashboard...</p>
    </div>
  );
}
