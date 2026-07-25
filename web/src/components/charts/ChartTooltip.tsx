interface TooltipEntry {
  name?: string;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
  labelPrefix?: string;
  valueSuffix?: string;
  valueDecimals?: number;
}

export function ChartTooltip({
  active,
  payload,
  label,
  labelPrefix = "Week ",
  valueSuffix = "",
  valueDecimals = 1,
}: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-xl ring-1 ring-foreground/10">
      <p className="mb-1.5 font-display text-xs font-semibold tracking-wide text-muted-foreground">
        {labelPrefix}
        {label}
      </p>
      <div className="space-y-1">
        {[...payload]
          .sort((a, b) => Number(b.value ?? 0) - Number(a.value ?? 0))
          .map((entry, i) => (
            <div key={`${entry.dataKey}-${i}`} className="flex items-center gap-2 text-xs">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="max-w-40 truncate text-foreground/80">{entry.name}</span>
              <span className="ml-auto pl-3 font-mono font-semibold tabular-nums text-foreground">
                {typeof entry.value === "number"
                  ? entry.value.toFixed(valueDecimals)
                  : entry.value}
                {valueSuffix}
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}
