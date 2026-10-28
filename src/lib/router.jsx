import React, { createContext, useContext, useEffect, useState } from "react";

const RouterCtx = createContext(null);
export const useRouter = () => useContext(RouterCtx);

const clean = (p) => (p.length > 1 ? p.replace(/\/+$/, "") : p);

export function RouterProvider({ children }) {
  const [path, setPath] = useState(clean(window.location.pathname));
  useEffect(() => {
    const onPop = () => setPath(clean(window.location.pathname));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const navigate = (to, { replace = false } = {}) => {
    window.history[replace ? "replaceState" : "pushState"]({}, "", to);
    setPath(clean(new URL(to, window.location.origin).pathname));
    window.scrollTo(0, 0);
  };
  return <RouterCtx.Provider value={{ path, navigate }}>{children}</RouterCtx.Provider>;
}

export function Link({ to, children, ...props }) {
  const { navigate } = useRouter();
  const onClick = (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    navigate(to);
  };
  return <a href={to} onClick={onClick} {...props}>{children}</a>;
}
