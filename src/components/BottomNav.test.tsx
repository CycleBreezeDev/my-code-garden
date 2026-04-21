import { describe, it, expect } from "vitest";
import { Home, Ticket, Trophy, Rss, HelpCircle } from "lucide-react";
import { __test__ } from "./BottomNav";

const { isItemActive } = __test__;

const home = { label: "Home", to: "/", icon: Home, matchPrefixes: ["/"] };
const tickets = {
  label: "My Tickets",
  to: "/dashboard",
  icon: Ticket,
  matchPrefixes: ["/dashboard", "/wallet", "/kyc"],
};
const results = {
  label: "Results",
  to: "/results",
  icon: Trophy,
  matchPrefixes: ["/results", "/lottery", "/lotteries"],
};
const feed = {
  label: "Feed",
  to: "/feed",
  icon: Rss,
  matchPrefixes: ["/feed", "/notifications", "/messages", "/u"],
};
const faq = { label: "FAQ", to: "/#how-it-works", icon: HelpCircle, alwaysInactive: true };

describe("BottomNav.isItemActive", () => {
  it("Home only matches exact root", () => {
    expect(isItemActive("/", home)).toBe(true);
    expect(isItemActive("/lotteries", home)).toBe(false);
    expect(isItemActive("/dashboard", home)).toBe(false);
  });

  it("My Tickets matches /dashboard and nested wallet/kyc routes", () => {
    expect(isItemActive("/dashboard", tickets)).toBe(true);
    expect(isItemActive("/dashboard/anything", tickets)).toBe(true);
    expect(isItemActive("/wallet/add-funds", tickets)).toBe(true);
    expect(isItemActive("/kyc", tickets)).toBe(true);
    expect(isItemActive("/feed", tickets)).toBe(false);
  });

  it("Results matches /results and lottery detail/history routes", () => {
    expect(isItemActive("/results", results)).toBe(true);
    expect(isItemActive("/results/2024-01", results)).toBe(true);
    expect(isItemActive("/lottery/powerball", results)).toBe(true);
    expect(isItemActive("/lotteries/powerball/history", results)).toBe(true);
    expect(isItemActive("/feed", results)).toBe(false);
  });

  it("Feed matches /feed plus notifications/messages/profile routes", () => {
    expect(isItemActive("/feed", feed)).toBe(true);
    expect(isItemActive("/feed/post/123", feed)).toBe(true);
    expect(isItemActive("/notifications", feed)).toBe(true);
    expect(isItemActive("/messages/abc", feed)).toBe(true);
    expect(isItemActive("/u/jane", feed)).toBe(true);
    expect(isItemActive("/dashboard", feed)).toBe(false);
  });

  it("guards against false-positive prefix matches (e.g. /feedback)", () => {
    expect(isItemActive("/feedback", feed)).toBe(false);
    expect(isItemActive("/dashboards", tickets)).toBe(false);
    expect(isItemActive("/resultset", results)).toBe(false);
  });

  it("FAQ is always inactive (hash link)", () => {
    expect(isItemActive("/", faq)).toBe(false);
    expect(isItemActive("/anywhere", faq)).toBe(false);
  });
});
