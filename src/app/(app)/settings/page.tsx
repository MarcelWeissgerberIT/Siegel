"use client";

import { Bot, Building2, CheckCircle2, CreditCard, Database, Download, Eye, ImageUp, KeyRound, Plus, RefreshCw, Send, Trash2, Webhook, XCircle } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { auth, baseUrl, MODE } from "@/client/api";
import { downloadBlob } from "@/client/download";
import { call, useData } from "@/client/hooks";
import { PageHeader } from "@/components/app-shell";
import { useToast } from "@/components/toast";
import { Badge, Button, Card, CopyButton, Field, Input, Select, Skeleton, Switch, Textarea } from "@/components/ui";
import { randomId } from "@/core/crypto";
import { DEFAULT_MODELS } from "@/core/defaults";
import { dateTime } from "@/core/format";
import { CURRENCIES, WEBHOOK_EVENTS, type AiProvider, type Settings, type StripeStatus, type WebhookConfig } from "@/core/types";
import { cn } from "@/lib/cn";

type Tab = "brand" | "ai" | "payments" | "webhooks" | "data";
type S = Settings & { hasApiKey: boolean; stripe: StripeStatus };

const TABS: { id: Tab; label: string; icon: typeof Bot }[] = [
  { id: "brand", label: "Brand profile", icon: Building2 },
  { id: "ai", label: "AI provider", icon: Bot },
  { id: "payments", label: "Payments", icon: CreditCard },
  { id: "webhooks", label: "Webhooks", icon: Webhook },
  { id: "data", label: "Data & account", icon: Database },
];

const PROVIDERS: { id: AiProvider; name: string; blurb: string; models: string[] }[] = [
  { id: "anthropic", name: "Anthropic", blurb: "Claude. Best writing quality.", models: ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-4-5"] },
  { id: "openai", name: "OpenAI", blurb: "GPT models via your key.", models: ["gpt-5.1", "gpt-5", "gpt-5-mini"] },
  { id: "openrouter", name: "OpenRouter", blurb: "Any model, one key.", models: ["anthropic/claude-opus-5.5", "anthropic/claude-sonnet-5.5", "openai/gpt-5.1"] },
  { id: "demo", name: "Demo drafter", blurb: "Offline, no key. Heuristic.", models: ["siegel-demo-drafter"] },
];

async function fileToLogo(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  const img = new Image();
  await new Promise((r, j) => {
    img.onload = r;
    img.onerror = j;
    img.src = url;
  });
  const scale = Math.min(1, 320 / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  URL.revokeObjectURL(url);
  return c.toDataURL("image/png");
}

function StripeCard({ status, onChange }: { status: StripeStatus; onChange: (s: S) => void }) {
  const toast = useToast();
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState<"connect" | "webhook" | "disconnect" | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  async function connect(withKey: boolean) {
    setBusy(withKey ? "connect" : "webhook");
    try {
      const r = await call((api) => api.connectStripe(withKey ? key : undefined));
      onChange(r.settings);
      setWarning(r.warning);
      setKey("");
      toast.success(r.message);
    } catch (e) {
      toast.error("Could not connect Stripe", (e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function disconnect() {
    setBusy("disconnect");
    try {
      onChange(await call((api) => api.disconnectStripe()));
      setWarning(null);
      toast.success("Stripe disconnected");
    } catch (e) {
      toast.error("Could not disconnect", (e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-semibold">Stripe Checkout</h2>
        {status.connected ? (
          <Badge tone={status.mode === "live" ? "ok" : "warn"}>
            <CheckCircle2 className="h-3 w-3" /> Connected · {status.mode === "live" ? "live" : "test mode"}
          </Badge>
        ) : (
          <Badge>Recommended</Badge>
        )}
      </div>
      <p className="mt-1 text-sm text-muted">
        Paste one key. Every signature opens a Stripe Checkout for the exact deposit, and Siegel marks the proposal paid on its own. Card, Apple Pay, Google Pay
        and SEPA, whatever your Stripe account offers.
      </p>

      {!status.available ? (
        <p className="mt-5 rounded-xl bg-info-soft p-3 text-xs text-info">
          The browser demo has no server that could keep a secret key, so it uses a simulated checkout. Self-host Siegel to connect your Stripe account.
        </p>
      ) : status.connected ? (
        <div className="mt-5 space-y-4">
          <dl className="grid gap-3 rounded-xl border border-line bg-sunken p-4 text-sm sm:grid-cols-[120px_1fr]">
            <dt className="text-subtle">Key</dt>
            <dd className="font-mono text-xs">
              {status.keyHint}
              {status.source === "env" && <span className="ml-2 font-sans text-subtle">from STRIPE_SECRET_KEY</span>}
            </dd>
            <dt className="text-subtle">Webhook</dt>
            <dd className="min-w-0">
              {status.webhook ? (
                <span className="flex items-center gap-1.5 text-xs">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-ok" />
                  <span className="truncate font-mono">{status.webhook.url}</span>
                </span>
              ) : (
                <span className="text-xs text-muted">
                  {status.webhookSecretSet ? "Added manually (signing secret saved)." : "Not registered. Payments still confirm when the client returns from checkout."}
                </span>
              )}
            </dd>
          </dl>
          {status.mode === "test" && (
            <p className="text-xs text-muted">
              Test mode: pay with card <span className="font-mono">4242 4242 4242 4242</span>, any future date, any CVC. Switch to a live key when you&apos;re ready.
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            {status.source === "settings" && (
              <Button variant="danger" loading={busy === "disconnect"} onClick={disconnect}>
                Disconnect
              </Button>
            )}
            <Button variant="secondary" loading={busy === "webhook"} icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={() => connect(false)}>
              {status.webhook ? "Re-check" : "Register webhook"}
            </Button>
          </div>
        </div>
      ) : (
        <form
          className="mt-5 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            connect(true);
          }}
        >
          <p className="text-sm text-muted">
            In Stripe → Developers →{" "}
            <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noreferrer" className="font-medium text-accent hover:underline">
              API keys
            </a>
            , create a <span className="text-fg">restricted key</span> with write access to <span className="text-fg">Checkout Sessions</span> and{" "}
            <span className="text-fg">Webhook Endpoints</span>. Your secret key works too.
          </p>
          <div className="flex gap-2">
            <Input
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="rk_live_… or rk_test_…"
              autoComplete="off"
              className="font-mono text-xs"
            />
            <Button variant="primary" type="submit" loading={busy === "connect"} disabled={!key.trim()} icon={<KeyRound className="h-3.5 w-3.5" />}>
              Connect
            </Button>
          </div>
          <p className="text-xs text-subtle">The key stays on your server. Siegel registers its webhook in your Stripe account automatically.</p>
        </form>
      )}
      {warning && <p className="mt-4 rounded-xl bg-warn-soft p-3 text-xs text-warn">{warning}</p>}
    </Card>
  );
}

function SettingsInner() {
  const params = useSearchParams();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>((params.get("tab") as Tab) || "brand");
  const [edit, setS] = useState<S | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [aiStatus, setAiStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const { data, reload } = useData(async (api) => {
    const [settings, deliveries, info] = await Promise.all([api.getSettings(), api.deliveries(), api.instanceInfo()]);
    return { settings, deliveries, info };
  }, [], { poll: 0 });

  const s = edit ?? data?.settings ?? null;

  if (!s || !data)
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-60" />
        <Skeleton className="h-96 w-full" />
      </div>
    );

  const brand = s.brand;
  const setBrand = (b: Partial<S["brand"]>) => setS({ ...s, brand: { ...brand, ...b } });

  async function save(patch?: Partial<Settings>, quiet = false) {
    setSaving(true);
    try {
      const next = await call((api) => api.updateSettings(patch ?? { brand: s!.brand, ai: s!.ai, webhooks: s!.webhooks, stripeWebhookSecret: s!.stripeWebhookSecret, publicUrl: s!.publicUrl }));
      setS(next);
      if (!quiet) toast.success("Settings saved");
      reload();
    } catch (e) {
      toast.error("Could not save", (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const webhookUrl = `${s.publicUrl || baseUrl()}/api/stripe/webhook`;

  return (
    <div className="animate-fade-in">
      <PageHeader title="Settings" subtitle="Your brand, your AI key, your payments. Everything stays on your instance." />
      <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
        <nav className="scrollbar-none flex gap-1 overflow-x-auto lg:flex-col">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex h-9 shrink-0 items-center gap-2 rounded-[10px] px-3 text-sm transition",
                tab === t.id ? "bg-hover font-medium text-fg" : "text-muted hover:bg-hover hover:text-fg",
              )}
            >
              <t.icon className={cn("h-4 w-4", tab === t.id && "text-accent")} /> {t.label}
            </button>
          ))}
        </nav>

        <div className="min-w-0 space-y-4">
          {tab === "brand" && (
            <Card className="p-6">
              <h2 className="text-base font-semibold">Brand profile</h2>
              <p className="mt-1 text-sm text-muted">Shown on every proposal page and certificate.</p>
              <div className="mt-6 flex items-center gap-4">
                <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-sunken">
                  {brand.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={brand.logo} alt="Logo" className="h-full w-full object-contain p-1.5" />
                  ) : (
                    <span className="font-serif text-2xl" style={{ color: brand.accent }}>
                      {brand.companyName.slice(0, 1)}
                    </span>
                  )}
                </div>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (f) setBrand({ logo: await fileToLogo(f) });
                    }}
                  />
                  <span className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line-strong px-3 text-[13px] font-medium hover:bg-hover">
                    <ImageUp className="h-3.5 w-3.5" /> Upload logo
                  </span>
                </label>
                {brand.logo && (
                  <Button size="sm" variant="ghost" onClick={() => setBrand({ logo: null })}>
                    Remove
                  </Button>
                )}
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <Field label="Company name">
                  <Input value={brand.companyName} onChange={(e) => setBrand({ companyName: e.target.value })} />
                </Field>
                <Field label="Your name">
                  <Input value={brand.contactName} onChange={(e) => setBrand({ contactName: e.target.value })} />
                </Field>
                <Field label="Email">
                  <Input value={brand.email} onChange={(e) => setBrand({ email: e.target.value })} />
                </Field>
                <Field label="Website">
                  <Input value={brand.website} onChange={(e) => setBrand({ website: e.target.value })} />
                </Field>
                <Field label="Tagline">
                  <Input value={brand.tagline} onChange={(e) => setBrand({ tagline: e.target.value })} />
                </Field>
                <Field label="Address">
                  <Input value={brand.address} onChange={(e) => setBrand({ address: e.target.value })} />
                </Field>
              </div>
              <div className="mt-6">
                <div className="mb-1.5 text-[13px] font-medium">Brand color</div>
                <div className="flex flex-wrap items-center gap-2">
                  {["#E0442B", "#C2410C", "#B45309", "#15803D", "#0F766E", "#2563EB", "#6D28D9", "#BE185D", "#18181B"].map((c) => (
                    <button
                      key={c}
                      onClick={() => setBrand({ accent: c })}
                      className={cn("h-8 w-8 rounded-full ring-offset-2 ring-offset-[var(--bg-elev)] transition", brand.accent.toLowerCase() === c.toLowerCase() && "ring-2 ring-fg")}
                      style={{ background: c }}
                      aria-label={`Use ${c}`}
                    />
                  ))}
                  <Input type="color" value={brand.accent} onChange={(e) => setBrand({ accent: e.target.value })} className="h-8 w-12 cursor-pointer p-1" />
                </div>
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <Field label="Default currency">
                  <Select value={brand.defaultCurrency} onChange={(e) => setBrand({ defaultCurrency: e.target.value as S["brand"]["defaultCurrency"] })}>
                    {CURRENCIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Default deposit %">
                  <Input type="number" min={0} max={100} value={brand.defaultDeposit} onChange={(e) => setBrand({ defaultDeposit: Number(e.target.value) || 0 })} />
                </Field>
                <Field label="Valid for (days)">
                  <Input type="number" min={1} value={brand.defaultValidityDays} onChange={(e) => setBrand({ defaultValidityDays: Number(e.target.value) || 14 })} />
                </Field>
              </div>
              <Field label="Default terms" hint="Markdown: “- ” bullets, **bold**" className="mt-6">
                <Textarea rows={8} value={brand.defaultTerms} onChange={(e) => setBrand({ defaultTerms: e.target.value })} className="font-mono text-xs leading-5" />
              </Field>
              <div className="mt-6 flex justify-end">
                <Button variant="primary" loading={saving} onClick={() => save({ brand })}>
                  Save brand
                </Button>
              </div>
            </Card>
          )}

          {tab === "ai" && (
            <Card className="p-6">
              <h2 className="text-base font-semibold">AI provider</h2>
              <p className="mt-1 text-sm text-muted">
                Bring your own key. {MODE === "server" ? "It's stored on your server and never sent to the browser." : "In the browser demo it's stored in this browser only and sent straight to the provider."}
              </p>
              <div className="mt-6 grid gap-2 sm:grid-cols-2">
                {PROVIDERS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setAiStatus(null);
                      setS({ ...s, ai: { ...s.ai, provider: p.id, model: p.id === s.ai.provider ? s.ai.model : DEFAULT_MODELS[p.id] } });
                    }}
                    className={cn(
                      "rounded-xl border p-4 text-left transition",
                      s.ai.provider === p.id ? "border-accent bg-accent-soft" : "border-line hover:border-line-strong",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{p.name}</span>
                      {s.ai.provider === p.id && <CheckCircle2 className="h-4 w-4 text-accent" />}
                    </div>
                    <div className="mt-0.5 text-xs text-muted">{p.blurb}</div>
                  </button>
                ))}
              </div>
              {s.ai.provider !== "demo" && (
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <Field label="Model" hint="any model ID works">
                    <Input list="models" value={s.ai.model} onChange={(e) => setS({ ...s, ai: { ...s.ai, model: e.target.value } })} className="font-mono text-xs" />
                    <datalist id="models">
                      {PROVIDERS.find((p) => p.id === s.ai.provider)?.models.map((m) => (
                        <option key={m} value={m} />
                      ))}
                    </datalist>
                  </Field>
                  <Field label="API key" hint={s.hasApiKey ? "saved" : undefined}>
                    <Input
                      type="password"
                      value={s.ai.apiKey}
                      onChange={(e) => setS({ ...s, ai: { ...s.ai, apiKey: e.target.value } })}
                      placeholder={s.ai.provider === "anthropic" ? "sk-ant-…" : s.ai.provider === "openrouter" ? "sk-or-…" : "sk-…"}
                      className="font-mono text-xs"
                    />
                  </Field>
                </div>
              )}
              {aiStatus && (
                <div className={cn("mt-4 flex items-center gap-2 rounded-xl px-3 py-2 text-sm", aiStatus.ok ? "bg-ok-soft text-ok" : "bg-danger-soft text-danger")}>
                  {aiStatus.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />} {aiStatus.message}
                </div>
              )}
              <div className="mt-6 flex justify-end gap-2">
                <Button
                  loading={testing}
                  onClick={async () => {
                    setTesting(true);
                    try {
                      setAiStatus(await call((api) => api.testAi(s.ai)));
                    } catch (e) {
                      setAiStatus({ ok: false, message: (e as Error).message });
                    } finally {
                      setTesting(false);
                    }
                  }}
                >
                  Test connection
                </Button>
                <Button variant="primary" loading={saving} onClick={() => save({ ai: s.ai })}>
                  Save
                </Button>
              </div>
            </Card>
          )}

          {tab === "payments" && (
            <div className="space-y-6">
              <StripeCard
                status={s.stripe}
                onChange={(next) => {
                  setS(next);
                  reload();
                }}
              />
              <Card className="p-6">
                <h2 className="text-base font-semibold">Payment Links</h2>
                {s.stripe.connected ? (
                  <p className="mt-1 text-sm text-muted">
                    Not needed while Stripe is connected: every signature gets its own checkout for the exact deposit, so links on tiers are ignored.
                  </p>
                ) : (
                  <>
                    <p className="mt-1 text-sm text-muted">No API key? Use one Stripe Payment Link per package and a webhook instead.</p>
                    <ol className="mt-6 space-y-5 text-sm">
                      <li className="flex gap-3">
                        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent-soft font-mono text-xs font-semibold text-accent">1</span>
                        <div>
                          <div className="font-medium">Create a Payment Link per package</div>
                          <p className="mt-0.5 text-muted">In Stripe → Payment Links, create a link for each deposit amount and paste it into the tier in the proposal editor.</p>
                        </div>
                      </li>
                      <li className="flex gap-3">
                        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent-soft font-mono text-xs font-semibold text-accent">2</span>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium">Add the webhook endpoint</div>
                          <p className="mt-0.5 text-muted">
                            Stripe → Developers → Webhooks → Add endpoint, event <code className="font-mono text-xs">checkout.session.completed</code>.
                          </p>
                          <div className="mt-2 flex gap-2">
                            <Input readOnly value={webhookUrl} className="font-mono text-xs" />
                            <CopyButton value={webhookUrl} size="md" />
                          </div>
                        </div>
                      </li>
                      <li className="flex gap-3">
                        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent-soft font-mono text-xs font-semibold text-accent">3</span>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium">Paste the signing secret</div>
                          <p className="mt-0.5 text-muted">
                            Siegel verifies every webhook and marks the proposal paid via its <code className="font-mono text-xs">client_reference_id</code>.
                          </p>
                          <Input
                            type="password"
                            value={s.stripeWebhookSecret}
                            onChange={(e) => setS({ ...s, stripeWebhookSecret: e.target.value })}
                            placeholder="whsec_…"
                            className="mt-2 font-mono text-xs"
                          />
                        </div>
                      </li>
                    </ol>
                  </>
                )}
                <Field label="Public URL" hint="used in client links, Stripe redirects, the webhook and certificates" className="mt-6">
                  <Input value={s.publicUrl} onChange={(e) => setS({ ...s, publicUrl: e.target.value.replace(/\/$/, "") })} placeholder={baseUrl()} className="font-mono text-xs" />
                </Field>
                {MODE === "local" && (
                  <p className="mt-4 rounded-xl bg-info-soft p-3 text-xs text-info">This static demo has no server, so payments use a clearly labelled simulated checkout. Self-host Siegel to take real payments.</p>
                )}
                <div className="mt-6 flex justify-end">
                  <Button variant="primary" loading={saving} onClick={() => save({ stripeWebhookSecret: s.stripeWebhookSecret, publicUrl: s.publicUrl })}>
                    Save
                  </Button>
                </div>
              </Card>
            </div>
          )}

          {tab === "webhooks" && (
            <>
              <Card className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-base font-semibold">Outgoing webhooks</h2>
                    <p className="mt-1 text-sm text-muted">Kick off onboarding in n8n, Make or Zapier the moment a proposal is viewed, signed or paid. Payloads are signed with HMAC-SHA256.</p>
                  </div>
                  <Button
                    icon={<Plus className="h-4 w-4" />}
                    onClick={() =>
                      setS({
                        ...s,
                        webhooks: [
                          ...s.webhooks,
                          { id: "wh_" + randomId(10), url: "", secret: "", events: ["proposal.signed", "proposal.paid"], active: true, createdAt: new Date().toISOString() },
                        ],
                      })
                    }
                  >
                    Add endpoint
                  </Button>
                </div>
                <div className="mt-6 space-y-3">
                  {s.webhooks.length === 0 && <p className="rounded-xl bg-sunken p-4 text-sm text-muted">No endpoints yet. Add your n8n / Make / Zapier webhook URL.</p>}
                  {s.webhooks.map((w, i) => (
                    <WebhookRow
                      key={w.id}
                      w={w}
                      onChange={(nw) => setS({ ...s, webhooks: s.webhooks.map((x, j) => (j === i ? nw : x)) })}
                      onDelete={() => setS({ ...s, webhooks: s.webhooks.filter((_, j) => j !== i) })}
                      onTest={async () => {
                        await save({ webhooks: s.webhooks }, true);
                        try {
                          const d = await call((api) => api.testWebhook(w.id));
                          if (d.ok) toast.success("Test delivered", d.error ?? `HTTP ${d.status}`);
                          else toast.error("Delivery failed", d.error ?? "");
                        } catch (e) {
                          toast.error("Delivery failed", (e as Error).message);
                        }
                        reload();
                      }}
                    />
                  ))}
                </div>
                <div className="mt-6 flex justify-end">
                  <Button variant="primary" loading={saving} onClick={() => save({ webhooks: s.webhooks })}>
                    Save webhooks
                  </Button>
                </div>
              </Card>
              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Recent deliveries</h3>
                  <Button size="sm" variant="ghost" icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={reload}>
                    Refresh
                  </Button>
                </div>
                {data.deliveries.length === 0 ? (
                  <p className="mt-3 text-sm text-muted">Nothing delivered yet.</p>
                ) : (
                  <ul className="mt-3 divide-y divide-line">
                    {data.deliveries.map((d) => (
                      <li key={d.id} className="flex items-center justify-between gap-3 py-2.5 text-[13px]">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            {d.ok ? <CheckCircle2 className="h-3.5 w-3.5 text-ok" /> : <XCircle className="h-3.5 w-3.5 text-danger" />}
                            <span className="font-mono text-xs">{d.event}</span>
                          </div>
                          <div className="truncate text-xs text-subtle">{d.url}</div>
                        </div>
                        <div className="shrink-0 text-right text-xs text-subtle">
                          <div>{d.status ?? "—"} · {d.durationMs}ms</div>
                          <div>{dateTime(d.at)}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              <Card className="p-6">
                <h3 className="text-sm font-semibold">Payload example</h3>
                <pre className="mt-3 overflow-x-auto rounded-xl bg-sunken p-4 font-mono text-[11.5px] leading-5">{`POST /your-webhook
X-Siegel-Event: proposal.signed
X-Siegel-Signature: t=1767225600,v1=<hmac_sha256(secret, t + "." + body)>

{
  "event": "proposal.signed",
  "proposal": { "id": "prp_…", "number": "SG-1004", "title": "…",
                "status": "signed", "value": 9500, "currency": "USD",
                "client": { "name": "…", "company": "…", "email": "…" },
                "url": "https://…/p/?t=…" },
  "data": { "tier": { "name": "Growth", "price": 9500 }, "deposit": 4750,
            "signer": { "name": "…", "email": "…" }, "docHash": "9f2c…" }
}`}</pre>
              </Card>
            </>
          )}

          {tab === "data" && (
            <div className="space-y-4">
              <Card className="p-6">
                <h2 className="text-base font-semibold">Your data</h2>
                <p className="mt-1 text-sm text-muted">
                  {MODE === "server" ? "Everything lives in one SQLite file in your data volume. Export it any time, no lock-in." : "In this demo, everything lives in your browser's IndexedDB."}
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Button
                    icon={<Download className="h-4 w-4" />}
                    onClick={async () => {
                      const dump = await call((api) => api.exportAll());
                      downloadBlob(JSON.stringify(dump, null, 2), `siegel-export-${new Date().toISOString().slice(0, 10)}.json`, "application/json");
                    }}
                  >
                    Export everything (JSON)
                  </Button>
                  {data.info.demo && (
                    <Button
                      variant="danger"
                      icon={<RefreshCw className="h-4 w-4" />}
                      onClick={async () => {
                        if (!confirm("Reset the demo workspace? All proposals are replaced with fresh sample data.")) return;
                        await call((api) => api.resetDemo());
                        setS(null);
                        reload();
                        toast.success("Demo workspace reset");
                      }}
                    >
                      Reset demo data
                    </Button>
                  )}
                </div>
              </Card>
              {MODE === "server" && <PasswordCard />}
              <Card className="p-6">
                <h3 className="text-sm font-semibold">Instance</h3>
                <dl className="mt-3 grid gap-2 text-[13px] sm:grid-cols-2">
                  <div><dt className="text-subtle">Mode</dt><dd>{MODE === "server" ? "Self-hosted server · SQLite" : "Static demo · IndexedDB"}</dd></div>
                  <div><dt className="text-subtle">Demo features</dt><dd>{data.info.demo ? <Badge tone="warn">enabled</Badge> : <Badge tone="ok">off</Badge>}</dd></div>
                </dl>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function WebhookRow({ w, onChange, onDelete, onTest }: { w: WebhookConfig; onChange: (w: WebhookConfig) => void; onDelete: () => void; onTest: () => void }) {
  const [secret, setSecret] = useState<string | null>(null);
  return (
    <div className="rounded-xl border border-line p-4">
      <div className="flex items-center gap-3">
        <Switch checked={w.active} onChange={(active) => onChange({ ...w, active })} label="Active" />
        <Input value={w.url} onChange={(e) => onChange({ ...w, url: e.target.value.trim() })} placeholder="https://your-n8n.example.com/webhook/…" className="font-mono text-xs" />
        <Button size="sm" variant="ghost" icon={<Send className="h-3.5 w-3.5" />} onClick={onTest} disabled={!w.url}>
          Test
        </Button>
        <button onClick={onDelete} className="rounded-md p-1.5 text-subtle hover:bg-danger-soft hover:text-danger" aria-label="Remove">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {WEBHOOK_EVENTS.map((ev) => {
          const on = w.events.includes(ev);
          return (
            <button
              key={ev}
              onClick={() => onChange({ ...w, events: on ? w.events.filter((x) => x !== ev) : [...w.events, ev] })}
              className={cn("rounded-full border px-2.5 py-1 font-mono text-[11px] transition", on ? "border-accent bg-accent-soft text-accent" : "border-line text-muted hover:border-line-strong")}
            >
              {ev}
            </button>
          );
        })}
      </div>
      {w.secret && (
        <div className="mt-3 flex items-center gap-2 text-xs text-muted">
          <KeyRound className="h-3.5 w-3.5" /> Signing secret:
          <code className="font-mono">{secret ?? "••••••••••••"}</code>
          {!secret && (
            <button className="flex items-center gap-1 text-fg hover:underline" onClick={async () => setSecret(await call((api) => api.revealWebhookSecret(w.id)))}>
              <Eye className="h-3 w-3" /> reveal
            </button>
          )}
          {secret && <CopyButton value={secret} />}
        </div>
      )}
    </div>
  );
}

function PasswordCard() {
  const toast = useToast();
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  return (
    <Card className="p-6">
      <h3 className="text-sm font-semibold">Change password</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <Input type="password" value={cur} onChange={(e) => setCur(e.target.value)} placeholder="Current password" />
        <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} placeholder="New password" />
        <Button
          onClick={async () => {
            try {
              await auth.action("change", { password: cur, newPassword: next });
              toast.success("Password changed");
              setCur("");
              setNext("");
            } catch (e) {
              toast.error("Could not change password", (e as Error).message);
            }
          }}
        >
          Update
        </Button>
      </div>
    </Card>
  );
}

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsInner />
    </Suspense>
  );
}
