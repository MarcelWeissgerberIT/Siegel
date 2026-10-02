"use client";

import {
  ArrowLeft,
  CheckCircle2,
  CircleDollarSign,
  Copy as CopyIcon,
  ExternalLink,
  FileStack,
  Lock,
  Mail,
  MoreHorizontal,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { asset, MODE } from "@/client/api";
import { downloadCertificate, downloadEvidence } from "@/client/download";
import { call, useData } from "@/client/hooks";
import { AuditPanel } from "@/components/audit-panel";
import { COVERS, Img } from "@/components/media";
import { ProposalEditor } from "@/components/proposal-editor";
import { useToast } from "@/components/toast";
import { Badge, Button, Card, CopyButton, Field, Hash, Input, Modal, Select, Skeleton, Spinner, StatusPill, Tabs, Textarea } from "@/components/ui";
import { dateTime, money, relative } from "@/core/format";
import { publicLink } from "@/core/service";
import { CURRENCIES, type CoverId, type Currency, type Proposal, type Tier } from "@/core/types";
import { cn } from "@/lib/cn";

function ProposalPageInner() {
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  const fresh = params.get("fresh") === "1";
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<"doc" | "audit">(params.get("tab") === "audit" ? "audit" : "doc");
  const [draft, setDraft] = useState<Proposal | null>(null);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("idle");
  const [sendOpen, setSendOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sentInfo, setSentInfo] = useState<{ link: string; version: number } | null>(null);
  const [menu, setMenu] = useState(false);
  const [tplOpen, setTplOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<Partial<Proposal>>({});
  const editingRef = useRef(false);

  const { data, loading, error, reload, setData } = useData(
    async (api) => {
      const [detail, settings, blocks, info] = await Promise.all([api.detail(id), api.getSettings(), api.listBlocks(), api.instanceInfo()]);
      return { detail, settings, blocks, info };
    },
    [id],
    { enabled: !!id, poll: MODE === "server" ? 8000 : 0 },
  );

  // Keep local editing state in sync with the server, unless the user is mid-edit.
  useEffect(() => {
    if (data && !editingRef.current) setDraft(data.detail.proposal);
  }, [data]);

  const flush = useCallback(async () => {
    if (!draft) return;
    const patch = pending.current;
    pending.current = {};
    if (!Object.keys(patch).length) return;
    setSaving("saving");
    try {
      const updated = await call((api) => api.updateProposal(draft.id, patch));
      setData((d) => (d ? { ...d, detail: { ...d.detail, proposal: updated } } : d));
      setSaving("saved");
    } catch (e) {
      toast.error("Could not save", (e as Error).message);
      setSaving("idle");
    } finally {
      editingRef.current = false;
    }
  }, [draft, setData, toast]);

  const onChange = (patch: Partial<Proposal>) => {
    if (!draft) return;
    editingRef.current = true;
    setDraft({ ...draft, ...patch, dirty: true });
    pending.current = { ...pending.current, ...patch };
    setSaving("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, 650);
  };

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  if (!id) return <p className="text-muted">Missing proposal id.</p>;
  if (error && !data)
    return (
      <Card className="p-8 text-center">
        <p className="font-medium">Proposal not found</p>
        <p className="mt-1 text-sm text-muted">{error.message}</p>
        <Button className="mt-4" onClick={() => router.push("/dashboard/")}>
          Back to dashboard
        </Button>
      </Card>
    );
  if (loading && !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-[520px] w-full" />
      </div>
    );
  }
  if (!data || !draft) return null;

  const { detail, settings, blocks, info } = data;
  const p = draft;
  const sealed = p.status === "signed" || p.status === "paid";
  const base = typeof window !== "undefined" ? `${window.location.origin}${process.env.NEXT_PUBLIC_BASE_PATH || ""}` : "";
  const link = publicLink(base, p.token);
  const generatedBy = p.generatedBy;

  async function send() {
    if (timer.current) {
      clearTimeout(timer.current);
      await flush();
    }
    setSending(true);
    try {
      const res = await call((api) => api.sendProposal(p.id));
      setSentInfo({ link: res.link, version: res.version });
      setDraft(res.proposal);
      setSendOpen(true);
      reload();
    } catch (e) {
      toast.error("Could not send", (e as Error).message);
    } finally {
      setSending(false);
    }
  }

  async function action(name: string, fn: () => Promise<unknown>, success?: string) {
    setBusy(name);
    try {
      await fn();
      if (success) toast.success(success);
      await reload();
    } catch (e) {
      toast.error("Something went wrong", (e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const certificate = () =>
    action("cert", async () => {
      const ev = await call((api) => api.evidenceById(p.id));
      await downloadCertificate(ev, settings.brand.companyName);
    });
  const evidence = () =>
    action("evidence", async () => {
      const ev = await call((api) => api.evidenceById(p.id));
      downloadEvidence(ev);
    });

  const mailto = `mailto:${encodeURIComponent(p.client.email)}?subject=${encodeURIComponent(`Proposal: ${p.title}`)}&body=${encodeURIComponent(
    `Hi ${p.client.name.split(" ")[0] || "there"},\n\nthanks again for the call. Here's the proposal we discussed. You can review it, choose a package and sign right on the page:\n\n${sentInfo?.link ?? link}\n\nHappy to walk you through it.\n\nBest,\n${settings.brand.contactName}\n${settings.brand.companyName}`,
  )}`;

  const sendLabel = p.version === 0 ? "Send to client" : p.dirty ? `Publish v${p.version + 1}` : "Share link";

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <Link href="/dashboard/" className="mb-2 inline-flex items-center gap-1 text-xs text-muted hover:text-fg">
            <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
          </Link>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{p.client.company || p.title}</h1>
            <StatusPill status={p.status} />
            {p.version > 0 && <Badge>v{p.version}</Badge>}
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs text-subtle">
            <span className="font-mono">{p.number}</span>·
            {saving === "saving" ? (
              <span className="flex items-center gap-1">
                <Spinner className="h-3 w-3" /> Saving…
              </span>
            ) : saving === "saved" ? (
              <span className="flex items-center gap-1 text-ok">
                <CheckCircle2 className="h-3 w-3" /> Saved
              </span>
            ) : (
              <span>Updated {relative(p.updatedAt)}</span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Tabs
            value={tab}
            onChange={setTab}
            items={[
              { value: "doc", label: "Document" },
              {
                value: "audit",
                label: (
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className={cn("h-3.5 w-3.5", detail.verification.valid ? "text-ok" : "text-danger")} /> Audit trail
                    <span className="text-subtle">{detail.events.length}</span>
                  </span>
                ),
              },
            ]}
          />
          <Button
            icon={<ExternalLink className="h-4 w-4" />}
            onClick={() => window.open(`${p.version && !p.dirty ? link : `${link}&preview=1`}`, "_blank")}
          >
            {p.version && !p.dirty ? "Client view" : "Preview"}
          </Button>
          {!sealed ? (
            <Button variant="primary" icon={<Send className="h-4 w-4" />} loading={sending} onClick={() => (p.version > 0 && !p.dirty ? setSendOpen(true) : send())}>
              {sendLabel}
            </Button>
          ) : p.status === "signed" ? (
            <Button
              variant="primary"
              icon={<CircleDollarSign className="h-4 w-4" />}
              loading={busy === "paid"}
              onClick={() => action("paid", () => call((api) => api.markPaid(p.id)), "Marked as paid")}
            >
              Mark deposit paid
            </Button>
          ) : null}
          <div className="relative">
            <Button variant="ghost" className="px-2" aria-label="More actions" onClick={() => setMenu((m) => !m)}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
            {menu && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setMenu(false)} />
                <div className="absolute right-0 z-40 mt-1 w-56 animate-fade-in rounded-xl border border-line bg-elev p-1 shadow-float">
                  {[
                    {
                      label: "Duplicate",
                      icon: CopyIcon,
                      run: () =>
                        action("dup", async () => {
                          const n = await call((api) => api.duplicateProposal(p.id));
                          router.push(`/proposal/?id=${n.id}`);
                        }),
                    },
                    { label: "Save as template", icon: FileStack, run: () => setTplOpen(true) },
                    ...(p.signature
                      ? [
                          { label: "Certificate (PDF)", icon: ShieldCheck, run: certificate },
                          { label: "Evidence (JSON)", icon: ShieldCheck, run: evidence },
                        ]
                      : []),
                    {
                      label: "Delete",
                      icon: Trash2,
                      danger: true,
                      run: () => {
                        if (!confirm(`Delete ${p.number}? This removes its audit trail too.`)) return;
                        action("del", async () => {
                          await call((api) => api.deleteProposal(p.id));
                          router.push("/dashboard/");
                        });
                      },
                    },
                  ].map((m) => (
                    <button
                      key={m.label}
                      onClick={() => {
                        setMenu(false);
                        m.run();
                      }}
                      className={cn("flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] hover:bg-hover", "danger" in m && m.danger ? "text-danger" : "text-fg")}
                    >
                      <m.icon className="h-4 w-4 opacity-70" /> {m.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Banners */}
      {fresh && generatedBy && tab === "doc" && !sealed && p.version === 0 && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-line bg-accent-soft px-4 py-3 text-sm">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <div>
            <span className="font-medium">Drafted from your call notes{generatedBy === "siegel-demo-drafter" ? " by the built-in demo drafter" : ` with ${generatedBy.split(":")[1] ?? generatedBy}`}.</span>{" "}
            <span className="text-muted">Click any text to edit. Changes save automatically. When it reads right, hit “Send to client”.</span>
          </div>
        </div>
      )}
      {sealed && tab === "doc" && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-line bg-sunken px-4 py-3 text-sm">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <div className="flex-1">
            <span className="font-medium">
              Sealed. Signed by {p.signature?.name} on {dateTime(p.signedAt)}.
            </span>{" "}
            <span className="text-muted">The signed version is locked and fingerprinted. Duplicate it to make changes.</span>
          </div>
          <button onClick={() => setTab("audit")} className="shrink-0 text-xs font-medium text-accent hover:underline">
            View proof →
          </button>
        </div>
      )}
      {!sealed && p.version > 0 && p.dirty && tab === "doc" && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-warn/30 bg-warn-soft px-4 py-3 text-sm">
          <span>
            <span className="font-medium">Unpublished changes.</span> <span className="text-muted">Your client still sees v{p.version}. Publish to update the link.</span>
          </span>
          <Button size="sm" onClick={send} loading={sending}>
            Publish v{p.version + 1}
          </Button>
        </div>
      )}

      {tab === "doc" ? (
        <div className="grid gap-5 xl:grid-cols-[1fr_300px]">
          <ProposalEditor
            p={p}
            onChange={onChange}
            readOnly={sealed}
            blocks={blocks}
            brandName={settings.brand.companyName}
            onSaveBlock={(t: Tier) =>
              action("block", async () => {
                const { id: _drop, ...tier } = t;
                void _drop;
                await call((api) => api.saveBlock({ tier: { ...tier, paymentLink: "" } }));
              }, `Saved “${t.name}” to your pricing library`)
            }
          />
          <aside className="space-y-4">
            <Card className="p-4">
              <h3 className="mb-3 text-[13px] font-semibold">Client</h3>
              <fieldset disabled={sealed} className="space-y-3">
                <Field label="Contact name">
                  <Input value={p.client.name} onChange={(e) => onChange({ client: { ...p.client, name: e.target.value } })} />
                </Field>
                <Field label="Company">
                  <Input value={p.client.company} onChange={(e) => onChange({ client: { ...p.client, company: e.target.value } })} />
                </Field>
                <Field label="Email">
                  <Input type="email" value={p.client.email} onChange={(e) => onChange({ client: { ...p.client, email: e.target.value } })} />
                </Field>
              </fieldset>
            </Card>
            <Card className="p-4">
              <h3 className="mb-3 text-[13px] font-semibold">Look & terms</h3>
              <fieldset disabled={sealed} className="space-y-3">
                <div>
                  <div className="mb-1.5 text-[13px] font-medium">Cover</div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(Object.keys(COVERS) as Exclude<CoverId, "none">[]).map((c) => (
                      <button
                        key={c}
                        type="button"
                        title={COVERS[c].label}
                        onClick={() => onChange({ cover: c })}
                        className={cn("relative aspect-[4/3] overflow-hidden rounded-lg ring-offset-2 ring-offset-[var(--bg-elev)] transition", p.cover === c ? "ring-2 ring-accent" : "opacity-80 hover:opacity-100")}
                      >
                        <Img name={`${COVERS[c].image}-thumb`} className="h-full w-full" />
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Currency">
                    <Select value={p.currency} onChange={(e) => onChange({ currency: e.target.value as Currency })}>
                      {CURRENCIES.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Deposit %">
                    <Input type="number" min={0} max={100} value={p.depositPercent} onChange={(e) => onChange({ depositPercent: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} />
                  </Field>
                </div>
                <Field label="Valid until">
                  <Input type="date" value={p.validUntil ?? ""} onChange={(e) => onChange({ validUntil: e.target.value || null })} />
                </Field>
              </fieldset>
            </Card>
            <Card className="p-4">
              <h3 className="text-[13px] font-semibold">Payment</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                After signing, the client is redirected to the tier&apos;s Stripe Payment Link with <code className="font-mono">client_reference_id</code> set, so the Stripe webhook marks it paid automatically.
              </p>
              <ul className="mt-3 space-y-1.5 text-xs">
                {p.tiers.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-2">
                    <span className="truncate">{t.name}</span>
                    {t.paymentLink ? <Badge tone="ok">Stripe link</Badge> : <Badge tone={MODE === "local" ? "info" : "warn"}>{MODE === "local" ? "simulated" : "no link"}</Badge>}
                  </li>
                ))}
              </ul>
              {p.depositPercent > 0 && p.tiers[0] && (
                <p className="mt-3 text-xs text-subtle">
                  Deposit on {p.tiers.find((t) => t.recommended)?.name ?? p.tiers[0].name}: {money(((p.tiers.find((t) => t.recommended) ?? p.tiers[0]).price * p.depositPercent) / 100, p.currency, { cents: true })}
                </p>
              )}
            </Card>
            {p.sourceNotes && (
              <details className="group rounded-2xl border border-line bg-elev p-4">
                <summary className="cursor-pointer text-[13px] font-semibold">Original call notes</summary>
                <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-muted">{p.sourceNotes}</p>
              </details>
            )}
          </aside>
        </div>
      ) : (
        <AuditPanel
          detail={detail}
          demo={info.demo}
          busy={busy}
          onCertificate={certificate}
          onEvidence={evidence}
          onTamper={() => action("tamper", () => call((api) => api.tamper(p.id)), "Price changed directly in storage. Watch the chain break.")}
          onRestore={() => action("restore", () => call((api) => api.restore(p.id)), "Original content restored")}
        />
      )}

      {/* Send modal */}
      <Modal
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        title={sentInfo ? `Version ${sentInfo.version} is live` : "Share the proposal"}
        description="One link. The client reviews, picks a package, signs and pays the deposit."
        footer={
          <>
            <Button variant="ghost" onClick={() => setSendOpen(false)}>
              Done
            </Button>
            <Button variant="primary" icon={<ExternalLink className="h-4 w-4" />} onClick={() => window.open(sentInfo?.link ?? link, "_blank")}>
              Open client view
            </Button>
          </>
        }
      >
        <div className="relative mb-4 overflow-hidden rounded-xl border border-line">
          <Img name={COVERS[p.cover === "none" ? "ember" : p.cover].image} className="h-24 w-full" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 to-transparent" />
          <div className="absolute inset-0 flex flex-col justify-center px-4 text-white">
            <div className="text-xs text-white/70">{p.number}</div>
            <div className="font-serif text-xl leading-tight">{p.title}</div>
          </div>
        </div>
        <div className="flex gap-2">
          <Input readOnly value={sentInfo?.link ?? link} className="font-mono text-xs" onFocus={(e) => e.target.select()} />
          <CopyButton value={sentInfo?.link ?? link} size="md" />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <a href={mailto}>
            <Button size="sm" icon={<Mail className="h-3.5 w-3.5" />}>
              Email to {p.client.name.split(" ")[0] || "client"}
            </Button>
          </a>
        </div>
        <div className="mt-4 rounded-xl bg-sunken p-3 text-xs text-muted">
          <div className="flex items-center gap-1.5 font-medium text-fg">
            <ShieldCheck className="h-3.5 w-3.5 text-ok" /> Fingerprinted
          </div>
          <p className="mt-1">
            This exact version is hashed (<Hash value={detail.versions.find((v) => v.version === p.version)?.hash} />) and recorded in the audit trail. If you edit later, the client sees the change only after you publish a new version, and the signature binds to the version they signed.
          </p>
          {MODE === "local" && (
            <p className="mt-2 text-warn">Demo mode: the link works in this browser only, since data lives in IndexedDB. Self-host Siegel to send real links.</p>
          )}
        </div>
      </Modal>

      <SaveTemplateModal key={tplOpen ? "open" : "closed"} open={tplOpen} onClose={() => setTplOpen(false)} proposal={p} />
      <link rel="prefetch" href={asset("/media/chain-break.mp4")} />
    </div>
  );
}

function SaveTemplateModal({ open, onClose, proposal }: { open: boolean; onClose: () => void; proposal: Proposal }) {
  const toast = useToast();
  const [name, setName] = useState(proposal.title);
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Save as template"
      description="Sections, timeline, tiers and terms become a reusable starting point."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await call((api) => api.saveAsTemplate(proposal.id, name, desc));
                toast.success("Template saved");
                onClose();
              } catch (e) {
                toast.error("Could not save template", (e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Save template
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Description">
          <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} placeholder="When to use this template" />
        </Field>
      </div>
    </Modal>
  );
}

export default function ProposalPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[520px] w-full" />}>
      <ProposalPageInner />
    </Suspense>
  );
}
