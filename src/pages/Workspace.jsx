import React, { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { Link } from "../lib/router";
import { IconBug } from "../lib/icons";
import UserMenu from "./UserMenu";
import { WorkspaceProvider, Shell, Boundary } from "../WorkspaceApp";

const ENVS = ["Development", "Staging", "Production"];
const SAVE_LABEL = { saved: "All changes saved", saving: "Saving…", error: "Save failed — retrying on next change" };

export const computeStats = (snap) => {
  const results = snap.results || {};
  const ids = Object.keys(results);
  return {
    apis: (snap.endpoints || []).length,
    tests: (snap.tests || []).length,
    runs: ids.length,
    passed: ids.filter((i) => results[i].status === "PASS").length,
  };
};

export default function WorkspacePage({ id }) {
  const [state, setState] = useState({ status: "loading" });
  const [env, setEnv] = useState("Development");
  const [save, setSave] = useState("saved");
  const latest = useRef(null);
  const timer = useRef(null);
  const first = useRef(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [p, w] = await Promise.all([
        supabase.from("projects").select("*").eq("id", id).maybeSingle(),
        supabase.from("project_workspaces").select("data").eq("project_id", id).maybeSingle(),
      ]);
      if (!alive) return;
      if (p.error) return setState(p.error.code === "22P02" ? { status: "notfound" } : { status: "error", message: p.error.message });
      if (!p.data) return setState({ status: "notfound" });
      setEnv(p.data.environment);
      setState({ status: "ready", project: p.data, initial: w.data?.data || {} });
    })();
    return () => { alive = false; };
  }, [id]);

  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    const snap = latest.current;
    if (!snap) return;
    latest.current = null;
    const [a, b] = await Promise.all([
      supabase.from("project_workspaces").upsert({ project_id: id, data: snap }),
      supabase.from("projects").update({ stats: computeStats(snap) }).eq("id", id),
    ]);
    setSave(a.error || b.error ? "error" : "saved");
  }, [id]);

  // The workspace reports every change; we save 1.5 s after the last one.
  const onSnapshot = useCallback((snap) => {
    if (first.current) { first.current = false; return; }
    latest.current = snap;
    setSave("saving");
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 1500);
  }, [flush]);

  useEffect(() => {
    const warn = (e) => { if (latest.current) { flush(); e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => { window.removeEventListener("beforeunload", warn); if (latest.current) flush(); };
  }, [flush]);

  const changeEnv = async (e) => {
    const value = e.target.value;
    setEnv(value);
    await supabase.from("projects").update({ environment: value }).eq("id", id);
  };

  if (state.status !== "ready") {
    return (
      <div className="splash">
        {state.status === "loading" && "Loading project…"}
        {state.status === "notfound" && (<div className="card empty"><h2>Project not found</h2><p className="sub">It may have been deleted, or it belongs to another account.</p><Link to="/app/projects" className="btn p small">Back to projects</Link></div>)}
        {state.status === "error" && (<div className="card empty"><h2>Could not open project</h2><p className="sub">{state.message}</p><Link to="/app/projects" className="btn p small">Back to projects</Link></div>)}
      </div>
    );
  }

  return (
    <>
      <header className="top wtop">
        <div className="row">
          <Link to="/app/projects" className="brand"><IconBug size={20} /> BUGBEEK</Link>
          <span className="sep" />
          <span className="pname">{state.project.name}</span>
          <select className="envsel" value={env} onChange={changeEnv} aria-label="Environment">{ENVS.map((x) => <option key={x}>{x}</option>)}</select>
          <span className={`save ${save}`}>{SAVE_LABEL[save]}</span>
        </div>
        <UserMenu />
      </header>
      <Boundary>
        <WorkspaceProvider initial={state.initial} onSnapshot={onSnapshot}><Shell /></WorkspaceProvider>
      </Boundary>
    </>
  );
}
