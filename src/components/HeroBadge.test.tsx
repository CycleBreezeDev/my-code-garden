import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Sparkles } from "lucide-react";

// Stub DisplayPrice so we can detect whether the badge tried to render a
// converted price. Using a sentinel `data-testid` keeps the assertion
// independent of FX / currency context wiring.
vi.mock("@/components/DisplayPrice", () => ({
  DisplayPrice: ({ amount, sourceCurrency }: { amount: number; sourceCurrency: string }) => (
    <span data-testid="display-price">
      {sourceCurrency} {amount}
    </span>
  ),
}));

import { HeroBadge } from "./HeroBadge";

describe("HeroBadge — price fallback", () => {
  it("renders DisplayPrice when both amount and currency are present", () => {
    render(<HeroBadge icon={Sparkles} text="Next Powerball Draw:" amount={850_000_000} currency="USD" />);

    expect(screen.getByTestId("display-price")).toBeInTheDocument();
    expect(screen.getByText("Next Powerball Draw:")).toBeInTheDocument();
  });

  it("falls back to text-only when amount is null", () => {
    render(<HeroBadge icon={Sparkles} text="Coming soon" amount={null} currency="USD" />);

    expect(screen.queryByTestId("display-price")).toBeNull();
    expect(screen.getByText("Coming soon")).toBeInTheDocument();
  });

  it("falls back to text-only when amount is undefined", () => {
    render(<HeroBadge icon={Sparkles} text="Over $2 Billion in Jackpots" />);

    expect(screen.queryByTestId("display-price")).toBeNull();
    expect(screen.getByText("Over $2 Billion in Jackpots")).toBeInTheDocument();
  });

  it("falls back to text-only when currency is missing even if amount is set", () => {
    render(<HeroBadge icon={Sparkles} text="Pool prize" amount={1000} />);

    expect(screen.queryByTestId("display-price")).toBeNull();
    expect(screen.getByText("Pool prize")).toBeInTheDocument();
  });

  it("falls back to text-only when currency is an empty string", () => {
    render(<HeroBadge icon={Sparkles} text="Pool prize" amount={1000} currency="" />);

    expect(screen.queryByTestId("display-price")).toBeNull();
    expect(screen.getByText("Pool prize")).toBeInTheDocument();
  });

  it("falls back to text-only when currency is null", () => {
    render(<HeroBadge icon={Sparkles} text="Pool prize" amount={1000} currency={null} />);

    expect(screen.queryByTestId("display-price")).toBeNull();
    expect(screen.getByText("Pool prize")).toBeInTheDocument();
  });

  it("treats amount=0 as a real value (renders the converted price)", () => {
    // 0 is a legitimate amount — only null/undefined should trigger fallback.
    render(<HeroBadge icon={Sparkles} text="Free draw" amount={0} currency="USD" />);

    expect(screen.getByTestId("display-price")).toBeInTheDocument();
  });

  it("renders the icon in every variant (no layout glitch)", () => {
    const { container, rerender } = render(
      <HeroBadge icon={Sparkles} text="With price" amount={100} currency="USD" />,
    );
    expect(container.querySelector("svg")).not.toBeNull();

    rerender(<HeroBadge icon={Sparkles} text="Text only" />);
    expect(container.querySelector("svg")).not.toBeNull();
  });
});
