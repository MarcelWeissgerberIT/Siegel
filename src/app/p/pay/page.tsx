"use client";

import { ArrowLeft, CreditCard, FlaskConical, Lock } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { call } from "@/client/hooks";
import { Spinner } from "@/components/ui";
import { money } from "@/core/format";
import type { ApiResult } from "@/core/handlers";

type Checkout = ApiResult<"checkout">;

// Demo checkout for the static build. Real installs redirect to the tier's Stripe Payment Link.
function PayInner() {
  const token = useSearchParams().get("t") ?? "";
  const router = useRouter();
  const [info, setInfo] = useState<Checkout | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    call((api) => api.checkout(token))
      .then((c) => {
        if (c.paid) router.replace(`/p/?t=${token}`);
        else if (c.url) window.location.href = c.url;
        else if (!c.simulated) setError("Your agency will send you an invoice for the deposit.");
        else setInfo(c);
      })
      .catch((e) => setError((e as Error).message));
  }, [token, router]);

  if (error)
    return (
      <div className="grid min-h-screen place-items-center px-6 text-center">
        <div>
          <p className="text-sm text-muted">{error}</p>
          <Link href={`/p/?t=${token}`} className="mt-4 inline-block text-sm font-medium text-accent">
            Back to proposal
          </Link>
        </div>
      </div>
    );
  if (!info)
    return (
      <div className="grid min-h-screen place-items-center">
        <Spinner />
      </div>
    );

  const amount = money(info.deposit, info.currency, { cents: true });

  return (
    <div className="min-h-screen bg-bg" style={{ ["--brand" as string]: info.accent }}>
      <div className="bg-warn px-4 py-2 text-center text-xs font-medium text-black">
        <FlaskConical className="mr-1 inline h-3.5 w-3.5" /> Demo checkout: no real payment is made. In production, clients go to your Stripe Payment Link.
      </div>
      <div className="mx-auto grid max-w-5xl gap-0 md:min-h-[calc(100vh-32px)] md:grid-cols-2">
        <div className="px-6 py-10 md:px-12 md:py-16">
          <Link href={`/p/?t=${token}`} className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
            <ArrowLeft className="h-4 w-4" /> {info.company}
          </Link>
          <p className="mt-10 text-sm text-muted">Deposit for {info.tierName}</p>
          <p className="mt-1 text-5xl font-semibold tracking-tight tabular-nums">{amount}</p>
          <div className="mt-8 space-y-3 border-t border-line pt-6 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">{info.title}</span>
              <span className="font-mono text-xs text-subtle">{info.number}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Package</span>
              <span>{info.tierName}</span>
            </div>
            <div className="flex justify-between border-t border-line pt-3 font-medium">
              <span>Due today</span>
              <span className="tabular-nums">{amount}</span>
            </div>
          </div>
        </div>
        <div className="border-line bg-elev px-6 py-10 md:border-l md:px-12 md:py-16">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setPaying(true);
              try {
                await call((api) => api.simulatePayment(token));
                await new Promise((r) => setTimeout(r, 900));
                router.replace(`/p/?t=${token}&paid=1`);
              } catch (err) {
                setError((err as Error).message);
                setPaying(false);
              }
            }}
            className="space-y-4"
          >
            <h2 className="text-lg font-semibold">Pay with card</h2>
            <label className="block text-sm">
              <span className="mb-1 block text-muted">Email</span>
              <input defaultValue={info.email} className="h-11 w-full rounded-lg border border-line-strong bg-bg px-3 outline-none focus:border-[var(--brand)]" />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-muted">Card information</span>
              <div className="overflow-hidden rounded-lg border border-line-strong">
                <div className="flex items-center gap-2 border-b border-line-strong bg-bg px-3">
                  <CreditCard className="h-4 w-4 text-subtle" />
                  <input defaultValue="4242 4242 4242 4242" className="h-11 flex-1 bg-transparent font-mono outline-none" />
                </div>
                <div className="grid grid-cols-2 bg-bg">
                  <input defaultValue="12 / 34" className="h-11 border-r border-line-strong bg-transparent px-3 font-mono outline-none" />
                  <input defaultValue="123" className="h-11 bg-transparent px-3 font-mono outline-none" />
                </div>
              </div>
            </label>
            <button
              disabled={paying}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand)] text-[15px] font-medium text-white transition hover:brightness-110 disabled:opacity-60"
            >
              {paying ? <Spinner className="text-white" /> : <Lock className="h-4 w-4" />} Pay {amount}
            </button>
            <p className="text-center text-xs text-subtle">Simulated payment. It records a “paid” event in the audit trail and fires the proposal.paid webhook.</p>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function PayPage() {
  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center"><Spinner /></div>}>
      <PayInner />
    </Suspense>
  );
}
