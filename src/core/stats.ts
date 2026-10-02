import type { DashboardStats, Proposal, ProposalStatus } from "./types";

export function headlineValue(p: Proposal): number {
  if (p.signature) return p.signature.amount;
  const rec = p.tiers.find((t) => t.recommended) ?? p.tiers[0];
  return rec?.price ?? 0;
}

export function computeStats(proposals: Proposal[], now: Date): DashboardStats {
  const counts: Record<ProposalStatus, number> = { draft: 0, sent: 0, viewed: 0, signed: 0, paid: 0 };
  let pipelineValue = 0;
  let wonValue = 0;
  let collected = 0;
  const signHours: number[] = [];
  for (const p of proposals) {
    counts[p.status]++;
    if (p.status === "sent" || p.status === "viewed") pipelineValue += headlineValue(p);
    if (p.signature) wonValue += p.signature.amount;
    if (p.payment) collected += p.payment.amount;
    if (p.signedAt && p.sentAt) signHours.push((Date.parse(p.signedAt) - Date.parse(p.sentAt)) / 36e5);
  }
  const sentTotal = proposals.filter((p) => p.status !== "draft").length;
  const won = counts.signed + counts.paid;

  const weekly: DashboardStats["weekly"] = [];
  const startOfWeek = new Date(now);
  startOfWeek.setHours(0, 0, 0, 0);
  startOfWeek.setDate(startOfWeek.getDate() - ((startOfWeek.getDay() + 6) % 7));
  for (let i = 7; i >= 0; i--) {
    const from = startOfWeek.getTime() - i * 7 * 864e5;
    const to = from + 7 * 864e5;
    const inRange = (iso: string | null) => !!iso && Date.parse(iso) >= from && Date.parse(iso) < to;
    weekly.push({
      label: new Date(from).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      won: proposals.filter((p) => p.signature && inRange(p.signedAt)).reduce((s, p) => s + (p.signature?.amount ?? 0), 0),
      sent: proposals.filter((p) => inRange(p.sentAt)).length,
    });
  }

  return {
    pipelineValue,
    wonValue,
    collected,
    winRate: sentTotal ? won / sentTotal : 0,
    avgHoursToSign: signHours.length ? signHours.reduce((a, b) => a + b, 0) / signHours.length : null,
    counts,
    sentTotal,
    weekly,
  };
}
