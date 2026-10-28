import React, { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { Link, useRouter } from "../lib/router";
import { useAuth, displayName } from "../lib/auth";
import { IconBug, IconBell, IconSearch, IconFolder, IconUser, IconSliders, IconDots, IconPlus, IconGrid, IconCrown } from "../lib/icons";
import UserMenu from "./UserMenu";

export const relTime = (iso) => {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  const plural = (n, u) => `${n} ${u}${n === 1 ? "" : "s"} ago`;
  if (m < 60) return plural(m, "minute");
  const h = Math.floor(m / 60);
  if (h < 24) return plural(h, "hour");
  const d = Math.floor(h / 24);
  if (d < 30) return plural(d, "day");
  const mo = Math.floor(d / 30);
  return mo < 12 ? plural(mo, "month") : plural(Math.floor(mo / 12), "year");
};
export const passRate = (s = {}) => (s.runs > 0 ? Math.round((s.passed / s.runs) * 100) : null);

const ENVS = ["Development", "Staging", "Production"];

function RateBadge({ stats }) {
  const r = passRate(stats);
  if (r == null) return <span className="rate none">No runs yet</span>;
  return <span className={`rate ${r >= 90 ? "good" : r >= 80 ? "mid" : "low"}`}>{r}% Pass Rate</span>;
}

function ProjectCard({ project, onOpen, onDelete }) {
  const [menu, setMenu] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setMenu(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  const s = project.stats || {};
  return (
    <div className="pcard">
      <div className="row between">
        <div className="row">
          <span className="pico"><IconFolder size={20} /></span>
          <div><b>{project.name}</b><div className="muted small clamp">{project.description || "No description"}</div></div>
        </div>
        <div className="pmenu" ref={ref}>
          <button className="iconbtn" aria-label="Project options" onClick={() => setMenu(!menu)}><IconDots size={18} /></button>
          {menu && (
            <div className="udrop" role="menu">
              <button role="menuitem" onClick={() => { setMenu(false); onOpen(); }}>Open</button>
              <button role="menuitem" className="danger" onClick={() => { setMenu(false); onDelete(); }}>Delete project</button>
            </div>
          )}
        </div>
      </div>
      <div className="pstats">
        <div><b>{s.apis || 0}</b><span>APIs</span></div>
        <div><b>{s.tests || 0}</b><span>Test Cases</span></div>
        <div><b>{s.runs || 0}</b><span>Test Runs</span></div>
      </div>
      <div className="row between">
        <RateBadge stats={s} />
        <button className="ghost blue" onClick={onOpen}>Open →</button>
      </div>
      <div className="muted small">{project.environment} · Updated {relTime(project.updated_at)}</div>
    </div>
  );
}

function NewProjectModal({ onClose, onCreate }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [environment, setEnvironment] = useState("Development");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr("");
    const error = await onCreate({ name: name.trim(), description: description.trim(), environment });
    if (error) { setErr(error); setBusy(false); }
  };
  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal card newproj" onSubmit={submit}>
        <div className="row between"><h2>Create New Project</h2><button type="button" className="iconbtn" aria-label="Close" onClick={onClose}>✕</button></div>
        <p className="muted">Set up a new project to start testing your APIs.</p>
        <label htmlFor="pn">Project Name <span className="req">*</span></label>
        <input id="pn" required maxLength={80} autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="E-commerce API" />
        <small className="muted">A short name for your project.</small>
        <label htmlFor="pd">Description</label>
        <textarea id="pd" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="API automation and quality testing for our e-commerce backend." />
        <small className="muted">Describe your project (optional).</small>
        <label htmlFor="pe">Environment</label>
        <select id="pe" value={environment} onChange={(e) => setEnvironment(e.target.value)}>{ENVS.map((x) => <option key={x}>{x}</option>)}</select>
        <small className="muted">You can always change this later.</small>
        {err && <div className="banner bad">{err}</div>}
        <div className="row end">
          <button type="button" className="ghost" onClick={onClose}>Cancel</button>
          <button className="primary inline" disabled={busy || !name.trim()}>{busy ? "Creating…" : "Create Project"}</button>
        </div>
      </form>
    </div>
  );
}

function ProfileSection() {
  const { user, updateProfile, signOut } = useAuth();
  const { navigate } = useRouter();
  const [name, setName] = useState(displayName(user));
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const save = async (e) => {
    e.preventDefault(); setMsg(""); setErr("");
    const { error } = await updateProfile(name.trim());
    if (error) setErr(error); else setMsg("Profile updated.");
  };
  return (
    <>
      <h1>Profile</h1><p className="muted">Your account details.</p>
      <form className="card formcard" onSubmit={save}>
        <label htmlFor="fn">Full name</label>
        <input id="fn" value={name} onChange={(e) => setName(e.target.value)} />
        <label htmlFor="em">Email</label>
        <input id="em" value={user?.email || ""} disabled />
        {err && <div className="banner bad">{err}</div>}
        {msg && <div className="banner ok">{msg}</div>}
        <div className="row">
          <button className="primary inline">Save changes</button>
          <button type="button" className="ghost" onClick={async () => { await signOut(); navigate("/", { replace: true }); }}>Sign out</button>
        </div>
      </form>
    </>
  );
}

const NAV = [
  ["/app", "Dashboard", IconGrid],
  ["/app/projects", "Projects", IconFolder],
  ["/app/profile", "Profile", IconUser],
  ["/app/settings", "Settings", IconSliders],
];

export default function ProjectsArea({ section }) {
  const { navigate } = useRouter();
  const [projects, setProjects] = useState(null);
  const [loadErr, setLoadErr] = useState("");
  const [q, setQ] = useState("");
  const [modal, setModal] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("projects").select("*").order("updated_at", { ascending: false });
    if (error) setLoadErr(error.message); else { setProjects(data); setLoadErr(""); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const create = async (fields) => {
    const { data, error } = await supabase.from("projects").insert(fields).select().single();
    if (error) return error.message;
    navigate(`/app/projects/${data.id}`);
    return null;
  };
  const remove = async (p) => {
    if (!window.confirm(`Delete "${p.name}" and all of its saved APIs and results? This cannot be undone.`)) return;
    const { error } = await supabase.from("projects").delete().eq("id", p.id);
    if (error) window.alert(error.message); else setProjects((list) => list.filter((x) => x.id !== p.id));
  };

  const shown = (projects || []).filter((p) => `${p.name} ${p.description}`.toLowerCase().includes(q.toLowerCase()));
  const sum = (k) => (projects || []).reduce((a, p) => a + (p.stats?.[k] || 0), 0);
  const runs = sum("runs");
  const cards = (list) => list.map((p) => (
    <ProjectCard key={p.id} project={p} onOpen={() => navigate(`/app/projects/${p.id}`)} onDelete={() => remove(p)} />
  ));
  const state = loadErr ? (
    <div className="banner bad">Could not load projects: {loadErr}. Make sure you ran <code>supabase/schema.sql</code> in your Supabase project.</div>
  ) : projects == null ? <p className="muted">Loading projects…</p> : null;

  return (
    <div className="papp">
      <aside className="psidebar">
        <Link to="/app" className="brand dark"><IconBug size={22} /> BUGBEEK</Link>
        <nav>
          {NAV.map(([to, label, Icon]) => (
            <Link key={to} to={to} className={`pnav ${(section === "dashboard" ? "/app" : `/app/${section}`) === to ? "on" : ""}`}><Icon size={18} /> {label}</Link>
          ))}
        </nav>
        <div className="upgrade">
          <b><IconCrown size={16} /> Upgrade to Pro</b>
          <span className="muted small">Run more tests and unlock advanced features.</span>
          <button className="ghost" disabled title="Coming soon">Upgrade</button>
        </div>
      </aside>

      <div className="pmain">
        <div className="ptop">
          <label className="psearch"><IconSearch size={16} /><input placeholder="Search projects..." value={q} onChange={(e) => { setQ(e.target.value); if (section !== "projects") navigate("/app/projects"); }} /></label>
          <span className="grow" />
          <button className="iconbtn" aria-label="Notifications"><IconBell size={18} /></button>
          <UserMenu showName />
        </div>

        <div className="pbody">
          {section === "profile" && <ProfileSection />}
          {section === "settings" && (<><h1>Settings</h1><p className="muted">Workspace settings are coming soon.</p></>)}

          {section === "dashboard" && (
            <>
              <h1>Dashboard</h1><p className="muted">An overview of everything you are testing.</p>
              {state}
              {projects && (
                <>
                  <div className="stats four">
                    {[["Projects", projects.length], ["APIs", sum("apis")], ["Test Cases", sum("tests")], ["Pass Rate", runs ? `${Math.round((sum("passed") / runs) * 100)}%` : "—"]].map(([l, v]) => (
                      <div key={l} className="stat"><div><b>{v}</b><span>{l}</span></div></div>
                    ))}
                  </div>
                  <div className="row between"><h2>Recent projects</h2><button className="btn p small" onClick={() => setModal(true)}>+ New Project</button></div>
                  {projects.length ? <div className="pgrid">{cards(projects.slice(0, 3))}</div> : <p className="muted">No projects yet — create your first one to get started.</p>}
                </>
              )}
            </>
          )}

          {section === "projects" && (
            <>
              <div className="row between">
                <div><h1>Your Projects</h1><p className="muted">Manage and organize your API testing projects.</p></div>
                <button className="btn p small" onClick={() => setModal(true)}><IconPlus size={14} /> New Project</button>
              </div>
              {state}
              {projects && (
                <div className="pgrid">
                  {cards(shown)}
                  {!q && (
                    <button className="pcard newtile" onClick={() => setModal(true)}>
                      <span className="plus"><IconPlus size={22} /></span><b>Create New Project</b>
                      <span className="muted small">Start testing a new API by importing its OpenAPI specification.</span>
                    </button>
                  )}
                </div>
              )}
              {projects && q && !shown.length && <p className="muted">No projects match “{q}”.</p>}
            </>
          )}
        </div>
      </div>
      {modal && <NewProjectModal onClose={() => setModal(false)} onCreate={create} />}
    </div>
  );
}

export { ProjectCard, NewProjectModal };
