import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Mocks: isolate DisplayPrice from network + global context.
// ---------------------------------------------------------------------------
vi.mock("@/contexts/CurrencyContext", () => ({
  useCurrency: () => ({ currency: "NGN", setCurrency: () => {}, detecting: false }),
}));

const fxRateMock = vi.fn();
vi.mock("@/hooks/useFxRate", () => ({
  useFxRate: (...args: unknown[]) => fxRateMock(...args),
}));

import { DisplayPrice } from "./DisplayPrice";

beforeEach(() => {
  fxRateMock.mockReset();
});

// ---------------------------------------------------------------------------
// 1. Visual contract: tooltip layout, font sizes, max width.
// ---------------------------------------------------------------------------
describe("DisplayPrice — tooltip visual contract", () => {
  it("renders the standard tooltip trigger with dotted underline + cursor-help", () => {
    fxRateMock.mockReturnValue({ data: 1500, isError: false, isLoading: false });

    const { container } = render(
      <DisplayPrice amount={10} sourceCurrency="USD" />,
    );

    // The trigger span must carry the standard affordance classes so users
    // know it's interactive across every page.
    const trigger = container.querySelector("span.cursor-help");
    expect(trigger).not.toBeNull();
    expect(trigger?.className).toContain("underline");
    expect(trigger?.className).toContain("decoration-dotted");
    expect(trigger?.className).toContain("tabular-nums");
  });

  it("renders the converted (target-currency) amount in the trigger", () => {
    fxRateMock.mockReturnValue({ data: 1500, isError: false, isLoading: false });

    const { container } = render(<DisplayPrice amount={10} sourceCurrency="USD" />);

    // 10 USD × 1500 = 15,000 NGN. Whitespace between code and number can
    // be a regular or non-breaking space, so match loosely.
    expect(container.textContent ?? "").toMatch(/NGN\s*15,000/);
  });

  it("falls back to the source amount with no tooltip while FX is loading", () => {
    fxRateMock.mockReturnValue({ data: undefined, isError: false, isLoading: true });

    const { container } = render(
      <DisplayPrice amount={10} sourceCurrency="USD" />,
    );

    // No tooltip trigger while loading — just a skeleton placeholder.
    expect(container.querySelector("span.cursor-help")).toBeNull();
    expect(container.querySelector(".animate-pulse")).not.toBeNull();
  });

  it("falls back to the source amount with no tooltip on FX error", () => {
    fxRateMock.mockReturnValue({ data: undefined, isError: true, isLoading: false });

    const { container } = render(
      <DisplayPrice amount={10} sourceCurrency="USD" />,
    );

    expect(container.querySelector("span.cursor-help")).toBeNull();
    expect(screen.getByText(/\$10/)).toBeInTheDocument();
  });

  it("renders source currency unchanged when source === target (no tooltip)", () => {
    fxRateMock.mockReturnValue({ data: undefined, isError: false, isLoading: false });

    const { container } = render(
      <DisplayPrice amount={10} sourceCurrency="NGN" />,
    );

    expect(container.querySelector("span.cursor-help")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 2. Source-level invariants: tooltip layout tokens are still present in
//    DisplayPrice. These guard against accidental drift in the shared
//    tooltip spec.
// ---------------------------------------------------------------------------
describe("DisplayPrice source — shared tooltip spec", () => {
  const source = readFileSync(
    join(process.cwd(), "src/components/DisplayPrice.tsx"),
    "utf8",
  );

  it("declares the standard tooltip layout container (space-y-1)", () => {
    expect(source).toMatch(/className="space-y-1"/);
  });

  it("declares the standard 'Original:' line with font-medium", () => {
    expect(source).toMatch(/font-medium["'>\s]+Original:/);
  });

  it("declares the standard rate line with text-xs text-muted-foreground", () => {
    expect(source).toMatch(/text-xs text-muted-foreground/);
  });

  it("constrains the tooltip with max-w-xs", () => {
    expect(source).toMatch(/max-w-xs/);
  });
});

// ---------------------------------------------------------------------------
// 3. Cross-page invariant: no other component reproduces FX conversion.
//    Every converted price must funnel through DisplayPrice so the tooltip
//    layout, font sizes, and max width stay uniform across pages.
// ---------------------------------------------------------------------------
describe("App-wide — converted prices funnel through DisplayPrice", () => {
  const SRC_DIR = join(process.cwd(), "src");
  const ALLOWED = new Set([
    join(SRC_DIR, "components/DisplayPrice.tsx"),
    join(SRC_DIR, "components/DisplayPrice.test.tsx"),
    join(SRC_DIR, "hooks/useFxRate.ts"),
  ]);

  function walk(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const s = statSync(full);
      if (s.isDirectory()) {
        if (entry === "node_modules" || entry === "test") continue;
        out.push(...walk(full));
      } else if (/\.(ts|tsx)$/.test(entry)) {
        out.push(full);
      }
    }
    return out;
  }

  const files = walk(SRC_DIR);

  it("only DisplayPrice imports useFxRate (no parallel converters)", () => {
    const offenders = files
      .filter((f) => !ALLOWED.has(f))
      .filter((f) => /useFxRate/.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
});
