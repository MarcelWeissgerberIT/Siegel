import { NextResponse } from "next/server";
import { createSession, destroySession, isAuthed, needsSetup, rateLimited, setPassword, verifyPassword } from "@/server/auth";
import { DEMO, instance, requestCtx } from "@/server/instance";

export const dynamic = "force-dynamic";

function isHttps(req: Request) {
  const proto = req.headers.get("x-forwarded-proto") || new URL(req.url).protocol.replace(":", "");
  return proto.split(",")[0].trim() === "https";
}

export async function GET() {
  await instance().ready;
  return NextResponse.json({ authenticated: await isAuthed(), needsSetup: needsSetup(), demo: DEMO, mode: "server" });
}

export async function POST(req: Request) {
  const { action, password, newPassword } = (await req.json().catch(() => ({}))) as {
    action?: string;
    password?: string;
    newPassword?: string;
  };
  const { ip } = await requestCtx(req);
  if (action === "logout") {
    await destroySession();
    return NextResponse.json({ ok: true });
  }
  if (action === "setup") {
    if (!needsSetup()) return NextResponse.json({ error: "Already set up" }, { status: 409 });
    if (!password || password.length < 8) return NextResponse.json({ error: "Use at least 8 characters." }, { status: 400 });
    setPassword(password);
    await createSession(isHttps(req));
    return NextResponse.json({ ok: true });
  }
  if (action === "login") {
    if (rateLimited(ip)) return NextResponse.json({ error: "Too many attempts. Try again in a few minutes." }, { status: 429 });
    if (!password || !verifyPassword(password)) return NextResponse.json({ error: "Wrong password." }, { status: 401 });
    await createSession(isHttps(req));
    return NextResponse.json({ ok: true });
  }
  if (action === "change") {
    if (!(await isAuthed())) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    if (process.env.SIEGEL_PASSWORD) return NextResponse.json({ error: "The password is set via SIEGEL_PASSWORD. Change it there." }, { status: 409 });
    if (!password || !verifyPassword(password)) return NextResponse.json({ error: "Current password is wrong." }, { status: 401 });
    if (!newPassword || newPassword.length < 8) return NextResponse.json({ error: "Use at least 8 characters." }, { status: 400 });
    setPassword(newPassword);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
