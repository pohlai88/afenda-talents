const NAMES: Record<string, string> = {
  WER: "Work ethic and reliability",
  COM: "Communication and collaboration",
  PSL: "Problem solving and learning agility",
  ADR: "Adaptability and resilience",
  INA: "Integrity and accountability",
};

export function DimensionBar({
  code,
  scaled,
  band,
}: {
  code: string;
  scaled: number;
  band: string;
}) {
  return (
    <div className="py-3">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">{NAMES[code] ?? code}</span>
        <span className="text-sm tabular-nums text-muted-foreground">
          {scaled} · {band}
        </span>
      </div>
      <div className="mt-2 h-3 w-full rounded-full bg-slate-200 print:border print:border-slate-400">
        <div
          className="h-3 rounded-full bg-slate-800 print:bg-slate-700"
          style={{ width: `${Math.max(2, scaled)}%` }}
        />
      </div>
    </div>
  );
}
