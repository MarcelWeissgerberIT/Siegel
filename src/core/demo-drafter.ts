// Offline "AI" used when no API key is configured (and in the GitHub Pages
// demo). It is a heuristic drafter: it extracts names, numbers, tools and
// pains from the notes and assembles a proposal from a library of modules.

import type { Draft, DraftInput } from "./ai";
import type { Brand } from "./types";

interface Module {
  id: string;
  match: RegExp;
  title: string;
  problem: string;
  solution: string;
  deliverables: string[];
  feature: string;
  weight: number;
}

const MODULES: Module[] = [
  {
    id: "leads",
    match: /\blead|inquir|enquir|form fill|response time|follow[- ]?up|prospect/i,
    title: "AI Lead Response",
    problem: "Inbound leads wait hours for a first reply, and the ones that go cold never come back.",
    solution: "An AI lead agent answers every new inquiry within 60 seconds, asks the qualifying questions your team asks today, and books qualified prospects straight into the calendar. Hot leads are flagged to a human instantly.",
    deliverables: ["AI lead-response agent across web form and email", "Lead qualification and scoring logic", "Calendar booking with reminders"],
    feature: "Lead agent replying in < 60 seconds",
    weight: 3,
  },
  {
    id: "crm",
    match: /crm|hubspot|salesforce|pipedrive|close\.com|zoho|data entry|copy[- ]?past|spreadsheet/i,
    title: "CRM Automation",
    problem: "Customer data is typed by hand into the CRM, so records are late, incomplete or duplicated.",
    solution: "Every email, form and call outcome is captured and written to the CRM automatically, deduplicated and enriched, so the pipeline is always up to date without anyone touching a keyboard.",
    deliverables: ["Two-way CRM sync with deduplication", "Automatic contact and company enrichment"],
    feature: "Hands-free CRM updates",
    weight: 2,
  },
  {
    id: "support",
    match: /support|ticket|helpdesk|zendesk|intercom|faq|customer service|chat ?bot|live chat/i,
    title: "AI Support Agent",
    problem: "The team answers the same customer questions again and again, and response times slip at peak hours.",
    solution: "A support agent trained on your help docs, policies and past tickets resolves routine questions 24/7 in your brand voice and hands complex cases to a human with a full summary.",
    deliverables: ["AI support agent trained on your knowledge base", "Human hand-off with conversation summary", "Weekly unresolved-question report"],
    feature: "24/7 AI support agent",
    weight: 3,
  },
  {
    id: "invoicing",
    match: /invoice|billing|quickbooks|xero|accounts receivable|payment reminder|bookkeep|reconcil/i,
    title: "Invoice Automation",
    problem: "Invoices are created and chased manually, which delays cash and eats hours of admin time every week.",
    solution: "Invoices are generated from completed work, sent automatically, and followed up with polite reminders until paid. Payments are reconciled in your accounting tool.",
    deliverables: ["Automated invoice generation and delivery", "Smart payment reminders", "Accounting reconciliation"],
    feature: "Automated invoicing & reminders",
    weight: 2,
  },
  {
    id: "onboarding",
    match: /onboard|welcome|kick[- ]?off|intake|new client|new customer|paperwork/i,
    title: "Client Onboarding Automation",
    problem: "Onboarding a new client takes days of back-and-forth emails, forms and manual setup.",
    solution: "The moment a deal is won, onboarding runs on its own: welcome email, intake form, folder and project setup, kickoff booking and internal notifications.",
    deliverables: ["One-click onboarding workflow", "Branded intake form", "Automatic project and folder setup"],
    feature: "Automated client onboarding",
    weight: 2,
  },
  {
    id: "voice",
    match: /phone|call(s)? (go|are|get) |missed call|voice|receptionist|answering/i,
    title: "AI Voice Receptionist",
    problem: "Calls go unanswered after hours and during busy periods, and every missed call is a missed booking.",
    solution: "An AI receptionist answers every call in a natural voice, books appointments, answers common questions and sends a summary of each call to the team.",
    deliverables: ["AI voice receptionist with custom script", "Calendar booking by phone", "Call summaries to CRM and Slack"],
    feature: "AI voice receptionist",
    weight: 3,
  },
  {
    id: "reporting",
    match: /report|dashboard|kpi|metrics|analytics|weekly numbers/i,
    title: "Automated Reporting",
    problem: "Reports are pieced together from several tools every week, so decisions are made on stale numbers.",
    solution: "A live dashboard pulls numbers from every tool automatically, and a weekly AI summary highlights what changed and what needs attention.",
    deliverables: ["Live KPI dashboard", "Weekly AI-written summary in Slack or email"],
    feature: "Live KPI dashboard",
    weight: 1,
  },
  {
    id: "content",
    match: /content|social|linkedin|newsletter|blog|post(s|ing)?\b|seo/i,
    title: "AI Content Engine",
    problem: "Publishing consistently takes more time than the team has, so marketing happens in bursts.",
    solution: "A content engine turns one input (a call, a voice memo, a case study) into a week of on-brand posts, a newsletter and a blog draft, with an approval step before anything is published.",
    deliverables: ["Content repurposing pipeline", "Brand voice guide for the AI", "Approval workflow before publishing"],
    feature: "Content engine with approvals",
    weight: 2,
  },
  {
    id: "scheduling",
    match: /schedul|booking|appointment|calendar|no[- ]?show|calendly/i,
    title: "Booking Automation",
    problem: "Scheduling back-and-forth and no-shows cost the team hours and revenue every week.",
    solution: "Self-serve booking with smart reminders, confirmations and automatic rescheduling cuts the back-and-forth to zero and reduces no-shows.",
    deliverables: ["Self-serve booking flow", "SMS and email reminder sequence", "No-show recovery workflow"],
    feature: "Booking & no-show reduction",
    weight: 1,
  },
  {
    id: "inbox",
    match: /inbox|email(s)? (pile|overload)|triage|too many emails|shared mailbox/i,
    title: "Inbox Triage",
    problem: "The shared inbox is overloaded; important emails get buried and replies are slow.",
    solution: "Every incoming email is classified, routed to the right person and answered with a suggested reply draft, so nothing important waits.",
    deliverables: ["Email classification and routing", "AI reply drafts for common requests"],
    feature: "AI inbox triage",
    weight: 1,
  },
];

const TOOLS = [
  "HubSpot", "Salesforce", "Pipedrive", "Gmail", "Outlook", "Slack", "Notion", "Airtable", "Google Sheets", "Shopify",
  "Stripe", "QuickBooks", "Xero", "Calendly", "Zendesk", "Intercom", "Twilio", "WhatsApp", "n8n", "Make", "Zapier",
  "Monday", "ClickUp", "Asana", "Typeform", "Webflow", "WordPress", "Teams", "Microsoft 365", "Google Workspace", "Jira", "Trello",
];

const STOP = new Set(["The", "This", "That", "They", "We", "Our", "Their", "Call", "Notes", "Budget", "Timeline", "Next", "Client", "Company", "Contact", "Meeting", "Discovery", "Today", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "AI"]);

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function round(n: number, step = 250) {
  return Math.max(step, Math.round(n / step) * step);
}

function parseBudget(notes: string): number | null {
  const m =
    notes.match(/budget[^.\n\d$€£]{0,30}[$€£]?\s?(\d[\d,.]*)\s?(k|K|thousand)?/) ||
    notes.match(/[$€£]\s?(\d[\d,.]*)\s?(k|K)?/) ||
    notes.match(/(\d[\d,.]*)\s?(k|K)\s?(budget|usd|eur|dollars|euros)?/);
  if (!m) return null;
  let n = parseFloat(m[1].replace(/,/g, "").replace(/\.(?=\d{3}\b)/g, ""));
  if (!Number.isFinite(n)) return null;
  if (m[2] && /k|thousand/i.test(m[2])) n *= 1000;
  if (n < 300 || n > 500000) return null;
  return n;
}

function findCompany(notes: string): string {
  const patterns = [
    /(?:client|company|business|account|org(?:anization)?)\s*[:\-–]\s*([^\n,.;(]{2,50})/i,
    /\bfrom\s+((?:[A-Z][\w&'’.-]*)(?:\s+(?:&\s+)?[A-Z][\w&'’.-]*){0,3})/,
    /\bat\s+((?:[A-Z][\w&'’.-]*)(?:\s+(?:&\s+)?[A-Z][\w&'’.-]*){0,3})/,
  ];
  for (const re of patterns) {
    const m = notes.match(re);
    if (m) {
      const c = m[1].trim().replace(/\s+(about|regarding|who|and|to)$/i, "");
      if (c && !STOP.has(c.split(" ")[0])) return c;
    }
  }
  return "";
}

function findPerson(notes: string): string {
  const patterns = [
    /(?:[Cc]ontact|[Nn]ame|[Ss]poke (?:to|with)|[Cc]all with|[Mm]eeting with|[Mm]et with|[Dd]iscovery call\s*[-–:]?)\s*[:\-–]?\s*(?:(?:Dr|Mr|Mrs|Ms)\.?\s+)?([A-Z][a-z]+(?:\s[A-Z][a-z'’-]+){1,2})/,
    /^([A-Z][a-z]+ [A-Z][a-z]+)\s*[,(-]/m,
  ];
  for (const re of patterns) {
    const m = notes.match(re);
    if (m && !STOP.has(m[1].split(" ")[0])) return m[1].trim();
  }
  return "";
}

function painSentences(notes: string): string[] {
  const sentences = notes
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.replace(/^[\s\-•*\d.)]+/, "").trim())
    .filter((s) => s.length > 18 && s.length < 220);
  const pain = /hours?|manual|slow|lose|losing|lost|miss|late|bottleneck|frustrat|waste|takes? (too )?long|by hand|copy|error|mistake|forget|drop|cold|backlog|overwhelm|can't keep up|no time/i;
  return sentences.filter((s) => pain.test(s)).slice(0, 4).map((s) => cap(s.replace(/[.;,]+$/, "")) + ".");
}

export function demoDraft(input: DraftInput, brand: Brand): Draft {
  const notes = input.notes;
  const hint = input.clientHint ?? {};
  const company = hint.company || findCompany(notes) || "your team";
  const person = hint.name || findPerson(notes);
  const email = hint.email || notes.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0] || "";
  const tools = TOOLS.filter((t) => new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(notes));
  const team = notes.match(/(\d+)\s*(people|employees|reps|agents|staff|team members|person team|locations|clinics|stores)/i);
  const hours = notes.match(/(\d+)\s*(\+\s*)?hours?\s*(a|per|each)?\s*(week|day|month)?/i);
  const retainer = /retainer|ongoing|monthly|every month|long[- ]term partner/i.test(notes);

  let modules = MODULES.filter((m) => m.match.test(notes));
  if (!modules.length) modules = [MODULES[0], MODULES[1]];
  modules = modules.sort((a, b) => b.weight - a.weight).slice(0, 4);
  const primary = modules[0];

  const budget = parseBudget(notes);
  const complexity = modules.reduce((s, m) => s + m.weight, 0);
  const growthPrice = budget ? round(budget * (retainer ? 1 : 0.95)) : round(retainer ? 1500 + complexity * 450 : 2200 + complexity * 1100);
  const starterPrice = round(growthPrice * 0.45);
  const scalePrice = round(growthPrice * 1.8);
  const billing = retainer ? "monthly" : "one-time";

  const companyLabel = company === "your team" ? "Your team" : company;
  const toolsText = tools.length ? ` It plugs into the tools you already use (${tools.slice(0, 5).join(", ")}), so nobody has to learn a new system.` : "";
  const hoursText = hours ? ` Today this costs roughly ${hours[1]} hours${hours[4] ? ` per ${hours[4]}` : ""}.` : "";

  const second = modules[1]?.title.replace(/^AI /, "");
  const title = second ? `${primary.title} & ${second}` : `${primary.title} for ${company === "your team" ? "Your Business" : company}`;
  const list = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}` : xs[0]);

  const executiveSummary =
    `${companyLabel} is growing faster than its manual processes can handle.${hoursText} ` +
    `We will design, build and launch ${modules.length > 1 ? `one connected system (${list(modules.map((m) => m.title))})` : `${/^[AEIOU]/.test(primary.title) ? "an" : "a"} ${primary.title} system`} that runs in the background 24/7.${toolsText} ` +
    `The recommended Growth package typically pays for itself within the first ${retainer ? "two months" : "quarter"}.`;

  const pains = painSentences(notes);
  const challengeBullets = [...pains, ...modules.map((m) => m.problem)].slice(0, 5);
  if (team) {
    const unit = team[2].toLowerCase();
    challengeBullets.push(
      /people|employees|staff|team members|person/.test(unit)
        ? `Your team of ${team[1]} spends hours on repetitive work instead of the work that grows the business.`
        : `With ${team[1]} ${unit}, every manual step is multiplied across the business.`,
    );
  }
  const challenge = challengeBullets.map((b) => `- ${b}`).join("\n");

  const solution =
    modules.map((m) => `**${m.title}.** ${m.solution}`).join("\n\n") +
    `\n\nEverything is built with monitoring, error alerts and a human-in-the-loop where it matters, and documented so your team stays in control.`;

  const deliverables = [
    ...modules.flatMap((m) => m.deliverables.slice(0, modules.length > 2 ? 2 : 3)),
    "Documentation and recorded walkthroughs for every workflow",
    "Live training session for your team",
    "30 days of post-launch support",
  ].slice(0, 9);

  const buildWeeks = Math.min(6, 1 + Math.ceil(complexity / 3));
  const timeline = retainer
    ? [
        { name: "Onboarding & audit", duration: "Week 1", description: "Access to your tools, audit of current workflows and a prioritised backlog." },
        { name: "First automation live", duration: "Weeks 2–3", description: `${primary.title} built, tested and launched.` },
        { name: "Monthly improvement cycles", duration: "Ongoing", description: "Plan, build and measure new automations every month, with a short report." },
      ]
    : [
        { name: "Discovery & process mapping", duration: "Week 1", description: "Interviews, tool access, success metrics and a signed-off blueprint." },
        { name: "Build & integrate", duration: buildWeeks > 2 ? `Weeks 2–${buildWeeks}` : "Week 2", description: `Build ${list(modules.map((m) => m.title))} with error handling, logging and alerts.` },
        { name: "Test with real data", duration: `Week ${buildWeeks + 1}`, description: "Run alongside your team, tune prompts and edge cases." },
        { name: "Launch & hand-off", duration: `Week ${buildWeeks + 2}`, description: "Go-live, training session, documentation and support handover." },
      ];

  const tiers: Draft["tiers"] = [
    {
      name: "Starter",
      price: starterPrice,
      billing,
      description: `Get ${primary.title} live fast and prove the ROI.`,
      features: [primary.feature, tools[0] ? `${tools[0]} integration` : "1 core integration", "Documentation", "14 days support"],
      recommended: false,
    },
    {
      name: "Growth",
      price: growthPrice,
      billing,
      description: "The complete system that removes the bottleneck.",
      features: [...modules.map((m) => m.feature), tools.length > 1 ? `Integrations with ${tools.slice(0, 3).join(", ")}` : "Up to 4 integrations", "Monitoring & error alerts", "Team training session", "30 days support"].slice(0, 7),
      recommended: true,
    },
    {
      name: "Scale",
      price: scalePrice,
      billing,
      description: "Everything in Growth, plus a quarter of optimisation.",
      features: ["Everything in Growth", "Custom KPI dashboard", "Priority support (4h response)", retainer ? "Dedicated automation lead" : "3 months of optimisation", "Quarterly ROI review"],
      recommended: false,
    },
  ];

  void brand;
  return {
    title,
    client: { name: person, company: company === "your team" ? "" : company, email },
    executiveSummary,
    challenge,
    solution,
    deliverables,
    timeline,
    tiers,
    depositPercent: retainer ? 100 : 50,
  };
}
