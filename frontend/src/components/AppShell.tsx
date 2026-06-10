import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { api } from "../api/client";
import type { LocalOnlyHealth, ConvBrief } from "../types";
import Aurora from "./Aurora";

type NavItem = { to: string; label: string; end?: boolean; primary?: boolean };

// Flat product nav — every route preserved, order/labels match the approved
// /chat mockup. Labels are display-only; route targets are unchanged.
const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/chat", label: "Main Chat", primary: true },
  { to: "/council", label: "AI Council", primary: true },
  { to: "/memory", label: "Memory" },
  { to: "/knowledge", label: "Knowledge Vault" },
  { to: "/conversations", label: "Conversations" },
  { to: "/decisions", label: "Decisions" },
  { to: "/tasks", label: "Tasks" },
  { to: "/approvals", label: "Approvals" },
  { to: "/workflows", label: "Workflows" },
  { to: "/reports", label: "Reports" },
  { to: "/audit", label: "Audit Trail" },
  { to: "/settings", label: "Settings" },
  // Tools Registry + Observatory moved INTO Settings → "System & Diagnostics"
  // (routes still live at /tools and /observatory).
];

// Topbar title derived from the route (frame-level, no route change).
const TITLES: Record<string, string> = {
  "/": "Dashboard", "/chat": "Main Chat", "/council": "AI Council", "/memory": "Memory",
  "/knowledge": "Knowledge Vault", "/conversations": "Conversations",
  "/decisions": "Decisions", "/tasks": "Tasks", "/approvals": "Approvals",
  "/workflows": "Workflows", "/reports": "Reports", "/tools": "Tools Registry",
  "/audit": "Audit Trail", "/observatory": "Observatory", "/settings": "Settings",
};

// Inline line-icons (stroke 1.5, currentColor) — no icon-library dependency.
const I = (paths: ReactNode) => (
  <svg className="nav-icon" width="17" height="17" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true" focusable="false">{paths}</svg>
);
const NAV_ICONS: Record<string, ReactNode> = {
  "/": I(<><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>),
  "/chat": I(<path d="M21 11.5a8.5 8.5 0 0 1-12.3 7.6L3 21l1.9-5.7A8.5 8.5 0 1 1 21 11.5Z" />),
  "/council": I(<><circle cx="9" cy="8" r="3" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0" /><circle cx="17" cy="9" r="2.2" /><path d="M16 14.5a4.5 4.5 0 0 1 4.5 4.5" /></>),
  "/memory": I(<><path d="M12 3a4 4 0 0 0-4 4v0a3 3 0 0 0-2 5.2A3 3 0 0 0 8 18a3 3 0 0 0 4 1 3 3 0 0 0 4-1 3 3 0 0 0 2-5.8A3 3 0 0 0 16 7v0a4 4 0 0 0-4-4Z" /><path d="M12 7v12" /></>),
  "/knowledge": I(<><path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H18a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H6.5A1.5 1.5 0 0 1 5 18.5Z" /><path d="M5 16.5A1.5 1.5 0 0 1 6.5 15H19" /></>),
  "/conversations": I(<><path d="M8 10h8M8 14h5" /><path d="M21 12a8 8 0 0 1-11.5 7.2L3 21l1.8-4.6A8 8 0 1 1 21 12Z" /></>),
  "/decisions": I(<><path d="M9 11l2.5 2.5L17 8" /><rect x="4" y="4" width="16" height="16" rx="2.5" /></>),
  "/tasks": I(<><path d="M4 6h12M4 12h12M4 18h8" /><path d="M19 5l1.4 1.4L19 8" /></>),
  "/approvals": I(<><path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6Z" /><path d="M9 11.5l2 2 4-4" /></>),
  "/workflows": I(<><circle cx="6" cy="6" r="2.2" /><circle cx="18" cy="6" r="2.2" /><circle cx="12" cy="18" r="2.2" /><path d="M6 8.2v3a2 2 0 0 0 2 2h2M18 8.2v3a2 2 0 0 1-2 2h-2" /></>),
  "/reports": I(<><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5M10 13h6M10 17h6M10 9h2" /></>),
  "/tools": I(<path d="M14.7 6.3a3.5 3.5 0 0 0-4.6 4.6L4 17l3 3 6.1-6.1a3.5 3.5 0 0 0 4.6-4.6l-2.3 2.3-2-2Z" />),
  "/audit": I(<><path d="M6 3h9l4 4v14H6Z" /><path d="M14 3v5h5M9 13h6M9 16.5h6" /></>),
  "/observatory": I(<><circle cx="12" cy="12" r="3" /><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" /></>),
  "/settings": I(<><circle cx="12" cy="12" r="3" /><path d="M12 2.5v2.5M12 19v2.5M4.6 4.6l1.8 1.8M17.6 17.6l1.8 1.8M2.5 12h2.5M19 12h2.5M4.6 19.4l1.8-1.8M17.6 6.4l1.8-1.8" /></>),
};

// Logo-ready brand mark: renders the real asset once frontend/public/thunity-mark.svg
// exists, else falls back to the ◆ glyph. The monogram is NOT hand-traced.
function BrandMark() {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className="brand-mark" aria-hidden="true">◆</span>;
  return (
    <span className="brand-mark brand-mark-img">
      <img src="/thunity-mark.png" alt="THUNITY" onError={() => setFailed(true)} />
    </span>
  );
}

// Compact relative time for the sidebar recent list. Backend sends naive UTC
// timestamps (no 'Z'); treat them as UTC so "Xh ago" is correct in any timezone.
function timeAgo(iso: string): string {
  if (!iso) return "";
  const t = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : iso + "Z").getTime();
  if (!t) return "";
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return "now";
  const m = Math.floor(s / 60); if (m < 60) return m + "m";
  const h = Math.floor(m / 60); if (h < 24) return h + "h";
  const d = Math.floor(h / 24); if (d < 7) return d + "d";
  return Math.floor(d / 7) + "w";
}

export default function AppShell() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [lo, setLo] = useState<LocalOnlyHealth | null>(null);
  const [loErr, setLoErr] = useState(false);
  const [recent, setRecent] = useState<ConvBrief[] | null>(null);
  const [recentErr, setRecentErr] = useState(false);
  // Adaptive rails: the sidebars FOLLOW the available width automatically — they
  // appear when there's room and hide when there isn't, at EVERY size. So a window
  // that grows past the fit point shows the panel ON ITS OWN (no manual toggle),
  // and shrinking hides it again. A manual toggle still overrides within a size
  // band; the next resize across a threshold re-adapts.
  //   left nav rail  → inline at >=1024, slide-over below
  //   Founder panel  → joins as soon as the multi-column layout begins (>=1024,
  //                    the same point the rail goes inline); below that it's chat-only
  const RAIL_BP = 1024, WIDE_BP = 1024;
  const mqWide = () => typeof window !== "undefined" && window.matchMedia(`(min-width: ${WIDE_BP}px)`).matches;
  const mqRail = () => typeof window !== "undefined" && window.matchMedia(`(min-width: ${RAIL_BP}px)`).matches;
  const [leftCollapsed, setLeftCollapsed] = useState(() => !mqRail());
  const [rightCollapsed, setRightCollapsed] = useState(() => !mqWide());
  const [isWide, setIsWide] = useState(() => mqWide());
  // Read the tab width on EVERY resize (rAF-debounced) AND on matchMedia change,
  // so the rails reliably track size in real time — window 'resize' is universal
  // and never misses, unlike relying on matchMedia alone. We act only when a
  // threshold is actually CROSSED, so a manual toggle within a band isn't clobbered.
  useEffect(() => {
    let prevW = mqWide(), prevR = mqRail(), raf = 0;
    const check = () => {
      raf = 0;
      const w = mqWide(), r = mqRail();
      if (w !== prevW) { prevW = w; setIsWide(w); setRightCollapsed(!w); }
      if (r !== prevR) { prevR = r; setLeftCollapsed(!r); }
    };
    const onResize = () => { if (!raf) raf = requestAnimationFrame(check); };
    const railMq = window.matchMedia(`(min-width: ${RAIL_BP}px)`);
    const wideMq = window.matchMedia(`(min-width: ${WIDE_BP}px)`);
    window.addEventListener("resize", onResize, { passive: true });
    railMq.addEventListener("change", onResize);
    wideMq.addEventListener("change", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      railMq.removeEventListener("change", onResize);
      wideMq.removeEventListener("change", onResize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // Probe local-only health on mount AND on a gentle interval so the sidebar
  // status dot reflects the REAL backend state over time (honest, never forced).
  useEffect(() => {
    let alive = true;
    const probe = () => api.localOnly()
      .then((d) => { if (alive) { setLo(d as LocalOnlyHealth); setLoErr(false); } })
      .catch(() => { if (alive) setLoErr(true); });
    probe();
    const id = window.setInterval(probe, 30000);
    return () => { alive = false; window.clearInterval(id); };
  }, []);
  const fetchRecent = useCallback(() => {
    api.conversations(5, 0)
      .then((r: any) => { setRecent((r.conversations || []) as ConvBrief[]); setRecentErr(false); })
      .catch(() => setRecentErr(true));
  }, []);
  // Keep "Recent Conversations" LIVE: refresh on mount, on tab focus, whenever a
  // chat/council turn updates a conversation (custom event), and on a gentle
  // interval — so the sidebar list never goes stale.
  useEffect(() => {
    fetchRecent();
    const onFocus = () => fetchRecent();
    window.addEventListener("focus", onFocus);
    window.addEventListener("thunity:conversation-updated", fetchRecent);
    const id = window.setInterval(fetchRecent, 20000);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("thunity:conversation-updated", fetchRecent);
      window.clearInterval(id);
    };
  }, [fetchRecent]);

  const compliant = lo?.status === "compliant";
  const hybrid = lo?.status === "hybrid";        // local-first + declared frontier (honest)
  // Honest sidebar status dot — mirrors the real health probe, never forced green.
  const sysTone = loErr ? "bad" : lo ? (compliant || hybrid ? "ok" : "warn") : "muted";
  const sysTitle = loErr ? "Backend offline"
    : lo ? (hybrid ? "Hybrid · Local + Frontier — online" : compliant ? "Local-secure — online" : `Status: ${lo.status}`)
    : "Checking backend…";
  const pageTitle = TITLES[loc.pathname] || "Thunity";
  const onChat = loc.pathname === "/chat";

  return (
    <div className={"shell" + (leftCollapsed ? " shell--left-collapsed" : "")}>
      <Aurora global />
      <aside className="sidebar">
        <div className="brand">
          <BrandMark />
          <div className="brand-text">
            <b className="brand-wordmark">THUNITY</b>
            <small className="brand-tag">Local AI Company OS</small>
          </div>
        </div>

        <div className="sidebar-scroll">
        <nav aria-label="Primary">
          {NAV_ITEMS.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}
              className={({ isActive }) => "nav-item" + (n.primary ? " primary" : "") + (isActive ? " active" : "")}>
              <span className="nav-icon-slot" aria-hidden="true">{NAV_ICONS[n.to]}</span>
              <span className="nav-label">{n.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="recent">
          <div className="recent-head">Recent Conversations</div>
          {recent === null && !recentErr && <div className="recent-state">Loading…</div>}
          {recentErr && <div className="recent-state">Unavailable</div>}
          {recent && recent.length === 0 && <div className="recent-state">No conversations yet</div>}
          {recent && recent.length > 0 && (
            <ul className="recent-list">
              {recent.map((c) => (
                <li key={c.id}>
                  <NavLink to={`/chat?conv=${c.id}`} className="recent-item" title={c.title}>
                    <span className="recent-ic" aria-hidden="true"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-11.9 7.6L3 21l1.9-5.7A8.4 8.4 0 1 1 21 11.5Z" /></svg></span>
                    <span className="recent-title">{c.title || "Untitled"}</span>
                    <span className="recent-time">{timeAgo(c.updated_at || c.created_at)}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          )}
        </div>
        </div>

        <div className="sidebar-user">
          <span className="su-avatar" aria-hidden="true">{(user?.username || "?").charAt(0).toUpperCase()}</span>
          <span className="su-info">
            <span className="su-name">{user?.username}</span>
            <span className="su-role">{user?.role}</span>
          </span>
          <span className={"su-dot su-dot-" + sysTone} title={sysTitle} aria-hidden="true" />
          <button type="button" className="su-signout" title="Sign out" aria-label="Sign out"
            onClick={() => { api.logout().catch(() => {}); logout(); nav("/login"); }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" />
            </svg>
          </button>
        </div>
        <div className="sidebar-foot">
          <span className="sidebar-ver">THUNITY OS v1.0.0</span>
          <span className="sidebar-tag">Private by default</span>
        </div>
      </aside>

      {/* Scrim behind the left-nav slide-over (narrow only — CSS-gated). Click to close. */}
      {!leftCollapsed && (
        <div className="nav-scrim" aria-hidden="true" onClick={() => setLeftCollapsed(true)} />
      )}

      <div className="main">
        <header className="topbar">
          <div className="topbar-left">
            <button type="button" className="rail-toggle" aria-pressed={!leftCollapsed}
              aria-label={leftCollapsed ? "Expand navigation" : "Collapse navigation"}
              title={leftCollapsed ? "Expand navigation" : "Collapse navigation"}
              onClick={() => setLeftCollapsed((v) => !v)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" />
              </svg>
            </button>
            <span className="topbar-title">{pageTitle}</span>
          </div>
          <div className="topbar-user">
            {onChat && isWide && (
              <button type="button" className="rail-toggle" aria-pressed={!rightCollapsed}
                aria-label={rightCollapsed ? "Show Founder Insight" : "Hide Founder Insight"}
                title={rightCollapsed ? "Show Founder Insight" : "Hide Founder Insight"}
                onClick={() => setRightCollapsed((v) => !v)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="4" width="18" height="16" rx="2" /><path d="M15 4v16" />
                </svg>
              </button>
            )}
          </div>
        </header>

        {(loErr || (lo && !compliant && !hybrid)) && (
          <div className="banner banner-bad">
            ⚠ Local-only status could not be confirmed as compliant. Verify the backend before trusting data sovereignty.
          </div>
        )}
        <main className="content"><Outlet context={{ rightCollapsed, setRightCollapsed, isWide }} /></main>
      </div>
    </div>
  );
}
