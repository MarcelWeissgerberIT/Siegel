"use client";

import { CheckCircle2, FileUp, RotateCcw, Search, ShieldAlert, ShieldCheck, Skull, XCircle } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { call } from "@/client/hooks";
import { Logo } from "@/components/logo";
import { LoopVideo } from "@/components/media";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button, Card, Hash, Input } from "@/components/ui";
import { EVENT_LABELS, verifyEvidence } from "@/core/chain";
import { dateTime, isoUtc, money } from "@/core/format";
import type { EvidencePackage, VerificationReport } from "@/core/types";
import { cn } from "@/lib/cn";

interface Result {
  source: string;
  report: VerificationReport;
  evidence?: EvidencePackage;
  summary?: { number: string; title: string; signedBy: string | null; signedAt: string | null; docHash: string | null; chainHead: string | null };
}

function VerifyInner() {
  const params = useSearchParams();
  const [result, setResult] = useState<Result | null>(null);
  const [original, setOriginal] = useState<EvidencePackage | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [lookup, setLookup] = useState(params.get("id") ?? "");
  const [revealed, setRevealed] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const show = (r: Result) => {
    setResult(r);
    setRevealed(0);
    r.report.checks.forEach((_, i) => setTimeout(() => setRevealed(i + 1), 350 + i * 280));
  };

  const verifyFile = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      let ev: EvidencePackage | null = null;
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (file.name.toLowerCase().endsWith(".pdf") || (bytes[0] === 0x25 && bytes[1] === 0x50)) {
        const { extractEvidenceFromPdf } = await import("@/core/certificate");
        ev = await extractEvidenceFromPdf(bytes);
        if (!ev) throw new Error("This PDF doesn't contain a Siegel evidence package.");
      } else {
        ev = JSON.parse(new TextDecoder().decode(bytes));
        if (ev?.format !== "siegel.evidence/v1") throw new Error("Not a Siegel evidence file.");
      }
      setOriginal(ev);
      show({ source: file.name, evidence: ev, report: await verifyEvidence(ev!) });
    } catch (e) {
      setError((e as Error).message);
      setResult(null);
    } finally {
      setBusy(false);
    }
  };

  const verifyId = useCallback(async (id: string) => {
    if (!id.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await call((api) => api.verifyById(id.trim()));
      setOriginal(null);
      show({ source: `Record ${res.summary.number} on this Siegel instance`, report: res.report, summary: res.summary });
    } catch (e) {
      setError((e as Error).message);
      setResult(null);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const id = params.get("id");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- verify the record named in the URL on load
    if (id) verifyId(id);
  }, [params, verifyId]);

  const tamper = async () => {
    if (!original) return;
    const forged: EvidencePackage = structuredClone(original);
    const t = forged.document.tiers.find((x) => x.id === forged.signature.tierId) ?? forged.document.tiers[0];
    t.price = Math.round(t.price * 1.5);
    show({ source: `${result?.source} (edited: ${t.name} price changed to ${money(t.price, forged.document.currency)})`, evidence: forged, report: await verifyEvidence(forged) });
  };

  const valid = result?.report.valid;
  const ev = result?.evidence;

  return (
    <div className="min-h-screen">
      <header className="relative isolate overflow-hidden border-b border-line bg-[#0a0908] text-white">
        <div className="absolute inset-0 -z-10">
          {result && !valid ? <LoopVideo key={result.source} name="chain-break" loop={false} className="h-full w-full" /> : <LoopVideo name="chain-loop" className="h-full w-full opacity-80" />}
          <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-black/20" />
        </div>
        <nav className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5 sm:px-8">
          <Link href="/" className="[&_span]:text-white">
            <Logo />
          </Link>
          <ThemeToggle className="border-white/15 bg-black/30" />
        </nav>
        <div className="mx-auto max-w-5xl px-5 pb-16 pt-10 sm:px-8 sm:pb-20">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-white/60">
            <ShieldCheck className="h-4 w-4 text-[#3ccf91]" /> Independent verification
          </div>
          <h1 className="mt-4 max-w-2xl font-serif text-5xl leading-[1.02] sm:text-6xl">Prove what was signed, when, and that nothing changed.</h1>
          <p className="mt-4 max-w-xl text-white/70">
            Drop a Siegel Certificate of Completion. Your browser re-hashes the embedded document, signature and every audit event. No account, no upload, no trust in any server required.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
        <div className="grid gap-4 md:grid-cols-[1fr_320px]">
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              const f = e.dataTransfer.files[0];
              if (f) verifyFile(f);
            }}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition",
              drag ? "border-accent bg-accent-soft" : "border-line-strong hover:border-accent hover:bg-hover",
            )}
          >
            <input ref={fileRef} type="file" accept=".pdf,.json,application/pdf,application/json" className="hidden" onChange={(e) => e.target.files?.[0] && verifyFile(e.target.files[0])} />
            <FileUp className="h-8 w-8 text-accent" />
            <p className="mt-3 font-medium">{busy ? "Verifying…" : "Drop a certificate PDF or evidence JSON"}</p>
            <p className="mt-1 text-sm text-muted">or click to choose a file · stays on your device</p>
          </label>
          <Card className="p-5">
            <p className="text-sm font-medium">Look up a record</p>
            <p className="mt-1 text-xs text-muted">Check the live audit trail stored on this Siegel instance by proposal ID.</p>
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                verifyId(lookup);
              }}
            >
              <Input value={lookup} onChange={(e) => setLookup(e.target.value)} placeholder="prp_…" className="font-mono text-xs" />
              <Button type="submit" icon={<Search className="h-4 w-4" />} loading={busy && !!lookup} aria-label="Verify record" />
            </form>
          </Card>
        </div>

        {error && (
          <div className="mt-6 flex items-center gap-2 rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
            <XCircle className="h-4 w-4" /> {error}
          </div>
        )}

        {result && (
          <div className="mt-8 animate-fade-up">
            <div
              className={cn(
                "flex flex-col gap-4 rounded-2xl border p-6 sm:flex-row sm:items-center sm:justify-between",
                valid ? "border-ok/30 bg-ok-soft" : "border-danger/40 bg-danger-soft",
              )}
            >
              <div className="flex items-start gap-4">
                {valid ? <ShieldCheck className="h-10 w-10 shrink-0 text-ok" /> : <ShieldAlert className="h-10 w-10 shrink-0 text-danger" />}
                <div>
                  <h2 className="text-xl font-semibold tracking-tight">{valid ? "Authentic and unchanged" : "Verification failed: the record was altered"}</h2>
                  <p className="mt-0.5 text-sm text-muted">{result.source}</p>
                </div>
              </div>
              {original &&
                (result.evidence === original ? (
                  <Button icon={<Skull className="h-4 w-4" />} onClick={tamper}>
                    Try tampering with it
                  </Button>
                ) : (
                  <Button icon={<RotateCcw className="h-4 w-4" />} onClick={async () => show({ source: result.source.replace(/ \(edited.*\)$/, ""), evidence: original, report: await verifyEvidence(original) })}>
                    Undo edit
                  </Button>
                ))}
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_360px]">
              <Card className="p-6">
                <h3 className="text-sm font-semibold">Checks</h3>
                <ul className="mt-4 space-y-4">
                  {result.report.checks.map((c, i) => (
                    <li key={c.id} className={cn("flex gap-3 transition duration-500", i < revealed ? "opacity-100" : "translate-y-1 opacity-0")}>
                      {c.ok ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-ok" /> : <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-danger" />}
                      <div>
                        <div className="text-sm font-medium">{c.label}</div>
                        <div className="text-[13px] text-muted">{c.detail}</div>
                      </div>
                    </li>
                  ))}
                </ul>
                {ev && (
                  <div className="mt-8">
                    <h3 className="text-sm font-semibold">Audit trail</h3>
                    <ol className="mt-3 space-y-1.5">
                      {ev.events.map((e) => {
                        const r = result.report.eventResults.find((x) => x.seq === e.seq);
                        const ok = r ? r.ok && r.linkOk : false;
                        return (
                          <li key={e.id} className="grid grid-cols-[28px_1fr_auto] items-center gap-2 rounded-lg bg-sunken px-3 py-2 text-[13px]">
                            <span className="font-mono text-xs text-subtle">#{e.seq}</span>
                            <span>
                              {EVENT_LABELS[e.type]} <span className="text-xs text-subtle">· {isoUtc(e.at)} · {e.ip}</span>
                            </span>
                            <span className="flex items-center gap-1.5">
                              <Hash value={e.hash} n={8} />
                              {ok ? <CheckCircle2 className="h-3.5 w-3.5 text-ok" /> : <XCircle className="h-3.5 w-3.5 text-danger" />}
                            </span>
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                )}
              </Card>
              <div className="space-y-4">
                <Card className="p-5">
                  <h3 className="text-sm font-semibold">Record</h3>
                  <dl className="mt-3 space-y-2 text-[13px]">
                    <div className="flex justify-between gap-3"><dt className="text-subtle">Proposal</dt><dd className="truncate text-right">{ev?.number ?? result.summary?.number}</dd></div>
                    <div><dt className="text-subtle">Title</dt><dd className="mt-0.5">{ev?.title ?? result.summary?.title}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-subtle">Signed by</dt><dd>{ev?.signature.name ?? result.summary?.signedBy ?? "—"}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-subtle">Signed at</dt><dd>{dateTime(ev?.signature.signedAt ?? result.summary?.signedAt)}</dd></div>
                    {ev && (
                      <div className="flex justify-between gap-3"><dt className="text-subtle">Package</dt><dd>{ev.signature.tierName}</dd></div>
                    )}
                    <div className="flex justify-between gap-3"><dt className="text-subtle">Document</dt><dd><Hash value={ev?.documentHash ?? result.summary?.docHash} /></dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-subtle">Chain head</dt><dd><Hash value={result.report.chainHead} /></dd></div>
                  </dl>
                  {ev?.signature.image && (
                    <div className="mt-4 rounded-xl border border-line bg-white p-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={ev.signature.image} alt="Signature" className="mx-auto max-h-16" />
                    </div>
                  )}
                </Card>
                <Card className="p-5 text-[13px] text-muted">
                  <h3 className="text-sm font-semibold text-fg">Verify it yourself</h3>
                  <p className="mt-2">The certificate embeds <code className="font-mono text-xs">siegel-evidence.json</code>. Canonicalise <code className="font-mono text-xs">.document</code> (sorted keys, no whitespace) and SHA-256 it:</p>
                  <pre className="mt-2 overflow-x-auto rounded-lg bg-sunken p-3 font-mono text-[11px] leading-5 text-fg">{`const c = v => v===null||typeof v!=="object"
  ? JSON.stringify(v)
  : Array.isArray(v) ? "["+v.map(c)+"]"
  : "{"+Object.keys(v).sort().map(k=>
      JSON.stringify(k)+":"+c(v[k])).join(",")+"}";
sha256(c(evidence.document)) === evidence.documentHash`}</pre>
                </Card>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense>
      <VerifyInner />
    </Suspense>
  );
}
