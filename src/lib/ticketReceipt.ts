import jsPDF from "jspdf";

import { formatPrice } from "@/lib/lotteryAssets";

export type TicketReceipt = {
  ticketId: string;
  lotteryName: string;
  drawDate: string;
  main: number[];
  bonus: number[];
  lines: number;
  pricePerLine: number;
  discount: number;
  total: number;
  currency: string;
  paymentReference?: string;
  buyerEmail?: string | null;
  brandColor?: string | null;
  // Wall-clock time the purchase was confirmed. Defaults to now() so callers
  // don't have to thread it through if they're generating immediately.
  purchasedAt?: Date;
};

// Convert a CSS color (hex or hsl(...)) to an [r, g, b] tuple jsPDF can use.
// We only need to handle the two formats used by `lotteryAssets.getColor`.
const toRgb = (color: string | null | undefined): [number, number, number] => {
  if (!color) return [37, 99, 235]; // tailwind blue-600 fallback
  const c = color.trim();
  if (c.startsWith("#")) {
    const hex = c.slice(1);
    const full = hex.length === 3 ? hex.split("").map((x) => x + x).join("") : hex;
    const n = parseInt(full, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  if (c.startsWith("hsl")) {
    const m = c.match(/hsl\(\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(\d+(?:\.\d+)?)%\s*[, ]\s*(\d+(?:\.\d+)?)%\s*\)/i);
    if (!m) return [37, 99, 235];
    const h = parseFloat(m[1]) / 360;
    const s = parseFloat(m[2]) / 100;
    const l = parseFloat(m[3]) / 100;
    if (s === 0) {
      const v = Math.round(l * 255);
      return [v, v, v];
    }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const hue2rgb = (t: number) => {
      let x = t;
      if (x < 0) x += 1;
      if (x > 1) x -= 1;
      if (x < 1 / 6) return p + (q - p) * 6 * x;
      if (x < 1 / 2) return q;
      if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
      return p;
    };
    return [
      Math.round(hue2rgb(h + 1 / 3) * 255),
      Math.round(hue2rgb(h) * 255),
      Math.round(hue2rgb(h - 1 / 3) * 255),
    ];
  }
  return [37, 99, 235];
};

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "ticket";

/**
 * Generate a single-page A4 PDF receipt and trigger the browser download.
 * Uses jsPDF's built-in Helvetica so no font shipping is needed.
 */
export const downloadTicketReceipt = (r: TicketReceipt) => {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 48;
  const contentW = pageW - margin * 2;
  const purchasedAt = r.purchasedAt ?? new Date();
  const [br, bg, bb] = toRgb(r.brandColor ?? null);

  // ---- Header band ------------------------------------------------
  doc.setFillColor(br, bg, bb);
  doc.rect(0, 0, pageW, 96, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("Ticket Receipt", margin, 46);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(r.lotteryName, margin, 66);

  doc.setFontSize(9);
  doc.text(
    purchasedAt.toLocaleString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }),
    pageW - margin,
    46,
    { align: "right" }
  );
  doc.text(`Ref: ${r.ticketId.slice(0, 18)}…`, pageW - margin, 66, { align: "right" });

  // ---- Body --------------------------------------------------------
  doc.setTextColor(20, 20, 20);
  let y = 140;

  // Section: Draw + lines
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Draw", margin, y);
  doc.text("Lines", margin + contentW / 2, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(
    new Date(r.drawDate).toLocaleString(undefined, {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }),
    margin,
    y + 16
  );
  doc.text(`${r.lines} line${r.lines === 1 ? "" : "s"}`, margin + contentW / 2, y + 16);

  y += 48;

  // Section: Numbers — drawn as filled circles for the brand color (main)
  // and outlined circles (bonus). We wrap onto multiple rows if needed.
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Your numbers", margin, y);
  y += 16;

  const drawBalls = (
    nums: number[],
    fill: boolean,
    startY: number
  ): number => {
    const radius = 14;
    const gap = 10;
    const diameter = radius * 2;
    let cx = margin + radius;
    let cy = startY + radius;
    for (const n of nums) {
      if (cx + radius > margin + contentW) {
        cx = margin + radius;
        cy += diameter + gap;
      }
      if (fill) {
        doc.setFillColor(br, bg, bb);
        doc.circle(cx, cy, radius, "F");
        doc.setTextColor(255, 255, 255);
      } else {
        doc.setDrawColor(br, bg, bb);
        doc.setLineWidth(1.5);
        doc.circle(cx, cy, radius, "S");
        doc.setTextColor(br, bg, bb);
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(String(n), cx, cy + 4, { align: "center" });
      cx += diameter + gap;
    }
    return cy + radius; // bottom Y
  };

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(110, 110, 110);
  doc.text("MAIN", margin, y + 4);
  y = drawBalls(r.main, true, y + 10) + 12;

  if (r.bonus.length > 0) {
    doc.setTextColor(110, 110, 110);
    doc.setFontSize(9);
    doc.text("BONUS", margin, y + 4);
    y = drawBalls(r.bonus, false, y + 10) + 12;
  }

  doc.setTextColor(20, 20, 20);
  y += 12;

  // Section: Cost breakdown
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.5);
  doc.line(margin, y, margin + contentW, y);
  y += 22;

  const subtotal = +(r.pricePerLine * r.lines).toFixed(2);
  const savings = +(subtotal - r.total).toFixed(2);

  const row = (label: string, value: string, opts?: { bold?: boolean; muted?: boolean }) => {
    doc.setFont("helvetica", opts?.bold ? "bold" : "normal");
    doc.setFontSize(opts?.bold ? 12 : 10);
    doc.setTextColor(opts?.muted ? 110 : 20, opts?.muted ? 110 : 20, opts?.muted ? 110 : 20);
    doc.text(label, margin, y);
    doc.text(value, margin + contentW, y, { align: "right" });
    y += opts?.bold ? 22 : 18;
  };

  row("Price per line", formatPrice(r.pricePerLine, r.currency), { muted: true });
  row(`Subtotal (×${r.lines})`, formatPrice(subtotal, r.currency), { muted: true });
  if (r.discount > 0) {
    doc.setTextColor(br, bg, bb);
    row(
      `Discount (${Math.round(r.discount * 100)}%)`,
      `- ${formatPrice(savings, r.currency)}`
    );
    doc.setTextColor(20, 20, 20);
  }

  y += 4;
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, y, margin + contentW, y);
  y += 22;
  row("Total paid", formatPrice(r.total, r.currency), { bold: true });

  // ---- Footer ------------------------------------------------------
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(140, 140, 140);
  const footerY = doc.internal.pageSize.getHeight() - 48;
  if (r.buyerEmail) {
    doc.text(`Issued to ${r.buyerEmail}`, margin, footerY);
  }
  doc.text("Keep this receipt as proof of purchase.", margin, footerY + 14);
  doc.text(
    `Ticket ID: ${r.ticketId}`,
    pageW - margin,
    footerY + 14,
    { align: "right" }
  );

  const filename = `receipt-${slugify(r.lotteryName)}-${r.ticketId.slice(0, 8) || "draft"}.pdf`;
  doc.save(filename);
};
