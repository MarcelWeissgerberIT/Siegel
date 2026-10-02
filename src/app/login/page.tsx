"use client";

import { ArrowRight, KeyRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { auth, MODE, type SessionInfo } from "@/client/api";
import { Logo } from "@/components/logo";
import { LoopVideo } from "@/components/media";
import { Button, Input } from "@/components/ui";

function LoginInner() {
  const router = useRouter();
  const [info, setInfo] = useState<SessionInfo | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (MODE === "local") {
      router.replace("/dashboard/");
      return;
    }
    auth.session().then((s) => {
      if (s.authenticated) router.replace("/dashboard/");
      else setInfo(s);
    });
  }, [router]);

  const setup = info?.needsSetup;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (setup && password !== confirm) return setError("Passwords don't match.");
    setBusy(true);
    try {
      await auth.action(setup ? "setup" : "login", { password });
      router.replace("/dashboard/");
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.1fr]">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Logo />
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <h1 className="font-serif text-4xl leading-tight">{setup ? "Make it yours." : "Welcome back."}</h1>
          <p className="mt-2 text-sm text-muted">
            {setup ? "Siegel is single-user and self-hosted. Choose the password that protects your workspace." : "Sign in to your Siegel workspace."}
          </p>
          <form onSubmit={submit} className="mt-8 space-y-3">
            <Input type="password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} placeholder={setup ? "New password (8+ characters)" : "Password"} className="h-11" />
            {setup && <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repeat password" className="h-11" />}
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy || !info} icon={<KeyRound className="h-4 w-4" />}>
              {setup ? "Create workspace" : "Sign in"} <ArrowRight className="h-4 w-4" />
            </Button>
          </form>
          {info?.demo && !setup && (
            <p className="mt-4 rounded-xl bg-sunken p-3 text-xs text-muted">
              Demo instance: the password is <code className="font-mono text-fg">demo</code> unless SIEGEL_PASSWORD is set.
            </p>
          )}
        </div>
        <p className="text-xs text-subtle">Your data stays on your server. SQLite, one container, no vendor lock-in.</p>
      </div>
      <div className="relative hidden overflow-hidden bg-[#0a0908] lg:block">
        <LoopVideo name="wax-drop" className="absolute inset-0 h-full w-full" rate={0.8} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
        <div className="absolute inset-x-0 bottom-0 p-12 text-white">
          <p className="max-w-md font-serif text-4xl leading-tight">“From call notes to signed and paid in under five minutes.”</p>
          <p className="mt-3 text-sm text-white/60">Proposals, e-signatures, deposits and automations, in one place you own.</p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}
