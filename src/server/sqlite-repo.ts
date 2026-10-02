import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import type { Repo } from "@/core/repo";
import type { ChainEvent, DocVersion, PricingBlock, Proposal, Settings, Template, ViewSession, WebhookDelivery } from "@/core/types";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS proposals (
  id TEXT PRIMARY KEY, token TEXT NOT NULL UNIQUE, status TEXT NOT NULL,
  updated_at TEXT NOT NULL, data TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY, proposal_id TEXT NOT NULL, seq INTEGER NOT NULL, at TEXT NOT NULL,
  data TEXT NOT NULL, UNIQUE (proposal_id, seq)
);
CREATE INDEX IF NOT EXISTS events_at ON events (at DESC);
CREATE TABLE IF NOT EXISTS versions (
  id TEXT PRIMARY KEY, proposal_id TEXT NOT NULL, version INTEGER NOT NULL, data TEXT NOT NULL,
  UNIQUE (proposal_id, version)
);
CREATE TABLE IF NOT EXISTS views (
  id TEXT PRIMARY KEY, proposal_id TEXT NOT NULL, session_id TEXT NOT NULL, data TEXT NOT NULL,
  UNIQUE (proposal_id, session_id)
);
CREATE TABLE IF NOT EXISTS templates (id TEXT PRIMARY KEY, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS blocks (id TEXT PRIMARY KEY, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS deliveries (id TEXT PRIMARY KEY, at TEXT NOT NULL, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL);
`;

const parse = <T>(row: { data: string } | undefined): T | null => (row ? (JSON.parse(row.data) as T) : null);
const parseAll = <T>(rows: { data: string }[]): T[] => rows.map((r) => JSON.parse(r.data) as T);

export class SqliteRepo implements Repo {
  readonly db: Database.Database;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(file: string) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    this.db = new Database(file);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.db.exec(SCHEMA);
  }

  kvGet(key: string): string | null {
    const row = this.db.prepare("SELECT value FROM kv WHERE key = ?").get(key) as { value: string } | undefined;
    return row?.value ?? null;
  }

  kvSet(key: string, value: string) {
    this.db.prepare("INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, value);
  }

  async getSettings() {
    const v = this.kvGet("settings");
    return v ? (JSON.parse(v) as Partial<Settings>) : null;
  }
  async saveSettings(s: Settings) {
    this.kvSet("settings", JSON.stringify(s));
  }

  async listProposals() {
    return parseAll<Proposal>(this.db.prepare("SELECT data FROM proposals ORDER BY updated_at DESC").all() as { data: string }[]);
  }
  async getProposal(id: string) {
    return parse<Proposal>(this.db.prepare("SELECT data FROM proposals WHERE id = ?").get(id) as { data: string } | undefined);
  }
  async getProposalByToken(token: string) {
    return parse<Proposal>(this.db.prepare("SELECT data FROM proposals WHERE token = ?").get(token) as { data: string } | undefined);
  }
  async saveProposal(p: Proposal) {
    this.db
      .prepare(
        `INSERT INTO proposals (id, token, status, updated_at, data) VALUES (@id, @token, @status, @updatedAt, @data)
         ON CONFLICT(id) DO UPDATE SET token = excluded.token, status = excluded.status, updated_at = excluded.updated_at, data = excluded.data`,
      )
      .run({ id: p.id, token: p.token, status: p.status, updatedAt: p.updatedAt, data: JSON.stringify(p) });
  }
  async deleteProposal(id: string) {
    const tx = this.db.transaction(() => {
      for (const t of ["events", "versions", "views"]) this.db.prepare(`DELETE FROM ${t} WHERE proposal_id = ?`).run(id);
      this.db.prepare("DELETE FROM proposals WHERE id = ?").run(id);
    });
    tx();
  }

  async listEvents(proposalId: string) {
    return parseAll<ChainEvent>(this.db.prepare("SELECT data FROM events WHERE proposal_id = ? ORDER BY seq").all(proposalId) as { data: string }[]);
  }
  async listRecentEvents(limit: number) {
    return parseAll<ChainEvent>(this.db.prepare("SELECT data FROM events ORDER BY at DESC, seq DESC LIMIT ?").all(limit) as { data: string }[]);
  }
  async appendEvent(e: ChainEvent) {
    // UNIQUE(proposal_id, seq) makes forks of the chain impossible at the storage level.
    this.db.prepare("INSERT INTO events (id, proposal_id, seq, at, data) VALUES (?, ?, ?, ?, ?)").run(e.id, e.proposalId, e.seq, e.at, JSON.stringify(e));
  }

  async listVersions(proposalId: string) {
    return parseAll<DocVersion>(this.db.prepare("SELECT data FROM versions WHERE proposal_id = ? ORDER BY version").all(proposalId) as { data: string }[]);
  }
  async saveVersion(v: DocVersion) {
    this.db
      .prepare(
        `INSERT INTO versions (id, proposal_id, version, data) VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET data = excluded.data`,
      )
      .run(v.id, v.proposalId, v.version, JSON.stringify(v));
  }

  async getViewSession(proposalId: string, sessionId: string) {
    return parse<ViewSession>(
      this.db.prepare("SELECT data FROM views WHERE proposal_id = ? AND session_id = ?").get(proposalId, sessionId) as { data: string } | undefined,
    );
  }
  async listViewSessions(proposalId: string) {
    return parseAll<ViewSession>(this.db.prepare("SELECT data FROM views WHERE proposal_id = ?").all(proposalId) as { data: string }[]).sort((a, b) =>
      b.startedAt.localeCompare(a.startedAt),
    );
  }
  async saveViewSession(v: ViewSession) {
    this.db
      .prepare(
        `INSERT INTO views (id, proposal_id, session_id, data) VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET data = excluded.data`,
      )
      .run(v.id, v.proposalId, v.sessionId, JSON.stringify(v));
  }

  async listTemplates() {
    return parseAll<Template>(this.db.prepare("SELECT data FROM templates").all() as { data: string }[]);
  }
  async saveTemplate(t: Template) {
    this.db.prepare("INSERT INTO templates (id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data").run(t.id, JSON.stringify(t));
  }
  async deleteTemplate(id: string) {
    this.db.prepare("DELETE FROM templates WHERE id = ?").run(id);
  }

  async listBlocks() {
    return parseAll<PricingBlock>(this.db.prepare("SELECT data FROM blocks").all() as { data: string }[]);
  }
  async saveBlock(b: PricingBlock) {
    this.db.prepare("INSERT INTO blocks (id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data").run(b.id, JSON.stringify(b));
  }
  async deleteBlock(id: string) {
    this.db.prepare("DELETE FROM blocks WHERE id = ?").run(id);
  }

  async listDeliveries(limit: number) {
    return parseAll<WebhookDelivery>(this.db.prepare("SELECT data FROM deliveries ORDER BY at DESC LIMIT ?").all(limit) as { data: string }[]);
  }
  async saveDelivery(d: WebhookDelivery) {
    this.db.prepare("INSERT INTO deliveries (id, at, data) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data").run(d.id, d.at, JSON.stringify(d));
  }

  /** Async service code awaits Web Crypto, so serialise with a promise queue (single process). */
  transaction<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn, fn);
    this.queue = run.catch(() => undefined);
    return run;
  }

  async wipe() {
    this.db.exec("DELETE FROM proposals; DELETE FROM events; DELETE FROM versions; DELETE FROM views; DELETE FROM templates; DELETE FROM blocks; DELETE FROM deliveries;");
    this.db.prepare("DELETE FROM kv WHERE key = 'settings'").run();
  }
}
