export function Progress({ value }: { value: number }) {
  return (
    <div className="h-3 overflow-hidden rounded-full bg-[#233B5D]">
      <div
        className="h-full rounded-full bg-[#FF5A00] transition-all"
        style={{ width: `${Math.max(0, Math.min(value, 100))}%` }}
      />
    </div>
  );
}
