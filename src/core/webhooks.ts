import { hmacSha256Hex, randomId } from "./crypto";
import type { WebhookConfig, WebhookDelivery, WebhookEvent } from "./types";

export const SIGNATURE_HEADER = "X-Siegel-Signature";

/** Signature format mirrors Stripe: t=<unix>,v1=<hex hmac of "t.body"> */
export async function signPayload(secret: string, body: string, timestamp: number): Promise<string> {
  const v1 = await hmacSha256Hex(secret, `${timestamp}.${body}`);
  return `t=${timestamp},v1=${v1}`;
}

export type Deliver = (hook: WebhookConfig, event: WebhookEvent | "test", payload: unknown) => Promise<WebhookDelivery>;

/**
 * Isomorphic delivery via fetch. On the server this is a normal signed POST.
 * In the browser demo, cross-origin endpoints without CORS headers fall back
 * to a fire-and-forget "no-cors" POST (status is then unknown).
 */
export function createFetchDeliver(opts: { browser: boolean; timeoutMs?: number }): Deliver {
  return async (hook, event, payload) => {
    const started = Date.now();
    const body = JSON.stringify(payload);
    const ts = Math.floor(started / 1000);
    const signature = await signPayload(hook.secret, body, ts);
    const delivery: WebhookDelivery = {
      id: "dlv_" + randomId(12),
      webhookId: hook.id,
      url: hook.url,
      event,
      proposalId: (payload as { proposal?: { id?: string } })?.proposal?.id ?? null,
      status: null,
      ok: false,
      error: null,
      durationMs: 0,
      at: new Date(started).toISOString(),
      payload,
    };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 8000);
    try {
      const res = await fetch(hook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Siegel-Event": event,
          [SIGNATURE_HEADER]: signature,
        },
        body,
        signal: controller.signal,
      });
      delivery.status = res.status;
      delivery.ok = res.ok;
      if (!res.ok) delivery.error = `HTTP ${res.status}`;
    } catch (err) {
      if (opts.browser) {
        try {
          await fetch(hook.url, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain" }, body, signal: controller.signal });
          delivery.ok = true;
          delivery.error = "Sent without CORS (browser demo): response not readable";
        } catch (err2) {
          delivery.error = err2 instanceof Error ? err2.message : String(err2);
        }
      } else {
        delivery.error = err instanceof Error ? err.message : String(err);
      }
    } finally {
      clearTimeout(timer);
      delivery.durationMs = Date.now() - started;
    }
    return delivery;
  };
}
