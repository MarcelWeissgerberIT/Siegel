import { NextResponse } from "next/server";
import { PUBLIC_METHODS, type Handlers, type HandlerCtx } from "@/core/handlers";
import { SiegelError } from "@/core/service";
import { isAuthed } from "@/server/auth";
import { instance, requestCtx } from "@/server/instance";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { method?: string; args?: unknown[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { handlers, ready } = instance();
  await ready;
  const method = body.method as keyof Handlers | undefined;
  if (!method || !(method in handlers)) return NextResponse.json({ error: "Unknown method" }, { status: 404 });
  const authed = await isAuthed();
  if (!authed && !PUBLIC_METHODS.has(method)) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const ctx: HandlerCtx = { ...(await requestCtx(req)), authed };
  try {
    const fn = handlers[method] as unknown as (c: HandlerCtx, ...a: unknown[]) => Promise<unknown>;
    const result = await fn(ctx, ...(Array.isArray(body.args) ? body.args : []));
    return NextResponse.json({ result: result ?? null });
  } catch (err) {
    if (err instanceof SiegelError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error(`[siegel] ${method} failed`, err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unexpected error" }, { status: 500 });
  }
}
