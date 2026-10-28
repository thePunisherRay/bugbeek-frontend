import React, { useState } from "react";
import { Link, useRouter } from "../lib/router";
import { useAuth } from "../lib/auth";
import { IconBug } from "../lib/icons";

// Opened from the link in the "reset password" email; Supabase signs the user in with a recovery session.
export default function ResetPassword() {
  const { user, loading, updatePassword } = useAuth();
  const { navigate } = useRouter();
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr("");
    const { error } = await updatePassword(password);
    setBusy(false);
    if (error) setErr(error); else navigate("/app");
  };

  return (
    <div className="auth solo">
      <section className="auth-form">
        <div className="auth-card">
          <Link to="/" className="brand dark"><IconBug size={22} /> BUGBEEK</Link>
          <h1>Choose a new password</h1>
          {loading ? <p className="muted">Checking your link…</p> : !user ? (
            <>
              <p className="muted">This link is invalid or has expired. Request a new one from the login page.</p>
              <Link to="/login" className="primary linkbtn">Back to login</Link>
            </>
          ) : (
            <form onSubmit={submit}>
              <label htmlFor="np">New password</label>
              <input id="np" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" autoComplete="new-password" />
              {err && <div className="banner bad">{err}</div>}
              <button className="primary" disabled={busy}>{busy ? "Saving…" : "Update password"}</button>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
