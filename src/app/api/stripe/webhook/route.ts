import { NextResponse } from "next/server";
import { hmacSha256Hex, timingSafeEqualHex } from "@/core/crypto";
import { instance, requestCtx } from "@/server/instance";

export const dynamic = "force-dynamic";

// Registered automatically when Stripe is connected with an API key (Settings → Payments).
// Manual setup: Stripe → Developers → Webhooks → https://<your-host>/api/stripe/webhook with
// checkout.session.completed and checkout.session.async_payment_succeeded.
// Sessions carry client_reference_id=<proposal id>: Siegel sets it on Checkout Sessions and appends it to Payment Links.

async function verifyStripeSignature(payload: string, header: string | null, secret: string) {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((kv) => kv.split("=") as [string, string]));
  const t = Number(parts.t);
  if (!t || Math.abs(Date.now() / 1000 - t) > 300) return false;
  const expected = await hmacSha256Hex(secret, `${t}.${payload}`);
  return header
    .split(",")
    .filter((kv) => kv.startsWith("v1="))
    .some((kv) => timingSafeEqualHex(kv.slice(3), expected));
}

export async function POST(req: Request) {
  const { service, ready } = instance();
  await ready;
  const settings = await service.settings();
  // The env secret (manual endpoint) and the auto-registered endpoint's secret may both be in use.
  const secrets = [process.env.STRIPE_WEBHOOK_SECRET, settings.stripeWebhookSecret].filter((x): x is string => !!x);
  if (!secrets.length) return NextResponse.json({ error: "Stripe webhook secret not configured" }, { status: 503 });
  const payload = await req.text();
  const header = req.headers.get("stripe-signature");
  const valid = (await Promise.all(secrets.map((secret) => verifyStripeSignature(payload, header, secret)))).some(Boolean);
  if (!valid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }
  const event = JSON.parse(payload) as {
    type: string;
    data: { object: { id: string; client_reference_id?: string | null; amount_total?: number | null; currency?: string | null; payment_status?: string } };
  };
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const s = event.data.object;
    // Delayed methods (SEPA, bank transfer) complete as "unpaid" and succeed later via async_payment_succeeded.
    if (s.payment_status === "paid") {
      try {
        await service.stripeSessionPaid(
          { id: s.id, clientReferenceId: s.client_reference_id ?? null, amountTotal: s.amount_total ?? null, currency: s.currency ?? null },
          await requestCtx(req),
        );
      } catch (err) {
        console.error("[siegel] stripe webhook could not mark paid", err);
        // Let Stripe retry: a transient failure must not lose the payment.
        return NextResponse.json({ error: "Could not record payment" }, { status: 500 });
      }
    }
  }
  return NextResponse.json({ received: true });
}
