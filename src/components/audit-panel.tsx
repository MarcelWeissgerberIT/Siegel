"use client";

import { CheckCircle2, CircleDollarSign, Download, Eye, FileJson, FilePlus2, FileSignature, FileText, Link2, RotateCcw, Send, ShieldAlert, ShieldCheck, Skull, XCircle } from "lucide-react";
import { EVENT_LABELS } from "@/core/chain";
import { dateTime, deviceFromUA, duration, isoUtc, money } from "@/core/format";
import type { ApiResult } from "@/core/handlers";
import type { ChainEvent, EventType } from "@/core/types";
import { cn } from "@/lib/cn";
import { LoopVideo } from "./media";
import { Badge, Button, Card, Hash } from "./ui";

type Detail = ApiResult<"detail">;

const ICON: Record<EventType, typeof Send> = {
  created: FilePlus2,
  sent: Send,
  revised: FileText,
  viewed: Eye,
  signed: FileSignature,
  paid: CircleDollarSign,
};

function eventSummary(e: ChainEvent, currency: string) {
  const d = e.data as Record<string, string | number | null>;
  switch (e.type) {
    case "created":
      return d.source === "ai" ? `Drafted with AI (${d.generatedBy})` : d.source === "template" ? "Created from template" : "Created";
    case "sent":
      return `Version ${d.version} published${d.recipient ? ` for ${d.recipient}` : ""}`;
    case "revised":
      return `Version ${d.version} replaces the previous version`;
    case "viewed":
      return `Opened version ${d.version}`;
    case "signed":
      return `${d.signerName} signed “${d.tierName}” · ${money(Number(d.amount), currency as "USD")}`;
    case "paid":
      return `${money(Number(d.amount), currency as "USD", { cents: true })} via ${d.method}`;
  }
}

export function AuditPanel({
  detail,
  demo,
  busy,
  onTamper,
  onRestore,
  onCertificate,
  onEvidence,
}: {
  detail: Detail;
  demo: boolean;
  busy: string | null;
  onTamper: () => void;
  onRestore: () => void;
  onCertificate: () => void;
  onEvidence: () => void;
}) {
  const { proposal: p, events, versions, views, verification: v } = detail;
  const results = new Map(v.eventResults.map((r) => [r.seq, r]));
  const sorted = [...events].sort((a, b) => b.seq - a.seq);

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        {/* Verification hero */}
        <div className={cn("relative overflow-hidden rounded-2xl border", v.valid ? "border-line" : "border-danger")}>
          <div className="absolute inset-0">
            {v.valid ? (
              <LoopVideo name="chain-loop" className="h-full w-full opacity-70" />
            ) : (
              <LoopVideo key="break" name="chain-break" loop={false} className="h-full w-full" />
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/70 to-black/20" />
          </div>
          <div className="relative p-6 text-white sm:p-8">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-white/60">
              {v.valid ? <ShieldCheck className="h-4 w-4 text-[#3ccf91]" /> : <ShieldAlert className="h-4 w-4 text-[#ff6b6b]" />}
              Tamper-evident audit trail
            </div>
            <h2 className="mt-3 max-w-lg font-serif text-3xl leading-tight sm:text-4xl">
              {v.valid ? (p.signature ? "Sealed. Nothing has changed since signing." : "Chain intact. Every event verified.") : "Tampering detected. The chain is broken."}
            </h2>
            <ul className="mt-5 max-w-xl space-y-2">
              {v.checks.map((c) => (
                <li key={c.id} className="flex gap-2.5 text-sm">
                  {c.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#3ccf91]" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#ff6b6b]" />}
                  <span>
                    <span className="font-medium">{c.label}</span>
                    <span className="block text-xs text-white/60">{c.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
            {p.signature && (
              <div className="mt-6 flex flex-wrap gap-2">
                <Button size="sm" variant="primary" icon={<Download className="h-3.5 w-3.5" />} onClick={onCertificate} loading={busy === "cert"}>
                  Certificate of Completion (PDF)
                </Button>
                <Button size="sm" className="border-white/20 bg-white/10 text-white hover:bg-white/20" icon={<FileJson className="h-3.5 w-3.5" />} onClick={onEvidence}>
                  Evidence JSON
                </Button>
                {demo &&
                  (p.tamperBackup ? (
                    <Button size="sm" className="border-white/20 bg-white/10 text-white hover:bg-white/20" icon={<RotateCcw className="h-3.5 w-3.5" />} onClick={onRestore} loading={busy === "restore"}>
                      Restore original
                    </Button>
                  ) : (
                    <Button size="sm" className="border-white/20 bg-white/10 text-white hover:bg-white/20" icon={<Skull className="h-3.5 w-3.5" />} onClick={onTamper} loading={busy === "tamper"}>
                      Tamper test: edit the price in the database
                    </Button>
                  ))}
              </div>
            )}
          </div>
        </div>

        {/* Chain */}
        <Card className="p-5 sm:p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">Hash-chained event log</h3>
              <p className="text-xs text-subtle">Each event hashes its content plus the previous hash. Newest first.</p>
            </div>
            <Badge tone={v.brokenAtSeq === null ? "ok" : "danger"}>{v.brokenAtSeq === null ? `${events.length} verified` : `broken at #${v.brokenAtSeq}`}</Badge>
          </div>
          <ol className="relative">
            {sorted.map((e, i) => {
              const r = results.get(e.seq);
              const ok = r ? r.ok && r.linkOk : true;
              const Icon = ICON[e.type];
              return (
                <li key={e.id} className="relative flex gap-4 pb-6 last:pb-0">
                  {i < sorted.length - 1 && <span className="absolute left-[17px] top-9 h-[calc(100%-28px)] w-px bg-gradient-to-b from-line-strong to-line" />}
                  <span
                    className={cn(
                      "relative z-10 grid h-9 w-9 shrink-0 place-items-center rounded-full border",
                      !ok ? "border-danger bg-danger-soft text-danger" : e.type === "signed" || e.type === "paid" ? "border-transparent bg-accent text-accent-fg" : "border-line-strong bg-elev text-muted",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <div className="text-sm font-medium">
                        <span className="mr-2 font-mono text-xs text-subtle">#{e.seq}</span>
                        {EVENT_LABELS[e.type]}
                      </div>
                      <div className="text-xs text-subtle" title={isoUtc(e.at)}>
                        {dateTime(e.at)}
                      </div>
                    </div>
                    <div className="mt-0.5 text-[13px] text-muted">{eventSummary(e, p.currency)}</div>
                    <div className="mt-2 grid gap-1 rounded-lg bg-sunken px-3 py-2 text-[11px] text-subtle sm:grid-cols-2">
                      <span className="truncate">
                        IP <span className="font-mono text-muted">{e.ip}</span>
                      </span>
                      <span className="truncate">{deviceFromUA(e.userAgent)}</span>
                      <span className="flex items-center gap-1.5">
                        hash <Hash value={e.hash} n={12} className={ok ? "text-fg" : "text-danger"} />
                        {ok ? <CheckCircle2 className="h-3 w-3 text-ok" /> : <XCircle className="h-3 w-3 text-danger" />}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Link2 className="h-3 w-3" /> prev <Hash value={e.prevHash} n={8} />
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </Card>
      </div>

      <div className="space-y-4">
        {p.signature && (
          <Card className="p-5">
            <h3 className="text-sm font-semibold">Signature</h3>
            <div className="mt-3 rounded-xl border border-line bg-white p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {p.signature.image ? <img src={p.signature.image} alt={`Signature of ${p.signature.name}`} className="mx-auto max-h-20" /> : null}
            </div>
            <dl className="mt-3 space-y-1.5 text-[13px]">
              <div className="flex justify-between gap-3"><dt className="text-subtle">Signed by</dt><dd className="truncate font-medium">{p.signature.name}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-subtle">Email</dt><dd className="truncate">{p.signature.email || "—"}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-subtle">Package</dt><dd>{p.signature.tierName} · {money(p.signature.amount, p.currency)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-subtle">Deposit</dt><dd>{money(p.signature.deposit, p.currency, { cents: true })} {p.payment ? <Badge tone="ok">paid</Badge> : <Badge tone="warn">pending</Badge>}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-subtle">When</dt><dd>{dateTime(p.signature.signedAt)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-subtle">Document</dt><dd><Hash value={p.signature.docHash} /></dd></div>
            </dl>
          </Card>
        )}

        <Card className="p-5">
          <div className="flex items-baseline justify-between">
            <h3 className="text-sm font-semibold">Engagement</h3>
            <span className="text-xs text-subtle">{p.stats.views} opens · {duration(p.stats.seconds)} total</span>
          </div>
          {views.length === 0 ? (
            <p className="mt-3 text-[13px] text-muted">{p.version ? "Not opened yet. You'll see each visit here, live." : "Send the proposal to start tracking."}</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {views.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 rounded-lg bg-sunken px-3 py-2 text-[13px]">
                  <div className="min-w-0">
                    <div className="truncate">{deviceFromUA(s.userAgent)}</div>
                    <div className="text-xs text-subtle">{dateTime(s.startedAt)} · {s.ip}</div>
                  </div>
                  <span className="shrink-0 font-medium tabular-nums">{duration(s.seconds)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-semibold">Published versions</h3>
          {versions.length === 0 ? (
            <p className="mt-3 text-[13px] text-muted">Nothing published yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {[...versions].reverse().map((ver) => (
                <li key={ver.id} className="flex items-center justify-between gap-3 text-[13px]">
                  <span>
                    <span className="font-medium">v{ver.version}</span> <span className="text-xs text-subtle">{dateTime(ver.createdAt)}</span>
                    {p.signature?.version === ver.version && <Badge tone="accent" className="ml-2">signed</Badge>}
                  </span>
                  <Hash value={ver.hash} n={8} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
