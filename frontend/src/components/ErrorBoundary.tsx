import { Component, type ErrorInfo, type ReactNode } from "react";

// Top-level safety net: a render error in any page would otherwise unmount the
// whole React tree and leave the founder staring at a blank white screen with no
// way back. This catches it and offers a recoverable fallback instead.
interface Props { children: ReactNode }
interface State { error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface to the console for diagnosis; never silently swallow.
    console.error("Thunity UI error boundary caught:", error, info.componentStack);
  }

  private reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
          <div style={{ maxWidth: 480, textAlign: "center" }}>
            <h1 style={{ fontSize: 18, marginBottom: 8 }}>Something went wrong on this screen.</h1>
            <p style={{ opacity: 0.7, marginBottom: 16, fontSize: 14 }}>
              Your data is safe and on your machine. You can reload, or go back and try again.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <button onClick={() => window.location.reload()}>Reload</button>
              <button onClick={this.reset}>Dismiss</button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
