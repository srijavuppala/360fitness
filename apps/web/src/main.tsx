import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/dm-sans/700.css";
import "@fontsource/manrope/500.css";
import "@fontsource/manrope/600.css";
import "@fontsource/manrope/700.css";
import "@fontsource/manrope/800.css";
import { Component, StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { Provider } from "./lib/store";
import { Layout } from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Diary from "./pages/Diary";
import Plan from "./pages/Plan";
import Library from "./pages/Library";
import Progress from "./pages/Progress";
import Settings from "./pages/Settings";
import { Landing, Login, Privacy } from "./pages/Public";
import "./styles.css";
class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="fatal-error">
        <h1>Let’s try that again.</h1>
        <p>
          This view could not be opened. Your saved data has not been cleared.
        </p>
        <button className="button" onClick={() => window.location.reload()}>
          Reload the app
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
const root = createRoot(document.getElementById("root")!);
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());
root.render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <Provider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/app" element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="diary" element={<Diary />} />
              <Route path="plan" element={<Plan />} />
              <Route path="library" element={<Library />} />
              <Route path="progress" element={<Progress />} />
              <Route path="settings" element={<Settings />} />
            </Route>
            <Route
              path="*"
              element={
                <div className="fatal-error">
                  <h1>A little off track.</h1>
                  <p>This page doesn’t exist.</p>
                  <Link className="button" to="/app">
                    Back to your workspace
                  </Link>
                </div>
              }
            />
          </Routes>
        </Provider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
);
