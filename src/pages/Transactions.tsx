import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWallet, formatMoney } from "@/contexts/WalletContext";
import { useTransactionLookups } from "@/hooks/useTransactionLookups";
import { TransactionRow, KIND_LABEL } from "@/components/wallet/TransactionRow";
import { ArrowLeft, Download } from "lucide-react";

const STATUSES = ["completed", "pending", "failed", "reversed"] as const;

const toCsv = (rows: string[][]) =>
  rows
    .map((r) =>
      r
        .map((cell) => {
          const s = String(cell ?? "");
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(","),
    )
    .join("\n");

const Transactions = () => {
  const { transactions } = useWallet();
  const [kind, setKind] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (kind !== "all" && t.kind !== kind) return false;
      if (status !== "all" && t.status !== status) return false;
      const created = new Date(t.created_at).getTime();
      if (from) {
        const f = new Date(from).getTime();
        if (created < f) return false;
      }
      if (to) {
        // Include the entire "to" day
        const tEnd = new Date(to).getTime() + 24 * 60 * 60 * 1000 - 1;
        if (created > tEnd) return false;
      }
      return true;
    });
  }, [transactions, kind, status, from, to]);

  const { syndicateMap, drawMap, wdMap } = useTransactionLookups(filtered);

  const kinds = useMemo(() => {
    const s = new Set<string>();
    for (const t of transactions) s.add(t.kind);
    return Array.from(s).sort();
  }, [transactions]);

  const handleExport = () => {
    const header = [
      "Date",
      "Kind",
      "Status",
      "Amount",
      "Currency",
      "Balance after",
      "Provider",
      "Reference",
    ];
    const rows = filtered.map((t) => [
      new Date(t.created_at).toISOString(),
      t.kind,
      t.status,
      String(t.amount),
      t.currency,
      t.balance_after != null ? String(t.balance_after) : "",
      t.provider ?? "",
      t.reference ?? "",
    ]);
    const csv = toCsv([header, ...rows]);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const stamp = new Date().toISOString().slice(0, 10);
    a.download = `transactions-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const totalIn = filtered.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const totalOut = filtered.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  const currency = filtered[0]?.currency ?? "USD";

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-5xl px-6 pt-28 pb-16">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
              <Link to="/dashboard">
                <ArrowLeft className="h-4 w-4 mr-1" /> Back to dashboard
              </Link>
            </Button>
            <h1 className="font-heading text-3xl font-bold tracking-tight">Transactions</h1>
            <p className="text-sm text-muted-foreground">
              {filtered.length} of {transactions.length} entries
            </p>
          </div>
          <Button onClick={handleExport} disabled={filtered.length === 0}>
            <Download className="h-4 w-4 mr-2" /> Export CSV
          </Button>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="grid gap-1.5">
                <Label htmlFor="kind">Type</Label>
                <Select value={kind} onValueChange={setKind}>
                  <SelectTrigger id="kind"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    {kinds.map((k) => (
                      <SelectItem key={k} value={k}>
                        {KIND_LABEL[k]?.label ?? k}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="status">Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger id="status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="from">From</Label>
                <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="to">To</Label>
                <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
            </div>
            {(kind !== "all" || status !== "all" || from || to) && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-3"
                onClick={() => { setKind("all"); setStatus("all"); setFrom(""); setTo(""); }}
              >
                Clear filters
              </Button>
            )}
          </CardContent>
        </Card>

        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">Money in</p>
              <p className="text-lg font-semibold tabular-nums text-primary">
                +{formatMoney(totalIn, currency)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">Money out</p>
              <p className="text-lg font-semibold tabular-nums">
                −{formatMoney(totalOut, currency)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">Net</p>
              <p className="text-lg font-semibold tabular-nums">
                {formatMoney(totalIn - totalOut, currency)}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>All Transactions</CardTitle></CardHeader>
          <CardContent>
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground">No transactions match your filters.</p>
            ) : (
              <ul className="divide-y divide-border">
                {filtered.map((t) => (
                  <TransactionRow
                    key={t.id}
                    t={t}
                    syndicateMap={syndicateMap}
                    drawMap={drawMap}
                    wdMap={wdMap}
                  />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
};

export default Transactions;
