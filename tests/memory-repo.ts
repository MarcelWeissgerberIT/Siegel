import type { Repo } from "../src/core/repo";
import type { ChainEvent, DocVersion, PricingBlock, Proposal, Settings, Template, ViewSession, WebhookDelivery } from "../src/core/types";

const clone = <T>(v: T): T => structuredClone(v);

/** In-memory Repo for tests. Mirrors the SQLite/IndexedDB semantics (incl. no chain forks). */
export class MemoryRepo implements Repo {
  settings: Settings | null = null;
  proposals = new Map<string, Proposal>();
  events: ChainEvent[] = [];
  versions: DocVersion[] = [];
  views: ViewSession[] = [];
  templates = new Map<string, Template>();
  blocks = new Map<string, PricingBlock>();
  deliveries: WebhookDelivery[] = [];
  private queue: Promise<unknown> = Promise.resolve();

  async getSettings() { return clone(this.settings); }
  async saveSettings(s: Settings) { this.settings = clone(s); }
  async listProposals() { return [...this.proposals.values()].map(clone); }
  async getProposal(id: string) { return clone(this.proposals.get(id) ?? null); }
  async getProposalByToken(t: string) { return clone([...this.proposals.values()].find((p) => p.token === t) ?? null); }
  async saveProposal(p: Proposal) { this.proposals.set(p.id, clone(p)); }
  async deleteProposal(id: string) { this.proposals.delete(id); }
  async listEvents(pid: string) { return this.events.filter((e) => e.proposalId === pid).sort((a, b) => a.seq - b.seq).map(clone); }
  async listRecentEvents(n: number) { return [...this.events].sort((a, b) => b.at.localeCompare(a.at)).slice(0, n).map(clone); }
  async appendEvent(e: ChainEvent) {
    if (this.events.some((x) => x.proposalId === e.proposalId && x.seq === e.seq)) throw new Error("fork");
    this.events.push(clone(e));
  }
  async listVersions(pid: string) { return this.versions.filter((v) => v.proposalId === pid).map(clone); }
  async saveVersion(v: DocVersion) { this.versions = [...this.versions.filter((x) => x.id !== v.id), clone(v)]; }
  async getViewSession(pid: string, sid: string) { return clone(this.views.find((v) => v.proposalId === pid && v.sessionId === sid) ?? null); }
  async listViewSessions(pid: string) { return this.views.filter((v) => v.proposalId === pid).map(clone); }
  async saveViewSession(v: ViewSession) { this.views = [...this.views.filter((x) => x.id !== v.id), clone(v)]; }
  async listTemplates() { return [...this.templates.values()].map(clone); }
  async saveTemplate(t: Template) { this.templates.set(t.id, clone(t)); }
  async deleteTemplate(id: string) { this.templates.delete(id); }
  async listBlocks() { return [...this.blocks.values()].map(clone); }
  async saveBlock(b: PricingBlock) { this.blocks.set(b.id, clone(b)); }
  async deleteBlock(id: string) { this.blocks.delete(id); }
  async listDeliveries(n: number) { return this.deliveries.slice(0, n).map(clone); }
  async saveDelivery(d: WebhookDelivery) { this.deliveries.unshift(clone(d)); }
  transaction<T>(fn: () => Promise<T>) { const r = this.queue.then(fn, fn); this.queue = r.catch(() => undefined); return r; }
  async wipe() { this.proposals.clear(); this.events = []; this.versions = []; }
}
