import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { api } from "../api/client";
import { Badge } from "./ui";
import type { LocalOnlyHealth } from "../types";

const NAV: { to: string; label: string; end?: boolean; stub?: boolean }[] = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/chat", label: "Main Chat" },
  { to: "/council", label: "AI Council" },
  { to: "/conversations", label: "Conversations" },
  { to: "/knowledge", label: "Knowledge Vault" },
  { to: "/decisions", label: "Decisions" },
  { to: "/tasks", label: "Tasks" },
  { to: "/approvals", label: "Approvals" },
  { to: "/workflows", label: "Workflows" },
  { to: "/tools", label: "Tools" },
  { to: "/observatory", label: "Observatory" },
  { to: "/audit", label: "Audit Trail" },
  { to: "/settings", label: "Settings" },
];

export default function AppShell() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [lo, setLo] = useState<LocalOnlyHealth | null>(null);
  const [loErr, setLoErr] = useState(false);

  useEffect(() => { api.localOnly().then((d) => setLo(d as LocalOnlyHealth)).catch(() => setLoErr(true)); }, []);
  const compliant = lo?.status === "compliant";

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">◆</span>
          <div><b className="brand-wordmark">THUNITY</b><small>Local AI Company OS</small></div>
        </div>
        <nav>
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}
              className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}>
              <span>{n.label}</span>
              {n.stub && <span className="soon">soon</span>}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">Founder-controlled · Auditable · Private</div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar-status">
            {loErr ? <Badge tone="bad">LOCAL-ONLY: UNKNOWN</Badge>
              : compliant ? <Badge tone="ok">LOCAL-ONLY: ON</Badge>
              : <Badge tone="warn">LOCAL-ONLY: {(lo?.status || "…").toUpperCase()}</Badge>}
            {lo && <span className="muted small">Ollama {lo.ollama_status} · DB {lo.database} · n8n {lo.n8n}</span>}
          </div>
          <div className="topbar-user">
            <span className="muted small">{user?.username} · <b>{user?.role}</b></span>
            <button className="btn btn-ghost" onClick={() => { logout(); nav("/login"); }}>Sign out</button>
          </div>
        </header>
        {(loErr || (lo && !compliant)) && (
          <div className="banner banner-bad">
            ⚠ Local-only status could not be confirmed as compliant. Verify the backend before trusting data sovereignty.
          </div>
        )}
        <main className="content"><Outlet /></main>
      </div>
    </div>
  );
}
