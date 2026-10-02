import { buildDocument, createEvent, hashDocument, verifyRecord } from "./chain";
import { randomId, sha256Hex } from "./crypto";
import { mergeSettings, starterBlocks, starterTemplates } from "./defaults";
import type { Repo } from "./repo";
import { computeStats } from "./stats";
import type {
  ActivityItem,
  ChainEvent,
  DocVersion,
  EventType,
  EvidencePackage,
  PricingBlock,
  Proposal,
  PublicProposal,
  Settings,
  Template,
  Tier,
  WebhookConfig,
  WebhookDelivery,
  WebhookEvent,
} from "./types";
import type { Deliver } from "./webhooks";

export interface Ctx {
  ip: string;
  userAgent: string;
  baseUrl: string; // origin + basePath, used to build public links
}

export interface ServiceDeps {
  repo: Repo;
  deliver: Deliver;
  mode: "server" | "local";
  allowSimulatedPayments: boolean;
}

export class SiegelError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export const MASK = "••••••••";

export function publicLink(baseUrl: string, token: string) {
  return `${baseUrl.replace(/\/$/, "")}/p/?t=${token}`;
}

export function depositFor(tier: Pick<Tier, "price">, percent: number) {
  return Math.round(tier.price * percent) / 100;
}

export function paymentUrl(link: string, proposalId: string, email: string) {
  if (!link) return null;
  const sep = link.includes("?") ? "&" : "?";
  return `${link}${sep}client_reference_id=${encodeURIComponent(proposalId)}${email ? `&prefilled_email=${encodeURIComponent(email)}` : ""}`;
}

export type ProposalPatch = Partial<
  Pick<Proposal, "title" | "client" | "currency" | "cover" | "sections" | "timeline" | "tiers" | "depositPercent" | "validUntil" | "terms">
>;

export interface CreateInput extends ProposalPatch {
  templateId?: string;
  sourceNotes?: string;
  generatedBy?: string | null;
}

export interface SignInput {
  tierId: string;
  name: string;
  email: string;
  image: string;
  docHash: string;
  consent: boolean;
}

export class SiegelService {
  private fixedNow: Date | null = null;

  constructor(private deps: ServiceDeps) {}

  get repo() {
    return this.deps.repo;
  }

  now() {
    return (this.fixedNow ?? new Date()).toISOString();
  }

  /** Used by the seeder to backdate history. */
  async at<T>(date: Date, fn: () => Promise<T>): Promise<T> {
    this.fixedNow = date;
    try {
      return await fn();
    } finally {
      this.fixedNow = null;
    }
  }

  // ------------------------------------------------------------------ settings

  async settings(): Promise<Settings> {
    return mergeSettings(await this.repo.getSettings());
  }

  async maskedSettings(): Promise<Settings & { hasApiKey: boolean }> {
    const s = await this.settings();
    return {
      ...s,
      hasApiKey: !!s.ai.apiKey,
      ai: { ...s.ai, apiKey: s.ai.apiKey ? MASK : "" },
      stripeWebhookSecret: s.stripeWebhookSecret ? MASK : "",
      webhooks: s.webhooks.map((w) => ({ ...w, secret: w.secret ? MASK : "" })),
    };
  }

  async updateSettings(patch: Partial<Settings>): Promise<Settings & { hasApiKey: boolean }> {
    const cur = await this.settings();
    const next: Settings = {
      ...cur,
      ...patch,
      brand: { ...cur.brand, ...(patch.brand ?? {}) },
      ai: { ...cur.ai, ...(patch.ai ?? {}) },
      webhooks: patch.webhooks ?? cur.webhooks,
    };
    if (patch.ai && (patch.ai.apiKey === undefined || patch.ai.apiKey === MASK)) next.ai.apiKey = cur.ai.apiKey;
    if (patch.stripeWebhookSecret === MASK || patch.stripeWebhookSecret === undefined) next.stripeWebhookSecret = cur.stripeWebhookSecret;
    // Keep existing secrets for webhooks when the client sends them masked.
    next.webhooks = next.webhooks.map((w) => {
      const prev = cur.webhooks.find((x) => x.id === w.id);
      return { ...w, secret: w.secret === MASK && prev ? prev.secret : w.secret || "whsec_" + randomId(24) };
    });
    await this.repo.saveSettings(next);
    return this.maskedSettings();
  }

  async webhookSecret(id: string) {
    const s = await this.settings();
    return s.webhooks.find((w) => w.id === id)?.secret ?? null;
  }

  // ------------------------------------------------------------------ proposals

  async listProposals(): Promise<Proposal[]> {
    const all = await this.repo.listProposals();
    return all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(stripHeavy);
  }

  async stats() {
    return computeStats(await this.repo.listProposals(), new Date(this.now()));
  }

  async activity(limit = 20): Promise<ActivityItem[]> {
    const events = await this.repo.listRecentEvents(limit);
    const cache = new Map<string, Proposal | null>();
    const out: ActivityItem[] = [];
    for (const e of events) {
      if (!cache.has(e.proposalId)) cache.set(e.proposalId, await this.repo.getProposal(e.proposalId));
      const p = cache.get(e.proposalId);
      if (p) out.push({ event: e, proposal: { id: p.id, number: p.number, title: p.title, client: p.client } });
    }
    return out;
  }

  private async mustGet(id: string) {
    const p = await this.repo.getProposal(id);
    if (!p) throw new SiegelError("Proposal not found", 404);
    return p;
  }

  async detail(id: string) {
    const proposal = await this.mustGet(id);
    const [events, versions, views] = await Promise.all([
      this.repo.listEvents(id),
      this.repo.listVersions(id),
      this.repo.listViewSessions(id),
    ]);
    const verification = await verifyRecord(proposal, versions, events);
    return { proposal, events, versions, views, verification };
  }

  private async nextNumber() {
    const all = await this.repo.listProposals();
    const max = all.reduce((m, p) => Math.max(m, parseInt(p.number.replace(/\D/g, ""), 10) || 0), 1000);
    return `SG-${max + 1}`;
  }

  private async log(p: Proposal, type: EventType, ctx: Pick<Ctx, "ip" | "userAgent">, data: Record<string, unknown>) {
    const events = await this.repo.listEvents(p.id);
    const last = events.length ? events.reduce((a, b) => (a.seq > b.seq ? a : b)) : null;
    const e = await createEvent(last, { proposalId: p.id, type, at: this.now(), ip: ctx.ip, userAgent: ctx.userAgent, data });
    await this.repo.appendEvent(e);
    return e;
  }

  async createProposal(input: CreateInput, ctx: Ctx): Promise<Proposal> {
    return this.repo.transaction(async () => {
      const s = await this.settings();
      const tpl = input.templateId ? (await this.repo.listTemplates()).find((t) => t.id === input.templateId) : undefined;
      const now = this.now();
      const validDays = s.brand.defaultValidityDays || 14;
      const p: Proposal = {
        id: "prp_" + randomId(14),
        number: await this.nextNumber(),
        title: input.title ?? (tpl ? tpl.name : "Untitled proposal"),
        client: input.client ?? { name: "", company: "", email: "" },
        status: "draft",
        currency: input.currency ?? s.brand.defaultCurrency,
        cover: input.cover ?? "ember",
        sections: clone(input.sections ?? tpl?.sections ?? []).map((x) => ({ ...x, id: x.id || "sec_" + randomId(8) })),
        timeline: clone(input.timeline ?? tpl?.timeline ?? []).map((x) => ({ ...x, id: x.id || "ph_" + randomId(8) })),
        tiers: clone(input.tiers ?? tpl?.tiers ?? []).map((x) => ({ ...x, id: x.id || "tier_" + randomId(8), paymentLink: x.paymentLink ?? "" })),
        depositPercent: input.depositPercent ?? s.brand.defaultDeposit,
        validUntil: input.validUntil ?? new Date(Date.parse(now) + validDays * 864e5).toISOString().slice(0, 10),
        terms: input.terms ?? tpl?.terms ?? s.brand.defaultTerms,
        sourceNotes: input.sourceNotes ?? "",
        generatedBy: input.generatedBy ?? null,
        token: randomId(24),
        version: 0,
        dirty: true,
        createdAt: now,
        updatedAt: now,
        sentAt: null,
        firstViewedAt: null,
        signedAt: null,
        paidAt: null,
        signature: null,
        payment: null,
        stats: { views: 0, seconds: 0, lastViewedAt: null },
        tamperBackup: null,
      };
      await this.repo.saveProposal(p);
      await this.log(p, "created", ctx, {
        number: p.number,
        title: p.title,
        source: input.generatedBy ? "ai" : tpl ? "template" : "blank",
        generatedBy: input.generatedBy ?? null,
      });
      return p;
    });
  }

  async updateProposal(id: string, patch: ProposalPatch): Promise<Proposal> {
    const p = await this.mustGet(id);
    if (p.status === "signed" || p.status === "paid") throw new SiegelError("Signed proposals are sealed and can't be edited. Duplicate it instead.", 409);
    const allowed: (keyof ProposalPatch)[] = ["title", "client", "currency", "cover", "sections", "timeline", "tiers", "depositPercent", "validUntil", "terms"];
    const next: Proposal = { ...p };
    for (const k of allowed) if (patch[k] !== undefined) (next as unknown as Record<string, unknown>)[k] = patch[k];
    next.dirty = true;
    next.updatedAt = this.now();
    await this.repo.saveProposal(next);
    return next;
  }

  async duplicateProposal(id: string, ctx: Ctx) {
    const p = await this.mustGet(id);
    return this.createProposal(
      {
        title: p.title + " (copy)",
        client: p.client,
        currency: p.currency,
        cover: p.cover,
        sections: p.sections.map((s) => ({ ...s, id: "" })),
        timeline: p.timeline.map((s) => ({ ...s, id: "" })),
        tiers: p.tiers.map((s) => ({ ...s, id: "" })),
        depositPercent: p.depositPercent,
        terms: p.terms,
        sourceNotes: p.sourceNotes,
      },
      ctx,
    );
  }

  async deleteProposal(id: string) {
    await this.repo.deleteProposal(id);
    return { ok: true };
  }

  /** Publish the current content as a new immutable, hashed version. */
  async sendProposal(id: string, ctx: Ctx) {
    return this.repo.transaction(async () => {
      const p = await this.mustGet(id);
      if (p.status === "signed" || p.status === "paid") throw new SiegelError("Already signed.", 409);
      if (!p.tiers.length) throw new SiegelError("Add at least one pricing tier before sending.");
      if (!p.title.trim()) throw new SiegelError("Give the proposal a title before sending.");
      if (!p.dirty && p.version > 0) return { proposal: p, link: publicLink(ctx.baseUrl, p.token), version: p.version };
      const s = await this.settings();
      const version = p.version + 1;
      const now = this.now();
      const doc = buildDocument(p, s.brand, version, now);
      const hash = await hashDocument(doc);
      const versions = await this.repo.listVersions(p.id);
      const prev = versions.find((v) => v.version === p.version);
      const v: DocVersion = { id: "ver_" + randomId(12), proposalId: p.id, version, hash, content: doc, createdAt: now };
      await this.repo.saveVersion(v);
      const first = p.version === 0;
      await this.log(p, first ? "sent" : "revised", ctx, {
        version,
        docHash: hash,
        ...(first ? { recipient: p.client.email || null } : { previousHash: prev?.hash ?? null }),
      });
      const next: Proposal = {
        ...p,
        version,
        dirty: false,
        status: p.status === "draft" ? "sent" : p.status,
        sentAt: p.sentAt ?? now,
        updatedAt: now,
      };
      await this.repo.saveProposal(next);
      if (first) void this.emit("proposal.sent", next, ctx, { version, docHash: hash });
      return { proposal: next, link: publicLink(ctx.baseUrl, p.token), version };
    });
  }

  // ------------------------------------------------------------------ public (client-facing)

  private async latestVersion(p: Proposal) {
    const versions = await this.repo.listVersions(p.id);
    return versions.find((v) => v.version === p.version) ?? null;
  }

  async getPublic(token: string, opts: { preview?: boolean } = {}): Promise<PublicProposal> {
    const p = await this.repo.getProposalByToken(token);
    if (!p) throw new SiegelError("This proposal link is invalid or has been withdrawn.", 404);
    const s = await this.settings();
    let document;
    let documentHash;
    if (opts.preview && (p.dirty || p.version === 0)) {
      document = buildDocument(p, s.brand, p.version + 1, this.now());
      documentHash = await hashDocument(document);
    } else {
      const v = await this.latestVersion(p);
      if (!v) throw new SiegelError("This proposal hasn't been sent yet.", 404);
      document = v.content;
      documentHash = v.hash;
    }
    const sig = p.signature;
    return {
      id: p.id,
      number: p.number,
      status: p.status,
      cover: p.cover,
      document,
      documentHash,
      brand: {
        companyName: s.brand.companyName,
        contactName: s.brand.contactName,
        email: s.brand.email,
        website: s.brand.website,
        logo: s.brand.logo,
        accent: s.brand.accent,
        tagline: s.brand.tagline,
      },
      tiers: p.tiers.map((t) => ({ id: t.id, paymentLink: !!t.paymentLink })),
      signature: sig
        ? {
            name: sig.name,
            email: sig.email,
            tierId: sig.tierId,
            tierName: sig.tierName,
            amount: sig.amount,
            deposit: sig.deposit,
            signedAt: sig.signedAt,
            imageHash: sig.imageHash,
            docHash: sig.docHash,
            version: sig.version,
          }
        : null,
      payment: p.payment,
      paymentConfigured: p.tiers.some((t) => !!t.paymentLink),
      checkoutMode: this.deps.allowSimulatedPayments ? "simulated" : "stripe",
    };
  }

  async recordView(token: string, sessionId: string, ctx: Ctx) {
    return this.repo.transaction(async () => {
      const p = await this.repo.getProposalByToken(token);
      if (!p || p.version === 0) return { ok: false };
      const now = this.now();
      const existing = await this.repo.getViewSession(p.id, sessionId);
      if (existing) return { ok: true, firstView: false };
      await this.repo.saveViewSession({
        id: "vw_" + randomId(12),
        proposalId: p.id,
        sessionId,
        startedAt: now,
        lastSeenAt: now,
        seconds: 0,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      });
      const next: Proposal = { ...p, stats: { ...p.stats, views: p.stats.views + 1, lastViewedAt: now } };
      const firstView = !p.firstViewedAt;
      if (firstView) {
        next.firstViewedAt = now;
        if (next.status === "sent") next.status = "viewed";
        await this.log(p, "viewed", ctx, { version: p.version, session: (await sha256Hex(sessionId)).slice(0, 16) });
      }
      await this.repo.saveProposal(next);
      if (firstView) void this.emit("proposal.viewed", next, ctx, { version: p.version });
      return { ok: true, firstView };
    });
  }

  async heartbeat(token: string, sessionId: string, seconds: number) {
    const p = await this.repo.getProposalByToken(token);
    if (!p) return { ok: false };
    const v = await this.repo.getViewSession(p.id, sessionId);
    if (!v) return { ok: false };
    const delta = Math.max(0, Math.min(60, Math.round(seconds)));
    await this.repo.saveViewSession({ ...v, seconds: v.seconds + delta, lastSeenAt: this.now() });
    await this.repo.saveProposal({ ...p, stats: { ...p.stats, seconds: p.stats.seconds + delta, lastViewedAt: this.now() } });
    return { ok: true };
  }

  async sign(token: string, input: SignInput, ctx: Ctx) {
    return this.repo.transaction(async () => {
      const p = await this.repo.getProposalByToken(token);
      if (!p || p.version === 0) throw new SiegelError("Proposal not found.", 404);
      if (p.signature) throw new SiegelError("This proposal has already been signed.", 409);
      const v = await this.latestVersion(p);
      if (!v) throw new SiegelError("Proposal not found.", 404);
      if (input.docHash !== v.hash)
        throw new SiegelError("The proposal was updated while you were reading it. Please reload to review the latest version before signing.", 409);
      if (!input.consent) throw new SiegelError("Please confirm the electronic signature consent.");
      const name = input.name.trim();
      if (name.length < 2) throw new SiegelError("Please type your full name.");
      if (!/^data:image\/png;base64,/.test(input.image) || input.image.length < 200) throw new SiegelError("Please draw your signature.");
      if (input.image.length > 600_000) throw new SiegelError("Signature image is too large.");
      const tier = v.content.tiers.find((t) => t.id === input.tierId);
      if (!tier) throw new SiegelError("Please choose a package.");
      const imageHash = await sha256Hex(input.image);
      const deposit = depositFor(tier, v.content.depositPercent);
      const now = this.now();
      await this.log(p, "signed", ctx, {
        version: v.version,
        docHash: v.hash,
        tierId: tier.id,
        tierName: tier.name,
        amount: tier.price,
        deposit,
        currency: v.content.currency,
        signerName: name,
        signerEmail: input.email.trim(),
        imageHash,
        consent: "I agree that my typed name and drawn signature are my legally binding electronic signature.",
      });
      const next: Proposal = {
        ...p,
        status: "signed",
        signedAt: now,
        updatedAt: now,
        client: { ...p.client, email: p.client.email || input.email.trim() },
        signature: {
          name,
          email: input.email.trim(),
          tierId: tier.id,
          tierName: tier.name,
          amount: tier.price,
          deposit,
          signedAt: now,
          image: input.image,
          imageHash,
          docHash: v.hash,
          version: v.version,
          ip: ctx.ip,
          userAgent: ctx.userAgent,
        },
      };
      await this.repo.saveProposal(next);
      void this.emit("proposal.signed", next, ctx, {
        tier: { id: tier.id, name: tier.name, price: tier.price, billing: tier.billing },
        deposit,
        signer: { name, email: input.email.trim() },
        docHash: v.hash,
      });
      const live = p.tiers.find((t) => t.id === tier.id);
      const url = live?.paymentLink ? paymentUrl(live.paymentLink, p.id, input.email.trim()) : null;
      return {
        ok: true,
        deposit,
        currency: v.content.currency,
        paymentUrl: url,
        simulated: !url && this.deps.allowSimulatedPayments && deposit > 0,
      };
    });
  }

  async markPaid(
    id: string,
    input: { method: "stripe" | "manual" | "simulated"; reference?: string; amount?: number },
    ctx: Ctx,
  ) {
    return this.repo.transaction(async () => {
      const p = await this.mustGet(id);
      if (!p.signature) throw new SiegelError("The proposal has to be signed first.", 409);
      if (p.payment) return p;
      const now = this.now();
      const amount = input.amount ?? p.signature.deposit;
      const payment = { amount, currency: p.currency, method: input.method, reference: input.reference || "pay_" + randomId(10), paidAt: now };
      await this.log(p, "paid", ctx, { amount, currency: p.currency, method: input.method, reference: payment.reference });
      const next: Proposal = { ...p, status: "paid", paidAt: now, updatedAt: now, payment };
      await this.repo.saveProposal(next);
      void this.emit("proposal.paid", next, ctx, { payment });
      return next;
    });
  }

  /** Where to send a signed client to pay the deposit. */
  async checkout(token: string) {
    const p = await this.repo.getProposalByToken(token);
    if (!p || !p.signature) throw new SiegelError("Sign the proposal first.", 409);
    const live = p.tiers.find((t) => t.id === p.signature!.tierId);
    const url = live?.paymentLink ? paymentUrl(live.paymentLink, p.id, p.signature.email) : null;
    return {
      paid: !!p.payment,
      url,
      simulated: !url && this.deps.allowSimulatedPayments,
      deposit: p.signature.deposit,
      currency: p.currency,
      tierName: p.signature.tierName,
      number: p.number,
      title: p.title,
      company: (await this.settings()).brand.companyName,
      accent: (await this.settings()).brand.accent,
      email: p.signature.email,
    };
  }

  /** Simulated checkout used by the static demo (never enabled for real installs). */
  async simulatePayment(token: string, ctx: Ctx) {
    if (!this.deps.allowSimulatedPayments) throw new SiegelError("Simulated payments are disabled on this instance.", 403);
    const p = await this.repo.getProposalByToken(token);
    if (!p) throw new SiegelError("Proposal not found.", 404);
    return this.markPaid(p.id, { method: "simulated", reference: "sim_" + randomId(12) }, ctx);
  }

  async evidence(token: string, ctx: Ctx): Promise<EvidencePackage> {
    const p = await this.repo.getProposalByToken(token);
    if (!p || !p.signature) throw new SiegelError("Evidence is available once the proposal is signed.", 404);
    const versions = await this.repo.listVersions(p.id);
    const v = versions.find((x) => x.version === p.signature!.version)!;
    const events = (await this.repo.listEvents(p.id)).sort((a, b) => a.seq - b.seq);
    const sig = p.signature;
    return {
      format: "siegel.evidence/v1",
      generatedAt: this.now(),
      proposalId: p.id,
      number: p.number,
      title: v.content.title,
      document: v.content,
      documentHash: v.hash,
      signature: {
        name: sig.name,
        email: sig.email,
        tierId: sig.tierId,
        tierName: sig.tierName,
        amount: sig.amount,
        deposit: sig.deposit,
        signedAt: sig.signedAt,
        image: sig.image,
        imageHash: sig.imageHash,
      },
      payment: p.payment,
      events,
      chainHead: events.length ? events[events.length - 1].hash : "",
      verifyUrl: `${ctx.baseUrl.replace(/\/$/, "")}/verify/?id=${p.id}`,
    };
  }

  async evidenceById(id: string, ctx: Ctx) {
    const p = await this.mustGet(id);
    return this.evidence(p.token, ctx);
  }

  async verifyById(id: string) {
    const p = await this.repo.getProposal(id);
    if (!p) throw new SiegelError("No proposal with this ID exists on this Siegel instance.", 404);
    const [versions, events] = await Promise.all([this.repo.listVersions(id), this.repo.listEvents(id)]);
    const report = await verifyRecord(p, versions, events);
    return {
      report,
      summary: {
        number: p.number,
        title: p.title,
        status: p.status,
        signedBy: p.signature?.name ?? null,
        signedAt: p.signature?.signedAt ?? null,
        chainHead: report.chainHead,
        docHash: p.signature?.docHash ?? null,
      },
    };
  }

  // Demo helpers to show what tampering looks like ---------------------------

  async tamper(id: string) {
    const p = await this.mustGet(id);
    if (!p.signature) throw new SiegelError("Only signed proposals can be tamper-tested.");
    if (p.tamperBackup) return p;
    const versions = await this.repo.listVersions(id);
    const v = versions.find((x) => x.version === p.signature!.version)!;
    const backup = clone(v.content);
    const forged = clone(v.content);
    const t = forged.tiers.find((x) => x.id === p.signature!.tierId) ?? forged.tiers[0];
    t.price = Math.round(t.price * 1.4);
    if (forged.sections[0]) forged.sections[0].body += " The client additionally agrees to unlimited free revisions.";
    await this.repo.saveVersion({ ...v, content: forged }); // hash intentionally NOT updated
    const next = { ...p, tamperBackup: backup };
    await this.repo.saveProposal(next);
    return next;
  }

  async restore(id: string) {
    const p = await this.mustGet(id);
    if (!p.tamperBackup || !p.signature) return p;
    const versions = await this.repo.listVersions(id);
    const v = versions.find((x) => x.version === p.signature!.version)!;
    await this.repo.saveVersion({ ...v, content: p.tamperBackup });
    const next = { ...p, tamperBackup: null };
    await this.repo.saveProposal(next);
    return next;
  }

  // ------------------------------------------------------------------ templates & blocks

  async listTemplates() {
    return (await this.repo.listTemplates()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async saveTemplate(t: Partial<Template> & { name: string }) {
    const existing = t.id ? (await this.repo.listTemplates()).find((x) => x.id === t.id) : undefined;
    const tpl: Template = {
      id: existing?.id ?? "tpl_" + randomId(10),
      name: t.name,
      description: t.description ?? existing?.description ?? "",
      sections: t.sections ?? existing?.sections ?? [],
      timeline: t.timeline ?? existing?.timeline ?? [],
      tiers: t.tiers ?? existing?.tiers ?? [],
      terms: t.terms ?? existing?.terms ?? (await this.settings()).brand.defaultTerms,
      createdAt: existing?.createdAt ?? this.now(),
    };
    await this.repo.saveTemplate(tpl);
    return tpl;
  }

  async saveAsTemplate(proposalId: string, name: string, description: string) {
    const p = await this.mustGet(proposalId);
    return this.saveTemplate({
      name,
      description,
      sections: p.sections.map((s) => ({ ...s, id: "sec_" + randomId(8) })),
      timeline: p.timeline.map((s) => ({ ...s, id: "ph_" + randomId(8) })),
      tiers: p.tiers.map((s) => ({ ...s, id: "tier_" + randomId(8), paymentLink: "" })),
      terms: p.terms,
    });
  }

  async deleteTemplate(id: string) {
    await this.repo.deleteTemplate(id);
    return { ok: true };
  }

  async listBlocks() {
    return (await this.repo.listBlocks()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async saveBlock(b: Partial<PricingBlock> & { tier: Omit<Tier, "id"> }) {
    const block: PricingBlock = {
      id: b.id ?? "blk_" + randomId(10),
      name: b.tier.name,
      tier: { ...b.tier, recommended: false },
      createdAt: b.createdAt ?? this.now(),
    };
    await this.repo.saveBlock(block);
    return block;
  }

  async deleteBlock(id: string) {
    await this.repo.deleteBlock(id);
    return { ok: true };
  }

  // ------------------------------------------------------------------ webhooks

  async deliveries(limit = 30) {
    return this.repo.listDeliveries(limit);
  }

  private payload(event: WebhookEvent | "test", p: Proposal, ctx: Ctx, extra: Record<string, unknown>) {
    const recommended = p.tiers.find((t) => t.recommended) ?? p.tiers[0];
    return {
      id: "evt_" + randomId(16),
      event,
      createdAt: this.now(),
      proposal: {
        id: p.id,
        number: p.number,
        title: p.title,
        status: p.status,
        currency: p.currency,
        value: p.signature?.amount ?? recommended?.price ?? 0,
        client: p.client,
        url: publicLink(ctx.baseUrl, p.token),
      },
      data: extra,
    };
  }

  private async emit(event: WebhookEvent, p: Proposal, ctx: Ctx, extra: Record<string, unknown>) {
    try {
      const s = await this.settings();
      const hooks = s.webhooks.filter((w) => w.active && w.events.includes(event) && w.url);
      if (!hooks.length) return;
      const body = this.payload(event, p, ctx, extra);
      await Promise.all(
        hooks.map(async (h) => {
          const d = await this.deps.deliver(h, event, body);
          await this.repo.saveDelivery(d);
        }),
      );
    } catch (err) {
      console.error("[siegel] webhook dispatch failed", err);
    }
  }

  async testWebhook(id: string, ctx: Ctx): Promise<WebhookDelivery> {
    const s = await this.settings();
    const hook: WebhookConfig | undefined = s.webhooks.find((w) => w.id === id);
    if (!hook) throw new SiegelError("Webhook not found", 404);
    const sample = (await this.repo.listProposals())[0];
    const body = sample
      ? this.payload("test", sample, ctx, { note: "Test delivery from Siegel" })
      : { id: "evt_" + randomId(16), event: "test", createdAt: this.now(), data: { note: "Test delivery from Siegel" } };
    const d = await this.deps.deliver(hook, "test", body);
    await this.repo.saveDelivery(d);
    return d;
  }

  // ------------------------------------------------------------------ data

  async exportAll() {
    const proposals = await this.repo.listProposals();
    const out: Record<string, unknown> = {
      format: "siegel.export/v1",
      exportedAt: this.now(),
      settings: await this.maskedSettings(),
      templates: await this.repo.listTemplates(),
      blocks: await this.repo.listBlocks(),
      proposals: [] as unknown[],
    };
    for (const p of proposals) {
      (out.proposals as unknown[]).push({
        proposal: p,
        versions: await this.repo.listVersions(p.id),
        events: await this.repo.listEvents(p.id),
      });
    }
    return out;
  }

  async ensureStarterLibrary() {
    const [tpls, blocks] = await Promise.all([this.repo.listTemplates(), this.repo.listBlocks()]);
    const now = this.now();
    if (!tpls.length) for (const t of starterTemplates(now)) await this.repo.saveTemplate(t);
    if (!blocks.length) for (const b of starterBlocks(now)) await this.repo.saveBlock(b);
  }
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

/** Lists don't need signature images; keeps payloads small. */
function stripHeavy(p: Proposal): Proposal {
  return p.signature ? { ...p, signature: { ...p.signature, image: "" } } : p;
}

export type { ChainEvent };
