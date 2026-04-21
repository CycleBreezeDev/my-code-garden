interface Props {
  main: number[];
  bonus?: number[];
  color?: string;
  size?: "sm" | "md";
}

/**
 * Reusable colored ball renderer for lottery number lines.
 * - main balls use the lottery's brand color
 * - bonus balls render with a contrasting accent ring
 */
export const NumberBalls = ({ main, bonus = [], color = "hsl(var(--primary))", size = "md" }: Props) => {
  const dims =
    size === "sm"
      ? "h-7 w-7 text-[11px]"
      : "h-9 w-9 text-sm";

  if (main.length === 0 && bonus.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {main.map((n, i) => (
        <span
          key={`m-${i}-${n}`}
          className={`inline-flex ${dims} items-center justify-center rounded-full font-bold text-white shadow-sm`}
          style={{ background: color }}
        >
          {String(n).padStart(2, "0")}
        </span>
      ))}
      {bonus.length > 0 && (
        <>
          <span className="mx-0.5 text-muted-foreground" aria-hidden>+</span>
          {bonus.map((n, i) => (
            <span
              key={`b-${i}-${n}`}
              className={`inline-flex ${dims} items-center justify-center rounded-full border-2 bg-card font-bold`}
              style={{ borderColor: color, color }}
            >
              {String(n).padStart(2, "0")}
            </span>
          ))}
        </>
      )}
    </div>
  );
};
