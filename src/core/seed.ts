import { draftToProposal } from "./ai";
import { demoDraft } from "./demo-drafter";
import { SEED_SIGNATURES } from "./seed-signatures";
import type { Ctx, SiegelService } from "./service";
import type { Brand } from "./types";

export const DEMO_BRAND: Partial<Brand> = {
  companyName: "Kestrel Automation Studio",
  contactName: "Alex Morgan",
  email: "alex@kestrel.example",
  website: "kestrel.example",
  address: "Remote · Europe & US",
  tagline: "AI automation that pays for itself",
  accent: "#E0442B",
  defaultCurrency: "USD",
};

const UAS = [
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36 Edg/139.0.0.0",
  "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36",
];

interface SeedSpec {
  notes: string;
  client: { name: string; company: string; email: string };
  cover: "ember" | "ink" | "dawn" | "emerald";
  createdDaysAgo: number;
  sentAfterH?: number;
  views?: { afterH: number; seconds: number; ua: number; ip: string }[];
  signAfterH?: number;
  tierIndex?: number;
  paidAfterH?: number;
}

const SPECS: SeedSpec[] = [
  {
    notes: `Call with Dr. Maya Chen from Brightside Dental Group (4 clinics). New patient inquiries come in via web form, Facebook and phone; front desk replies after 3-5 hours, sometimes next day. She thinks they lose 20+ patients a month to faster competitors. They use HubSpot and Calendly. Missed calls after 5pm go to voicemail. Budget around $7k. Wants it live before the January rush.`,
    client: { name: "Maya Chen", company: "Brightside Dental Group", email: "maya@brightside.example" },
    cover: "ember",
    createdDaysAgo: 38,
    sentAfterH: 3,
    views: [
      { afterH: 5, seconds: 412, ua: 0, ip: "84.112.37.201" },
      { afterH: 30, seconds: 248, ua: 1, ip: "84.112.37.201" },
    ],
    signAfterH: 31,
    tierIndex: 1,
    paidAfterH: 31.2,
  },
  {
    notes: `Discovery call - Tom Reyes, Atlas Bookkeeping. 6 people team. Invoices are created by hand in QuickBooks every Friday, payment reminders are forgotten, about 12 hours a week of admin. Accounts receivable is slow. Wants automated invoicing + reminders + monthly client reports. Budget 5k.`,
    client: { name: "Tom Reyes", company: "Atlas Bookkeeping", email: "tom@atlasbooks.example" },
    cover: "emerald",
    createdDaysAgo: 30,
    sentAfterH: 2,
    views: [{ afterH: 20, seconds: 655, ua: 2, ip: "73.21.140.18" }],
    signAfterH: 26,
    tierIndex: 1,
    paidAfterH: 26.1,
  },
  {
    notes: `Rosa Lima, Fieldnote Coffee roasters. Wants to post on LinkedIn and Instagram 4x a week and send a newsletter, but nobody has time, content happens in bursts. They record voice memos at the roastery. Use Notion and Shopify. Budget about $4,000. Open to monthly retainer later.`,
    client: { name: "Rosa Lima", company: "Fieldnote Coffee", email: "rosa@fieldnote.example" },
    cover: "dawn",
    createdDaysAgo: 22,
    sentAfterH: 4,
    views: [{ afterH: 9, seconds: 190, ua: 0, ip: "189.44.12.7" }],
    signAfterH: 50,
    tierIndex: 0,
    paidAfterH: 52,
  },
  {
    notes: `Jordan Blake, Harbor & Pine Realty. 9 agents. Leads from Zillow and the website get copied into a spreadsheet and then into Follow Up Boss manually; follow-up is inconsistent, leads go cold. Shared inbox is a mess. Wants AI to respond to leads and keep the CRM updated. Budget $9k-10k.`,
    client: { name: "Jordan Blake", company: "Harbor & Pine Realty", email: "jordan@harborpine.example" },
    cover: "ink",
    createdDaysAgo: 9,
    sentAfterH: 1,
    views: [
      { afterH: 2, seconds: 320, ua: 1, ip: "98.207.66.130" },
      { afterH: 40, seconds: 540, ua: 0, ip: "98.207.66.130" },
    ],
    signAfterH: 44,
    tierIndex: 1,
  },
  {
    notes: `Sam Okafor - Velo Physio (2 clinics). Phones ring constantly during treatments, about 30% of calls missed, patients book elsewhere. Wants an AI voice receptionist that books into their calendar and answers FAQ about prices and parking. Budget 6k.`,
    client: { name: "Sam Okafor", company: "Velo Physio", email: "sam@velophysio.example" },
    cover: "ember",
    createdDaysAgo: 4,
    sentAfterH: 2,
    views: [
      { afterH: 6, seconds: 133, ua: 3, ip: "51.9.204.88" },
      { afterH: 50, seconds: 287, ua: 1, ip: "51.9.204.88" },
      { afterH: 70, seconds: 76, ua: 3, ip: "51.9.204.88" },
    ],
  },
  {
    notes: `Priya Nair, Cobalt Freight Co. Ops team of 14. Customer support emails about shipment status take hours; they copy tracking info from 3 systems. Want an AI support agent plus weekly KPI reporting. Ongoing monthly retainer preferred, around $3.5k/month.`,
    client: { name: "Priya Nair", company: "Cobalt Freight Co.", email: "priya@cobaltfreight.example" },
    cover: "ink",
    createdDaysAgo: 1,
    sentAfterH: 3,
  },
  {
    notes: `Ella Fischer, Lumina Skincare (Shopify store, 40k customers). Support tickets in Zendesk doubled since launch of new line, same questions about ingredients and shipping. Wants AI support agent + onboarding flow for wholesale partners. Budget ~8k.`,
    client: { name: "Ella Fischer", company: "Lumina Skincare", email: "ella@lumina.example" },
    cover: "dawn",
    createdDaysAgo: 0.3,
  },
];

export async function seedDemo(service: SiegelService, baseCtx: Ctx) {
  await service.updateSettings({ brand: { ...(await service.settings()).brand, ...DEMO_BRAND } });
  await service.ensureStarterLibrary();
  const now = Date.now();
  const H = 36e5;
  for (const spec of SPECS) {
    const t0 = now - spec.createdDaysAgo * 24 * H;
    const at = (h: number) => new Date(t0 + h * H);
    const ownerCtx: Ctx = { ...baseCtx, ip: "10.0.0.12", userAgent: UAS[1] };
    const input = { notes: spec.notes, currency: "USD" as const, clientHint: spec.client };
    const draft = draftToProposal(demoDraft(input, (await service.settings()).brand), input);
    const p = await service.at(at(0), () =>
      service.createProposal({ ...draft, cover: spec.cover, generatedBy: "siegel-demo-drafter" }, ownerCtx),
    );
    if (spec.sentAfterH === undefined) continue;
    await service.at(at(spec.sentAfterH), () => service.sendProposal(p.id, ownerCtx));
    for (const [i, v] of (spec.views ?? []).entries()) {
      const ctx: Ctx = { ...baseCtx, ip: v.ip, userAgent: UAS[v.ua] };
      const sid = `seed-${p.id}-${i}`;
      await service.at(at(v.afterH), () => service.recordView(p.token, sid, ctx));
      let left = v.seconds;
      while (left > 0) {
        const chunk = Math.min(60, left);
        await service.at(at(v.afterH), () => service.heartbeat(p.token, sid, chunk));
        left -= chunk;
      }
    }
    if (spec.signAfterH !== undefined) {
      const last = spec.views?.[spec.views.length - 1];
      const ctx: Ctx = { ...baseCtx, ip: last?.ip ?? "84.112.37.201", userAgent: UAS[last?.ua ?? 0] };
      const pub = await service.getPublic(p.token);
      const tier = pub.document.tiers[spec.tierIndex ?? 1] ?? pub.document.tiers[0];
      const image = SEED_SIGNATURES[spec.client.name] ?? Object.values(SEED_SIGNATURES)[0];
      await service.at(at(spec.signAfterH), () =>
        service.sign(p.token, { tierId: tier.id, name: spec.client.name, email: spec.client.email, image, docHash: pub.documentHash, consent: true }, ctx),
      );
      if (spec.paidAfterH !== undefined) {
        await service.at(at(spec.paidAfterH), () =>
          service.markPaid(p.id, { method: "stripe", reference: "cs_live_" + p.id.slice(4, 20) }, { ...ctx, ip: "54.187.174.169", userAgent: "Stripe/1.0 (+https://stripe.com/docs/webhooks)" }),
        );
      }
    }
  }
}
