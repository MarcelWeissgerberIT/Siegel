import { randomId } from "./crypto";
import type { Brand, PricingBlock, Settings, Template, Tier } from "./types";

export const DEFAULT_TERMS = `- **Deposit.** Work starts once the deposit is received. The remaining balance is invoiced on delivery.
- **Scope.** Changes outside the agreed scope are quoted separately before any work begins.
- **Ownership.** All workflows, prompts and documentation become your property upon final payment.
- **Third-party costs.** API, hosting and software subscriptions are billed by the providers directly to you.
- **Confidentiality.** Both parties keep each other's business information confidential.
- **Support.** Includes 30 days of bug-fix support after hand-off.`;

export const DEFAULT_BRAND: Brand = {
  companyName: "Your Agency",
  contactName: "Your Name",
  email: "hello@youragency.com",
  website: "youragency.com",
  address: "",
  tagline: "AI automation that pays for itself",
  logo: null,
  accent: "#E0442B",
  defaultCurrency: "USD",
  defaultDeposit: 50,
  defaultTerms: DEFAULT_TERMS,
  defaultValidityDays: 14,
};

export const DEFAULT_MODELS = {
  anthropic: "claude-opus-5-5",
  openai: "gpt-5.1",
  openrouter: "anthropic/claude-opus-5.5",
  demo: "siegel-demo-drafter",
} as const;

export function defaultSettings(): Settings {
  return {
    brand: { ...DEFAULT_BRAND },
    ai: { provider: "demo", model: DEFAULT_MODELS.demo, apiKey: "" },
    webhooks: [],
    stripeWebhookSecret: "",
    stripeSecretKey: "",
    stripeWebhookEndpoint: null,
    publicUrl: "",
  };
}

export function mergeSettings(stored: Partial<Settings> | null | undefined): Settings {
  const d = defaultSettings();
  if (!stored) return d;
  return {
    ...d,
    ...stored,
    brand: { ...d.brand, ...(stored.brand ?? {}) },
    ai: { ...d.ai, ...(stored.ai ?? {}) },
    webhooks: stored.webhooks ?? [],
  };
}

export function tier(partial: Partial<Tier> & Pick<Tier, "name" | "price">): Tier {
  return {
    id: "tier_" + randomId(8),
    billing: "one-time",
    description: "",
    features: [],
    recommended: false,
    paymentLink: "",
    ...partial,
  };
}

const sec = (title: string, body: string) => ({ id: "sec_" + randomId(8), title, body });
const phase = (name: string, duration: string, description: string) => ({ id: "ph_" + randomId(8), name, duration, description });

export function starterTemplates(now: string): Template[] {
  return [
    {
      id: "tpl_" + randomId(10),
      name: "AI Automation Build",
      description: "Discovery, build and hand-off of a custom automation system. Three fixed-price tiers.",
      createdAt: now,
      terms: DEFAULT_TERMS,
      sections: [
        sec("Executive summary", "A short, outcome-focused summary of what we will build and why it matters."),
        sec("The challenge", "- Where time and money leak today\n- What it costs per month\n- Why now"),
        sec("Proposed solution", "How the system works end to end, which tools it connects and what changes for the team."),
        sec("Deliverables", "- Production workflows\n- Documentation and Loom walkthroughs\n- 30 days of support"),
      ],
      timeline: [
        phase("Discovery & mapping", "Week 1", "Process interviews, data access, success metrics."),
        phase("Build & integrate", "Weeks 2–3", "Workflows, prompts, error handling and logging."),
        phase("Launch & hand-off", "Week 4", "Go-live, training session and documentation."),
      ],
      tiers: [
        tier({ name: "Starter", price: 2500, description: "One core workflow, live in two weeks.", features: ["1 production workflow", "Up to 3 integrations", "Documentation", "14 days support"] }),
        tier({ name: "Growth", price: 6500, recommended: true, description: "The full system that removes the bottleneck.", features: ["Up to 4 workflows", "AI agent with guardrails", "Error alerts & logging", "Team training session", "30 days support"] }),
        tier({ name: "Scale", price: 12000, description: "End-to-end automation plus a quarter of optimisation.", features: ["Everything in Growth", "Custom dashboard", "Priority support (4h SLA)", "3 months optimisation"] }),
      ],
    },
    {
      id: "tpl_" + randomId(10),
      name: "Monthly Automation Retainer",
      description: "Ongoing automation partner with monthly billing.",
      createdAt: now,
      terms: DEFAULT_TERMS.replace("The remaining balance is invoiced on delivery.", "The retainer renews monthly and can be cancelled with 30 days notice."),
      sections: [
        sec("Executive summary", "A dedicated automation partner who ships improvements every month."),
        sec("How the retainer works", "- Monthly planning call\n- Shared backlog with clear priorities\n- Weekly async updates"),
        sec("What's included", "- Building new automations\n- Maintaining and monitoring existing ones\n- Quarterly ROI report"),
      ],
      timeline: [
        phase("Onboarding", "Week 1", "Access, audit of existing workflows, backlog."),
        phase("Monthly cycles", "Ongoing", "Plan → build → measure, every month."),
      ],
      tiers: [
        tier({ name: "Essentials", price: 1500, billing: "monthly", description: "Keep everything running.", features: ["Monitoring & fixes", "Up to 10 hours/month", "Monthly report"] }),
        tier({ name: "Partner", price: 3500, billing: "monthly", recommended: true, description: "Ship something new every month.", features: ["Up to 30 hours/month", "New automations", "Slack channel", "Quarterly ROI review"] }),
        tier({ name: "Embedded", price: 7500, billing: "monthly", description: "Your fractional automation team.", features: ["Up to 70 hours/month", "Weekly calls", "Same-day response"] }),
      ],
    },
    {
      id: "tpl_" + randomId(10),
      name: "AI Audit & Roadmap",
      description: "A paid discovery engagement that de-risks the bigger build.",
      createdAt: now,
      terms: DEFAULT_TERMS,
      sections: [
        sec("Executive summary", "In two weeks you get a prioritised, costed roadmap of the automations with the highest ROI."),
        sec("Approach", "- Stakeholder interviews\n- Process and tool audit\n- ROI model per opportunity"),
        sec("Deliverables", "- Opportunity map\n- Prioritised roadmap\n- Architecture recommendation\n- Fixed-price quote for phase 1"),
      ],
      timeline: [
        phase("Interviews", "Days 1–4", "Talk to the people doing the work."),
        phase("Analysis", "Days 5–8", "Map processes, score opportunities."),
        phase("Roadmap", "Days 9–10", "Presentation and written report."),
      ],
      tiers: [
        tier({ name: "Audit", price: 1800, description: "Roadmap for one department.", features: ["Up to 5 interviews", "Written roadmap"] }),
        tier({ name: "Audit + Prototype", price: 4200, recommended: true, description: "Roadmap plus a working prototype.", features: ["Everything in Audit", "1 working prototype", "Recorded walkthrough"] }),
      ],
    },
  ];
}

export function starterBlocks(now: string): PricingBlock[] {
  const mk = (t: Omit<Tier, "id">): PricingBlock => ({ id: "blk_" + randomId(10), name: t.name, tier: t, createdAt: now });
  return [
    mk({ name: "Lead Response Agent", price: 3200, billing: "one-time", description: "AI agent that qualifies and answers inbound leads in under a minute.", features: ["Website + email intake", "CRM sync", "Calendar booking", "Human hand-off"], recommended: false, paymentLink: "" }),
    mk({ name: "Ops Care Plan", price: 900, billing: "monthly", description: "Monitoring, fixes and small improvements.", features: ["Uptime monitoring", "Monthly tune-up", "Email support"], recommended: false, paymentLink: "" }),
    mk({ name: "Voice Receptionist", price: 4800, billing: "one-time", description: "24/7 AI phone agent that books appointments.", features: ["Custom voice & script", "Calendar integration", "Call summaries to CRM"], recommended: false, paymentLink: "" }),
  ];
}
