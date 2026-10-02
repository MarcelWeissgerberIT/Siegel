// Shared domain types. Everything in src/core is isomorphic: it runs in the
// browser (GitHub Pages demo) and in Node (self-hosted server) unchanged.

export type Currency = "USD" | "EUR" | "GBP" | "CHF" | "CAD" | "AUD";
export const CURRENCIES: Currency[] = ["USD", "EUR", "GBP", "CHF", "CAD", "AUD"];

export type ProposalStatus = "draft" | "sent" | "viewed" | "signed" | "paid";
export const STATUSES: ProposalStatus[] = ["draft", "sent", "viewed", "signed", "paid"];

export type CoverId = "ember" | "ink" | "dawn" | "emerald" | "none";
export type Billing = "one-time" | "monthly";

export interface Section {
  id: string;
  title: string;
  body: string; // lightweight markdown: paragraphs, "- " bullets, **bold**
}

export interface Phase {
  id: string;
  name: string;
  duration: string;
  description: string;
}

export interface Tier {
  id: string;
  name: string;
  price: number;
  billing: Billing;
  description: string;
  features: string[];
  recommended: boolean;
  paymentLink: string; // Stripe Payment Link (optional, "" when unset)
}

export interface Client {
  name: string;
  company: string;
  email: string;
}

export interface Signature {
  name: string;
  email: string;
  tierId: string;
  tierName: string;
  amount: number;
  deposit: number;
  signedAt: string;
  image: string; // PNG data URL of the drawn signature
  imageHash: string;
  docHash: string;
  version: number;
  ip: string;
  userAgent: string;
}

export interface Payment {
  amount: number;
  currency: Currency;
  method: "stripe" | "manual" | "simulated";
  reference: string;
  paidAt: string;
}

export interface Proposal {
  id: string;
  number: string;
  title: string;
  client: Client;
  status: ProposalStatus;
  currency: Currency;
  cover: CoverId;
  sections: Section[];
  timeline: Phase[];
  tiers: Tier[];
  depositPercent: number;
  validUntil: string | null;
  terms: string;
  sourceNotes: string;
  generatedBy: string | null;
  token: string;
  version: number; // last published version (0 = never sent)
  dirty: boolean; // edited since the last published version
  createdAt: string;
  updatedAt: string;
  sentAt: string | null;
  firstViewedAt: string | null;
  signedAt: string | null;
  paidAt: string | null;
  signature: Signature | null;
  payment: Payment | null;
  stats: { views: number; seconds: number; lastViewedAt: string | null };
  tamperBackup: ProposalDocument | null; // demo only: original content while "tampered"
  /** Last Stripe Checkout Session opened for the deposit (reused while it is still open). */
  checkout?: { sessionId: string; url: string; expiresAt: string } | null;
}

/** The exact content a client sees and signs. Hashed with SHA-256 over canonical JSON. */
export interface ProposalDocument {
  schema: "siegel.proposal/v1";
  proposalId: string;
  number: string;
  version: number;
  issuedAt: string;
  title: string;
  issuer: { company: string; contactName: string; email: string; website: string; address: string };
  client: Client;
  currency: Currency;
  sections: { title: string; body: string }[];
  timeline: { name: string; duration: string; description: string }[];
  tiers: { id: string; name: string; price: number; billing: Billing; description: string; features: string[]; recommended: boolean }[];
  depositPercent: number;
  validUntil: string | null;
  terms: string;
}

export interface DocVersion {
  id: string;
  proposalId: string;
  version: number;
  hash: string;
  content: ProposalDocument;
  createdAt: string;
}

export type EventType = "created" | "sent" | "revised" | "viewed" | "signed" | "paid";

export interface ChainEvent {
  id: string;
  proposalId: string;
  seq: number;
  type: EventType;
  at: string;
  ip: string;
  userAgent: string;
  data: Record<string, unknown>;
  prevHash: string;
  hash: string;
}

export interface ViewSession {
  id: string;
  proposalId: string;
  sessionId: string;
  startedAt: string;
  lastSeenAt: string;
  seconds: number;
  ip: string;
  userAgent: string;
}

export interface Brand {
  companyName: string;
  contactName: string;
  email: string;
  website: string;
  address: string;
  tagline: string;
  logo: string | null; // data URL
  accent: string; // hex
  defaultCurrency: Currency;
  defaultDeposit: number;
  defaultTerms: string;
  defaultValidityDays: number;
}

export type AiProvider = "demo" | "anthropic" | "openai" | "openrouter";

export interface AiConfig {
  provider: AiProvider;
  model: string;
  apiKey: string;
}

export type WebhookEvent = "proposal.sent" | "proposal.viewed" | "proposal.signed" | "proposal.paid";
export const WEBHOOK_EVENTS: WebhookEvent[] = ["proposal.sent", "proposal.viewed", "proposal.signed", "proposal.paid"];

export interface WebhookConfig {
  id: string;
  url: string;
  secret: string;
  events: WebhookEvent[];
  active: boolean;
  createdAt: string;
}

export interface Settings {
  brand: Brand;
  ai: AiConfig;
  webhooks: WebhookConfig[];
  stripeWebhookSecret: string;
  /** Stripe secret or restricted key (server only). Set via connectStripe, never via updateSettings. */
  stripeSecretKey: string;
  /** Webhook endpoint Siegel registered in Stripe itself. */
  stripeWebhookEndpoint: { id: string; url: string } | null;
  publicUrl: string; // base URL used in links/certificates; "" = derive from browser
}

/** What the settings page may know about the Stripe connection (never the key itself). */
export interface StripeStatus {
  available: boolean; // false in the static demo: there is no server to hold a key
  connected: boolean;
  source: "settings" | "env" | null;
  mode: "live" | "test" | null;
  keyHint: string;
  webhook: { id: string; url: string } | null;
  webhookSecretSet: boolean;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  sections: Section[];
  timeline: Phase[];
  tiers: Tier[];
  terms: string;
  createdAt: string;
}

export interface PricingBlock {
  id: string;
  name: string;
  tier: Omit<Tier, "id">;
  createdAt: string;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  url: string;
  event: WebhookEvent | "test";
  proposalId: string | null;
  status: number | null;
  ok: boolean;
  error: string | null;
  durationMs: number;
  at: string;
  payload: unknown;
}

/** Portable, self-contained proof that can be verified anywhere by re-hashing. */
export interface EvidencePackage {
  format: "siegel.evidence/v1";
  generatedAt: string;
  proposalId: string;
  number: string;
  title: string;
  document: ProposalDocument;
  documentHash: string;
  signature: {
    name: string;
    email: string;
    tierId: string;
    tierName: string;
    amount: number;
    deposit: number;
    signedAt: string;
    image: string;
    imageHash: string;
  };
  payment: Payment | null;
  events: ChainEvent[];
  chainHead: string;
  verifyUrl: string;
}

export interface Check {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
}

export interface VerificationReport {
  valid: boolean;
  checks: Check[];
  brokenAtSeq: number | null;
  chainHead: string | null;
  eventResults: { seq: number; ok: boolean; linkOk: boolean; expected: string }[];
}

export interface PublicProposal {
  id: string;
  number: string;
  status: ProposalStatus;
  cover: CoverId;
  document: ProposalDocument;
  documentHash: string;
  brand: Pick<Brand, "companyName" | "contactName" | "email" | "website" | "logo" | "accent" | "tagline">;
  tiers: { id: string; paymentLink: boolean }[];
  signature: Omit<Signature, "image" | "ip" | "userAgent"> | null;
  payment: Payment | null;
  paymentConfigured: boolean;
  /** "server" mode can redirect to Stripe; otherwise the simulated checkout is used */
  checkoutMode: "stripe" | "simulated";
  /** Stripe is connected with an API key: a Checkout Session is created for the exact deposit. */
  stripeCheckout: boolean;
}

export interface DashboardStats {
  pipelineValue: number;
  wonValue: number;
  collected: number;
  winRate: number;
  avgHoursToSign: number | null;
  counts: Record<ProposalStatus, number>;
  sentTotal: number;
  weekly: { label: string; won: number; sent: number }[];
}

export interface ActivityItem {
  event: ChainEvent;
  proposal: { id: string; number: string; title: string; client: Client };
}
