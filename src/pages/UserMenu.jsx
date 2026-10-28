import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "../lib/router";
import { useAuth, displayName, initials } from "../lib/auth";

export default function UserMenu({ showName = false }) {
  const { user, signOut } = useAuth();
  const { navigate } = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  return (
    <div className="umenu" ref={ref}>
      <button className="ubtn" onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open}>
        <span className="avatar">{initials(user)}</span>
        {showName && <span className="uname">{displayName(user)} ⌄</span>}
      </button>
      {open && (
        <div className="udrop" role="menu">
          <div className="uhead"><b>{displayName(user)}</b><span>{user?.email}</span></div>
          <button role="menuitem" onClick={() => { setOpen(false); navigate("/app/projects"); }}>All projects</button>
          <button role="menuitem" onClick={() => { setOpen(false); navigate("/app/profile"); }}>Profile</button>
          <button role="menuitem" onClick={async () => { await signOut(); navigate("/", { replace: true }); }}>Sign out</button>
        </div>
      )}
    </div>
  );
}
