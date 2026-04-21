export type NumberFormat = {
  main: { count: number; min: number; max: number };
  bonus: { count: number; min: number; max: number };
};

export const DEFAULT_FORMAT: NumberFormat = {
  main: { count: 6, min: 1, max: 49 },
  bonus: { count: 0, min: 0, max: 0 },
};

export const parseFormat = (raw: unknown): NumberFormat => {
  if (!raw || typeof raw !== "object") return DEFAULT_FORMAT;
  const r = raw as Record<string, { count?: number; min?: number; max?: number }>;
  return {
    main: {
      count: Number(r.main?.count ?? DEFAULT_FORMAT.main.count),
      min: Number(r.main?.min ?? DEFAULT_FORMAT.main.min),
      max: Number(r.main?.max ?? DEFAULT_FORMAT.main.max),
    },
    bonus: {
      count: Number(r.bonus?.count ?? DEFAULT_FORMAT.bonus.count),
      min: Number(r.bonus?.min ?? DEFAULT_FORMAT.bonus.min),
      max: Number(r.bonus?.max ?? DEFAULT_FORMAT.bonus.max),
    },
  };
};

export const quickPick = (count: number, min: number, max: number): number[] => {
  if (count <= 0 || max < min) return [];
  const pool: number[] = [];
  for (let i = min; i <= max; i++) pool.push(i);
  // Fisher-Yates shuffle (partial)
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count).sort((a, b) => a - b);
};

export type LuckyPick = {
  share_index: number;
  main: number[];
  bonus: number[];
};

export const validatePick = (pick: LuckyPick, fmt: NumberFormat): string | null => {
  if (pick.main.length !== fmt.main.count) {
    return `Pick ${fmt.main.count} main number${fmt.main.count > 1 ? "s" : ""}`;
  }
  if (new Set(pick.main).size !== pick.main.length) return "Main numbers must be unique";
  for (const n of pick.main) {
    if (!Number.isInteger(n) || n < fmt.main.min || n > fmt.main.max) {
      return `Main numbers must be between ${fmt.main.min} and ${fmt.main.max}`;
    }
  }
  if (fmt.bonus.count > 0) {
    if (pick.bonus.length !== fmt.bonus.count) {
      return `Pick ${fmt.bonus.count} bonus number${fmt.bonus.count > 1 ? "s" : ""}`;
    }
    if (new Set(pick.bonus).size !== pick.bonus.length) return "Bonus numbers must be unique";
    for (const n of pick.bonus) {
      if (!Number.isInteger(n) || n < fmt.bonus.min || n > fmt.bonus.max) {
        return `Bonus must be between ${fmt.bonus.min} and ${fmt.bonus.max}`;
      }
    }
  }
  return null;
};
