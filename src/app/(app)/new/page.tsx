"use client";

import { ArrowRight, Check, FileText, KeyRound, Sparkles, Wand2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { call, useData } from "@/client/hooks";
import { PageHeader } from "@/components/app-shell";
import { LoopVideo } from "@/components/media";
import { useToast } from "@/components/toast";
import { Badge, Button, Card, Field, Input, Kbd, Select, Textarea } from "@/components/ui";
import { SAMPLE_NOTES } from "@/core/samples";
import { CURRENCIES, type Currency } from "@/core/types";
import { cn } from "@/lib/cn";

const STEPS = ["Reading your call notes", "Finding the real pain points", "Structuring scope & deliverables", "Pricing good / better / best", "Polishing every sentence"];

const PROVIDER_LABEL: Record<string, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  openrouter: "OpenRouter",
  demo: "Built-in demo drafter",
};

export default function NewProposalPage() {
  const router = useRouter();
  const toast = useToast();
  const { data } = useData(async (api) => {
    const [settings, templates] = await Promise.all([api.getSettings(), api.listTemplates()]);
    return { settings, templates };
  }, []);
  const [notes, setNotes] = useState("");
  const [client, setClient] = useState({ name: "", company: "", email: "" });
  const [templateId, setTemplateId] = useState("");
  const [currencyChoice, setCurrency] = useState<Currency | null>(null);
  const currency: Currency = currencyChoice ?? data?.settings.brand.defaultCurrency ?? "USD";
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => setStep((s) => Math.min(STEPS.length - 1, s + 1)), 1100);
    return () => clearInterval(t);
  }, [busy]);

  const ai = data?.settings.ai;
  const usingDemo = !ai || ai.provider === "demo" || !data?.settings.hasApiKey;

  async function generate(e?: React.FormEvent) {
    e?.preventDefault();
    if (notes.trim().length < 20) {
      toast.error("Add a bit more detail", "Paste at least a few sentences from the call.");
      return;
    }
    setStep(0);
    setBusy(true);
    const started = Date.now();
    try {
      const res = await call((api) => api.draftProposal({ notes, currency, templateId: templateId || undefined, clientHint: client }));
      // Let the drafting animation breathe even when the offline drafter is instant.
      const wait = Math.max(0, 5200 - (Date.now() - started));
      if (wait) await new Promise((r) => setTimeout(r, wait));
      router.push(`/proposal/?id=${res.proposal.id}&fresh=1`);
    } catch (err) {
      setBusy(false);
      toast.error("Drafting failed", (err as Error).message);
    }
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow="Step 1 of 5"
        title="From call notes to proposal"
        subtitle="Paste your notes or a transcript. Siegel drafts the summary, scope, deliverables, timeline and three pricing tiers."
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <form
          ref={formRef}
          onSubmit={generate}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) generate();
          }}
        >
          <Card className="p-5 sm:p-6">
            <div className="mb-2 flex items-center justify-between">
              <label htmlFor="notes" className="text-[13px] font-medium">
                Call notes or transcript
              </label>
              <button type="button" onClick={() => setNotes(SAMPLE_NOTES)} className="flex items-center gap-1 text-xs font-medium text-accent hover:underline">
                <Wand2 className="h-3.5 w-3.5" /> Use sample notes
              </button>
            </div>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={"e.g. Call with Daniel from Northwall Roofing. Leads from Google Ads wait until the next day for a reply, quotes are typed by hand, budget around $8k…"}
              className="min-h-[300px] font-[450] leading-relaxed"
            />
            <div className="mt-1.5 flex justify-between text-xs text-subtle">
              <span>Messy is fine. Bullet points, transcripts, half sentences.</span>
              <span className="tabular-nums">{notes.length.toLocaleString()} chars</span>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <Field label="Client name" hint="optional">
                <Input value={client.name} onChange={(e) => setClient({ ...client, name: e.target.value })} placeholder="Detected from notes" />
              </Field>
              <Field label="Company" hint="optional">
                <Input value={client.company} onChange={(e) => setClient({ ...client, company: e.target.value })} placeholder="Detected from notes" />
              </Field>
              <Field label="Email" hint="optional">
                <Input type="email" value={client.email} onChange={(e) => setClient({ ...client, email: e.target.value })} placeholder="client@company.com" />
              </Field>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_140px]">
              <Field label="Template" hint="guides structure & pricing">
                <Select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                  <option value="">Let AI decide</option>
                  {data?.templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Currency">
                <Select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
                  {CURRENCIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-xs text-muted">
                {usingDemo ? (
                  <>
                    <Badge tone="warn">Demo drafter</Badge>
                    <span>
                      No API key yet.{" "}
                      <Link href="/settings/?tab=ai" className="font-medium text-fg underline-offset-2 hover:underline">
                        Add Claude, OpenAI or OpenRouter
                      </Link>
                    </span>
                  </>
                ) : (
                  <>
                    <Badge tone="ok">
                      <KeyRound className="h-3 w-3" /> {PROVIDER_LABEL[ai!.provider]}
                    </Badge>
                    <span className="font-mono">{ai!.model}</span>
                  </>
                )}
              </div>
              <Button type="submit" variant="primary" size="lg" icon={<Sparkles className="h-4 w-4" />} loading={busy}>
                Draft proposal <Kbd>⌘↵</Kbd>
              </Button>
            </div>
          </Card>
        </form>

        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-2xl border border-line">
            <LoopVideo name="notes-flow" className="aspect-[4/3] w-full" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-4 text-white">
              <p className="font-serif text-xl leading-tight">Hours of writing, gone.</p>
              <p className="mt-1 text-xs text-white/70">A proposal that sounds like you, in the time it takes to refill your coffee.</p>
            </div>
          </div>
          <Card className="p-5">
            <h3 className="text-sm font-semibold">What happens next</h3>
            <ol className="mt-3 space-y-3 text-[13px] text-muted">
              {[
                ["Edit inline", "Tweak any sentence, tier or price. Autosaved."],
                ["Send one link", "A beautiful, mobile-friendly proposal page."],
                ["Client signs", "Picks a tier, types their name, draws a signature."],
                ["Deposit paid", "Redirect to your Stripe Payment Link."],
                ["Automations fire", "Webhooks to n8n, Make or Zapier kick off onboarding."],
              ].map(([t, d], i) => (
                <li key={t} className="flex gap-3">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent-soft font-mono text-[10px] font-semibold text-accent">{i + 2}</span>
                  <span>
                    <span className="font-medium text-fg">{t}.</span> {d}
                  </span>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>

      {busy && (
        <div className="fixed inset-0 z-50 grid animate-fade-in place-items-center bg-black/80 p-6 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#0e0c0b] text-white shadow-float">
            <div className="relative">
              <LoopVideo name="notes-flow" className="aspect-[4/3] w-full" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0e0c0b] via-transparent to-transparent" />
            </div>
            <div className="px-6 pb-6">
              <p className="font-serif text-2xl">Drafting your proposal…</p>
              <p className="mt-1 text-xs text-white/50">{usingDemo ? "Built-in demo drafter" : `${PROVIDER_LABEL[ai!.provider]} · ${ai!.model}`}</p>
              <ul className="mt-5 space-y-2.5">
                {STEPS.map((s, i) => (
                  <li key={s} className={cn("flex items-center gap-3 text-sm transition", i > step ? "text-white/30" : "text-white/90")}>
                    <span
                      className={cn(
                        "grid h-5 w-5 place-items-center rounded-full border",
                        i < step ? "border-transparent bg-[var(--accent)]" : i === step ? "animate-pulse-ring border-[var(--accent)]" : "border-white/20",
                      )}
                    >
                      {i < step ? <Check className="h-3 w-3" /> : i === step ? <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" /> : null}
                    </span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <p className="mt-6 flex items-center gap-2 text-xs text-subtle">
        <FileText className="h-3.5 w-3.5" /> Prefer a blank page?{" "}
        <button
          className="font-medium text-muted hover:text-fg"
          onClick={async () => {
            const p = await call((api) => api.createProposal({ title: "Untitled proposal", currency, templateId: templateId || undefined }));
            router.push(`/proposal/?id=${p.id}`);
          }}
        >
          Start from {templateId ? "the template" : "scratch"} <ArrowRight className="inline h-3 w-3" />
        </button>
      </p>
    </div>
  );
}
