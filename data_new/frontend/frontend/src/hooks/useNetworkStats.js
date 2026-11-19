import { useEffect, useState } from "react";

/**
 * Reads the real station count from the GET /api/data endpoint.
 * status: "loading" | "ready" | "error"  – callers render a proper empty state on error.
 */
export default function useNetworkStats() {
  const [state, setState] = useState({ status: "loading", stations: null });

  useEffect(() => {
    const ctrl = new AbortController();
    const token = JSON.parse(localStorage.getItem("user") || "{}").token;
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    fetch("/api/data", { signal: ctrl.signal, headers })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.statusText))))
      .then((d) => setState({ status: "ready", stations: Number(d.stations) }))
      .catch((e) => {
        if (e.name !== "AbortError") setState({ status: "error", stations: null });
      });
    return () => ctrl.abort();
  }, []);

  return state;
}
