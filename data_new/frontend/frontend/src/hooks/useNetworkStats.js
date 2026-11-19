import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Reads the real station count from the GET /api/data endpoint.
 * status: "loading" | "ready" | "error" - callers render a proper empty state on error.
 */
export default function useNetworkStats({ pollInterval = 10000 } = {}) {
  const [state, setState] = useState({ status: "loading", stations: null });
  const controllerRef = useRef(null);

  const fetchStats = useCallback(async () => {
    controllerRef.current?.abort();
    const ctrl = new AbortController();
    controllerRef.current = ctrl;

    try {
      const rawUser = localStorage.getItem("user");
      const user = rawUser ? JSON.parse(rawUser) : {};
      const headers = user?.token
        ? { Authorization: `Bearer ${user.token}` }
        : {};

      const response = await fetch("/api/data", {
        signal: ctrl.signal,
        headers,
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(response.statusText || `HTTP ${response.status}`);
      }

      const data = await response.json();
      const rawCount = data?.stations ?? data?.data?.stations;
      const parsedCount = Number(rawCount);

      setState({
        status: "ready",
        stations: Number.isFinite(parsedCount) ? parsedCount : null,
      });
    } catch (err) {
      if (err?.name !== "AbortError") {
        setState({ status: "error", stations: null });
      }
    }
  }, []);

  useEffect(() => {
    fetchStats();

    if (!pollInterval || pollInterval <= 0) {
      return () => controllerRef.current?.abort();
    }

    const intervalId = setInterval(fetchStats, pollInterval);

    return () => {
      clearInterval(intervalId);
      controllerRef.current?.abort();
    };
  }, [fetchStats, pollInterval]);

  return { ...state, refresh: fetchStats };
}