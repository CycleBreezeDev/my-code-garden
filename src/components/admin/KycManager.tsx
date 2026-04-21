import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck } from "lucide-react";

export const KycManager = () => (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-primary" /> KYC Management
      </CardTitle>
    </CardHeader>
    <CardContent>
      <p className="text-sm text-muted-foreground">
        KYC tables are not yet provisioned in this environment. This module will
        be available once the KYC schema is migrated.
      </p>
    </CardContent>
  </Card>
);

export default KycManager;
