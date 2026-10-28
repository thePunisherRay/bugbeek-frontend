import React from "react";
import { Link } from "../lib/router";
import { useAuth } from "../lib/auth";
import { IconBug, IconCheck, IconUpload, IconSpark, IconPlay, IconReport } from "../lib/icons";

const FLOW = [
  ["Generate Test Cases", IconSpark, "violet"],
  ["Execute Tests", IconPlay, "green"],
  ["Detailed Reports", IconReport, "orange"],
];
const FEATURES = [
  [IconUpload, "violet", "Import API", "Upload, paste or link your OpenAPI spec"],
  [IconSpark, "blue", "Generate Tests", "Test cases generated from your spec"],
  [IconPlay, "green", "Execute", "Run tests in one click and get results"],
  [IconReport, "orange", "Detailed Reports", "Find bugs with clear, actionable insights"],
];

export default function Landing() {
  const { user } = useAuth();
  return (
    <div className="land">
      <header className="land-nav">
        <Link to="/" className="brand"><IconBug size={22} /> BUGBEEK</Link>
        <nav>
          <a href="#product">Product</a><a href="#how">How it works</a><a href="#pricing">Pricing</a>
        </nav>
        <div className="row">
          <Link to={user ? "/app" : "/login"} className="lbtn outline">{user ? "Open app" : "Login"}</Link>
          <Link to={user ? "/app" : "/signup"} className="lbtn solid">Get Started</Link>
        </div>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <span className="pill"><IconSpark size={14} /> Turn API specs into tests instantly</span>
          <h1>API Testing<br />without the<br /><em>manual effort</em></h1>
          <p>Import your OpenAPI/Swagger spec and let BUGBEEK generate, execute and report API tests automatically.</p>
          <div className="row">
            <Link to={user ? "/app" : "/signup"} className="lbtn solid big">Get Started — It’s Free →</Link>
            <a href="#how" className="lbtn dark big">▶ See how it works</a>
          </div>
          <ul className="ticks">
            {["No test code needed", "Works with any OpenAPI", "Find bugs early"].map((t) => <li key={t}><IconCheck size={14} /> {t}</li>)}
          </ul>
        </div>
        <div className="flow" aria-hidden="true">
          <div className="fcard"><span className="fico green"><IconUpload size={16} /></span>OpenAPI Spec</div>
          {FLOW.map(([label, Icon, tone]) => (
            <React.Fragment key={label}>
              <span className="farrow">↓</span>
              <div className="fcard"><span className={`fico ${tone}`}><Icon size={16} /></span>{label}</div>
            </React.Fragment>
          ))}
        </div>
      </section>

      <section id="product" className="feats">
        {FEATURES.map(([Icon, tone, title, text]) => (
          <div key={title} className="feat">
            <span className={`fico big ${tone}`}><Icon size={22} /></span>
            <b>{title}</b><span>{text}</span>
          </div>
        ))}
      </section>

      <section id="how" className="how">
        <h2>How it works</h2>
        <ol>
          <li><b>1. Add an API</b><span>Paste a cURL command, upload a YAML file or link a Swagger/OpenAPI URL.</span></li>
          <li><b>2. Review the test cases</b><span>Happy paths, validation, boundary and negative cases are generated for every endpoint.</span></li>
          <li><b>3. Run and read the report</b><span>Execute against your environment and see exactly what passed, failed and why.</span></li>
        </ol>
      </section>

      <section id="pricing" className="how">
        <h2>Pricing</h2>
        <p className="muted">BUGBEEK is free while we are in beta.</p>
        <Link to={user ? "/app" : "/signup"} className="lbtn solid big">Create your free account</Link>
      </section>

      <footer className="land-foot">© {new Date().getFullYear()} BUGBEEK</footer>
    </div>
  );
}
