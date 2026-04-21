import { Link } from "react-router-dom";
import { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface EmptyStateAction {
  label: string;
  to: string;
  icon?: LucideIcon;
}

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  primary?: EmptyStateAction;
  /** Optional secondary action rendered as a ghost link-style button. */
  secondary?: EmptyStateAction;
}

/**
 * Friendly empty-state card used by every /profile tab. Centralised so the
 * spacing, icon framing, and CTA hierarchy stay identical across tabs and
 * we don't repeat the same Tailwind soup six times.
 */
export const EmptyState = ({ icon: Icon, title, description, primary, secondary }: EmptyStateProps) => {
  return (
    <Card className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="h-6 w-6" />
      </div>
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">{description}</p>
      </div>
      {(primary || secondary) && (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          {primary && (
            <Button asChild size="sm">
              <Link to={primary.to}>
                {primary.icon && <primary.icon className="mr-1.5 h-3.5 w-3.5" />}
                {primary.label}
              </Link>
            </Button>
          )}
          {secondary && (
            <Button asChild size="sm" variant="ghost">
              <Link to={secondary.to}>
                {secondary.icon && <secondary.icon className="mr-1.5 h-3.5 w-3.5" />}
                {secondary.label}
              </Link>
            </Button>
          )}
        </div>
      )}
    </Card>
  );
};
