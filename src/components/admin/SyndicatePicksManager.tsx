import { ListChecks } from "lucide-react";

const SyndicatePicksManager = () => (
  <div className="rounded-2xl border border-border bg-card p-5">
    <div className="mb-2 flex items-center gap-2">
      <ListChecks className="h-5 w-5 text-primary" />
      <h2 className="font-heading text-lg font-bold text-foreground">
        Syndicate Lucky Picks
      </h2>
    </div>
    <p className="text-sm text-muted-foreground">
      Lucky-pick tables are not yet provisioned in this environment. This module
      will be available once the syndicate-picks schema is migrated.
    </p>
  </div>
);

export default SyndicatePicksManager;
