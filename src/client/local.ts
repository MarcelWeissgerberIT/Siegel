"use client";

import { createHandlers, type Api, type HandlerCtx } from "@/core/handlers";
import { seedDemo } from "@/core/seed";
import { SiegelError, SiegelService } from "@/core/service";
import { createFetchDeliver } from "@/core/webhooks";
import { ApiError, BASE_PATH } from "./api";
import { LocalRepo } from "./local-repo";

let repoRef: LocalRepo | null = null;

export function localRepo() {
  return repoRef;
}

export async function createLocalApi(): Promise<Api> {
  const repo = await LocalRepo.open();
  repoRef = repo;
  const service = new SiegelService({
    repo,
    deliver: createFetchDeliver({ browser: true }),
    mode: "local",
    allowSimulatedPayments: true,
  });
  const handlers = createHandlers(service, { browser: true, demo: true });
  const ctx = (): HandlerCtx => ({
    authed: true,
    ip: "browser-demo",
    userAgent: navigator.userAgent,
    baseUrl: `${window.location.origin}${BASE_PATH}`,
  });

  // First visit: load the sample workspace so the dashboard isn't empty.
  if ((await repo.listProposals()).length === 0 && !localStorage.getItem("siegel:seeded")) {
    await seedDemo(service, ctx());
    localStorage.setItem("siegel:seeded", "1");
    await repo.flush();
  }

  return new Proxy({} as Api, {
    get: (_t, method: string | symbol) => {
      if (typeof method !== "string" || method === "then") return undefined;
      return async (...args: unknown[]) => {
        const fn = (handlers as unknown as Record<string, (c: HandlerCtx, ...a: unknown[]) => Promise<unknown>>)[method];
        if (!fn) throw new ApiError("Unknown method", 404);
        try {
          const result = await fn(ctx(), ...structuredClone(args));
          await repo.flush();
          return result === undefined ? null : structuredClone(result);
        } catch (err) {
          if (err instanceof SiegelError) throw new ApiError(err.message, err.status);
          throw err;
        }
      };
    },
  });
}
