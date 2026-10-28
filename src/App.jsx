import React, { useEffect } from "react";
import "./styles.css";
import "./pages.css";
import { supabase } from "./lib/supabase";
import { RouterProvider, Link, useRouter } from "./lib/router";
import { AuthProvider, useAuth } from "./lib/auth";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import ProjectsArea from "./pages/Projects";
import WorkspacePage from "./pages/Workspace";

function SetupNotice() {
  return (
    <div className="splash">
      <div className="card empty setup">
        <h2>Connect Supabase</h2>
        <p className="sub">Add these two variables to <code>.env.local</code> (and to Vercel → Settings → Environment Variables), then restart the dev server:</p>
        <pre className="bodybox">{"VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co\nVITE_SUPABASE_ANON_KEY=YOUR-ANON-PUBLIC-KEY"}</pre>
      </div>
    </div>
  );
}

// need = true: signed-in users only. need = false: signed-out users only (login/signup).
function Guard({ need, children }) {
  const { user, loading } = useAuth();
  const { navigate } = useRouter();
  const blocked = !loading && (need ? !user : !!user);
  useEffect(() => {
    if (blocked) navigate(need ? "/login" : "/app", { replace: true });
  }, [blocked, need]);
  return loading || blocked ? <div className="splash">Loading…</div> : children;
}

function NotFound() {
  return <div className="splash"><div className="card empty"><h2>Page not found</h2><Link to="/" className="btn p small">Go home</Link></div></div>;
}

function AppArea() {
  const { path } = useRouter();
  const project = path.match(/^\/app\/projects\/([^/]+)$/);
  if (project) return <WorkspacePage key={project[1]} id={project[1]} />;
  const section = { "/app": "dashboard", "/app/projects": "projects", "/app/profile": "profile", "/app/settings": "settings" }[path];
  return section ? <ProjectsArea section={section} /> : <NotFound />;
}

function Routes() {
  const { path } = useRouter();
  if (path === "/") return <Landing />;
  if (!supabase) return <SetupNotice />;
  if (path === "/login" || path === "/signup") return <Guard need={false}><Login mode={path.slice(1)} /></Guard>;
  if (path === "/reset-password") return <ResetPassword />;
  if (path === "/app" || path.startsWith("/app/")) return <Guard need><AppArea /></Guard>;
  return <NotFound />;
}

export default function App() {
  return <RouterProvider><AuthProvider><Routes /></AuthProvider></RouterProvider>;
}
