"use client";

import {
  ArrowRight,
  BarChart3,
  Bot,
  CircleDollarSign,
  Clock3,
  FileSignature,
  FileStack,

  KeyRound,
  Layers,
  MoonStar,
  MousePointerClick,
  Receipt,
  ScrollText,
  Server,
  ShieldCheck,
  Sparkles,
  Webhook,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { MODE } from "@/client/api";
import { LiveChain } from "@/components/live-chain";
import { GithubIcon as Github, Logo, SealMark } from "@/components/logo";
import { Img, LoopVideo } from "@/components/media";
import { ThemeToggle } from "@/components/theme-toggle";
import { CopyButton } from "@/components/ui";
import { cn } from "@/lib/cn";

const REPO = "https://github.com/MarcelWeissgerberIT/Siegel";

const STEPS = [
  { n: "01", icon: Sparkles, title: "Paste the call notes", body: "Messy notes or a full transcript. Claude, GPT or any OpenRouter model drafts the problem, scope, deliverables, timeline and three pricing tiers.", time: "0:00" },
  { n: "02", icon: MousePointerClick, title: "Edit inline, send one link", body: "Click any sentence to change it. Publishing fingerprints the exact version your client will see.", time: "1:30" },
  { n: "03", icon: FileSignature, title: "Client picks a tier & signs", body: "A gorgeous, mobile-first proposal page. Typed name plus drawn signature, bound to the document hash.", time: "3:10" },
  { n: "04", icon: CircleDollarSign, title: "Deposit, instantly", body: "Straight from the signature to your Stripe Payment Link. The webhook marks it paid automatically.", time: "4:05" },
  { n: "05", icon: Webhook, title: "Onboarding runs itself", body: "proposal.viewed, .signed and .paid webhooks trigger n8n, Make or Zapier the second they happen.", time: "4:20" },
];

const FEATURES = [
  { icon: BarChart3, title: "Pipeline dashboard", body: "Draft → Sent → Viewed → Signed → Paid, pipeline value, win rate and time-to-sign." },
  { icon: Bot, title: "Bring your own AI key", body: "Anthropic, OpenAI or OpenRouter. Your key stays on your server. Works offline with a demo drafter." },
  { icon: FileStack, title: "Templates & pricing blocks", body: "Reusable proposal structures and packages, one click to insert." },
  { icon: Clock3, title: "View tracking", body: "Know when they opened it, how often, on which device and for how long." },
  { icon: ShieldCheck, title: "Verifiable e-signatures", body: "SHA-256 document fingerprint plus a hash-chained audit trail with IP and user agent." },
  { icon: ScrollText, title: "Certificate of Completion", body: "A PDF with the evidence embedded, so anyone can re-verify it, forever." },
  { icon: Receipt, title: "Stripe Payment Links", body: "One link per tier. No API keys, no PCI scope. Paid status via signed webhook." },
  { icon: MoonStar, title: "Dark & light, mobile-first", body: "Linear-grade dashboard, Stripe-grade client page. Fully English UI." },
  { icon: Server, title: "One container, SQLite", body: "docker compose up. Or one click on Railway / Render. All data local." },
];

export default function Landing() {
  const [tampered, setTampered] = useState(false);
  const demoHref = "/dashboard/";

  return (
    <div className="overflow-x-clip">
      {/* NAV */}
      <header className="fixed inset-x-0 top-0 z-40">
        <div className="mx-auto mt-3 flex max-w-6xl items-center justify-between rounded-2xl border border-white/10 bg-black/35 px-4 py-2.5 text-white backdrop-blur-xl sm:mx-4 lg:mx-auto">
          <Link href="/" className="[&_span]:text-white">
            <Logo size="sm" />
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-white/70 md:flex">
            <a href="#how" className="hover:text-white">How it works</a>
            <a href="#proof" className="hover:text-white">Proof</a>
            <a href="#value" className="hover:text-white">Pricing</a>
            <a href="#self-host" className="hover:text-white">Self-host</a>
          </nav>
          <div className="flex items-center gap-2">
            <a href={REPO} className="hidden rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white sm:block" aria-label="GitHub">
              <Github className="h-4 w-4" />
            </a>
            <Link href={demoHref} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white px-3.5 text-sm font-medium text-black transition hover:bg-white/90">
              {MODE === "local" ? "Live demo" : "Open app"} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="grain relative isolate flex min-h-[100svh] items-end overflow-hidden bg-[#070605] text-white">
        <div className="absolute inset-0 -z-10">
          <LoopVideo name="hero-loop" className="h-full w-full object-[70%_50%]" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#070605] via-[#070605]/75 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#070605] via-transparent to-[#070605]/40" />
        </div>
        <div className="mx-auto w-full max-w-6xl px-5 pb-16 pt-32 sm:px-8 sm:pb-24">
          <div className="inline-flex animate-fade-up items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/75 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-[#3ccf91]" /> Free & self-hosted · replaces PandaDoc + DocuSign
          </div>
          <h1 className="mt-6 max-w-3xl animate-fade-up font-serif text-[54px] leading-[0.95] tracking-tight [animation-delay:80ms] sm:text-[88px] lg:text-[104px]">
            Proposals that
            <br />
            <span className="italic text-[#ff8a6b]">close themselves.</span>
          </h1>
          <p className="mt-7 max-w-xl animate-fade-up text-lg leading-relaxed text-white/75 [animation-delay:160ms] sm:text-xl">
            From call notes to <span className="text-white">signed and paid in under 5 minutes</span>, with signatures you can actually prove. Free, self-hosted, yours.
          </p>
          <div className="mt-9 flex animate-fade-up flex-wrap items-center gap-3 [animation-delay:240ms]">
            <Link
              href={demoHref}
              className="inline-flex h-12 items-center gap-2 rounded-xl bg-[#e0442b] px-6 text-[15px] font-medium text-white shadow-[0_18px_50px_-15px_rgba(224,68,43,0.9)] transition hover:bg-[#f0583a]"
            >
              <Sparkles className="h-4 w-4" /> Try the live demo
            </Link>
            <a href="#self-host" className="inline-flex h-12 items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-6 text-[15px] font-medium text-white backdrop-blur transition hover:bg-white/10">
              <Server className="h-4 w-4" /> Self-host in one command
            </a>
          </div>
          <div className="mt-14 grid max-w-3xl animate-fade-up grid-cols-3 gap-6 border-t border-white/10 pt-6 [animation-delay:320ms]">
            {[
              ["< 5 min", "call notes → signed & paid"],
              ["$0", "vs. up to $110 / user / month"],
              ["SHA-256", "hash-chained audit trail"],
            ].map(([k, v]) => (
              <div key={k}>
                <div className="font-serif text-3xl sm:text-4xl">{k}</div>
                <div className="mt-1 text-xs text-white/55 sm:text-sm">{v}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PROBLEM */}
      <section className="relative bg-bg py-24 sm:py-32">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">The leak</p>
          <h2 className="mt-4 max-w-3xl font-serif text-4xl leading-[1.05] tracking-tight sm:text-6xl">Deals don&apos;t die on the call. They die between the call and the signature.</h2>
          <div className="mt-14 grid gap-4 md:grid-cols-3">
            {[
              { k: "3–5 hours", t: "to write one proposal", b: "Copy-pasting old docs, rewriting scope, guessing at prices while the lead cools down." },
              { k: "1 PDF", t: "that nobody reads", b: "Attached to an email, opened once on a phone, forwarded, forgotten. You never know." },
              { k: "3 tools", t: "to get paid", b: "Proposal software, an e-sign tool and a payment tool. Three subscriptions, three handoffs." },
            ].map((c) => (
              <div key={c.k} className="rounded-2xl border border-line bg-elev p-6">
                <div className="font-serif text-5xl tracking-tight text-accent">{c.k}</div>
                <div className="mt-2 font-medium">{c.t}</div>
                <p className="mt-2 text-sm leading-relaxed text-muted">{c.b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW */}
      <section id="how" className="relative border-y border-line bg-sunken py-24 sm:py-32">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <div className="grid items-end gap-10 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">How it works</p>
              <h2 className="mt-4 font-serif text-4xl leading-[1.05] tracking-tight sm:text-6xl">One app. One link. Five minutes.</h2>
              <p className="mt-5 max-w-lg text-muted">Siegel turns a great call into money in the bank without leaving the page. Here&apos;s the whole flow, timed.</p>
            </div>
            <div className="relative overflow-hidden rounded-3xl border border-line shadow-float">
              <LoopVideo name="notes-flow" className="aspect-[4/3] w-full" />
              <div className="absolute bottom-3 left-3 rounded-full bg-black/60 px-3 py-1 text-xs text-white backdrop-blur">Call notes → proposal</div>
            </div>
          </div>
          <ol className="mt-16 grid gap-3 md:grid-cols-5">
            {STEPS.map((s) => (
              <li key={s.n} className="group relative rounded-2xl border border-line bg-elev p-5 transition hover:-translate-y-1 hover:shadow-float">
                <div className="flex items-center justify-between">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent-soft text-accent">
                    <s.icon className="h-4 w-4" />
                  </span>
                  <span className="font-mono text-xs text-subtle">{s.time}</span>
                </div>
                <div className="mt-5 font-mono text-xs text-subtle">{s.n}</div>
                <h3 className="mt-1 font-semibold tracking-tight">{s.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-muted">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* PROOF */}
      <section id="proof" className="grain relative isolate overflow-hidden bg-[#070605] py-24 text-white sm:py-32">
        <div className="absolute inset-0 -z-10">
          {tampered ? <LoopVideo key="break" name="chain-break" loop={false} className="h-full w-full opacity-60" /> : <LoopVideo name="chain-loop" className="h-full w-full opacity-50" />}
          <div className="absolute inset-0 bg-gradient-to-b from-[#070605] via-[#070605]/60 to-[#070605]" />
        </div>
        <div className="mx-auto grid max-w-6xl gap-12 px-5 sm:px-8 lg:grid-cols-[1fr_1.05fr] lg:items-center">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#ff8a6b]">The differentiator</p>
            <h2 className="mt-4 font-serif text-4xl leading-[1.05] tracking-tight sm:text-6xl">Signatures you can actually prove.</h2>
            <p className="mt-6 text-white/70">
              Most cheap e-sign clones save a picture of a signature. Siegel proves <em>what</em> was signed, <em>when</em>, and that <em>nothing changed since</em>.
            </p>
            <ul className="mt-8 space-y-5">
              {[
                ["SHA-256 fingerprint", "of the exact document version the client saw, computed over canonical JSON."],
                ["Hash-chained event log", "created → sent → viewed → signed → paid, each with timestamp, IP and user agent, each committing to the one before."],
                ["Certificate of Completion", "a PDF with the evidence embedded. Anyone can drop it on the verify page and re-hash it in their browser."],
              ].map(([t, b]) => (
                <li key={t} className="flex gap-3">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#3ccf91]" />
                  <span className="text-[15px] text-white/70">
                    <span className="font-medium text-white">{t}</span> {b}
                  </span>
                </li>
              ))}
            </ul>
            <Link href="/verify/" className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-[#ff8a6b] hover:text-white">
              Verify a certificate <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <LiveChain onTamperChange={setTampered} />
        </div>
      </section>

      {/* CERTIFICATE + SIGN MOMENT */}
      <section className="bg-bg py-24 sm:py-32">
        <div className="mx-auto grid max-w-6xl gap-6 px-5 sm:px-8 lg:grid-cols-2">
          <div className="relative overflow-hidden rounded-3xl border border-line bg-[#0b0a09] text-white">
            <LoopVideo name="seal-press" className="aspect-square w-full" />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-7">
              <h3 className="font-serif text-3xl">The moment it&apos;s sealed.</h3>
              <p className="mt-2 max-w-sm text-sm text-white/70">Your client signs, the seal presses, the fingerprint is recorded, and they land on your Stripe checkout. Ceremony that converts.</p>
            </div>
          </div>
          <div className="flex flex-col gap-6">
            <div className="relative overflow-hidden rounded-3xl border border-line">
              <Img name="certificate" alt="Certificate of Completion" className="aspect-[4/3] w-full" />
            </div>
            <div className="rounded-3xl border border-line bg-elev p-7">
              <h3 className="font-serif text-3xl">Evidence that travels.</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Every signed proposal produces a Certificate of Completion with signer, package, deposit, the full audit chain and a QR code. The machine-readable evidence is embedded inside the PDF, so verification works even if your server is gone.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="border-y border-line bg-sunken py-24 sm:py-32">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">Everything in the MVP</p>
          <h2 className="mt-4 max-w-2xl font-serif text-4xl leading-[1.05] tracking-tight sm:text-5xl">Built like the tools you love to pay for.</h2>
          <div className="mt-12 grid gap-px overflow-hidden rounded-3xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-elev p-6 transition hover:bg-bg">
                <f.icon className="h-5 w-5 text-accent" />
                <h3 className="mt-4 font-semibold tracking-tight">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* VALUE */}
      <section id="value" className="bg-bg py-24 sm:py-32">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">Value</p>
              <h2 className="mt-4 font-serif text-4xl leading-[1.05] tracking-tight sm:text-6xl">Stop renting your closing process.</h2>
              <p className="mt-5 max-w-md text-muted">A five-person agency on PandaDoc Business and DocuSign pays thousands a year to send PDFs. Siegel does more, runs on a $5 server, and the data is yours.</p>
            </div>
            <div className="overflow-hidden rounded-3xl border border-line bg-elev">
              {[
                ["PandaDoc / Proposify", "$35–65", "per user / month"],
                ["DocuSign", "$15–45", "per month"],
                ["Payment tool & zaps", "$20+", "per month"],
              ].map(([t, p, u]) => (
                <div key={t} className="flex items-center justify-between border-b border-line px-6 py-4">
                  <span className="text-muted line-through decoration-[var(--accent)]/60">{t}</span>
                  <span className="text-right">
                    <span className="font-medium tabular-nums text-muted">{p}</span> <span className="text-xs text-subtle">{u}</span>
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between bg-accent-soft px-6 py-5">
                <span className="flex items-center gap-2 font-semibold">
                  <SealMark className="h-6 w-6" /> Siegel
                </span>
                <span className="text-right">
                  <span className="font-serif text-4xl text-accent">$0</span> <span className="text-xs text-muted">forever · self-hosted</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SELF HOST */}
      <section id="self-host" className="border-t border-line bg-sunken py-24 sm:py-32">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 sm:px-8 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">Self-host</p>
            <h2 className="mt-4 font-serif text-4xl leading-[1.05] tracking-tight sm:text-5xl">One container. One SQLite file. Yours.</h2>
            <p className="mt-5 max-w-md text-muted">Next.js + SQLite in a single Docker image. Deploy on any VPS, or one click on Railway or Render. Bring your own AI key, no vendor lock-in.</p>
            <div className="mt-6 flex flex-wrap gap-2 text-xs">
              {["Next.js 16", "SQLite (WAL)", "Docker", "Railway", "Render", "Anthropic · OpenAI · OpenRouter", "Stripe Payment Links", "n8n · Make · Zapier"].map((t) => (
                <span key={t} className="rounded-full border border-line bg-elev px-3 py-1 text-muted">
                  {t}
                </span>
              ))}
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl border border-line bg-[#0d0c0b] text-[#e8e2da] shadow-float">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
              <div className="flex gap-1.5">
                <span className="h-3 w-3 rounded-full bg-white/15" />
                <span className="h-3 w-3 rounded-full bg-white/15" />
                <span className="h-3 w-3 rounded-full bg-white/15" />
              </div>
              <CopyButton value={`git clone ${REPO}.git && cd Siegel && docker compose up -d`} className="h-7 border-white/10 bg-white/5 text-white hover:bg-white/10" />
            </div>
            <pre className="overflow-x-auto p-5 font-mono text-[13px] leading-7">
              <span className="text-white/40"># 1. get it</span>
              {"\n"}git clone {REPO}.git && cd Siegel
              {"\n\n"}
              <span className="text-white/40"># 2. set a password (or create one on first visit)</span>
              {"\n"}echo &quot;SIEGEL_PASSWORD=change-me&quot; &gt; .env
              {"\n\n"}
              <span className="text-white/40"># 3. run</span>
              {"\n"}docker compose up -d
              {"\n\n"}
              <span className="text-[#3ccf91]">✓ Siegel is live on http://localhost:3000</span>
            </pre>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="grain relative isolate overflow-hidden bg-[#070605] py-28 text-center text-white sm:py-36">
        <div className="absolute inset-0 -z-10 opacity-60">
          <LoopVideo name="silk-loop" className="h-full w-full" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#070605] via-[#070605]/50 to-[#070605]" />
        </div>
        <SealMark className="mx-auto h-16 w-16" ticks />
        <h2 className="mx-auto mt-8 max-w-3xl px-5 font-serif text-5xl leading-[1.02] tracking-tight sm:text-7xl">Seal your next deal before lunch.</h2>
        <p className="mx-auto mt-5 max-w-md px-5 text-white/70">Try the full flow in your browser: draft with AI, send, sign as the client, pay, verify.</p>
        <div className="mt-9 flex flex-wrap justify-center gap-3 px-5">
          <Link href={demoHref} className="inline-flex h-12 items-center gap-2 rounded-xl bg-[#e0442b] px-6 text-[15px] font-medium text-white transition hover:bg-[#f0583a]">
            <Sparkles className="h-4 w-4" /> Open the live demo
          </Link>
          <a href={REPO} className="inline-flex h-12 items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-6 text-[15px] font-medium text-white backdrop-blur transition hover:bg-white/10">
            <Github className="h-4 w-4" /> Get the code
          </a>
        </div>
      </section>

      <footer className="border-t border-line bg-bg">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 text-sm text-muted sm:flex-row sm:px-8">
          <Logo size="sm" />
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-xs">
              <KeyRound className="h-3.5 w-3.5" /> MIT licensed · your data, your server
            </span>
            <span className={cn("flex items-center gap-1.5 text-xs")}>
              <Layers className="h-3.5 w-3.5" /> Visuals generated with Higgsfield
            </span>
            <ThemeToggle />
          </div>
        </div>
      </footer>
    </div>
  );
}
