"use client";

import { CalendarDays, Check, CheckCircle2, Download, FileSignature, Lock, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { getApi, MODE } from "@/client/api";
import { downloadCertificate } from "@/client/download";
import { call } from "@/client/hooks";
import { CHANGE_EVENT } from "@/client/local-repo";
import { SealMark } from "@/components/logo";
import { Markdown } from "@/components/markdown";
import { COVERS, Img, LoopVideo } from "@/components/media";
import { SealMoment } from "@/components/seal-moment";
import { SignaturePad } from "@/components/signature-pad";
import { ThemeToggle } from "@/components/theme-toggle";
import { useToast } from "@/components/toast";
import { Input, Spinner } from "@/components/ui";
import { dateLong, money } from "@/core/format";
import { depositFor } from "@/core/service";
import type { PublicProposal } from "@/core/types";
import { cn } from "@/lib/cn";

function sessionId(token: string) {
  const key = `siegel:sid:${token}`;
  try {
    let v = sessionStorage.getItem(key);
    if (!v) {
      v = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, "0")).join("");
      sessionStorage.setItem(key, v);
    }
    return v;
  } catch {
    return "anon";
  }
}

function PublicProposalInner() {
  const params = useSearchParams();
  const token = params.get("t") ?? "";
  const preview = params.get("preview") === "1";
  const justPaid = params.get("paid") === "1";
  const router = useRouter();
  const toast = useToast();
  const [data, setData] = useState<PublicProposal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tierId, setTierId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [sig, setSig] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [signing, setSigning] = useState(false);
  const [sealed, setSealed] = useState<{ paymentUrl: string | null; simulated: boolean } | null>(null);
  const [certBusy, setCertBusy] = useState(false);
  const lastBeat = useRef(0);

  const load = async () => {
    try {
      const api = await getApi();
      const p = await api.getPublic(token, preview);
      setData(p);
      setTierId((cur) => cur ?? p.signature?.tierId ?? p.document.tiers.find((t) => t.recommended)?.id ?? p.document.tiers[0]?.id ?? null);
      setEmail((cur) => cur || p.document.client.email);
      setName((cur) => cur || p.document.client.name);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  useEffect(() => {
    if (!token) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount
    load();
    const onChange = () => load();
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => window.removeEventListener(CHANGE_EVENT, onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, preview]);

  // View tracking: one session per tab, heartbeats while the page is visible.
  useEffect(() => {
    if (!token || preview || !data) return;
    const sid = sessionId(token);
    call((api) => api.recordView(token, sid)).catch(() => {});
    lastBeat.current = Date.now();
    const beat = () => {
      const now = Date.now();
      const secs = (now - lastBeat.current) / 1000;
      lastBeat.current = now;
      if (secs > 1) call((api) => api.heartbeat(token, sid, secs)).catch(() => {});
    };
    const t = setInterval(() => document.visibilityState === "visible" && beat(), 15000);
    const onVis = () => (document.visibilityState === "hidden" ? beat() : (lastBeat.current = Date.now()));
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, preview, !!data]);

  // Waiting for Stripe's webhook after returning from checkout.
  useEffect(() => {
    if (!justPaid || !data || data.payment) return;
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [justPaid, !!data?.payment]);

  const doc = data?.document;
  const tier = doc?.tiers.find((t) => t.id === tierId) ?? null;
  const deposit = tier && doc ? depositFor(tier, doc.depositPercent) : 0;
  const brand = data?.brand.accent || "#E0442B";
  const cover = data && data.cover !== "none" ? COVERS[data.cover] : null;
  const signed = !!data?.signature;

  const sections = useMemo(() => doc?.sections.filter((s) => s.title || s.body) ?? [], [doc]);

  const problem = !token ? "This link is missing its proposal token." : error;
  if (problem)
    return (
      <div className="grid min-h-screen place-items-center px-6 text-center">
        <div className="max-w-md">
          <SealMark className="mx-auto h-12 w-12 opacity-80" />
          <h1 className="mt-5 font-serif text-3xl">Proposal unavailable</h1>
          <p className="mt-2 text-sm text-muted">{problem}</p>
          {MODE === "local" && (
            <p className="mt-4 rounded-xl bg-sunken p-3 text-xs text-muted">
              This is the static demo: proposals live in the browser that created them. Open the link in the same browser, or self-host Siegel to share links with real clients.
            </p>
          )}
        </div>
      </div>
    );
  if (!data || !doc)
    return (
      <div className="grid min-h-screen place-items-center">
        <Spinner />
      </div>
    );

  async function sign() {
    if (!tier || !data) return;
    if (!name.trim()) return toast.error("Please type your full name");
    if (!sig) return toast.error("Please draw your signature");
    if (!consent) return toast.error("Please confirm the consent checkbox");
    setSigning(true);
    try {
      const res = await call((api) => api.sign(token, { tierId: tier.id, name, email, image: sig, docHash: data.documentHash, consent }));
      setSealed({ paymentUrl: res.paymentUrl, simulated: res.simulated });
    } catch (e) {
      toast.error("Could not sign", (e as Error).message);
    } finally {
      setSigning(false);
    }
  }

  function continueAfterSeal() {
    if (sealed?.paymentUrl) window.location.href = sealed.paymentUrl;
    else if (sealed?.simulated) router.push(`/p/pay/?t=${token}`);
    else {
      setSealed(null);
      load();
    }
  }

  async function certificate() {
    setCertBusy(true);
    try {
      const ev = await call((api) => api.evidence(token));
      await downloadCertificate(ev, data!.brand.companyName);
    } catch (e) {
      toast.error("Could not create certificate", (e as Error).message);
    } finally {
      setCertBusy(false);
    }
  }

  const ctaLabel = sealed?.paymentUrl || sealed?.simulated ? `Pay ${money(deposit, doc.currency, { cents: deposit % 1 !== 0 })} deposit` : "View signed proposal";

  return (
    <div style={{ ["--brand" as string]: brand }} className="min-h-screen pb-28 lg:pb-0">
      {preview && (
        <div className="sticky top-0 z-40 bg-[var(--warn)] px-4 py-1.5 text-center text-xs font-medium text-black">
          Preview: this is exactly what your client will see. Views aren&apos;t tracked and signing is disabled.
        </div>
      )}

      {/* Hero */}
      <header className="grain relative isolate flex min-h-[78vh] flex-col overflow-hidden bg-[#0b0a09] text-white sm:min-h-[72vh]">
        {cover && (
          <div className="absolute inset-0 -z-10">
            {cover.video ? <LoopVideo name={cover.video} className="h-full w-full" /> : <Img name={cover.image} className="h-full w-full" />}
          </div>
        )}
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/55 via-black/35 to-[var(--bg)]" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/60 to-transparent" />

        <nav className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-5 sm:px-8">
          <div className="flex items-center gap-2.5">
            {data.brand.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.brand.logo} alt={data.brand.companyName} className="h-8 w-auto max-w-[140px] rounded object-contain" />
            ) : (
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--brand)] font-serif text-lg">{data.brand.companyName.slice(0, 1)}</span>
            )}
            <span className="text-sm font-medium">{data.brand.companyName}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full border border-white/15 bg-black/30 px-3 py-1 font-mono text-[11px] text-white/70 backdrop-blur sm:inline-flex" title={data.documentHash}>
              <ShieldCheck className="mr-1.5 h-3.5 w-3.5 text-[#3ccf91]" /> v{doc.version} · {data.documentHash.slice(0, 10)}…
            </span>
            <ThemeToggle className="border-white/15 bg-black/30" />
          </div>
        </nav>

        <div className="mx-auto mt-auto w-full max-w-5xl px-5 pb-14 sm:px-8 sm:pb-20">
          <div className="animate-fade-up text-xs font-medium uppercase tracking-[0.2em] text-white/70">
            Proposal for {doc.client.company || doc.client.name}
          </div>
          <h1 className="mt-4 max-w-4xl animate-fade-up font-serif text-[44px] leading-[1.02] tracking-tight [animation-delay:80ms] sm:text-[72px]">{doc.title}</h1>
          <div className="mt-7 flex animate-fade-up flex-wrap gap-x-8 gap-y-3 text-sm text-white/75 [animation-delay:160ms]">
            <span>
              <span className="block text-[11px] uppercase tracking-wider text-white/45">Prepared by</span>
              {doc.issuer.contactName}, {doc.issuer.company}
            </span>
            <span>
              <span className="block text-[11px] uppercase tracking-wider text-white/45">Prepared for</span>
              {[doc.client.name, doc.client.company].filter(Boolean).join(", ")}
            </span>
            <span>
              <span className="block text-[11px] uppercase tracking-wider text-white/45">Issued</span>
              {dateLong(doc.issuedAt)}
            </span>
            {doc.validUntil && (
              <span>
                <span className="block text-[11px] uppercase tracking-wider text-white/45">Valid until</span>
                {dateLong(doc.validUntil)}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Body */}
      <main className="mx-auto grid max-w-5xl gap-12 px-5 sm:px-8 lg:grid-cols-[1fr_260px]">
        <article className="min-w-0 py-12 sm:py-16">
          {sections.map((s, i) => (
            <section key={i} id={`s${i}`} className="mb-14 scroll-mt-8">
              <div className="mb-4 flex items-baseline gap-4">
                <span className="font-mono text-xs text-[var(--brand)]">{String(i + 1).padStart(2, "0")}</span>
                <h2 className="font-serif text-[32px] leading-tight tracking-tight sm:text-[38px]">{s.title}</h2>
              </div>
              <Markdown text={s.body} className="text-[16.5px] leading-[1.75] text-muted" />
            </section>
          ))}

          {doc.timeline.length > 0 && (
            <section id="timeline" className="mb-14 scroll-mt-8">
              <div className="mb-6 flex items-baseline gap-4">
                <span className="font-mono text-xs text-[var(--brand)]">{String(sections.length + 1).padStart(2, "0")}</span>
                <h2 className="font-serif text-[32px] leading-tight tracking-tight sm:text-[38px]">Timeline</h2>
              </div>
              <ol className="relative ml-2 border-l border-line-strong">
                {doc.timeline.map((t, i) => (
                  <li key={i} className="relative pb-8 pl-8 last:pb-0">
                    <span className="absolute -left-[7px] top-1.5 h-3.5 w-3.5 rounded-full border-2 border-[var(--brand)] bg-[var(--bg)]" />
                    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-[var(--brand)]">
                      <CalendarDays className="h-3.5 w-3.5" /> {t.duration}
                    </div>
                    <div className="mt-1 text-lg font-medium">{t.name}</div>
                    <p className="mt-1 text-[15px] leading-relaxed text-muted">{t.description}</p>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {/* Investment */}
          <section id="investment" className="mb-14 scroll-mt-8">
            <div className="mb-2 flex items-baseline gap-4">
              <span className="font-mono text-xs text-[var(--brand)]">{String(sections.length + 2).padStart(2, "0")}</span>
              <h2 className="font-serif text-[32px] leading-tight tracking-tight sm:text-[38px]">Investment</h2>
            </div>
            <p className="mb-6 text-[15px] text-muted">{signed ? "The package you selected." : "Choose the package that fits. You can sign for it right below."}</p>
            <div className={cn("grid gap-3", doc.tiers.length >= 3 ? "md:grid-cols-3" : doc.tiers.length === 2 ? "md:grid-cols-2" : "")}>
              {doc.tiers.map((t) => {
                const selected = t.id === tierId;
                const disabled = signed && data.signature?.tierId !== t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    disabled={signed}
                    onClick={() => setTierId(t.id)}
                    className={cn(
                      "relative flex flex-col rounded-2xl border bg-elev p-5 text-left transition",
                      selected ? "border-[var(--brand)] shadow-[0_0_0_4px_color-mix(in_oklab,var(--brand)_18%,transparent)]" : "border-line hover:border-line-strong",
                      disabled && "opacity-45",
                    )}
                  >
                    {t.recommended && (
                      <span className="absolute -top-2.5 left-5 rounded-full bg-[var(--brand)] px-2.5 py-0.5 text-[11px] font-medium text-white">Recommended</span>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{t.name}</span>
                      <span className={cn("grid h-5 w-5 place-items-center rounded-full border transition", selected ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-line-strong")}>
                        {selected && <Check className="h-3 w-3" />}
                      </span>
                    </div>
                    <div className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">
                      {money(t.price, doc.currency)}
                      <span className="text-sm font-normal text-subtle">{t.billing === "monthly" ? " / month" : ""}</span>
                    </div>
                    {t.description && <p className="mt-2 text-[13px] leading-relaxed text-muted">{t.description}</p>}
                    <ul className="mt-4 space-y-2 border-t border-line pt-4 text-[13.5px]">
                      {t.features.map((f, i) => (
                        <li key={i} className="flex gap-2">
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--brand)]" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </button>
                );
              })}
            </div>
            {doc.depositPercent > 0 && tier && (
              <p className="mt-4 text-sm text-muted">
                {doc.depositPercent === 100 ? "Paid upfront at signing:" : `${doc.depositPercent}% deposit due at signing:`}{" "}
                <span className="font-medium text-fg">{money(deposit, doc.currency, { cents: deposit % 1 !== 0 })}</span>
              </p>
            )}
          </section>

          {doc.terms && (
            <section className="mb-14">
              <details className="group rounded-2xl border border-line bg-elev p-5">
                <summary className="flex cursor-pointer list-none items-center justify-between font-medium">
                  Terms & conditions <span className="text-xs text-subtle transition group-open:rotate-180">▾</span>
                </summary>
                <Markdown text={doc.terms} className="mt-4 text-sm leading-relaxed text-muted" />
              </details>
            </section>
          )}

          {/* Sign / signed */}
          <section id="sign" className="scroll-mt-8">
            {signed ? (
              <SignedState data={data} justPaid={justPaid} onCertificate={certificate} certBusy={certBusy} token={token} />
            ) : (
              <div className="overflow-hidden rounded-3xl border border-line bg-elev shadow-soft">
                <div className="border-b border-line bg-sunken px-6 py-5 sm:px-8">
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-[var(--brand)]">
                    <FileSignature className="h-4 w-4" /> Accept & sign
                  </div>
                  <h2 className="mt-2 font-serif text-3xl">Ready to start?</h2>
                  <p className="mt-1 text-sm text-muted">
                    {tier ? (
                      <>
                        You&apos;re accepting <span className="font-medium text-fg">{tier.name}</span> for {money(tier.price, doc.currency)}
                        {tier.billing === "monthly" ? " per month" : ""}.
                      </>
                    ) : (
                      "Select a package above."
                    )}
                  </p>
                </div>
                <div className="space-y-4 px-6 py-6 sm:px-8">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1.5 block text-[13px] font-medium">Full name</span>
                      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" autoComplete="name" className="h-11 text-[15px]" />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-[13px] font-medium">Email</span>
                      <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@company.com" autoComplete="email" className="h-11 text-[15px]" />
                    </label>
                  </div>
                  <div>
                    <span className="mb-1.5 block text-[13px] font-medium">Signature</span>
                    <SignaturePad onChange={setSig} />
                  </div>
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-sunken p-3 text-[13px] leading-relaxed text-muted">
                    <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--brand)]" />
                    <span>
                      I agree that my typed name and drawn signature are my legally binding electronic signature, and that I have reviewed version {doc.version} of this proposal
                      (fingerprint <span className="font-mono text-[12px] text-fg">{data.documentHash.slice(0, 16)}…</span>).
                    </span>
                  </label>
                  <button
                    onClick={sign}
                    disabled={preview || signing || !tier}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand)] text-[15px] font-medium text-white shadow-[0_12px_30px_-12px_var(--brand)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {signing ? <Spinner className="text-white" /> : <Lock className="h-4 w-4" />}
                    {preview ? "Signing is disabled in preview" : deposit > 0 ? `Sign & continue to ${money(deposit, doc.currency, { cents: deposit % 1 !== 0 })} deposit` : "Sign proposal"}
                  </button>
                  <p className="flex items-center justify-center gap-1.5 text-center text-xs text-subtle">
                    <ShieldCheck className="h-3.5 w-3.5" /> Timestamp, IP and device are recorded in a tamper-evident audit trail.
                  </p>
                </div>
              </div>
            )}
          </section>
        </article>

        {/* Side rail */}
        <aside className="hidden py-16 lg:block">
          <div className="sticky top-8 space-y-4">
            <nav className="space-y-1 text-sm">
              {sections.map((s, i) => (
                <a key={i} href={`#s${i}`} className="block truncate text-muted transition hover:text-fg">
                  {s.title}
                </a>
              ))}
              {doc.timeline.length > 0 && (
                <a href="#timeline" className="block text-muted hover:text-fg">
                  Timeline
                </a>
              )}
              <a href="#investment" className="block text-muted hover:text-fg">
                Investment
              </a>
            </nav>
            {!signed && tier && (
              <div className="rounded-2xl border border-line bg-elev p-4">
                <div className="text-xs text-subtle">Selected</div>
                <div className="font-medium">{tier.name}</div>
                <div className="text-2xl font-semibold tabular-nums">{money(tier.price, doc.currency)}</div>
                <a href="#sign" className="mt-3 flex h-10 items-center justify-center gap-2 rounded-xl bg-[var(--brand)] text-sm font-medium text-white transition hover:brightness-110">
                  Review & sign
                </a>
              </div>
            )}
            <div className="rounded-2xl border border-line p-4 text-xs leading-relaxed text-subtle">
              <div className="mb-1 flex items-center gap-1.5 font-medium text-muted">
                <ShieldCheck className="h-3.5 w-3.5 text-ok" /> Verifiable document
              </div>
              Version {doc.version} · SHA-256
              <div className="mt-1 break-all font-mono text-[10.5px] text-muted">{data.documentHash}</div>
            </div>
          </div>
        </aside>
      </main>

      {/* Mobile sticky CTA */}
      {!signed && tier && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/90 p-3 backdrop-blur lg:hidden">
          <a href="#sign" className="flex h-12 items-center justify-between rounded-xl bg-[var(--brand)] px-5 text-white">
            <span className="text-sm">
              {tier.name} · <span className="font-semibold">{money(tier.price, doc.currency)}</span>
            </span>
            <span className="text-sm font-medium">Review & sign →</span>
          </a>
        </div>
      )}

      <footer className="border-t border-line py-8 text-center text-xs text-subtle">
        <span className="inline-flex items-center gap-1.5">
          <SealMark className="h-4 w-4" /> Sent with Siegel · signatures you can actually prove ·{" "}
          <Link href="/verify/" className="underline-offset-2 hover:text-fg hover:underline">
            Verify a certificate
          </Link>
        </span>
      </footer>

      {sealed && <SealMoment open hash={data.documentHash} signer={name} ctaLabel={ctaLabel} onContinue={continueAfterSeal} />}
    </div>
  );
}

function SignedState({
  data,
  justPaid,
  onCertificate,
  certBusy,
  token,
}: {
  data: PublicProposal;
  justPaid: boolean;
  onCertificate: () => void;
  certBusy: boolean;
  token: string;
}) {
  const sig = data.signature!;
  const paid = !!data.payment;
  const doc = data.document;
  const live = data.tiers.find((t) => t.id === sig.tierId);
  return (
    <div className="relative overflow-hidden rounded-3xl border border-line bg-[#0b0a09] text-white">
      <div className="absolute inset-0 opacity-60">
        <Img name="hero-seal" className="h-full w-full" />
      </div>
      <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/80 to-black/30" />
      <div className="relative p-7 sm:p-10">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-white/60">
          {paid ? <CheckCircle2 className="h-4 w-4 text-[#3ccf91]" /> : <FileSignature className="h-4 w-4 text-[var(--brand)]" />}
          {paid ? "Signed & paid" : "Signed"}
        </div>
        <h2 className="mt-3 max-w-md font-serif text-4xl leading-tight">
          {paid ? "Welcome aboard. Let's get to work." : justPaid ? "Confirming your payment…" : "Signed. One step left."}
        </h2>
        <p className="mt-3 max-w-md text-sm text-white/70">
          {sig.name} accepted <span className="text-white">{sig.tierName}</span> on {dateLong(sig.signedAt)}.{" "}
          {paid
            ? `Deposit of ${money(data.payment!.amount, doc.currency, { cents: true })} received. ${data.brand.contactName} will be in touch with next steps.`
            : justPaid
              ? "Stripe usually confirms within a few seconds."
              : `The ${money(sig.deposit, doc.currency, { cents: true })} deposit secures your start date.`}
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          {!paid && !justPaid && sig.deposit > 0 && (live?.paymentLink || data.checkoutMode === "simulated") && (
            <Link
              href={`/p/pay/?t=${token}`}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-[var(--brand)] px-5 text-sm font-medium text-white transition hover:brightness-110"
            >
              <Sparkles className="h-4 w-4" /> Pay deposit
            </Link>
          )}
          <button
            onClick={onCertificate}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-5 text-sm font-medium backdrop-blur transition hover:bg-white/20"
          >
            {certBusy ? <Spinner className="text-white" /> : <Download className="h-4 w-4" />} Certificate of Completion
          </button>
          <Link href={`/verify/?id=${data.id}`} className="inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm text-white/70 hover:text-white">
            <ShieldCheck className="h-4 w-4" /> Verify
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function PublicProposalPage() {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-screen place-items-center">
          <Spinner />
        </div>
      }
    >
      <PublicProposalInner />
    </Suspense>
  );
}
