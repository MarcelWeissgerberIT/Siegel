"use client";

import { ArrowRight, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { LoopVideo } from "./media";

/**
 * The moment of signing: the Higgsfield stamp-press clip plays full screen while
 * the document fingerprint "types" in, then hands over to payment.
 */
export function SealMoment({
  open,
  hash,
  signer,
  ctaLabel,
  onContinue,
}: {
  open: boolean;
  hash: string;
  signer: string;
  ctaLabel: string;
  onContinue: () => void;
}) {
  const [typed, setTyped] = useState(0);
  const [showCta, setShowCta] = useState(false);
  useEffect(() => {
    if (!open) return;
    const start = setTimeout(() => {
      const t = setInterval(() => setTyped((n) => (n >= hash.length ? (clearInterval(t), n) : n + 2)), 28);
    }, 1500);
    const cta = setTimeout(() => setShowCta(true), 3600);
    return () => {
      clearTimeout(start);
      clearTimeout(cta);
    };
  }, [open, hash]);
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[70] flex animate-fade-in items-center justify-center bg-[#070605] p-4 text-white">
      <div className="grid w-full max-w-4xl items-center gap-8 md:grid-cols-2">
        <div className="relative mx-auto aspect-square w-full max-w-[420px] overflow-hidden rounded-3xl shadow-[0_40px_120px_-30px_rgba(224,68,43,0.55)]">
          <LoopVideo name="seal-press" loop={false} className="h-full w-full" />
          <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-inset ring-white/10" />
        </div>
        <div className="text-center md:text-left">
          <div className="flex items-center justify-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-white/50 md:justify-start">
            <ShieldCheck className="h-4 w-4 text-[#3ccf91]" /> Signature recorded
          </div>
          <h2 className="mt-4 font-serif text-5xl leading-none sm:text-6xl">Sealed.</h2>
          <p className="mt-4 text-white/70">
            Thank you, {signer.split(" ")[0]}. Your signature is bound to this exact version of the proposal by its SHA-256 fingerprint:
          </p>
          <p className="mt-3 break-all rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left font-mono text-[13px] leading-6 text-[#ffb59f]">
            {hash.slice(0, typed)}
            <span className={cn("inline-block w-2", typed < hash.length ? "animate-pulse bg-[#ffb59f]" : "")}>&nbsp;</span>
          </p>
          <div className={cn("mt-8 transition duration-700", showCta ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0")}>
            <button
              onClick={onContinue}
              className="inline-flex h-12 items-center gap-2 rounded-xl bg-[var(--brand,#E0442B)] px-6 text-[15px] font-medium text-white shadow-[0_10px_30px_-10px_rgba(224,68,43,0.8)] transition hover:brightness-110"
            >
              {ctaLabel} <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
