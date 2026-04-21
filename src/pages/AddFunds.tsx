import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus } from "lucide-react";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { AddFundsForm } from "@/components/wallet/AddFundsDialog";
import { WalletSubNav } from "@/components/wallet/WalletSubNav";

const AddFunds = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-20">
        <div className="mx-auto max-w-xl px-6 py-8">
          <Link to="/dashboard">
            <Button variant="ghost" size="sm" className="mb-4 -ml-2">
              <ArrowLeft className="h-4 w-4 mr-1" /> Back to Dashboard
            </Button>
          </Link>
          <WalletSubNav />
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="mb-5 flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Plus className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="font-heading text-xl font-bold text-foreground">Add Funds</h1>
                <p className="text-xs text-muted-foreground">Top up your wallet via Paystack or Flutterwave.</p>
              </div>
            </div>
            <AddFundsForm onDone={() => navigate("/dashboard")} />
          </div>
        </div>
      </main>
    </div>
  );
};

export default AddFunds;
