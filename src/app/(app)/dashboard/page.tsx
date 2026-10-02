"use client";

import { ArrowUpRight, CircleDollarSign, Eye, FileSignature, FileText, Search, Send, Sparkles, Stamp, Trophy, Wallet } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { call, useData } from "@/client/hooks";
import { PageHeader } from "@/components/app-shell";
import { CountUp, Funnel, WeeklyBars } from "@/components/charts";
import { Img, LoopVideo } from "@/components/media";
import { useToast } from "@/components/toast";
import { Button, Card, EmptyState, Input, Skeleton, StatusPill, Tabs } from "@/components/ui";
import { duration, money, relative } from "@/core/format";
import { headlineValue } from "@/core/stats";
import type { ActivityItem, EventType, ProposalStatus } from "@/core/types";
import { cn } from "@/lib/cn";

type Filter = "all" | ProposalStatus;

const EVENT_ICON: Record<EventType, typeof Send> = {
  created: FileText,
  sent: Send,
  revised: FileText,
  viewed: Eye,
  signed: FileSignature,
  paid: CircleDollarSign,
};

function activityText(a: ActivityItem) {
  const who = a.proposal.client.name || a.proposal.client.company || "Client";
  const d = a.event.data as Record<string, unknown>;
  switch (a.event.type) {
    case "created":
      return <>Drafted {d.source === "ai" ? "with AI" : ""} <b className="font-medium text-fg">{a.proposal.number}</b></>;
    case "sent":
      return <>Sent <b className="font-medium text-fg">{a.proposal.number}</b> to {who}</>;
    case "revised":
      return <>Published v{String(d.version)} of <b className="font-medium text-fg">{a.proposal.number}</b></>;
    case "viewed":
      return <><b className="font-medium text-fg">{who}</b> opened {a.proposal.number}</>;
    case "signed":
      return <><b className="font-medium text-fg">{String(d.signerName ?? who)}</b> signed {String(d.tierName ?? "")}</>;
    case "paid":
      return <>Deposit received · <b className="font-medium text-fg">{a.proposal.number}</b></>;
  }
}

export default function DashboardPage() {
  const router = useRouter();
  const toast = useToast();
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [loadingSample, setLoadingSample] = useState(false);
  const { data, loading, reload } = useData(
    async (api) => {
      const [proposals, stats, activity, settings] = await Promise.all([api.listProposals(), api.stats(), api.activity(14), api.getSettings()]);
      return { proposals, stats, activity, settings };
    },
    [],
  );

  const currency = data?.settings.brand.defaultCurrency ?? "USD";
  const rows = useMemo(() => {
    const list = data?.proposals ?? [];
    const needle = q.trim().toLowerCase();
    return list.filter(
      (p) =>
        (filter === "all" || p.status === filter) &&
        (!needle || [p.title, p.number, p.client.name, p.client.company].join(" ").toLowerCase().includes(needle)),
    );
  }, [data, filter, q]);

  const s = data?.stats;
  const openCount = s ? s.counts.sent + s.counts.viewed : 0;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow={greeting}
        title="Dashboard"
        subtitle="Every proposal, from first draft to deposit in the bank."
        actions={
          <Button variant="primary" icon={<Sparkles className="h-4 w-4" />} onClick={() => router.push("/new/")}>
            New proposal
          </Button>
        }
      />

      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Open pipeline", icon: Wallet, value: s?.pipelineValue ?? 0, fmt: (n: number) => money(n, currency, { compact: true }), foot: `${openCount} awaiting signature` },
          { label: "Won", icon: Trophy, value: s?.wonValue ?? 0, fmt: (n: number) => money(n, currency, { compact: true }), foot: `${(s?.counts.signed ?? 0) + (s?.counts.paid ?? 0)} signed proposals` },
          { label: "Deposits collected", icon: CircleDollarSign, value: s?.collected ?? 0, fmt: (n: number) => money(n, currency, { compact: true }), foot: `${s?.counts.paid ?? 0} paid via Stripe` },
          {
            label: "Win rate",
            icon: Stamp,
            value: (s?.winRate ?? 0) * 100,
            fmt: (n: number) => `${Math.round(n)}%`,
            foot: s?.avgHoursToSign != null ? `Signed in ${s.avgHoursToSign < 24 ? `${Math.round(s.avgHoursToSign)}h` : `${(s.avgHoursToSign / 24).toFixed(1)} days`} on avg.` : "No signatures yet",
          },
        ].map((k, i) => (
          <Card key={k.label} className="relative overflow-hidden p-4 sm:p-5" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="flex items-center justify-between text-[13px] text-muted">
              {k.label}
              <k.icon className="h-4 w-4 text-subtle" />
            </div>
            <div className="mt-3 text-[26px] font-semibold tracking-tight sm:text-[30px]">
              {loading && !data ? <Skeleton className="h-8 w-24" /> : <CountUp value={k.value} format={k.fmt} />}
            </div>
            <div className="mt-1 text-xs text-subtle">{k.foot}</div>
          </Card>
        ))}
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="mb-3 flex items-baseline justify-between">
            <div>
              <h2 className="text-sm font-semibold">Won revenue per week</h2>
              <p className="text-xs text-subtle">Signed proposal value, last 8 weeks</p>
            </div>
          </div>
          {s ? <WeeklyBars data={s.weekly} currency={currency} /> : <Skeleton className="h-44 w-full" />}
        </Card>
        <Card className="p-5">
          <h2 className="text-sm font-semibold">Pipeline funnel</h2>
          <p className="mb-4 text-xs text-subtle">Proposals that reached each stage</p>
          {s ? <Funnel counts={s.counts} /> : <Skeleton className="h-40 w-full" />}
        </Card>
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-[1fr_320px]">
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
            <Tabs
              value={filter}
              onChange={setFilter}
              className="scrollbar-none max-w-full overflow-x-auto"
              items={[
                { value: "all", label: `All ${data ? data.proposals.length : ""}` },
                { value: "draft", label: "Draft" },
                { value: "sent", label: "Sent" },
                { value: "viewed", label: "Viewed" },
                { value: "signed", label: "Signed" },
                { value: "paid", label: "Paid" },
              ]}
            />
            <div className="relative sm:w-56">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-subtle" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search proposals" className="pl-8" />
            </div>
          </div>

          {loading && !data ? (
            <div className="space-y-2 p-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : data && data.proposals.length === 0 ? (
            <EmptyState
              image={<Img name="wax-disc" className="h-28 w-28 rounded-full" />}
              title="No proposals yet"
              body="Paste your notes from a sales call and Siegel drafts a polished proposal in seconds."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Button variant="primary" icon={<Sparkles className="h-4 w-4" />} onClick={() => router.push("/new/")}>
                    Draft your first proposal
                  </Button>
                  <Button
                    loading={loadingSample}
                    onClick={async () => {
                      setLoadingSample(true);
                      try {
                        await call((api) => api.loadSampleData());
                        await reload();
                        toast.success("Sample workspace loaded");
                      } catch (e) {
                        toast.error("Could not load sample data", (e as Error).message);
                      } finally {
                        setLoadingSample(false);
                      }
                    }}
                  >
                    Load sample data
                  </Button>
                </div>
              }
            />
          ) : rows.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted">No proposals match.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="text-left text-xs text-subtle">
                    <th className="px-4 py-2.5 font-medium">Proposal</th>
                    <th className="px-4 py-2.5 font-medium">Client</th>
                    <th className="px-4 py-2.5 text-right font-medium">Value</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5 font-medium">Engagement</th>
                    <th className="px-4 py-2.5 text-right font-medium">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => (
                    <tr
                      key={p.id}
                      onClick={() => router.push(`/proposal/?id=${p.id}`)}
                      className="group cursor-pointer border-t border-line transition hover:bg-hover"
                    >
                      <td className="max-w-[280px] px-4 py-3">
                        <div className="truncate font-medium">{p.title}</div>
                        <div className="font-mono text-[11px] text-subtle">{p.number}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="truncate">{p.client.company || "—"}</div>
                        <div className="truncate text-xs text-subtle">{p.client.name}</div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums">{money(headlineValue(p), p.currency)}</td>
                      <td className="px-4 py-3">
                        <StatusPill status={p.status} />
                      </td>
                      <td className="px-4 py-3 text-xs text-muted">
                        {p.stats.views ? (
                          <span className="inline-flex items-center gap-1.5">
                            <Eye className="h-3.5 w-3.5" />
                            {p.stats.views} · {duration(p.stats.seconds)}
                          </span>
                        ) : (
                          <span className="text-subtle">{p.status === "draft" ? "Not sent" : "Not opened yet"}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-subtle">
                        <span className="inline-flex items-center gap-1">
                          {relative(p.updatedAt)}
                          <ArrowUpRight className="h-3.5 w-3.5 opacity-0 transition group-hover:opacity-100" />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div className="space-y-3">
          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold">Live activity</h2>
            {!data ? (
              <Skeleton className="h-48 w-full" />
            ) : data.activity.length === 0 ? (
              <p className="text-sm text-muted">Events appear here the moment clients open, sign and pay.</p>
            ) : (
              <ol className="relative space-y-3.5 before:absolute before:bottom-2 before:left-[13px] before:top-2 before:w-px before:bg-line">
                {data.activity.map((a) => {
                  const Icon = EVENT_ICON[a.event.type];
                  const hot = a.event.type === "signed" || a.event.type === "paid";
                  return (
                    <li key={a.event.id} className="relative flex gap-3">
                      <span
                        className={cn(
                          "relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full border border-line bg-elev",
                          hot && "border-transparent bg-accent text-accent-fg",
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <Link href={`/proposal/?id=${a.proposal.id}`} className="min-w-0 pt-0.5 text-[13px] leading-snug text-muted hover:text-fg">
                        <div className="truncate">{activityText(a)}</div>
                        <div className="text-xs text-subtle">
                          {a.proposal.client.company} · {relative(a.event.at)}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>
          <Link href="/verify/" className="group relative block overflow-hidden rounded-2xl border border-line">
            <LoopVideo name="chain-loop" className="h-36 w-full opacity-80 transition group-hover:opacity-100" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-4 text-white">
              <div className="text-sm font-semibold">Every signature is provable</div>
              <div className="text-xs text-white/70">Hash-chained audit trail · verify any certificate →</div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
