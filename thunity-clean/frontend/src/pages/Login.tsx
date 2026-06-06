import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [u, setU] = useState(""); const [p, setP] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr(null); setBusy(true);
    try { await login(u, p); nav("/"); }
    catch (e: any) { setErr(e?.message || "Login failed."); }
    finally { setBusy(false); }
  };

  return (
    <div className="login">
      <form className="login-card" onSubmit={submit}>
        <div className="brand center"><span className="brand-mark">◆</span><b className="brand-wordmark">THUNITY</b></div>
        <div className="muted small center brand-subtitle">Local Secure Login</div>
        <h2>Founder Command Center</h2>
        <p className="muted">Your company brain stays on your machine.</p>
        <label>Username or email
          <input value={u} onChange={(e) => setU(e.target.value)} autoFocus autoComplete="username" />
        </label>
        <label>Password
          <input type="password" value={p} onChange={(e) => setP(e.target.value)} autoComplete="current-password" />
        </label>
        {err && <div className="form-error">⚠ {err}</div>}
        <button className="btn btn-primary" disabled={busy || !u || !p}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <small className="muted center">Local accounts only · no cloud sign-in</small>
      </form>
    </div>
  );
}
