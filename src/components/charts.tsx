"use client";

import { useEffect, useRef, useState } from "react";
import { money } from "@/core/format";
import type { Currency, DashboardStats, ProposalStatus } from "@/core/types";
import { cn } from "@/lib/cn";

/** Animated number for stat tiles. */
export function CountUp({ value, format, className }: { value: number; format: (n: number) => string; className?: string }) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    const dur = 900;
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      setShown(a + (value - a) * e);
      if (k < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span className={cn("tabular-nums", className)}>{format(shown)}</span>;
}

/** Single-series bar chart: won revenue per week. One hue, no legend (the title names it). */
export function WeeklyBars({ data, currency }: { data: DashboardStats["weekly"]; currency: Currency }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 560;
  const H = 180;
  const padL = 44;
  const padB = 22;
  const padT = 10;
  const max = Math.max(1, ...data.map((d) => d.won));
  const nice = niceMax(max);
  const plotW = W - padL - 4;
  const plotH = H - padB - padT;
  const slot = plotW / data.length;
  const bw = Math.min(34, slot - 10);
  const ticks = [0, nice / 2, nice];
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Won revenue per week, last 8 weeks">
        {ticks.map((t) => {
          const y = padT + plotH - (t / nice) * plotH;
          return (
            <g key={t}>
              <line x1={padL} x2={W} y1={y} y2={y} stroke="var(--line)" strokeDasharray={t === 0 ? undefined : "2 4"} />
              <text x={padL - 8} y={y + 3.5} textAnchor="end" className="fill-[var(--fg-subtle)] text-[10px]">
                {money(t, currency, { compact: true })}
              </text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const h = (d.won / nice) * plotH;
          const x = padL + i * slot + (slot - bw) / 2;
          const y = padT + plotH - h;
          const r = Math.min(4, h);
          const last = i === data.length - 1;
          return (
            <g key={d.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={padL + i * slot} y={padT} width={slot} height={plotH} fill="transparent" />
              {h > 0 && (
                <path
                  d={`M${x},${y + plotH * 0 + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + bw - r} Q${x + bw},${y} ${x + bw},${y + r} V${y + h} Z`}
                  fill="var(--accent)"
                  opacity={hover === null || hover === i ? (last ? 1 : 0.78) : 0.35}
                  style={{ transition: "opacity .15s" }}
                />
              )}
              {h === 0 && <rect x={x} y={padT + plotH - 2} width={bw} height={2} rx={1} fill="var(--line-strong)" />}
              <text x={x + bw / 2} y={H - 6} textAnchor="middle" className={cn("text-[10px]", last ? "fill-[var(--fg-muted)]" : "fill-[var(--fg-subtle)]")}>
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-lg border border-line bg-elev px-2.5 py-1.5 text-xs shadow-float"
          style={{ left: `${((padL + hover * slot + slot / 2) / W) * 100}%`, top: `${((padT + plotH - (data[hover].won / nice) * plotH) / H) * 100}%` }}
        >
          <div className="font-medium tabular-nums">{money(data[hover].won, currency)}</div>
          <div className="text-subtle">
            Week of {data[hover].label} · {data[hover].sent} sent
          </div>
        </div>
      )}
    </div>
  );
}

function niceMax(v: number) {
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / exp;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * exp;
}

const STAGES: { key: ProposalStatus | "open"; label: string }[] = [
  { key: "draft", label: "Drafted" },
  { key: "sent", label: "Sent" },
  { key: "viewed", label: "Opened" },
  { key: "signed", label: "Signed" },
  { key: "paid", label: "Paid" },
];

/** Funnel: how many proposals reached each stage (cumulative). Single hue + direct labels. */
export function Funnel({ counts }: { counts: Record<ProposalStatus, number> }) {
  const reached = {
    draft: counts.draft + counts.sent + counts.viewed + counts.signed + counts.paid,
    sent: counts.sent + counts.viewed + counts.signed + counts.paid,
    viewed: counts.viewed + counts.signed + counts.paid,
    signed: counts.signed + counts.paid,
    paid: counts.paid,
  };
  const max = Math.max(1, reached.draft);
  return (
    <div className="space-y-2.5">
      {STAGES.map((s, i) => {
        const n = reached[s.key as ProposalStatus];
        const prev = i === 0 ? n : reached[STAGES[i - 1].key as ProposalStatus];
        const conv = i === 0 || !prev ? null : Math.round((n / prev) * 100);
        return (
          <div key={s.key} title={`${n} proposals reached “${s.label}”`}>
            <div className="mb-1 flex items-baseline justify-between text-xs">
              <span className="text-muted">{s.label}</span>
              <span className="tabular-nums">
                <span className="font-medium text-fg">{n}</span>
                {conv !== null && <span className="ml-1.5 text-subtle">{conv}%</span>}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-hover">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-700 ease-out"
                style={{ width: `${(n / max) * 100}%`, opacity: 0.45 + (i / (STAGES.length - 1)) * 0.55 }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
