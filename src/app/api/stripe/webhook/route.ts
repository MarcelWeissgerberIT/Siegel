import { NextResponse } from "next/server";
import { hmacSha256Hex, timingSafeEqualHex } from "@/core/crypto";
import { instance, requestCtx } from "@/server/instance";

export const dynamic = "force-dynamic";

// Configure in Stripe: Developers → Webhooks → endpoint https://<your-host>/api/stripe/webhook
// Events: checkout.session.completed (and checkout.session.async_payment_succeeded).
// Payment Links carry ?client_reference_id=<proposal id>, which Siegel appends automatically.

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
  const secret = process.env.STRIPE_WEBHOOK_SECRET || settings.stripeWebhookSecret;
  if (!secret) return NextResponse.json({ error: "Stripe webhook secret not configured" }, { status: 503 });
  const payload = await req.text();
  if (!(await verifyStripeSignature(payload, req.headers.get("stripe-signature"), secret))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }
  const event = JSON.parse(payload) as {
    type: string;
    data: { object: { id: string; client_reference_id?: string; amount_total?: number; payment_status?: string } };
  };
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const s = event.data.object;
    if (s.client_reference_id && s.payment_status === "paid") {
      const ctx = await requestCtx(req);
      try {
        await service.markPaid(s.client_reference_id, { method: "stripe", reference: s.id, amount: (s.amount_total ?? 0) / 100 || undefined }, ctx);
      } catch (err) {
        console.error("[siegel] stripe webhook could not mark paid", err);
      }
    }
  }
  return NextResponse.json({ received: true });
}
