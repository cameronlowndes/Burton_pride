export default function EventHubAuditLogLoading() {
  return (
    <div className="min-h-full bg-[#100918] p-4 text-white sm:p-6">
      <div className="space-y-5 animate-pulse">
        <div className="h-64 rounded-[30px] border border-white/10 bg-white/[0.05]" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="h-28 rounded-3xl border border-white/10 bg-white/[0.05]" />
          ))}
        </div>
        <div className="h-[520px] rounded-[28px] border border-white/10 bg-white/[0.05]" />
      </div>
    </div>
  );
}
