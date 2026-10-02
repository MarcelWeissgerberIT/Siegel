"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Api } from "@/core/handlers";
import { getApi, MODE } from "./api";
import { CHANGE_EVENT } from "./local-repo";

/**
 * Data hook: runs `fn(api)` and re-runs it when data changes (other tab in the
 * local demo, or polling on the server so the owner sees views/signatures live).
 */
export function useData<T>(fn: (api: Api) => Promise<T>, deps: unknown[], opts: { poll?: number; enabled?: boolean } = {}) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });
  const enabled = opts.enabled ?? true;

  const reload = useCallback(async () => {
    try {
      const api = await getApi();
      const result = await fnRef.current(api);
      setData(result);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount / when deps change
    setLoading(true);
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled]);

  useEffect(() => {
    if (!enabled) return;
    const onChange = () => reload();
    window.addEventListener(CHANGE_EVENT, onChange);
    window.addEventListener("focus", onChange);
    const poll = opts.poll ?? (MODE === "server" ? 15000 : 0);
    const t = poll ? setInterval(() => document.visibilityState === "visible" && reload(), poll) : null;
    return () => {
      window.removeEventListener(CHANGE_EVENT, onChange);
      window.removeEventListener("focus", onChange);
      if (t) clearInterval(t);
    };
  }, [reload, opts.poll, enabled]);

  return { data, error, loading, reload, setData };
}

export function useApi() {
  const [api, setApi] = useState<Api | null>(null);
  useEffect(() => {
    getApi().then(setApi);
  }, []);
  return api;
}

export async function call<T>(fn: (api: Api) => Promise<T>): Promise<T> {
  return fn(await getApi());
}
