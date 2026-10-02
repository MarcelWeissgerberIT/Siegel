import Stripe from "stripe";
import type { CheckoutSession, StripeFactory } from "@/core/payments";
import { SiegelError } from "@/core/service";

// STRIPE_API_BASE points the SDK at stripe-mock (https://github.com/stripe/stripe-mock) for local testing.
function endpoint() {
  const base = process.env.STRIPE_API_BASE;
  if (!base) return {};
  const u = new URL(base);
  return { host: u.hostname, port: u.port || (u.protocol === "https:" ? 443 : 80), protocol: u.protocol.replace(":", "") as "http" | "https" };
}

function toSession(s: Stripe.Checkout.Session): CheckoutSession {
  return {
    id: s.id,
    url: s.url ?? null,
    status: s.status ?? null,
    paymentStatus: s.payment_status,
    amountTotal: s.amount_total ?? null,
    currency: s.currency ?? null,
    clientReferenceId: s.client_reference_id ?? null,
    expiresAt: s.expires_at,
  };
}

// Stripe's messages are written for developers and safe to show to the owner.
async function wrap<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof Stripe.errors.StripeError) {
      const status = err.statusCode === 401 || err.statusCode === 403 ? 400 : 502;
      throw new SiegelError(`Stripe: ${err.message}`, status);
    }
    throw err;
  }
}

export const createStripeGateway: StripeFactory = (secretKey) => {
  const stripe = new Stripe(secretKey, {
    maxNetworkRetries: 2,
    timeout: 20_000,
    appInfo: { name: "Siegel", url: "https://github.com/MarcelWeissgerberIT/Siegel" },
    ...endpoint(),
  });
  return {
    verify: () =>
      wrap(async () => {
        await stripe.checkout.sessions.list({ limit: 1 });
      }),
    createCheckout: (input) =>
      wrap(async () => {
        const description = input.description.slice(0, 500);
        const session = await stripe.checkout.sessions.create({
          mode: "payment",
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: input.currency.toLowerCase(),
                unit_amount: input.amountMinor,
                product_data: { name: input.productName.slice(0, 250), description: description || undefined },
              },
            },
          ],
          client_reference_id: input.clientReferenceId,
          customer_email: input.customerEmail || undefined,
          success_url: input.successUrl,
          cancel_url: input.cancelUrl,
          metadata: input.metadata,
          payment_intent_data: { description: input.productName.slice(0, 250), metadata: input.metadata },
        });
        return toSession(session);
      }),
    retrieveCheckout: (id) => wrap(async () => toSession(await stripe.checkout.sessions.retrieve(id))),
    createWebhook: (url, events) =>
      wrap(async () => {
        const hook = await stripe.webhookEndpoints.create({
          url,
          enabled_events: events as Stripe.WebhookEndpointCreateParams.EnabledEvent[],
          description: "Siegel: marks proposals paid",
          metadata: { siegel: "1" },
        });
        if (!hook.secret) {
          await stripe.webhookEndpoints.del(hook.id).catch(() => {});
          throw new SiegelError("Stripe did not return a webhook signing secret.", 502);
        }
        return { id: hook.id, secret: hook.secret };
      }),
    deleteWebhook: (id) =>
      wrap(async () => {
        await stripe.webhookEndpoints.del(id);
      }),
  };
};
