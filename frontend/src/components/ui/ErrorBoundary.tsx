import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "./Button";

interface Props {
  children: ReactNode;
  /** Optional label so the message can name the area that failed. */
  area?: string;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[ErrorBoundary]", this.props.area ?? "", error, info.componentStack);
  }

  private reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="max-w-md space-y-4 border-2 border-ink bg-surface p-8 text-center shadow-brutal">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-danger">
            Something broke
          </p>
          <h1 className="text-2xl font-black uppercase leading-tight">
            This section failed to load
          </h1>
          <p className="text-sm text-muted">
            You can retry, or reload the page if it keeps happening.
          </p>
          <div className="flex justify-center gap-3">
            <Button onClick={this.reset}>Retry</Button>
            <Button variant="secondary" onClick={() => window.location.reload()}>
              Reload
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
