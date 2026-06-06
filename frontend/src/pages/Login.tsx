import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import Aurora from "../components/Aurora";

// Logo-ready brand mark — renders the real THUNITY monogram, else ◆ (not hand-traced).
function LoginMark() {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className="brand-mark" aria-hidden="true">◆</span>;
  return (
    <span className="brand-mark brand-mark-img">
      <img src="/thunity-mark.png" alt="THUNITY" onError={() => setFailed(true)} />
    </span>
  );
}

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [u, setU] = useState(""); const [p, setP] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr(null); setBusy(true);
    try { await login(u, p); nav("/chat"); }
    catch (e: any) { setErr(e?.message || "Login failed."); }
    finally { setBusy(false); }
  };

  return (
    <div className="login">
      <Aurora />
      <div className="login-aura" aria-hidden="true" />
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand">
          <LoginMark />
          <b className="brand-wordmark">THUNITY</b>
          <span className="brand-subtitle">Local AI Company OS</span>
        </div>
        <h2>Welcome back, founder</h2>
        <p className="muted">Your private company brain stays on your machine — and remembers.</p>
        <label>Username or email
          <input value={u} onChange={(e) => setU(e.target.value)} autoFocus autoComplete="username" placeholder="founder@thunity.local" />
        </label>
        <label>Password
          <input type="password" value={p} onChange={(e) => setP(e.target.value)} autoComplete="current-password" placeholder="••••••••" />
        </label>
        {err && <div className="form-error">⚠ {err}</div>}
        <button className="btn btn-primary" disabled={busy || !u || !p}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <div className="login-foot">
          <span className="login-secure"><span className="login-secure-dot" />Local-secure</span>
          <span>Local accounts only · no cloud sign-in</span>
        </div>
      </form>
    </div>
  );
}
