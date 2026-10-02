import { DEFAULT_MODELS } from "./defaults";
import { draftToProposal, generateDraft, type DraftInput } from "./ai";
import { verifyEvidence } from "./chain";
import { seedDemo } from "./seed";
import { SiegelError, type Ctx, type CreateInput, type ProposalPatch, type SignInput, type SiegelService } from "./service";
import type { AiConfig, EvidencePackage, PricingBlock, Settings, Template, Tier } from "./types";

export interface HandlerCtx extends Ctx {
  authed: boolean;
}

export interface HandlerEnv {
  browser: boolean;
  demo: boolean; // demo features (tamper test, reset, simulated checkout)
}

/** Methods anyone with a proposal link may call. Everything else needs the owner session. */
export const PUBLIC_METHODS = new Set([
  "getPublic",
  "recordView",
  "heartbeat",
  "sign",
  "simulatePayment",
  "checkout",
  "evidence",
  "verifyById",
  "verifyEvidence",
  "instanceInfo",
]);

export async function testAiConnection(cfg: AiConfig, browser: boolean) {
  if (cfg.provider === "demo") return { ok: true, message: "Demo drafter is built in. No key needed." };
  if (!cfg.apiKey) throw new SiegelError("Add an API key first.");
  if (cfg.provider === "anthropic") {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: cfg.apiKey, dangerouslyAllowBrowser: browser, maxRetries: 0 });
    const model = await client.models.retrieve(cfg.model || DEFAULT_MODELS.anthropic);
    return { ok: true, message: `Connected to Anthropic · ${model.display_name}` };
  }
  const url =
    cfg.provider === "openrouter"
      ? "https://openrouter.ai/api/v1/key"
      : `https://api.openai.com/v1/models/${encodeURIComponent(cfg.model || DEFAULT_MODELS.openai)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${cfg.apiKey}` } });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new SiegelError(j.error?.message || `Provider returned HTTP ${res.status}`);
  }
  return { ok: true, message: cfg.provider === "openrouter" ? "Connected to OpenRouter" : `Connected to OpenAI · ${cfg.model}` };
}

export function createHandlers(service: SiegelService, env: HandlerEnv) {
  const requireDemo = () => {
    if (!env.demo) throw new SiegelError("Only available in demo mode.", 403);
  };
  return {
    instanceInfo: async () => ({ mode: env.browser ? ("local" as const) : ("server" as const), demo: env.demo }),

    // ---------------------------------------------------------------- owner
    getSettings: async () => service.maskedSettings(),
    updateSettings: async (_c: HandlerCtx, patch: Partial<Settings>) => service.updateSettings(patch),
    revealWebhookSecret: async (_c: HandlerCtx, id: string) => service.webhookSecret(id),
    testAi: async (_c: HandlerCtx, cfg?: Partial<AiConfig>) => {
      const s = await service.settings();
      const merged: AiConfig = { ...s.ai, ...(cfg ?? {}) };
      if (!cfg?.apiKey || cfg.apiKey === "••••••••") merged.apiKey = s.ai.apiKey;
      return testAiConnection(merged, env.browser);
    },

    listProposals: async () => service.listProposals(),
    stats: async () => service.stats(),
    activity: async (_c: HandlerCtx, limit?: number) => service.activity(limit ?? 20),
    detail: async (_c: HandlerCtx, id: string) => service.detail(id),
    createProposal: async (c: HandlerCtx, input: CreateInput) => service.createProposal(input, c),
    draftProposal: async (c: HandlerCtx, input: DraftInput & { templateId?: string }) => {
      const s = await service.settings();
      const template = input.templateId ? (await service.listTemplates()).find((t) => t.id === input.templateId) ?? null : null;
      const draftInput: DraftInput = { ...input, template };
      let result;
      try {
        result = await generateDraft(s.ai, draftInput, s.brand, { browser: env.browser });
      } catch (err) {
        throw new SiegelError(err instanceof Error ? err.message : String(err), 502);
      }
      const fields = draftToProposal(result.draft, draftInput);
      const generatedBy = result.provider === "demo" ? "siegel-demo-drafter" : `${result.provider}:${result.model}`;
      const proposal = await service.createProposal(
        { ...fields, generatedBy, terms: template?.terms, templateId: undefined },
        c,
      );
      return { proposal, provider: result.provider, model: result.model, ms: result.ms };
    },
    updateProposal: async (_c: HandlerCtx, id: string, patch: ProposalPatch) => service.updateProposal(id, patch),
    duplicateProposal: async (c: HandlerCtx, id: string) => service.duplicateProposal(id, c),
    deleteProposal: async (_c: HandlerCtx, id: string) => service.deleteProposal(id),
    sendProposal: async (c: HandlerCtx, id: string) => service.sendProposal(id, c),
    markPaid: async (c: HandlerCtx, id: string, reference?: string) => service.markPaid(id, { method: "manual", reference }, c),
    evidenceById: async (c: HandlerCtx, id: string) => service.evidenceById(id, c),
    tamper: async (_c: HandlerCtx, id: string) => {
      requireDemo();
      return service.tamper(id);
    },
    restore: async (_c: HandlerCtx, id: string) => service.restore(id),

    listTemplates: async () => service.listTemplates(),
    saveTemplate: async (_c: HandlerCtx, t: Partial<Template> & { name: string }) => service.saveTemplate(t),
    saveAsTemplate: async (_c: HandlerCtx, proposalId: string, name: string, description: string) =>
      service.saveAsTemplate(proposalId, name, description),
    deleteTemplate: async (_c: HandlerCtx, id: string) => service.deleteTemplate(id),
    listBlocks: async () => service.listBlocks(),
    saveBlock: async (_c: HandlerCtx, b: Partial<PricingBlock> & { tier: Omit<Tier, "id"> }) => service.saveBlock(b),
    deleteBlock: async (_c: HandlerCtx, id: string) => service.deleteBlock(id),

    deliveries: async () => service.deliveries(40),
    testWebhook: async (c: HandlerCtx, id: string) => service.testWebhook(id, c),
    exportAll: async () => service.exportAll(),
    loadSampleData: async (c: HandlerCtx) => {
      if ((await service.listProposals()).length) throw new SiegelError("Sample data can only be loaded into an empty workspace.", 409);
      await seedDemo(service, c);
      return { ok: true };
    },
    resetDemo: async (c: HandlerCtx) => {
      requireDemo();
      await service.repo.wipe();
      await seedDemo(service, c);
      return { ok: true };
    },

    // ---------------------------------------------------------------- public
    getPublic: async (c: HandlerCtx, token: string, preview?: boolean) => {
      if (preview && !c.authed) throw new SiegelError("Sign in to preview unsent proposals.", 401);
      return service.getPublic(token, { preview: !!preview });
    },
    recordView: async (c: HandlerCtx, token: string, sessionId: string) => service.recordView(token, sessionId, c),
    heartbeat: async (_c: HandlerCtx, token: string, sessionId: string, seconds: number) => service.heartbeat(token, sessionId, seconds),
    sign: async (c: HandlerCtx, token: string, input: SignInput) => service.sign(token, input, c),
    checkout: async (_c: HandlerCtx, token: string) => service.checkout(token),
    simulatePayment: async (c: HandlerCtx, token: string) => {
      await service.simulatePayment(token, c);
      return { ok: true };
    },
    evidence: async (c: HandlerCtx, token: string) => service.evidence(token, c),
    verifyById: async (_c: HandlerCtx, id: string) => service.verifyById(id),
    verifyEvidence: async (_c: HandlerCtx, ev: EvidencePackage) => verifyEvidence(ev),
  };
}

export type Handlers = ReturnType<typeof createHandlers>;
type Tail<T extends unknown[]> = T extends [unknown, ...infer R] ? R : [];
export type Api = { [K in keyof Handlers]: (...args: Tail<Parameters<Handlers[K]>>) => ReturnType<Handlers[K]> };
export type ApiResult<K extends keyof Api> = Awaited<ReturnType<Api[K]>>;
