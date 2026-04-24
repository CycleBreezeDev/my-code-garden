import { Component, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  /** Optional custom fallback renderer. Receives the captured error and a reset callback. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
  /** Optional callback for logging/analytics when an error is captured. */
  onError?: (error: Error, info: { componentStack: string }) => void;
}

interface State {
  error: Error | null;
}

/**
 * Generic error boundary used to keep a single page crash from blanking
 * the whole app. Renders a friendly fallback with a retry that remounts
 * the children. Pass `fallback` to customise the UI per route.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    // Surface in the console so devs see the stack while debugging.
    // eslint-disable-next-line no-console
    console.error("ErrorBoundary caught:", error, info);
    this.props.onError?.(error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) return this.props.fallback(error, this.reset);

    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6 py-16">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h2 className="font-heading text-xl font-bold text-foreground">Something went wrong</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            We hit an unexpected error loading this page. You can try again or refresh the browser.
          </p>
          {error.message ? (
            <p className="mt-3 break-words rounded-lg bg-secondary/50 px-3 py-2 text-left text-xs text-muted-foreground">
              {error.message}
            </p>
          ) : null}
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button onClick={this.reset} className="gap-2">
              <RefreshCw className="h-4 w-4" /> Try again
            </Button>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Reload page
            </Button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
