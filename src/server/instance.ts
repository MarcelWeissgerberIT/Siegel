import path from "node:path";
import { createHandlers } from "@/core/handlers";
import { seedDemo } from "@/core/seed";
import { SiegelService, type Ctx } from "@/core/service";
import { createFetchDeliver } from "@/core/webhooks";
import { SqliteRepo } from "./sqlite-repo";

interface Instance {
  repo: SqliteRepo;
  service: SiegelService;
  handlers: ReturnType<typeof createHandlers>;
  ready: Promise<void>;
}

export const DEMO = process.env.SIEGEL_DEMO === "1" || process.env.SIEGEL_DEMO === "true";

const g = globalThis as unknown as { __siegel?: Instance };

export function instance(): Instance {
  if (g.__siegel) return g.__siegel;
  const dir = process.env.SIEGEL_DATA_DIR || path.join(process.cwd(), "data");
  const repo = new SqliteRepo(path.join(dir, "siegel.db"));
  const service = new SiegelService({
    repo,
    deliver: createFetchDeliver({ browser: false }),
    mode: "server",
    allowSimulatedPayments: DEMO,
  });
  const handlers = createHandlers(service, { browser: false, demo: DEMO });
  const ready = (async () => {
    await service.ensureStarterLibrary();
    if (DEMO && (await repo.listProposals()).length === 0) {
      await seedDemo(service, { ip: "127.0.0.1", userAgent: "seed", baseUrl: process.env.SIEGEL_PUBLIC_URL || "http://localhost:3000" });
    }
  })();
  g.__siegel = { repo, service, handlers, ready };
  return g.__siegel;
}

export async function requestCtx(req: Request): Promise<Ctx> {
  const h = req.headers;
  const ip = (h.get("x-forwarded-for")?.split(",")[0] || h.get("x-real-ip") || h.get("cf-connecting-ip") || "unknown").trim();
  const settings = await instance().service.settings();
  const proto = h.get("x-forwarded-proto") || new URL(req.url).protocol.replace(":", "");
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const baseUrl = settings.publicUrl || process.env.SIEGEL_PUBLIC_URL || `${proto}://${host}${process.env.NEXT_PUBLIC_BASE_PATH || ""}`;
  return { ip, userAgent: h.get("user-agent") || "", baseUrl };
}
