import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SparklineProps {
  values: number[];
  width?: number;
  height?: number;
  className?: string;
  currency?: string;
}

const formatAmount = (v: number, currency?: string) => {
  const symbol =
    currency === "USD"
      ? "$"
      : currency === "EUR"
      ? "€"
      : currency === "GBP"
      ? "£"
      : currency === "ZAR"
      ? "R"
      : "";
  if (v >= 1_000_000_000) return `${symbol}${(v / 1_000_000_000).toFixed(2)}B`;
  if (v >= 1_000_000) return `${symbol}${Math.round(v / 1_000_000)}M`;
  if (v >= 1_000) return `${symbol}${Math.round(v / 1_000)}K`;
  return `${symbol}${v.toLocaleString()}`;
};

const Sparkline = ({
  values,
  width = 96,
  height = 28,
  className,
  currency,
}: SparklineProps) => {
  if (!values || values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const first = values[0];
  const last = values[values.length - 1];
  const range = max - min || 1;
  const stepX = width / (values.length - 1);

  const points = values.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const path = `M ${points.join(" L ")}`;
  const areaPath = `${path} L ${width},${height} L 0,${height} Z`;

  const trendUp = last >= first;
  const stroke = trendUp ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))";
  const pctChange = first === 0 ? 0 : ((last - first) / first) * 100;
  const pctLabel = `${pctChange >= 0 ? "+" : ""}${pctChange.toFixed(1)}%`;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={(e) => e.preventDefault()}
            className={`cursor-help ${className ?? ""}`}
            aria-label={`Trend: ${pctLabel}, min ${formatAmount(min, currency)}, max ${formatAmount(max, currency)}`}
          >
            <svg
              width={width}
              height={height}
              viewBox={`0 0 ${width} ${height}`}
              aria-hidden="true"
            >
              <path d={areaPath} fill={stroke} fillOpacity={0.12} />
              <path
                d={path}
                fill="none"
                stroke={stroke}
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Change</span>
              <span className={trendUp ? "font-semibold text-primary" : "font-semibold text-muted-foreground"}>
                {pctLabel}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Min</span>
              <span className="font-medium text-foreground">{formatAmount(min, currency)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Max</span>
              <span className="font-medium text-foreground">{formatAmount(max, currency)}</span>
            </div>
            <div className="pt-1 text-[10px] text-muted-foreground">
              {values.length} snapshot{values.length === 1 ? "" : "s"}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default Sparkline;
