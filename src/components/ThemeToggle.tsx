import { Moon, Sun, Monitor, Check } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type ThemeOption = "light" | "dark" | "system";

const OPTIONS: ReadonlyArray<{ value: ThemeOption; label: string; icon: typeof Sun }> = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

/**
 * Theme switcher with three modes: Light, Dark, and System.
 *
 * `theme` reflects the user's *intent* (including the literal "system")
 * while `resolvedTheme` is the actually-applied theme. We render the
 * trigger icon based on the resolved theme so it always matches what's
 * on screen.
 *
 * `next-themes` hydrates client-side, so we render a neutral placeholder
 * during SSR / first paint to avoid hydration mismatches.
 */
export const ThemeToggle = () => {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const current: ThemeOption = (theme as ThemeOption) ?? "system";
  const TriggerIcon = mounted && resolvedTheme === "dark" ? Sun : Moon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Toggle theme"
          className="text-muted-foreground hover:text-foreground"
        >
          <TriggerIcon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40 p-1.5">
        {OPTIONS.map(({ value, label, icon: Icon }) => {
          const isActive = mounted && current === value;
          return (
            <DropdownMenuItem
              key={value}
              onClick={() => setTheme(value)}
              className="gap-3 py-2 cursor-pointer [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground focus:[&_svg]:text-primary"
            >
              <Icon />
              <span className="flex-1">{label}</span>
              {isActive && <Check className="!text-primary" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
