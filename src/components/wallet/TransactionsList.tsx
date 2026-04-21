import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/contexts/WalletContext";
import { useTransactionLookups } from "@/hooks/useTransactionLookups";
import { TransactionRow } from "./TransactionRow";

const PREVIEW_LIMIT = 8;

export const TransactionsList = () => {
  const { transactions } = useWallet();
  const visible = transactions.slice(0, PREVIEW_LIMIT);
  const { syndicateMap, drawMap, wdMap } = useTransactionLookups(visible);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Recent Transactions</CardTitle>
        {transactions.length > 0 && (
          <Button asChild variant="ghost" size="sm">
            <Link to="/wallet/transactions">View all</Link>
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {visible.length === 0 ? (
          <p className="text-sm text-muted-foreground">No transactions yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {visible.map((t) => (
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
  );
};
