import { Routes, Route, Navigate } from "react-router-dom";
import type { JSX } from "react";
import { useAuth } from "./auth/AuthContext";
import AppShell from "./components/AppShell";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Observatory from "./pages/Observatory";
import Audit from "./pages/Audit";
import Placeholder from "./pages/Placeholder";

function Protected({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="boot"><span className="spinner" /> Loading…</div>;
  return user ? children : <Navigate to="/login" replace />;
}

const STUBS: [string, string][] = [
  ["council", "AI Council"], ["conversations", "Conversations"], ["knowledge", "Knowledge Vault"],
  ["decisions", "Decisions"], ["tasks", "Tasks"], ["approvals", "Approvals"],
  ["workflows", "Workflows"], ["tools", "Tools"], ["settings", "Settings"],
];

export default function App() {
  const { user, loading } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user && !loading ? <Navigate to="/" replace /> : <Login />} />
      <Route element={<Protected><AppShell /></Protected>}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/observatory" element={<Observatory />} />
        <Route path="/audit" element={<Audit />} />
        {STUBS.map(([p, label]) => <Route key={p} path={`/${p}`} element={<Placeholder title={label} />} />)}
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
