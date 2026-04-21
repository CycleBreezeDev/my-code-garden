import { Card } from "@/components/ui/card";
import { Flag } from "lucide-react";

export const SocialReports = () => (
  <Card className="p-6">
    <div className="flex items-start gap-3">
      <Flag className="mt-0.5 h-5 w-5 text-primary" />
      <div>
        <h2 className="text-base font-semibold text-foreground">Social reports</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Reporting tables are not yet provisioned. This panel will activate
          once the social moderation schema is migrated.
        </p>
      </div>
    </div>
  </Card>
);

export default SocialReports;
