import { Routes, Route, Navigate } from "react-router-dom";
import type { JSX } from "react";
import { useAuth } from "./auth/AuthContext";
import AppShell from "./components/AppShell";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Observatory from "./pages/Observatory";
import Audit from "./pages/Audit";
import Decisions from "./pages/Decisions";
import Tasks from "./pages/Tasks";
import Approvals from "./pages/Approvals";
import Knowledge from "./pages/Knowledge";
import Conversations from "./pages/Conversations";
import Council from "./pages/Council";
import Workflows from "./pages/Workflows";
import Tools from "./pages/Tools";
import Settings from "./pages/Settings";
import Placeholder from "./pages/Placeholder";

function Protected({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="boot"><span className="spinner" /> Loading…</div>;
  return user ? children : <Navigate to="/login" replace />;
}

const STUBS: [string, string][] = [];

export default function App() {
  const { user, loading } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user && !loading ? <Navigate to="/" replace /> : <Login />} />
      <Route element={<Protected><AppShell /></Protected>}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/observatory" element={<Observatory />} />
        <Route path="/audit" element={<Audit />} />
        <Route path="/decisions" element={<Decisions />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/approvals" element={<Approvals />} />
        <Route path="/knowledge" element={<Knowledge />} />
        <Route path="/conversations" element={<Conversations />} />
        <Route path="/council" element={<Council />} />
        <Route path="/workflows" element={<Workflows />} />
        <Route path="/tools" element={<Tools />} />
        <Route path="/settings" element={<Settings />} />
        {STUBS.map(([p, label]) => <Route key={p} path={`/${p}`} element={<Placeholder title={label} />} />)}
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
