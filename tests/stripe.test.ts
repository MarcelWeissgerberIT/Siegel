import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { draftToProposal } from "../src/core/ai";
import { demoDraft } from "../src/core/demo-drafter";
import { fromMinor, isPublicHttps, stripeKeyHint, stripeKeyMode, toMinor, type CheckoutSession, type CreateCheckoutInput, type StripeGateway } from "../src/core/payments";
import { SAMPLE_NOTES } from "../src/core/samples";
import { SEED_SIGNATURES } from "../src/core/seed-signatures";
import { MASK, SiegelService, type Ctx } from "../src/core/service";
import { MemoryRepo } from "./memory-repo";

const ctx: Ctx = { ip: "203.0.113.7", userAgent: "test", baseUrl: "https://proposals.agency.test" };
const KEY = "rk_test_51AbCdEfGh0123456789";

/** In-memory stand-in for Stripe that records what Siegel asked for. */
function fakeStripe() {
  const sessions = new Map<string, CheckoutSession>();
  const created: CreateCheckoutInput[] = [];
  const hooks = new Map<string, string>();
  let n = 0;
  const gateway: StripeGateway = {
    verify: async () => {},
    createCheckout: async (input) => {
      created.push(input);
      const id = `cs_test_${++n}`;
      const s: CheckoutSession = {
        id,
        url: `https://checkout.stripe.com/c/pay/${id}`,
        status: "open",
        paymentStatus: "unpaid",
        amountTotal: input.amountMinor,
        currency: input.currency.toLowerCase(),
        clientReferenceId: input.clientReferenceId,
        expiresAt: Math.floor(Date.now() / 1000) + 24 * 3600,
      };
      sessions.set(id, s);
      return s;
    },
    retrieveCheckout: async (id) => {
      const s = sessions.get(id);
      if (!s) throw new Error("No such checkout.session");
      return { ...s };
    },
    createWebhook: async (url) => {
      const id = `we_${hooks.size + 1}`;
      hooks.set(id, url);
      return { id, secret: `whsec_auto_${id}` };
    },
    deleteWebhook: async (id) => {
      hooks.delete(id);
    },
  };
  const pay = (id: string, paymentStatus = "paid") => {
    const s = sessions.get(id)!;
    sessions.set(id, { ...s, status: "complete", paymentStatus });
  };
  return { gateway, sessions, created, hooks, pay };
}

async function setup(opts: { connect?: boolean; baseUrl?: string } = {}) {
  const stripe = fakeStripe();
  const keys: string[] = [];
  const service = new SiegelService({
    repo: new MemoryRepo(),
    mode: "server",
    allowSimulatedPayments: false,
    deliver: async () => null as never,
    stripe: {
      factory: (key) => {
        keys.push(key);
        return stripe.gateway;
      },
    },
  });
  const c = { ...ctx, baseUrl: opts.baseUrl ?? ctx.baseUrl };
  if (opts.connect !== false) await service.connectStripe({ key: KEY }, c);
  const input = { notes: SAMPLE_NOTES, currency: "EUR" as const };
  const p = await service.createProposal(draftToProposal(demoDraft(input, (await service.settings()).brand), input), c);
  await service.sendProposal(p.id, c);
  const pub = await service.getPublic(p.token);
  const tier = pub.document.tiers.find((t) => t.recommended)!;
  const signed = await service.sign(
    p.token,
    { tierId: tier.id, name: "Daniel Weber", email: "daniel@example.com", image: Object.values(SEED_SIGNATURES)[0], docHash: pub.documentHash, consent: true },
    c,
  );
  return { service, stripe, p, tier, signed, keys, c };
}

describe("stripe helpers", () => {
  it("converts to minor units, including zero-decimal currencies", () => {
    assert.equal(toMinor(3750, "EUR"), 375000);
    assert.equal(toMinor(19.99, "usd"), 1999);
    assert.equal(toMinor(5000, "JPY"), 5000);
    assert.equal(fromMinor(375000, "eur"), 3750);
    assert.equal(fromMinor(5000, "jpy"), 5000);
  });
  it("recognises secret and restricted keys only", () => {
    assert.equal(stripeKeyMode("rk_live_abc123"), "live");
    assert.equal(stripeKeyMode("sk_test_abc123"), "test");
    assert.equal(stripeKeyMode("pk_live_abc123"), null);
    assert.equal(stripeKeyHint("rk_test_51AbCdEf9z"), "rk_test_…Ef9z");
  });
  it("only registers webhooks on public HTTPS URLs", () => {
    assert.equal(isPublicHttps("https://proposals.agency.com/api/stripe/webhook"), true);
    assert.equal(isPublicHttps("http://proposals.agency.com/api/stripe/webhook"), false);
    assert.equal(isPublicHttps("https://localhost:3000/api/stripe/webhook"), false);
    assert.equal(isPublicHttps("https://192.168.1.20/api/stripe/webhook"), false);
  });
});

describe("stripe checkout", () => {
  it("connects with one key, registers the webhook and never leaks the key", async () => {
    const { service, stripe } = await setup();
    const s = await service.settings();
    assert.equal(s.stripeSecretKey, KEY);
    assert.deepEqual(s.stripeWebhookEndpoint, { id: "we_1", url: "https://proposals.agency.test/api/stripe/webhook" });
    assert.equal(s.stripeWebhookSecret, "whsec_auto_we_1");
    assert.equal(stripe.hooks.get("we_1"), "https://proposals.agency.test/api/stripe/webhook");
    const masked = await service.maskedSettings();
    assert.equal(masked.stripeSecretKey, MASK);
    assert.equal(masked.stripeWebhookSecret, MASK);
    assert.ok(!JSON.stringify(masked).includes(KEY));
    assert.deepEqual({ connected: masked.stripe.connected, mode: masked.stripe.mode, source: masked.stripe.source }, { connected: true, mode: "test", source: "settings" });
    // A normal settings save can't overwrite or clear the connection.
    await service.updateSettings({ stripeSecretKey: "", stripeWebhookEndpoint: null, publicUrl: "https://x.test" });
    assert.equal((await service.settings()).stripeSecretKey, KEY);
  });

  it("skips webhook registration on a local address but still connects", async () => {
    const { service, stripe } = await setup({ connect: false, baseUrl: "http://localhost:3000" });
    const r = await service.connectStripe({ key: KEY }, { ...ctx, baseUrl: "http://localhost:3000" });
    assert.match(r.warning ?? "", /public HTTPS/);
    assert.equal(r.settings.stripe.connected, true);
    assert.equal(stripe.hooks.size, 0);
  });

  it("rejects publishable and malformed keys", async () => {
    const { service } = await setup({ connect: false });
    await assert.rejects(service.connectStripe({ key: "pk_test_123" }, ctx), /publishable/);
    await assert.rejects(service.connectStripe({ key: "hello" }, ctx), /secret key/);
  });

  it("creates a checkout for exactly the signed deposit and confirms on return", async () => {
    const { service, stripe, p, signed } = await setup();
    assert.equal(signed.checkout, true);
    assert.equal(signed.paymentUrl, null);
    const pub = await service.getPublic(p.token);
    assert.equal(pub.stripeCheckout, true);
    assert.equal(pub.paymentConfigured, true);

    const c = await service.checkout(p.token, ctx);
    assert.equal(c.url, "https://checkout.stripe.com/c/pay/cs_test_1");
    const req = stripe.created[0];
    assert.equal(req.amountMinor, Math.round(signed.deposit * 100));
    assert.equal(req.currency, "EUR");
    assert.equal(req.clientReferenceId, p.id);
    assert.equal(req.customerEmail, "daniel@example.com");
    assert.equal(req.successUrl, `https://proposals.agency.test/p/?t=${p.token}&paid=1&session_id={CHECKOUT_SESSION_ID}`);
    assert.equal(req.cancelUrl, `https://proposals.agency.test/p/?t=${p.token}`);
    assert.match(req.productName, /^Deposit · SG-\d+ · /);

    // A reload reuses the open session instead of creating a second one.
    assert.equal((await service.checkout(p.token, ctx)).url, c.url);
    assert.equal(stripe.created.length, 1);

    // Not paid yet: nothing changes.
    assert.deepEqual(await service.confirmCheckout(p.token, "cs_test_1", ctx), { paid: false, processing: false });

    stripe.pay("cs_test_1");
    assert.deepEqual(await service.confirmCheckout(p.token, "cs_test_1", ctx), { paid: true, processing: false });
    const after = (await service.detail(p.id)).proposal;
    assert.equal(after.status, "paid");
    assert.deepEqual({ method: after.payment?.method, ref: after.payment?.reference, amount: after.payment?.amount }, { method: "stripe", ref: "cs_test_1", amount: signed.deposit });
    assert.equal((await service.detail(p.id)).verification.valid, true);

    // The webhook arriving afterwards is a no-op.
    await service.stripeSessionPaid({ id: "cs_test_1", clientReferenceId: p.id, amountTotal: 1, currency: "eur" }, ctx);
    assert.equal((await service.detail(p.id)).events.filter((e) => e.type === "paid").length, 1);
  });

  it("refuses a session that belongs to another proposal", async () => {
    const a = await setup();
    const other = await a.service.createProposal({ title: "Other" }, ctx);
    const s = await a.stripe.gateway.createCheckout({
      amountMinor: 50,
      currency: "eur",
      productName: "Other",
      description: "",
      clientReferenceId: other.id,
      customerEmail: "",
      successUrl: "https://x.test",
      cancelUrl: "https://x.test",
      metadata: {},
    });
    a.stripe.pay(s.id);
    await assert.rejects(a.service.confirmCheckout(a.p.token, s.id, ctx), /different proposal/);
    assert.equal((await a.service.detail(a.p.id)).proposal.payment, null);
  });

  it("treats delayed payment methods as processing until Stripe confirms", async () => {
    const { service, stripe, p } = await setup();
    await service.checkout(p.token, ctx);
    stripe.pay("cs_test_1", "unpaid"); // e.g. SEPA debit: session complete, money not there yet
    assert.deepEqual(await service.confirmCheckout(p.token, "cs_test_1", ctx), { paid: false, processing: true });
    assert.equal((await service.checkout(p.token, ctx)).processing, true);
    assert.equal(stripe.created.length, 1);
    // async_payment_succeeded via webhook
    assert.equal(await service.stripeSessionPaid({ id: "cs_test_1", clientReferenceId: p.id, amountTotal: null, currency: null }, ctx), true);
    assert.equal((await service.detail(p.id)).proposal.status, "paid");
  });

  it("ignores webhook sessions that aren't Siegel's", async () => {
    const { service } = await setup();
    assert.equal(await service.stripeSessionPaid({ id: "cs_x", clientReferenceId: null, amountTotal: 100, currency: "eur" }, ctx), false);
    assert.equal(await service.stripeSessionPaid({ id: "cs_y", clientReferenceId: "order_42", amountTotal: 100, currency: "eur" }, ctx), false);
  });

  it("disconnect removes the key and the webhook it registered", async () => {
    const { service, stripe, p } = await setup();
    await service.disconnectStripe();
    const s = await service.settings();
    assert.equal(s.stripeSecretKey, "");
    assert.equal(s.stripeWebhookEndpoint, null);
    assert.equal(s.stripeWebhookSecret, "");
    assert.equal(stripe.hooks.size, 0);
    // Falls back to Payment Links / invoice: no checkout URL without a key or link.
    const c = await service.checkout(p.token, ctx);
    assert.equal(c.url, null);
    assert.equal(c.simulated, false);
  });

  it("uses STRIPE_SECRET_KEY from the environment", async () => {
    const service = new SiegelService({
      repo: new MemoryRepo(),
      mode: "server",
      allowSimulatedPayments: false,
      deliver: async () => null as never,
      stripe: { factory: () => fakeStripe().gateway, envKey: "sk_live_abc123" },
    });
    const st = (await service.maskedSettings()).stripe;
    assert.deepEqual({ connected: st.connected, source: st.source, mode: st.mode }, { connected: true, source: "env", mode: "live" });
  });
});
