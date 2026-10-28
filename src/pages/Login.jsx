import React, { useState } from "react";
import { Link, useRouter } from "../lib/router";
import { useAuth } from "../lib/auth";
import { IconBug, IconCheck, IconEye, IconGithub, IconKey } from "../lib/icons";

const BULLETS = ["No manual test writing", "Supports any OpenAPI spec", "Instant test reports", "Built for modern teams"];

export default function Login({ mode }) {
  const auth = useAuth();
  const { navigate } = useRouter();
  const signup = mode === "signup";
  const [view, setView] = useState("password"); // password | otp | sso | forgot
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [domain, setDomain] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const run = async (fn, onOk) => {
    setBusy(true); setErr(""); setMsg("");
    const { data, error } = await fn();
    setBusy(false);
    if (error) setErr(error); else onOk?.(data);
  };
  const go = (v) => { setView(v); setErr(""); setMsg(""); setSent(false); setCode(""); };

  const submitPassword = (e) => {
    e.preventDefault();
    if (signup) {
      run(() => auth.signUp(email.trim(), password, name.trim()),
        (d) => (d?.session ? navigate("/app") : setMsg("Check your email to confirm your account, then log in.")));
    } else {
      run(() => auth.signInPassword(email.trim(), password), () => navigate("/app"));
    }
  };
  const submitOtp = (e) => {
    e.preventDefault();
    if (!sent) run(() => auth.sendOtp(email.trim()), () => { setSent(true); setMsg(`We emailed ${email.trim()} a sign-in link and one-time code.`); });
    else run(() => auth.verifyOtp(email.trim(), code.trim()), () => navigate("/app"));
  };
  const submitForgot = (e) => {
    e.preventDefault();
    run(() => auth.resetPassword(email.trim()), () => setMsg("If that email has an account, a reset link is on its way."));
  };
  const submitSso = (e) => {
    e.preventDefault();
    run(() => auth.sso(domain.trim().toLowerCase()));
  };

  const title = view === "forgot" ? "Reset your password" : view === "otp" ? "Sign in with email" : view === "sso" ? "Single sign-on" : signup ? "Create your account" : "Welcome back";
  const sub = view === "forgot" ? "We’ll email you a link to choose a new password."
    : view === "otp" ? "Get a magic link or one-time code — no password needed."
    : view === "sso" ? "Enter your work email domain to continue with your company login."
    : signup ? "Start testing your APIs in minutes." : "Login to your BUGBEEK account";

  return (
    <div className="auth">
      <aside className="auth-brand">
        <Link to="/" className="brand"><IconBug size={26} /> BUGBEEK</Link>
        <p className="tag">API Test Intelligence</p>
        <h2>Ship better<br />APIs, faster.</h2>
        <p className="muted">Turn your API specifications into automated tests and catch issues before your users do.</p>
        <ul className="ticks col">{BULLETS.map((b) => <li key={b}><IconCheck size={14} /> {b}</li>)}</ul>
      </aside>

      <section className="auth-form">
        <div className="auth-card">
          <h1>{title}</h1>
          <p className="muted">{sub}</p>

          {view === "password" && (
            <>
              <button type="button" className="social" disabled={busy} onClick={() => run(() => auth.oauth("google"))}>
                <span className="gmark">G</span> Continue with Google
              </button>
              <button type="button" className="social" disabled={busy} onClick={() => run(() => auth.oauth("github"))}>
                <IconGithub size={18} /> Continue with GitHub
              </button>
              <div className="or"><span>OR</span></div>
              <form onSubmit={submitPassword}>
                {signup && (<><label htmlFor="name">Full name</label><input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="name" /></>)}
                <label htmlFor="email">Email</label>
                <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
                <label htmlFor="pw">Password</label>
                <div className="pwrow">
                  <input id="pw" type={show ? "text" : "password"} required minLength={signup ? 8 : 1} value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder={signup ? "At least 8 characters" : "Enter your password"} autoComplete={signup ? "new-password" : "current-password"} />
                  <button type="button" className="eye" aria-label={show ? "Hide password" : "Show password"} onClick={() => setShow(!show)}><IconEye size={18} /></button>
                </div>
                {!signup && <button type="button" className="textlink right" onClick={() => go("forgot")}>Forgot password?</button>}
                {err && <div className="banner bad">{err}</div>}
                {msg && <div className="banner ok">{msg}</div>}
                <button className="primary" disabled={busy}>{busy ? "Please wait…" : signup ? "Create account" : "Login"}</button>
              </form>
              <div className="alt">
                <button type="button" className="textlink" onClick={() => go("otp")}><IconKey size={14} /> Magic link / one-time code</button>
                <button type="button" className="textlink" onClick={() => go("sso")}>Single sign-on (SSO)</button>
              </div>
              <p className="switch">
                {signup ? <>Already have an account? <Link to="/login">Log in</Link></> : <>Don’t have an account? <Link to="/signup">Sign up</Link></>}
              </p>
            </>
          )}

          {view === "otp" && (
            <form onSubmit={submitOtp}>
              <label htmlFor="oemail">Email</label>
              <input id="oemail" type="email" required disabled={sent} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              {sent && (<><label htmlFor="code">One-time code</label>
                <input id="code" required inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Enter the code from the email" /></>)}
              {err && <div className="banner bad">{err}</div>}
              {msg && <div className="banner ok">{msg}</div>}
              <button className="primary" disabled={busy}>{busy ? "Please wait…" : sent ? "Verify code" : "Send link & code"}</button>
              <button type="button" className="textlink" onClick={() => go("password")}>← Back to password login</button>
            </form>
          )}

          {view === "sso" && (
            <form onSubmit={submitSso}>
              <label htmlFor="domain">Company domain</label>
              <input id="domain" required value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="yourcompany.com" />
              {err && <div className="banner bad">{err}</div>}
              <button className="primary" disabled={busy}>{busy ? "Redirecting…" : "Continue with SSO"}</button>
              <button type="button" className="textlink" onClick={() => go("password")}>← Back to password login</button>
            </form>
          )}

          {view === "forgot" && (
            <form onSubmit={submitForgot}>
              <label htmlFor="femail">Email</label>
              <input id="femail" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              {err && <div className="banner bad">{err}</div>}
              {msg && <div className="banner ok">{msg}</div>}
              <button className="primary" disabled={busy}>{busy ? "Please wait…" : "Send reset link"}</button>
              <button type="button" className="textlink" onClick={() => go("password")}>← Back to login</button>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
