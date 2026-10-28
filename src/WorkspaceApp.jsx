import React, { Component, createContext, useContext, useEffect, useState, useMemo } from "react";
import { importApis, generateTestCases, runExecute, groupTests } from "./api";

const fmt = (d) =>
  d.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
const validUrl = (s) => {
  try { return /^https?:$/.test(new URL(s.trim()).protocol); } catch { return false; }
};
const SOURCE_LABEL = { curl: "cURL", yaml: "YAML", url: "Swagger" };
const validCurl = (s) => /^\s*curl\s/i.test(s) && /https?:\/\/\S+/.test(s);
const schemaLabel = (s) => {
  if (!s || !Object.keys(s).length) return "No schema defined";
  if (s.title) return s.title;
  if (s.properties) return `object { ${Object.keys(s.properties).join(", ")} }`;
  return s.type || "schema";
};

const statusView = (r, isRunning) =>
  isRunning ? { cls: "run", label: "Running..." }
  : !r ? { cls: "none", label: "Not Executed" }
  : r.status === "PASS" ? { cls: "pass", label: "Passed" }
  : r.status === "FAIL" ? { cls: "fail", label: "Failed" }
  : { cls: "fail", label: "Error" };
const StatusTag = ({ view }) => <span className={`st ${view.cls}`}><i />{view.label}</span>;
const show = (v) => (v == null ? "—" : typeof v === "string" ? v : JSON.stringify(v, null, 2));
const deriveBase = (data, input) => {
  try {
    if (input.type === "url") return new URL(data.base_url || "/", input.url).href.replace(/\/$/, "");
  } catch { /* fall through */ }
  return data.base_url || "";
};

const tally = (list, results) => {
  const d = list.filter((t) => results[t.test_id]);
  const p = d.filter((t) => results[t.test_id].status === "PASS").length;
  return { p, f: d.length - p, n: list.length - d.length };
};
const keyOf = (e) => `${e.method} ${e.path}`;
const renumber = (list, start) => list.map((t, i) => ({ ...t, test_id: `TC-${String(start + i).padStart(3, "0")}` }));

// Merge a fresh /api/import result into the workspace. Same method+path replaces the old API;
// operation ids that clash with a different API get a suffix so tests always map to one API.
function mergeImport(prev, data) {
  const taken = new Map(prev.endpoints.map((e) => [e.operation_id, keyOf(e)]));
  const fresh = data.endpoints.map((e) => ({ ...e }));
  const newSpec = JSON.parse(JSON.stringify(data.specification));
  for (const e of fresh) {
    let id = e.operation_id, n = 2;
    while (taken.has(id) && taken.get(id) !== keyOf(e)) id = `${e.operation_id}_${n++}`;
    if (id !== e.operation_id) {
      const op = newSpec.paths?.[e.path]?.[e.method.toLowerCase()];
      if (op) op.operationId = id;
      e.operation_id = id;
    }
    taken.set(id, keyOf(e));
  }
  const freshKeys = new Set(fresh.map(keyOf));
  const replaced = new Set(prev.endpoints.filter((e) => freshKeys.has(keyOf(e))).map((e) => e.operation_id));
  const paths = { ...(prev.spec?.paths || {}) };
  for (const [p, item] of Object.entries(newSpec.paths || {})) paths[p] = { ...(paths[p] || {}), ...item };
  return {
    endpoints: [...prev.endpoints.filter((e) => !freshKeys.has(keyOf(e))), ...fresh],
    spec: { ...(prev.spec || newSpec), paths },
    newSpec,
    replaced,
  };
}

const Badge = ({ m }) => <span className={`badge ${m.toLowerCase()}`}>{m}</span>;

function InputPanel({ onGenerate, busy, error, onCollapse, variant }) {
  const [tab, setTab] = useState("curl");
  const [curl, setCurl] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState(null);
  const [fileErr, setFileErr] = useState("");
  const [drag, setDrag] = useState(false);
  const ok = tab === "curl" ? validCurl(curl) : tab === "yaml" ? !!file : validUrl(url);
  const lines = Math.max(curl.split("\n").length, 3);
  const makeInput = () => (tab === "swagger" ? { type: "url", url: url.trim() } : { type: tab, curl, file });

  const pick = (f) => {
    if (!f) return;
    if (/\.ya?ml$/i.test(f.name)) { setFile(f); setFileErr(""); }
    else setFileErr("Upload a .yaml or .yml file.");
  };

  return (
    <section className="card">
      <div className="row between">
        <div>
          <h1>{variant === "add" ? "Add API" : "Generate API Test Report"}</h1>
          <p className="sub">Provide a single API using cURL, upload a YAML file containing multiple APIs, or enter a Swagger/OpenAPI URL.</p>
        </div>
        {onCollapse && <button className="ghost" onClick={onCollapse}>{variant === "add" ? "Close" : "Collapse input"}</button>}
      </div>
      <div className="tabs">
        <button className={`tab ${tab === "curl" ? "on" : ""}`} onClick={() => setTab("curl")}>cURL</button>
        <button className={`tab ${tab === "yaml" ? "on" : ""}`} onClick={() => setTab("yaml")}>YAML</button>
        <button className={`tab ${tab === "swagger" ? "on" : ""}`} onClick={() => setTab("swagger")}>Swagger</button>
      </div>

      {tab === "swagger" ? (
        <>
          <input
            className="urlbox"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://api.example.com/openapi.json"
            spellCheck={false}
            aria-label="Swagger / OpenAPI URL"
          />
          <p className="sub tight hint">Link to the OpenAPI JSON or YAML document (for FastAPI this is usually /openapi.json).</p>
          {url.trim() && (
            <div className={`banner ${ok ? "ok" : "bad"}`}>
              {ok ? "Valid URL" : "Enter a full URL starting with http:// or https://"}
            </div>
          )}
        </>
      ) : tab === "curl" ? (
        <>
          <div className="editor">
            <div className="gutter">{Array.from({ length: lines }, (_, i) => <div key={i}>{i + 1}</div>)}</div>
            <textarea value={curl} onChange={(e) => setCurl(e.target.value)} placeholder="Paste cURL command here..." spellCheck={false} />
            <div className="tools">
              <button onClick={() => navigator.clipboard.readText().then(setCurl).catch(() => {})}>Paste</button>
              <button onClick={() => setCurl("")}>Clear</button>
            </div>
          </div>
          {curl.trim() && (
            <div className={`banner ${ok ? "ok" : "bad"}`}>
              {ok ? "Valid cURL command" : "Enter a cURL command that starts with curl and includes a full URL."}
            </div>
          )}
        </>
      ) : file ? (
        <div className="filebox">
          <div><b>{file.name}</b><div className="sub">{(file.size / 1024).toFixed(1)} KB</div></div>
          <button className="ghost" aria-label="Remove file" onClick={() => setFile(null)}>✕</button>
        </div>
      ) : (
        <label
          className={`drop ${drag ? "drag" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files[0]); }}
        >
          <b>Drag and drop YAML file here</b>
          <span className="sub">or</span>
          <span className="btn p small">Upload YAML</span>
          <span className="sub">Supported formats: .yaml, .yml</span>
          <input type="file" accept=".yaml,.yml" hidden onChange={(e) => pick(e.target.files[0])} />
        </label>
      )}
      {fileErr && <div className="banner bad">{fileErr}</div>}
      {error && <div className="banner bad">{error}</div>}

      <div className={`actions ${variant === "add" ? "one" : ""}`}>
        <div>
          <button className="btn p" disabled={!ok || busy} onClick={() => onGenerate(makeInput(), "full")}>{busy ? "Generating…" : "Get Report for Full Suite"}</button>
          <small>Generates discovery, schema, test cases and execution results for the API(s).</small>
        </div>
        <div>
          <button className="btn s" disabled={!ok || busy} onClick={() => onGenerate(makeInput(), "tests")}>
            {busy ? "Generating…" : variant === "add" ? "Add API" : "Only Generate Test Cases"}
          </button>
          <small>Generates test cases without executing them.</small>
        </div>
      </div>
    </section>
  );
}

const Stat = ({ icon, tone, value, label }) => (
  <div className="stat">
    <div className={`ico ${tone}`}>{icon}</div>
    <div><b>{value}</b><span>{label}</span></div>
  </div>
);

function Discovery({ e }) {
  const rb = e.request_body;
  return (
    <table className="kv"><tbody>
      <tr><th>Purpose</th><td>{e.description || e.summary}</td></tr>
      <tr><th>Tags</th><td>{e.tags?.join(", ") || "None"}</td></tr>
      <tr><th>Endpoint</th><td><code>{e.method} {e.path}</code></td></tr>
      <tr><th>Parameters</th><td>{e.parameters?.length
        ? <ul>{e.parameters.map((p) => <li key={p.name}><code>{p.name}</code> ({p.location}) · {p.type || "type not specified"} · {p.required ? "required" : "optional"}</li>)}</ul>
        : "None"}</td></tr>
      <tr><th>Request body</th><td>{rb ? `${schemaLabel(rb.schema)} · ${rb.content_type}${rb.required ? " · required" : ""}` : "None"}</td></tr>
      <tr><th>Responses</th><td><ul>{e.responses.map((r) => <li key={r.status_code}><code>{r.status_code}</code> {r.description}</li>)}</ul></td></tr>
    </tbody></table>
  );
}

function Schema({ e }) {
  const row = (label, schema) => (
    <tr key={label}>
      <th>{label}</th>
      <td>{schema && Object.keys(schema).length ? <pre>{JSON.stringify(schema, null, 2)}</pre> : "No schema defined"}</td>
    </tr>
  );
  return (
    <table className="kv"><tbody>
      {e.request_body ? row("Request body", e.request_body.schema) : <tr><th>Request body</th><td>None</td></tr>}
      {e.responses.map((r) => row(`Response ${r.status_code}`, r.schema))}
    </tbody></table>
  );
}

function TestCases({ list, state, error, onRetry, results, running, onRun }) {
  if (state === "loading") return <p className="sub">Generating test cases…</p>;
  if (state === "error")
    return <div className="banner bad">Could not generate test cases: {error} <button className="ghost" onClick={onRetry}>Retry</button></div>;
  if (!list.length) return <p className="sub">No test cases were generated for this API.</p>;
  return (
    <>
      <div className="row between">
        <h2>Test Cases ({list.length})</h2>
        <button className="ghost blue" onClick={() => onRun(list)}>▶ Run All</button>
      </div>
      <table className="grid">
        <thead><tr><th>ID</th><th>Test Case Description</th><th>Status</th><th>Action</th></tr></thead>
        <tbody>
          {list.map((t) => {
            const isRun = running.has(t.test_id);
            return (
              <tr key={t.test_id}>
                <td>{t.test_id}</td>
                <td>{t.name}<div className="sub tight">{t.reason}</div></td>
                <td><StatusTag view={statusView(results[t.test_id], isRun)} /></td>
                <td>
                  <button className={`btn small ${isRun ? "run" : "p"}`} disabled={isRun} onClick={() => onRun([t])}>
                    {isRun ? "Running..." : "Run Test"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}

function ExecRow({ t, r, withApi }) {
  const bad = r.status !== "PASS";
  const [open, setOpen] = useState(bad);
  return (
    <>
      <tr className={`clk ${bad ? "badrow" : ""}`} onClick={() => setOpen(!open)}>
        <td>{t.test_id}<div className="sub tight">{t.name}</div></td>
        {withApi && <td><Badge m={t.method} /> <code>{t.path}</code></td>}
        <td><StatusTag view={statusView(r, false)} /></td>
        <td>{r.response_time_ms == null ? "—" : `${r.response_time_ms} ms`}</td>
        <td>{r.actual_status_code ?? "—"}</td>
        <td>{open ? "⌃" : "⌄"}</td>
      </tr>
      {open && (
        <tr className="detail">
          <td colSpan={withApi ? 6 : 5}>
            <div className="dgrid">
              <div><b>Expected Result</b><div>HTTP {(r.expected_status_codes || []).join(" or ") || "—"}</div></div>
              <div><b>Actual Result</b><div className={bad ? "redtxt" : ""}>{r.actual_status_code == null ? "No response" : `HTTP ${r.actual_status_code}`}</div></div>
            </div>
            {r.error && <p className="redtxt">Error: {r.error}</p>}
            <b>Response Body</b>
            <pre className="bodybox">{show(r.response_body)}</pre>
          </td>
        </tr>
      )}
    </>
  );
}

function Execution({ list, results }) {
  const rows = list.filter((t) => results[t.test_id]);
  const passed = rows.filter((t) => results[t.test_id].status === "PASS").length;
  return (
    <>
      <h2>Execution Summary</h2>
      <div className="stats four">
        <Stat icon="≡" tone="b" value={list.length} label="Total Tests" />
        <Stat icon="✓" tone="gr" value={passed} label="Passed" />
        <Stat icon="✕" tone="r" value={rows.length - passed} label="Failed" />
        <Stat icon="⊖" tone="g" value={list.length - rows.length} label="Pending" />
      </div>
      {!rows.length ? (
        <p className="sub">No tests have been executed for this API yet. Use Run Test in the Test Cases tab.</p>
      ) : (
        <table className="grid">
          <thead><tr><th>Test Case</th><th>Status</th><th>Response Time</th><th>HTTP Status</th><th /></tr></thead>
          <tbody>{rows.map((t) => <ExecRow key={t.test_id} t={t} r={results[t.test_id]} />)}</tbody>
        </table>
      )}
    </>
  );
}

const Ctx = createContext(null);
const useWS = () => useContext(Ctx);

function WorkspaceProvider({ children, initial = {}, onSnapshot }) {
  const [endpoints, setEndpoints] = useState(initial.endpoints || []);
  const [spec, setSpec] = useState(initial.specification || null);
  const [tests, setTests] = useState(initial.tests || null);
  const [tState, setTState] = useState(initial.tests ? "done" : "idle");
  const [tError, setTError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [meta, setMeta] = useState(initial.meta ? { ...initial.meta, at: new Date(initial.meta.at) } : null);
  const [expanded, setExpanded] = useState(!initial.meta);
  const [baseUrl, setBaseUrl] = useState(initial.baseUrl || "");
  const [results, setResults] = useState(initial.results || {});
  const [running, setRunning] = useState(new Set());
  const [runError, setRunError] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  const grouped = useMemo(() => groupTests(tests || []), [tests]);

  // Report every change so the page that hosts the workspace can save it.
  useEffect(() => {
    onSnapshot?.({ endpoints, specification: spec, tests, results, baseUrl, meta });
  }, [endpoints, spec, tests, results, baseUrl, meta]); // eslint-disable-line react-hooks/exhaustive-deps

  // Runs tests against the API under test, 10 per request so results appear progressively.
  async function runTests(list, base = baseUrl) {
    if (!base.trim()) { setRunError("Enter the Base URL of the API under test before running tests."); return; }
    setRunError("");
    setRunning((r) => new Set([...r, ...list.map((t) => t.test_id)]));
    for (let i = 0; i < list.length; i += 10) {
      const chunk = list.slice(i, i + 10);
      let out;
      try {
        out = (await runExecute({ baseUrl: base.trim(), tests: chunk })).results;
      } catch (err) {
        setRunError(err.message);
        out = chunk.map((t) => ({
          test_id: t.test_id, status: "ERROR", expected_status_codes: t.expected?.status_codes || [],
          actual_status_code: null, response_time_ms: null, response_body: null, error: err.message,
        }));
      }
      setResults((r) => ({ ...r, ...Object.fromEntries(out.map((x) => [x.test_id, x])) }));
      setRunning((r) => { const n = new Set(r); chunk.forEach((t) => n.delete(t.test_id)); return n; });
    }
  }

  // Regenerates test cases for every API in the workspace (clears results).
  async function regenerate() {
    setTState("loading"); setResults({}); setRunning(new Set());
    try {
      const r = await generateTestCases({ specification: spec });
      setTests(renumber(r.tests || [], 1));
      setTState("done");
    } catch (err) {
      setTError(err.message);
      setTState("error");
    }
  }

  // Imports an API (adds to the workspace), then generates tests for it. Returns true if the import worked.
  async function onGenerate(input, mode = "tests") {
    setBusy(true); setError("");
    let merged, base;
    try {
      const data = await importApis(input);
      if (!Array.isArray(data.endpoints))
        throw new Error("The backend returned the old response format (no 'endpoints' list). Replace main.py and openapi_importer.py with the updated versions and restart uvicorn.");
      if (!data.endpoints.length) throw new Error("No API endpoints were found in this input.");
      base = deriveBase(data, input);
      merged = mergeImport({ endpoints, spec }, data);
    } catch (err) {
      setError(err.message); setBusy(false);
      return false;
    }
    setEndpoints(merged.endpoints); setSpec(merged.spec);
    if (base) setBaseUrl(base);
    setRunError("");
    setMeta({
      type: input.type,
      preview: input.type === "curl" ? input.curl.trim().replace(/\s+/g, " ").slice(0, 70) + " ..." : input.type === "url" ? input.url : input.file.name,
      at: new Date(), mode,
    });
    setExpanded(false); setBusy(false);

    setTState("loading");
    try {
      const r = await generateTestCases({ specification: merged.newSpec });
      const keep = (tests || []).filter((t) => !merged.replaced.has(t.operation_id));
      const next = Math.max(0, ...keep.map((t) => parseInt(t.test_id.replace(/\D/g, ""), 10) || 0)) + 1;
      const fresh = renumber(r.tests || [], next);
      const keepIds = new Set(keep.map((t) => t.test_id));
      setTests([...keep, ...fresh]);
      setResults((res) => Object.fromEntries(Object.entries(res).filter(([id]) => keepIds.has(id))));
      setTState("done");
      if (mode === "full" && fresh.length) runTests(fresh, base || baseUrl);
    } catch (err) {
      setTError(err.message);
      setTState("error");
    }
    return true;
  }

  function clearAll() {
    setEndpoints([]); setSpec(null); setTests(null); setTState("idle"); setResults({}); setRunning(new Set());
    setMeta(null); setExpanded(true); setRunError(""); setError("");
  }

  const value = {
    endpoints, tests, tState, tError, busy, error, meta, expanded, setExpanded, baseUrl, setBaseUrl,
    results, running, runError, grouped, runTests, regenerate, onGenerate, clearAll,
    openAdd: () => { setError(""); setAddOpen(true); }, closeAdd: () => setAddOpen(false), addOpen,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/* ---------- shared pieces ---------- */

function ApiList({ eps, cur, onSelect, q, setQ, count }) {
  const shown = eps.filter((e) => `${e.method} ${e.path} ${e.summary}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <aside className="card side">
      <h2>APIs ({eps.length})</h2>
      <input placeholder="Search APIs..." value={q} onChange={(e) => setQ(e.target.value)} />
      {shown.map((e) => (
        <button key={e.operation_id} className={`item ${e.operation_id === cur.operation_id ? "on" : ""}`} onClick={() => onSelect(e.operation_id)}>
          <Badge m={e.method} /><code>{e.path}</code><small>{count(e)} test cases</small>
        </button>
      ))}
      {!shown.length && <p className="sub">No APIs match your search.</p>}
    </aside>
  );
}

function ApiDetail({ cur, tabs, tab, setTab }) {
  const ws = useWS();
  const list = ws.grouped[cur.operation_id] || [];
  const t = tally(list, ws.results);
  const n = ws.tests ? list.length : "…";
  return (
    <section className="card">
      <div className="row between">
        <div className="row"><Badge m={cur.method} /><div><b>{cur.path}</b><div className="sub tight">{cur.summary}</div></div></div>
        <span className="sub tight">{n} test cases · {t.p} passed · {t.f} failed · {t.n} not executed</span>
      </div>
      <div className="tabs top-gap">
        {tabs.map(([k, l]) => <button key={k} className={`tab ${tab === k ? "on" : ""}`} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      {tab === "discovery" && <Discovery e={cur} />}
      {tab === "schema" && <Schema e={cur} />}
      {tab === "tests" && (
        <TestCases list={list} state={ws.tState} error={ws.tError} onRetry={ws.regenerate}
          results={ws.results} running={ws.running} onRun={(l) => ws.runTests(l)} />
      )}
      {tab === "execution" && <Execution list={list} results={ws.results} />}
    </section>
  );
}

function Empty({ title, text }) {
  const ws = useWS();
  return (
    <div className="card empty">
      <h2>{title}</h2>
      <p className="sub">{text}</p>
      <button className="btn p small" onClick={ws.openAdd}>+ Add API</button>
    </div>
  );
}

/* ---------- 1. Dashboard ---------- */

function Dashboard() {
  const ws = useWS();
  const { endpoints: eps, tests, grouped, results, meta, expanded, setExpanded } = ws;
  const [sel, setSel] = useState(null);
  const [tab, setTab] = useState("tests");
  const [q, setQ] = useState("");

  const cur = eps.find((e) => e.operation_id === sel) || eps[0];
  const count = (e) => (tests ? (grouped[e.operation_id] || []).length : "…");
  const all = tests || [];
  const doneN = all.filter((t) => results[t.test_id]).length;
  const passedN = all.filter((t) => results[t.test_id]?.status === "PASS").length;
  const total = tests ? all.length : "…";

  return (
    <>
      <div hidden={eps.length > 0 && !expanded}>
        <InputPanel onGenerate={ws.onGenerate} busy={ws.busy} error={ws.error} onCollapse={eps.length ? () => setExpanded(false) : null} />
      </div>

      {eps.length > 0 && !expanded && meta && (
        <div className="card minbar">
          <button className="ghost" onClick={() => setExpanded(true)}>⌃ Input (Minimized)</button>
          <span className="chip">{SOURCE_LABEL[meta.type]}</span>
          <span className="prev">{meta.preview}</span>
          <span className="okdot">● {meta.type === "curl" ? "Valid cURL" : meta.type === "url" ? "URL imported" : "File imported"}</span>
          <b>{meta.mode === "full" ? "Full Suite Report" : "Only Test Cases Generated"}</b>
          <span className="sub tight">Generated {fmt(meta.at)}</span>
          <button className="ghost blue" onClick={() => setExpanded(true)}>Expand Input ⌄</button>
        </div>
      )}

      {eps.length > 0 && cur && (
        <>
          <div className="row between top-gap">
            <div>
              <h1>API Test Report</h1>
              <p className="sub">{doneN ? `Executed ${doneN} of ${all.length} test cases.` : `Test cases generated for ${eps.length} APIs. No execution performed.`}</p>
            </div>
            <button className="ghost blue" disabled={ws.tState === "loading"} onClick={ws.regenerate}>↻ Regenerate Test Cases</button>
          </div>
          <div className="row baserow">
            <label htmlFor="base">Base URL of the API under test</label>
            <input id="base" className="urlbox slim" value={ws.baseUrl} onChange={(e) => ws.setBaseUrl(e.target.value)} placeholder="http://127.0.0.1:8000" spellCheck={false} />
          </div>
          {ws.runError && <div className="banner bad">{ws.runError}</div>}
          <div className="stats">
            <Stat icon="▣" tone="b" value={eps.length} label="Total APIs" />
            <Stat icon="≡" tone="b" value={total} label="Total Test Cases" />
            <Stat icon="⊖" tone="g" value={tests ? all.length - doneN : "…"} label="Not Executed" />
            <Stat icon="✓" tone="gr" value={tests ? passedN : "…"} label="Passed" />
            <Stat icon="✕" tone="r" value={tests ? doneN - passedN : "…"} label="Failed" />
          </div>
          <div className="split">
            <ApiList eps={eps} cur={cur} onSelect={setSel} q={q} setQ={setQ} count={count} />
            <ApiDetail cur={cur} tab={tab} setTab={setTab}
              tabs={[["discovery", "Discovery"], ["schema", "Schema"], ["tests", "Test Cases"], ["execution", "Execution"]]} />
          </div>
        </>
      )}
    </>
  );
}

/* ---------- 2. APIs ---------- */

function ApisView() {
  const ws = useWS();
  const eps = ws.endpoints;
  const [sel, setSel] = useState(null);
  const [tab, setTab] = useState("discovery");
  const [q, setQ] = useState("");
  const cur = eps.find((e) => e.operation_id === sel) || eps[0];
  const count = (e) => (ws.tests ? (ws.grouped[e.operation_id] || []).length : "…");
  return (
    <>
      <div className="row between">
        <div>
          <h1>APIs</h1>
          <p className="sub">{eps.length ? `${eps.length} APIs with their parameters, request and response schemas.` : "Every API you add shows up here."}</p>
        </div>
        <div className="row">
          {eps.length > 0 && (
            <button className="ghost" onClick={() => window.confirm("Remove all APIs, test cases and results?") && ws.clearAll()}>Clear all</button>
          )}
          <button className="btn p small" onClick={ws.openAdd}>+ Add API</button>
        </div>
      </div>
      {!eps.length || !cur ? (
        <Empty title="No APIs yet" text="Add an API with a cURL command, a YAML file or a Swagger/OpenAPI URL." />
      ) : (
        <div className="split top-gap">
          <ApiList eps={eps} cur={cur} onSelect={setSel} q={q} setQ={setQ} count={count} />
          <ApiDetail cur={cur} tab={tab} setTab={setTab} tabs={[["discovery", "Discovery"], ["schema", "Schema"]]} />
        </div>
      )}
    </>
  );
}

/* ---------- 3. Test cases ---------- */

function TcRow({ t }) {
  const ws = useWS();
  const r = ws.results[t.test_id];
  const isRun = ws.running.has(t.test_id);
  const [open, setOpen] = useState(false);
  return (
    <>
      <tr className="clk" onClick={() => setOpen(!open)}>
        <td>{t.test_id}</td>
        <td><Badge m={t.method} /> <code>{t.path}</code></td>
        <td>{t.name}</td>
        <td><span className="chip">{t.category || "—"}</span></td>
        <td><StatusTag view={statusView(r, isRun)} /></td>
        <td onClick={(e) => e.stopPropagation()}>
          <button className={`btn small ${isRun ? "run" : "p"}`} disabled={isRun} onClick={() => ws.runTests([t])}>{isRun ? "Running..." : "Run Test"}</button>
        </td>
      </tr>
      {open && (
        <tr className="detail">
          <td colSpan={6}>
            <div className="dgrid">
              <div><b>Request</b><pre className="bodybox">{show(t.request)}</pre></div>
              <div>
                <b>Expected Result</b><div>HTTP {(t.expected?.status_codes || []).join(" or ") || "—"}</div>
                {t.reason && <><b>Reason</b><div>{t.reason}</div></>}
                {r && <><b>Last Result</b><div className={r.status === "PASS" ? "" : "redtxt"}>{r.status} · {r.actual_status_code == null ? "no response" : `HTTP ${r.actual_status_code}`}</div></>}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function TestCasesView() {
  const ws = useWS();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [st, setSt] = useState("all");
  const all = ws.tests || [];
  const cats = [...new Set(all.map((t) => t.category).filter(Boolean))];
  const stateOf = (t) => (ws.results[t.test_id] ? (ws.results[t.test_id].status === "PASS" ? "passed" : "failed") : "pending");
  const list = all.filter((t) =>
    `${t.test_id} ${t.method} ${t.path} ${t.name}`.toLowerCase().includes(q.toLowerCase()) &&
    (cat === "all" || t.category === cat) && (st === "all" || stateOf(t) === st));
  return (
    <>
      <div className="row between">
        <div>
          <h1>Test Cases</h1>
          <p className="sub">Detailed view of every generated test case. Click a row to see its request and expected result.</p>
        </div>
        {all.length > 0 && <button className="btn p small" onClick={() => ws.runTests(list)} disabled={!list.length}>▶ Run {list.length === all.length ? "All" : `Filtered (${list.length})`}</button>}
      </div>
      {ws.runError && <div className="banner bad">{ws.runError}</div>}
      {!ws.endpoints.length ? (
        <Empty title="No test cases yet" text="Add an API and its test cases will be generated automatically." />
      ) : ws.tState === "loading" && !all.length ? (
        <p className="sub">Generating test cases…</p>
      ) : ws.tState === "error" && !all.length ? (
        <div className="banner bad">Could not generate test cases: {ws.tError} <button className="ghost" onClick={ws.regenerate}>Retry</button></div>
      ) : (
        <div className="card top-gap">
          <div className="row filters">
            <input className="urlbox slim" placeholder="Search by ID, API or description..." value={q} onChange={(e) => setQ(e.target.value)} />
            <select className="sel" value={cat} onChange={(e) => setCat(e.target.value)}>
              <option value="all">All categories</option>
              {cats.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select className="sel" value={st} onChange={(e) => setSt(e.target.value)}>
              <option value="all">All statuses</option><option value="pending">Not executed</option>
              <option value="passed">Passed</option><option value="failed">Failed</option>
            </select>
            <span className="sub tight">{list.length} of {all.length}</span>
          </div>
          <table className="grid">
            <thead><tr><th>ID</th><th>API</th><th>Test Case</th><th>Category</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>{list.map((t) => <TcRow key={t.test_id} t={t} />)}</tbody>
          </table>
          {!list.length && <p className="sub top-gap">No test cases match your filters.</p>}
        </div>
      )}
    </>
  );
}

/* ---------- 4. Execution ---------- */

function ExecutionView() {
  const ws = useWS();
  const [st, setSt] = useState("all");
  const all = ws.tests || [];
  const done = all.filter((t) => ws.results[t.test_id]);
  const failedList = done.filter((t) => ws.results[t.test_id].status !== "PASS");
  const passed = done.length - failedList.length;
  const rows = done.filter((t) => st === "all" || (st === "passed") === (ws.results[t.test_id].status === "PASS"));
  const times = done.map((t) => ws.results[t.test_id].response_time_ms).filter((x) => typeof x === "number");
  const avg = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null;
  return (
    <>
      <div className="row between">
        <div>
          <h1>Execution</h1>
          <p className="sub">Results of every test you have run, across all APIs.</p>
        </div>
        {failedList.length > 0 && <button className="ghost blue" onClick={() => ws.runTests(failedList)}>↻ Re-run Failed ({failedList.length})</button>}
      </div>
      {ws.runError && <div className="banner bad">{ws.runError}</div>}
      {!ws.endpoints.length ? (
        <Empty title="Nothing executed yet" text="Add an API, then run its tests to see results here." />
      ) : (
        <>
          <div className="stats top-gap">
            <Stat icon="≡" tone="b" value={all.length} label="Total Tests" />
            <Stat icon="✓" tone="gr" value={passed} label="Passed" />
            <Stat icon="✕" tone="r" value={failedList.length} label="Failed" />
            <Stat icon="⊖" tone="g" value={all.length - done.length} label="Pending" />
            <Stat icon="⏱" tone="b" value={avg == null ? "—" : `${avg} ms`} label="Avg Response" />
          </div>
          {!done.length ? (
            <p className="sub">No tests have been executed yet. Run tests from the Dashboard or the Test Cases page.</p>
          ) : (
            <div className="card">
              <div className="row filters">
                <select className="sel" value={st} onChange={(e) => setSt(e.target.value)}>
                  <option value="all">All results</option><option value="passed">Passed</option><option value="failed">Failed / Error</option>
                </select>
                <span className="sub tight">{rows.length} of {done.length}</span>
              </div>
              <table className="grid">
                <thead><tr><th>Test Case</th><th>API</th><th>Status</th><th>Response Time</th><th>HTTP Status</th><th /></tr></thead>
                <tbody>{rows.map((t) => <ExecRow key={t.test_id} t={t} r={ws.results[t.test_id]} withApi />)}</tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}

/* ---------- shell: sidebar + views ---------- */

const Svg = ({ children }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);
const IconDashboard = () => <Svg><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></Svg>;
const IconApis = () => <Svg><path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5c0 1.1.9 2 2 2h1" /><path d="M16 21h1a2 2 0 0 0 2-2v-5c0-1.1.9-2 2-2a2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1" /></Svg>;
const IconTests = () => <Svg><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><path d="m9 14 2 2 4-4" /></Svg>;
const IconExec = () => <Svg><circle cx="12" cy="12" r="10" /><polygon points="10 8 16 12 10 16 10 8" /></Svg>;
const IconCollapse = () => <Svg><path d="m11 17-5-5 5-5" /><path d="m18 17-5-5 5-5" /></Svg>;

const NAV = [
  { k: "dashboard", label: "Dashboard", Icon: IconDashboard },
  { k: "apis", label: "APIs", Icon: IconApis },
  { k: "tests", label: "Test Cases", Icon: IconTests },
  { k: "execution", label: "Execution", Icon: IconExec },
];

function Shell() {
  const ws = useWS();
  const [view, setView] = useState("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  return (
    <>
      <div className={`shell ${collapsed ? "collapsed" : ""}`}>
        <nav className="sidenav" aria-label="Main navigation">
          {NAV.map(({ k, label, Icon }) => (
            <button key={k} className={`nav ${view === k ? "on" : ""}`} title={label} aria-label={label} aria-current={view === k ? "page" : undefined} onClick={() => setView(k)}>
              <Icon /><span>{label}</span>
            </button>
          ))}
          <button className="nav toggle" title={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed} onClick={() => setCollapsed(!collapsed)}>
            <span className="flip"><IconCollapse /></span><span>Collapse</span>
          </button>
        </nav>
        <main>
          {view === "dashboard" && <Dashboard />}
          {view === "apis" && <ApisView />}
          {view === "tests" && <TestCasesView />}
          {view === "execution" && <ExecutionView />}
        </main>
      </div>
      {ws.addOpen && (
        <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && ws.closeAdd()}>
          <div className="modal">
            <InputPanel variant="add" busy={ws.busy} error={ws.error} onCollapse={ws.closeAdd}
              onGenerate={async (input, mode) => { const ok = await ws.onGenerate(input, mode); if (ok) ws.closeAdd(); return ok; }} />
          </div>
        </div>
      )}
    </>
  );
}

// Shows the real error on screen instead of a blank page if a render ever fails.
class Boundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main>
        <div className="banner bad">
          Something went wrong: {String(this.state.error.message || this.state.error)}{" "}
          <button className="ghost" onClick={() => this.setState({ error: null })}>Try again</button>
        </div>
      </main>
    );
  }
}

export { WorkspaceProvider, Shell, Boundary };
