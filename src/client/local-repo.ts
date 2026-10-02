"use client";

import type { Repo } from "@/core/repo";
import type { ChainEvent, DocVersion, PricingBlock, Proposal, Settings, Template, ViewSession, WebhookDelivery } from "@/core/types";

// IndexedDB-backed repository used by the static (GitHub Pages) build.
// Everything lives in the visitor's browser; tabs stay in sync via BroadcastChannel.

interface State {
  settings: Settings | null;
  proposals: Record<string, Proposal>;
  events: Record<string, ChainEvent[]>;
  versions: Record<string, DocVersion[]>;
  views: Record<string, ViewSession[]>;
  templates: Record<string, Template>;
  blocks: Record<string, PricingBlock>;
  deliveries: WebhookDelivery[];
}

const DB_NAME = "siegel";
const STORE = "kv";
const KEY = "state-v1";
export const CHANGE_EVENT = "siegel:changed";

const empty = (): State => ({ settings: null, proposals: {}, events: {}, versions: {}, views: {}, templates: {}, blocks: {}, deliveries: [] });
const clone = <T>(v: T): T => (v === undefined || v === null ? v : structuredClone(v));

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(): Promise<State | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const r = db.transaction(STORE, "readonly").objectStore(STORE).get(KEY);
    r.onsuccess = () => resolve((r.result as State) ?? null);
    r.onerror = () => reject(r.error);
  });
}

async function idbPut(state: State): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(state, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export class LocalRepo implements Repo {
  private state: State = empty();
  private queue: Promise<unknown> = Promise.resolve();
  private channel: BroadcastChannel | null = null;
  private writeTimer: ReturnType<typeof setTimeout> | null = null;
  private pending: Promise<void> | null = null;

  static async open(): Promise<LocalRepo> {
    const repo = new LocalRepo();
    try {
      repo.state = { ...empty(), ...((await idbGet()) ?? {}) };
    } catch {
      repo.state = empty();
    }
    if (typeof BroadcastChannel !== "undefined") {
      repo.channel = new BroadcastChannel("siegel");
      repo.channel.onmessage = async () => {
        await repo.reload();
        window.dispatchEvent(new Event(CHANGE_EVENT));
      };
    }
    return repo;
  }

  async reload() {
    try {
      const s = await idbGet();
      if (s) this.state = { ...empty(), ...s };
    } catch {
      /* keep memory state */
    }
  }

  private persist() {
    if (this.writeTimer) clearTimeout(this.writeTimer);
    this.pending = new Promise((resolve) => {
      this.writeTimer = setTimeout(async () => {
        try {
          await idbPut(this.state);
          this.channel?.postMessage("changed");
        } catch (err) {
          console.warn("[siegel] could not persist demo data", err);
        }
        window.dispatchEvent(new Event(CHANGE_EVENT));
        resolve();
      }, 40);
    });
  }

  /** Resolves once the latest write reached IndexedDB (used before navigating away). */
  flush() {
    return this.pending ?? Promise.resolve();
  }

  async getSettings() {
    return clone(this.state.settings);
  }
  async saveSettings(s: Settings) {
    this.state.settings = clone(s);
    this.persist();
  }

  async listProposals() {
    return Object.values(this.state.proposals).map(clone);
  }
  async getProposal(id: string) {
    return clone(this.state.proposals[id] ?? null);
  }
  async getProposalByToken(token: string) {
    return clone(Object.values(this.state.proposals).find((p) => p.token === token) ?? null);
  }
  async saveProposal(p: Proposal) {
    this.state.proposals[p.id] = clone(p);
    this.persist();
  }
  async deleteProposal(id: string) {
    delete this.state.proposals[id];
    delete this.state.events[id];
    delete this.state.versions[id];
    delete this.state.views[id];
    this.persist();
  }

  async listEvents(proposalId: string) {
    return clone(this.state.events[proposalId] ?? []).sort((a, b) => a.seq - b.seq);
  }
  async listRecentEvents(limit: number) {
    return Object.values(this.state.events)
      .flat()
      .sort((a, b) => b.at.localeCompare(a.at) || b.seq - a.seq)
      .slice(0, limit)
      .map(clone);
  }
  async appendEvent(e: ChainEvent) {
    const list = (this.state.events[e.proposalId] ??= []);
    if (list.some((x) => x.seq === e.seq)) throw new Error("Chain fork rejected");
    list.push(clone(e));
    this.persist();
  }

  async listVersions(proposalId: string) {
    return clone(this.state.versions[proposalId] ?? []).sort((a, b) => a.version - b.version);
  }
  async saveVersion(v: DocVersion) {
    const list = (this.state.versions[v.proposalId] ??= []);
    const i = list.findIndex((x) => x.id === v.id);
    if (i >= 0) list[i] = clone(v);
    else list.push(clone(v));
    this.persist();
  }

  async getViewSession(proposalId: string, sessionId: string) {
    return clone((this.state.views[proposalId] ?? []).find((v) => v.sessionId === sessionId) ?? null);
  }
  async listViewSessions(proposalId: string) {
    return clone(this.state.views[proposalId] ?? []).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }
  async saveViewSession(v: ViewSession) {
    const list = (this.state.views[v.proposalId] ??= []);
    const i = list.findIndex((x) => x.id === v.id);
    if (i >= 0) list[i] = clone(v);
    else list.push(clone(v));
    this.persist();
  }

  async listTemplates() {
    return Object.values(this.state.templates).map(clone);
  }
  async saveTemplate(t: Template) {
    this.state.templates[t.id] = clone(t);
    this.persist();
  }
  async deleteTemplate(id: string) {
    delete this.state.templates[id];
    this.persist();
  }

  async listBlocks() {
    return Object.values(this.state.blocks).map(clone);
  }
  async saveBlock(b: PricingBlock) {
    this.state.blocks[b.id] = clone(b);
    this.persist();
  }
  async deleteBlock(id: string) {
    delete this.state.blocks[id];
    this.persist();
  }

  async listDeliveries(limit: number) {
    return clone(this.state.deliveries.slice(0, limit));
  }
  async saveDelivery(d: WebhookDelivery) {
    this.state.deliveries = [clone(d), ...this.state.deliveries.filter((x) => x.id !== d.id)].slice(0, 100);
    this.persist();
  }

  transaction<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn, fn);
    this.queue = run.catch(() => undefined);
    return run;
  }

  async wipe() {
    this.state = empty();
    this.persist();
  }
}
