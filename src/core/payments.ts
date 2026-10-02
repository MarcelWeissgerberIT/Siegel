// Stripe Checkout, seen from the core. The server injects a real gateway built on the
// official SDK (src/server/stripe.ts); the static demo has none and keeps the simulated checkout.

export interface CheckoutSession {
  id: string;
  url: string | null;
  status: string | null; // "open" | "complete" | "expired"
  paymentStatus: string; // "paid" | "unpaid" | "no_payment_required"
  amountTotal: number | null; // minor units
  currency: string | null;
  clientReferenceId: string | null;
  expiresAt: number; // unix seconds
}

export interface CreateCheckoutInput {
  amountMinor: number;
  currency: string; // ISO code, any case
  productName: string;
  description: string;
  clientReferenceId: string;
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
  metadata: Record<string, string>;
}

export interface StripeGateway {
  /** Cheap authenticated call that proves the key works and may create Checkout Sessions. */
  verify(): Promise<void>;
  createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession>;
  retrieveCheckout(id: string): Promise<CheckoutSession>;
  createWebhook(url: string, events: string[]): Promise<{ id: string; secret: string }>;
  deleteWebhook(id: string): Promise<void>;
}

export type StripeFactory = (secretKey: string) => StripeGateway;

export const STRIPE_WEBHOOK_EVENTS = ["checkout.session.completed", "checkout.session.async_payment_succeeded"];

// https://docs.stripe.com/currencies#zero-decimal
const ZERO_DECIMAL = new Set(["BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA", "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF"]);

export function toMinor(amount: number, currency: string) {
  return ZERO_DECIMAL.has(currency.toUpperCase()) ? Math.round(amount) : Math.round(amount * 100);
}

export function fromMinor(amount: number, currency: string) {
  return ZERO_DECIMAL.has(currency.toUpperCase()) ? amount : amount / 100;
}

export function stripeKeyMode(key: string): "live" | "test" | null {
  const m = /^(?:sk|rk)_(live|test)_[A-Za-z0-9]+$/.exec(key.trim());
  return m ? (m[1] as "live" | "test") : null;
}

export function stripeKeyHint(key: string) {
  const k = key.trim();
  const prefix = /^(?:sk|rk)_(?:live|test)_/.exec(k)?.[0] ?? k.slice(0, 3);
  return `${prefix}…${k.slice(-4)}`;
}

/** Stripe can only deliver webhooks to a public HTTPS address. */
export function isPublicHttps(url: string) {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    const h = u.hostname;
    if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || h === "[::1]") return false;
    if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h)) return false;
    return true;
  } catch {
    return false;
  }
}
