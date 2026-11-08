import { Component, type ErrorInfo, type ReactNode, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { applyTheme, readTheme } from "./theme";
import "./styles.css";

class ErrorBoundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Porch view failed", error, info);
  }
  render() {
    if (this.state.error)
      return (
        <main className="fatal">
          <h1>The view could not render</h1>
          <p>Your agents are still independent of this window.</p>
          <button type="button" onClick={() => location.reload()}>
            Reload view
          </button>
        </main>
      );
    return this.props.children;
  }
}

const root = document.getElementById("root");
applyTheme(readTheme());
if (!root) throw new Error("Missing app root");
createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
