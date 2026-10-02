import type {
  ChainEvent,
  DocVersion,
  PricingBlock,
  Proposal,
  Settings,
  Template,
  ViewSession,
  WebhookDelivery,
} from "./types";

/**
 * Persistence port. Implemented by SQLite (self-hosted server) and by
 * IndexedDB (static GitHub Pages demo). All business logic lives in the
 * service and is shared by both.
 */
export interface Repo {
  getSettings(): Promise<Partial<Settings> | null>;
  saveSettings(s: Settings): Promise<void>;

  listProposals(): Promise<Proposal[]>;
  getProposal(id: string): Promise<Proposal | null>;
  getProposalByToken(token: string): Promise<Proposal | null>;
  saveProposal(p: Proposal): Promise<void>;
  deleteProposal(id: string): Promise<void>;

  listEvents(proposalId: string): Promise<ChainEvent[]>;
  listRecentEvents(limit: number): Promise<ChainEvent[]>;
  appendEvent(e: ChainEvent): Promise<void>;

  listVersions(proposalId: string): Promise<DocVersion[]>;
  saveVersion(v: DocVersion): Promise<void>;

  getViewSession(proposalId: string, sessionId: string): Promise<ViewSession | null>;
  listViewSessions(proposalId: string): Promise<ViewSession[]>;
  saveViewSession(v: ViewSession): Promise<void>;

  listTemplates(): Promise<Template[]>;
  saveTemplate(t: Template): Promise<void>;
  deleteTemplate(id: string): Promise<void>;

  listBlocks(): Promise<PricingBlock[]>;
  saveBlock(b: PricingBlock): Promise<void>;
  deleteBlock(id: string): Promise<void>;

  listDeliveries(limit: number): Promise<WebhookDelivery[]>;
  saveDelivery(d: WebhookDelivery): Promise<void>;

  /** Serialise writes that read-then-append (event chain). */
  transaction<T>(fn: () => Promise<T>): Promise<T>;
  wipe(): Promise<void>;
}
