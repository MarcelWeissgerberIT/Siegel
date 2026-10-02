"use client";

import type { Api } from "@/core/handlers";

export const MODE: "local" | "server" = process.env.NEXT_PUBLIC_SIEGEL_MODE === "local" ? "local" : "server";
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

/** Prefix a public/ asset or internal path with the deployment base path. */
export function asset(path: string) {
  return `${BASE_PATH}${path}`;
}

export function baseUrl() {
  return typeof window === "undefined" ? "" : `${window.location.origin}${BASE_PATH}`;
}

function createServerApi(): Api {
  return new Proxy({} as Api, {
    get: (_t, method: string | symbol) => {
      // Not a thenable: Promise resolution probes `.then` on whatever it resolves.
      if (typeof method !== "string" || method === "then") return undefined;
      return async (...args: unknown[]) => {
        const res = await fetch(`${BASE_PATH}/api/rpc/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ method, args }),
        });
        const json = (await res.json().catch(() => ({}))) as { result?: unknown; error?: string };
        if (!res.ok) throw new ApiError(json.error || `Request failed (${res.status})`, res.status);
        return json.result;
      };
    },
  });
}

let apiPromise: Promise<Api> | null = null;

export function getApi(): Promise<Api> {
  if (!apiPromise) {
    apiPromise = MODE === "local" ? import("./local").then((m) => m.createLocalApi()) : Promise.resolve(createServerApi());
  }
  return apiPromise;
}

export interface SessionInfo {
  authenticated: boolean;
  needsSetup: boolean;
  demo: boolean;
  mode: "local" | "server";
}

export const auth = {
  async session(): Promise<SessionInfo> {
    if (MODE === "local") return { authenticated: true, needsSetup: false, demo: true, mode: "local" };
    const res = await fetch(`${BASE_PATH}/api/auth/`, { cache: "no-store" });
    return res.json();
  },
  async action(action: "login" | "setup" | "logout" | "change", body: Record<string, string> = {}) {
    if (MODE === "local") return { ok: true };
    const res = await fetch(`${BASE_PATH}/api/auth/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...body }),
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (!res.ok) throw new ApiError(json.error || "Request failed", res.status);
    return json;
  },
};
