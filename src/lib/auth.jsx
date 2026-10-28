import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./supabase";

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export const displayName = (user) =>
  user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split("@")[0] || "User";
export const initials = (user) =>
  displayName(user).split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "U";

// Every call resolves to { data, error: string | null } so pages never need try/catch.
const call = async (fn) => {
  try {
    const { data, error } = await fn();
    return { data, error: error ? error.message : null };
  } catch (e) {
    return { data: null, error: e.message || String(e) };
  }
};

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(!!supabase);

  useEffect(() => {
    if (!supabase) return undefined;
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false); });
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const origin = window.location.origin;
  const value = {
    session, user: session?.user ?? null, loading,
    signInPassword: (email, password) => call(() => supabase.auth.signInWithPassword({ email, password })),
    signUp: (email, password, name) =>
      call(() => supabase.auth.signUp({ email, password, options: { data: { full_name: name }, emailRedirectTo: `${origin}/app` } })),
    // Magic link and one-time code share this call: the email template decides whether it shows a link, a code, or both.
    sendOtp: (email) => call(() => supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${origin}/app` } })),
    verifyOtp: (email, token) => call(() => supabase.auth.verifyOtp({ email, token, type: "email" })),
    oauth: (provider) => call(() => supabase.auth.signInWithOAuth({ provider, options: { redirectTo: `${origin}/app` } })),
    sso: (domain) => call(() => supabase.auth.signInWithSSO({ domain, options: { redirectTo: `${origin}/app` } })),
    resetPassword: (email) => call(() => supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/reset-password` })),
    updatePassword: (password) => call(() => supabase.auth.updateUser({ password })),
    updateProfile: (fullName) => call(() => supabase.auth.updateUser({ data: { full_name: fullName } })),
    signOut: () => call(() => supabase.auth.signOut()),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
