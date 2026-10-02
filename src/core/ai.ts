import { z } from "zod";
import { randomId } from "./crypto";
import { DEFAULT_MODELS } from "./defaults";
import type { AiConfig, Brand, Currency, Phase, Section, Template, Tier } from "./types";

// Structured draft returned by every provider (and by the offline demo drafter).
export const DraftSchema = z.object({
  title: z.string().describe("Outcome-focused proposal title, max 8 words"),
  client: z.object({
    name: z.string().describe("Contact person's full name, or empty string"),
    company: z.string().describe("Client company name, or empty string"),
    email: z.string().describe("Contact email if mentioned, else empty string"),
  }),
  executiveSummary: z.string().describe("2-4 sentences: the outcome, the approach and why it pays off"),
  challenge: z.string().describe("Markdown bullet list ('- ') of the client's concrete problems and their cost"),
  solution: z.string().describe("Markdown: how the solution works end to end, 2-3 short paragraphs or bullets"),
  deliverables: z.array(z.string()).describe("Concrete, verifiable deliverables"),
  timeline: z
    .array(z.object({ name: z.string(), duration: z.string(), description: z.string() }))
    .describe("3-5 phases with durations like 'Week 1' or 'Weeks 2-3'"),
  tiers: z
    .array(
      z.object({
        name: z.string(),
        price: z.number().describe("Price as a plain number in the proposal currency"),
        billing: z.enum(["one-time", "monthly"]),
        description: z.string().describe("One sentence on who this tier is for"),
        features: z.array(z.string()),
        recommended: z.boolean(),
      }),
    )
    .describe("2-3 good/better/best tiers; exactly one recommended"),
  depositPercent: z.number().describe("Deposit due at signing, 0-100"),
});

export type Draft = z.infer<typeof DraftSchema>;

export interface DraftInput {
  notes: string;
  currency: Currency;
  template?: Pick<Template, "name" | "sections" | "timeline" | "tiers"> | null;
  clientHint?: { name?: string; company?: string; email?: string };
}

export interface DraftResult {
  draft: Draft;
  provider: string;
  model: string;
  ms: number;
}

const SYSTEM_PROMPT = `You are the proposal writer for a small AI-automation agency. You turn messy sales-call notes into a polished, persuasive, client-ready proposal.

How to write it:
- Write in clear, confident, plain English for a business owner, not an engineer. Short sentences. No hype words like "revolutionary", "cutting-edge" or "seamless".
- Be specific to the notes: reuse the client's own numbers, tools, team size and pain points. Never invent facts that contradict the notes; when something is missing, choose a sensible, conservative assumption.
- Quantify the cost of the problem and the expected outcome where the notes allow it (hours saved, response time, revenue at risk).
- Deliverables must be concrete and verifiable (a workflow, an agent, documentation, a training session), never vague activities.
- Pricing: 2 or 3 tiers following good/better/best anchoring. Exactly one tier is recommended, usually the middle one, and it should fit the budget mentioned in the notes. Each tier lists 3-6 features; higher tiers include everything from lower tiers plus more. Use round, realistic agency prices in the requested currency.
- Use monthly billing only when the notes describe ongoing/retainer work.
- Use a 50% deposit unless the notes say otherwise; use 100% for monthly retainers (first month upfront).
- Markdown in text fields is limited to paragraphs, "- " bullet lists and **bold**.`;

function userPrompt(input: DraftInput, brand: Brand) {
  const parts = [
    `Today's date: ${new Date().toISOString().slice(0, 10)}`,
    `Agency: ${brand.companyName}${brand.tagline ? ` (${brand.tagline})` : ""}`,
    `Proposal currency: ${input.currency}`,
  ];
  if (input.clientHint && (input.clientHint.company || input.clientHint.name)) {
    parts.push(`Client (provided by the user, use exactly): ${[input.clientHint.name, input.clientHint.company, input.clientHint.email].filter(Boolean).join(", ")}`);
  }
  if (input.template) {
    parts.push(
      `Follow the structure and pricing style of the agency's template "${input.template.name}":\n` +
        `Sections: ${input.template.sections.map((s) => s.title).join(", ")}\n` +
        `Tiers: ${input.template.tiers.map((t) => `${t.name} (${t.price} ${t.billing})`).join(", ")}`,
    );
  }
  parts.push(`Call notes / transcript:\n"""\n${input.notes.trim()}\n"""`);
  parts.push("Draft the proposal now.");
  return parts.join("\n\n");
}

// ---------------------------------------------------------------- providers

function supportsEffort(model: string) {
  return !/haiku|claude-3|sonnet-4-5|claude-sonnet-4-|opus-4-1|opus-4-0/.test(model);
}

function supportsServerFallback(model: string) {
  return /^claude-(fable-5-1|opus-5-5|opus-5|sonnet-5-5)$/.test(model);
}

async function generateAnthropic(cfg: AiConfig, input: DraftInput, brand: Brand, browser: boolean): Promise<Draft> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const { betaZodOutputFormat } = await import("@anthropic-ai/sdk/helpers/beta/zod");
  const client = new Anthropic({ apiKey: cfg.apiKey, dangerouslyAllowBrowser: browser, maxRetries: 1 });
  const model = cfg.model || DEFAULT_MODELS.anthropic;
  const fallback = supportsServerFallback(model);
  const message = await client.beta.messages.parse({
    model,
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt(input, brand) }],
    output_config: {
      format: betaZodOutputFormat(DraftSchema),
      ...(supportsEffort(model) ? { effort: "medium" as const } : {}),
    },
    // Server-side refusal fallback: if a safety classifier declines, the API
    // retries on Anthropic's recommended fallback model within the same call.
    ...(fallback ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
  });
  if (message.stop_reason === "refusal") throw new Error("The model declined to draft this proposal. Try rephrasing the notes.");
  if (message.stop_reason === "max_tokens") throw new Error("The draft was cut off (max tokens). Try shorter notes.");
  if (!message.parsed_output) throw new Error("The model returned an unexpected format.");
  return message.parsed_output;
}

function strictSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(strictSchema);
  if (!node || typeof node !== "object") return node;
  const obj: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    if (k === "$schema") continue;
    obj[k] = strictSchema(v);
  }
  if (obj.type === "object" && obj.properties) {
    obj.additionalProperties = false;
    obj.required = Object.keys(obj.properties as object);
  }
  return obj;
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  return JSON.parse(raw.slice(start, end + 1));
}

async function generateOpenAICompatible(cfg: AiConfig, input: DraftInput, brand: Brand): Promise<Draft> {
  const openrouter = cfg.provider === "openrouter";
  const url = openrouter ? "https://openrouter.ai/api/v1/chat/completions" : "https://api.openai.com/v1/chat/completions";
  const schema = strictSchema(z.toJSONSchema(DraftSchema));
  const headers: Record<string, string> = { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` };
  if (openrouter) {
    headers["HTTP-Referer"] = "https://github.com/MarcelWeissgerberIT/Siegel";
    headers["X-Title"] = "Siegel";
  }
  const body = {
    model: cfg.model || (openrouter ? DEFAULT_MODELS.openrouter : DEFAULT_MODELS.openai),
    messages: [
      { role: "system", content: SYSTEM_PROMPT + (openrouter ? `\n\nRespond with JSON only, matching this JSON Schema:\n${JSON.stringify(schema)}` : "") },
      { role: "user", content: userPrompt(input, brand) },
    ],
    response_format: openrouter
      ? { type: "json_object" }
      : { type: "json_schema", json_schema: { name: "proposal_draft", strict: true, schema } },
  };
  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  const json = (await res.json().catch(() => ({}))) as { error?: { message?: string }; choices?: { message?: { content?: string; refusal?: string } }[] };
  if (!res.ok) throw new Error(json.error?.message || `Provider returned HTTP ${res.status}`);
  const msg = json.choices?.[0]?.message;
  if (msg?.refusal) throw new Error(msg.refusal);
  const parsed = DraftSchema.safeParse(extractJson(msg?.content ?? ""));
  if (!parsed.success) throw new Error("The model returned JSON that doesn't match the proposal format.");
  return parsed.data;
}

export async function generateDraft(cfg: AiConfig, input: DraftInput, brand: Brand, opts: { browser: boolean }): Promise<DraftResult> {
  const started = Date.now();
  if (!input.notes.trim()) throw new Error("Paste some call notes first.");
  if (cfg.provider === "demo" || !cfg.apiKey) {
    const { demoDraft } = await import("./demo-drafter");
    const draft = demoDraft(input, brand);
    return { draft, provider: "demo", model: DEFAULT_MODELS.demo, ms: Date.now() - started };
  }
  const draft =
    cfg.provider === "anthropic" ? await generateAnthropic(cfg, input, brand, opts.browser) : await generateOpenAICompatible(cfg, input, brand);
  return { draft, provider: cfg.provider, model: cfg.model, ms: Date.now() - started };
}

export function draftToProposal(draft: Draft, input: DraftInput) {
  const sections: Section[] = [
    { id: "sec_" + randomId(8), title: "Executive summary", body: draft.executiveSummary },
    { id: "sec_" + randomId(8), title: "The challenge", body: draft.challenge },
    { id: "sec_" + randomId(8), title: "Proposed solution", body: draft.solution },
    { id: "sec_" + randomId(8), title: "Deliverables", body: draft.deliverables.map((d) => `- ${d.replace(/^[-•]\s*/, "")}`).join("\n") },
  ];
  const timeline: Phase[] = draft.timeline.map((t) => ({ id: "ph_" + randomId(8), ...t }));
  let tiers: Tier[] = draft.tiers.slice(0, 4).map((t) => ({
    id: "tier_" + randomId(8),
    name: t.name,
    price: Math.max(0, Math.round(t.price)),
    billing: t.billing,
    description: t.description,
    features: t.features,
    recommended: t.recommended,
    paymentLink: "",
  }));
  const rec = tiers.findIndex((t) => t.recommended);
  const pick = rec >= 0 ? rec : Math.min(1, tiers.length - 1);
  tiers = tiers.map((t, i) => ({ ...t, recommended: i === pick }));
  const hint = input.clientHint ?? {};
  return {
    title: draft.title,
    client: {
      name: hint.name || draft.client.name,
      company: hint.company || draft.client.company,
      email: hint.email || draft.client.email,
    },
    currency: input.currency,
    sections,
    timeline,
    tiers,
    depositPercent: Math.min(100, Math.max(0, Math.round(draft.depositPercent))),
    sourceNotes: input.notes,
  };
}
