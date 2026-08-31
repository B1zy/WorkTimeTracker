import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

// Catches render-time exceptions so a bug in one view (or a crash triggered
// by unexpected data, e.g. a corrupted localStorage blob or a bad backup
// import) shows a recoverable message instead of an unhandled white screen.
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Unhandled error in app render:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="app-crash">
          <h1>Something went wrong.</h1>
          <p>The app hit an unexpected error and couldn't continue. Reloading usually fixes it.</p>
          <button type="button" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
