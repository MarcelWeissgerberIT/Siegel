import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCertificatePdf, extractEvidenceFromPdf } from "../src/core/certificate";
import { verifyChain, verifyEvidence } from "../src/core/chain";
import { canonicalize, sha256Hex } from "../src/core/crypto";
import { demoDraft } from "../src/core/demo-drafter";
import { draftToProposal } from "../src/core/ai";
import { SAMPLE_NOTES } from "../src/core/samples";
import { SEED_SIGNATURES } from "../src/core/seed-signatures";
import { SiegelService, type Ctx } from "../src/core/service";
import type { WebhookDelivery } from "../src/core/types";
import { MemoryRepo } from "./memory-repo";

const ctx: Ctx = { ip: "203.0.113.7", userAgent: "test", baseUrl: "https://siegel.test" };
const signature = Object.values(SEED_SIGNATURES)[0];

async function signedProposal(opts: { simulated?: boolean } = {}) {
  const repo = new MemoryRepo();
  const delivered: { event: string; payload: unknown }[] = [];
  const service = new SiegelService({
    repo,
    mode: "server",
    allowSimulatedPayments: opts.simulated ?? true,
    deliver: async (hook, event, payload) => {
      delivered.push({ event, payload });
      return { id: "d", webhookId: hook.id, url: hook.url, event, proposalId: null, status: 200, ok: true, error: null, durationMs: 1, at: "", payload } as WebhookDelivery;
    },
  });
  await service.updateSettings({
    webhooks: [{ id: "wh1", url: "https://hooks.test/x", secret: "", events: ["proposal.viewed", "proposal.signed", "proposal.paid"], active: true, createdAt: "" }],
  });
  const input = { notes: SAMPLE_NOTES, currency: "USD" as const };
  const p = await service.createProposal(draftToProposal(demoDraft(input, (await service.settings()).brand), input), ctx);
  await service.sendProposal(p.id, ctx);
  await service.recordView(p.token, "session-1", ctx);
  const pub = await service.getPublic(p.token);
  const tier = pub.document.tiers.find((t) => t.recommended)!;
  await service.sign(p.token, { tierId: tier.id, name: "Daniel Weber", email: "daniel@example.com", image: signature, docHash: pub.documentHash, consent: true }, ctx);
  return { repo, service, p, tier, delivered };
}

describe("canonical JSON", () => {
  it("is independent of key order", () => {
    assert.equal(canonicalize({ b: 1, a: { d: [1, 2], c: "x" } }), canonicalize({ a: { c: "x", d: [1, 2] }, b: 1 }));
  });
  it("hashes deterministically", async () => {
    assert.equal(await sha256Hex("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});

describe("demo drafter", () => {
  it("extracts client, budget and builds three tiers", () => {
    const d = demoDraft({ notes: SAMPLE_NOTES, currency: "USD" }, {} as never);
    assert.equal(d.client.name, "Daniel Weber");
    assert.equal(d.client.company, "Northwall Roofing");
    assert.equal(d.tiers.length, 3);
    assert.equal(d.tiers.filter((t) => t.recommended).length, 1);
    assert.ok(d.tiers[1].price >= 7000 && d.tiers[1].price <= 8500, `growth price ${d.tiers[1].price}`);
  });
});

describe("signing flow", () => {
  it("records a valid hash chain created → sent → viewed → signed → paid", async () => {
    const { service, p, delivered } = await signedProposal();
    await service.markPaid(p.id, { method: "stripe", reference: "cs_test" }, ctx);
    const d = await service.detail(p.id);
    assert.deepEqual(d.events.map((e) => e.type), ["created", "sent", "viewed", "signed", "paid"]);
    assert.equal(d.verification.valid, true);
    assert.equal(d.proposal.status, "paid");
    await new Promise((r) => setTimeout(r, 10));
    assert.deepEqual(delivered.map((x) => x.event), ["proposal.viewed", "proposal.signed", "proposal.paid"]);
  });

  it("refuses to sign a document version the client didn't see", async () => {
    const { service, p } = await signedProposal();
    const dup = await service.duplicateProposal(p.id, ctx);
    await service.sendProposal(dup.id, ctx);
    const pub = await service.getPublic(dup.token);
    await service.updateProposal(dup.id, { title: "Changed after viewing" });
    await service.sendProposal(dup.id, ctx);
    await assert.rejects(
      service.sign(dup.token, { tierId: pub.document.tiers[0].id, name: "X Y", email: "", image: signature, docHash: pub.documentHash, consent: true }, ctx),
      /updated while you were reading/,
    );
  });

  it("seals signed proposals against edits", async () => {
    const { service, p } = await signedProposal();
    await assert.rejects(service.updateProposal(p.id, { title: "nope" }), /sealed/);
  });
});

describe("tamper evidence", () => {
  it("detects content changed in storage after signing", async () => {
    const { service, p } = await signedProposal();
    await service.tamper(p.id);
    const bad = await service.detail(p.id);
    assert.equal(bad.verification.valid, false);
    await service.restore(p.id);
    assert.equal((await service.detail(p.id)).verification.valid, true);
  });

  it("detects an edited audit event", async () => {
    const { repo, p } = await signedProposal();
    const events = await repo.listEvents(p.id);
    events[2].ip = "10.0.0.1"; // rewrite history
    const res = await verifyChain(events);
    assert.equal(res.brokenAtSeq, 2);
  });
});

describe("certificate", () => {
  it("embeds evidence that round-trips and verifies offline", async () => {
    const { service, p } = await signedProposal();
    const ev = await service.evidenceById(p.id, ctx);
    const pdf = await buildCertificatePdf(ev, "Test Agency");
    assert.ok(pdf.byteLength > 10_000);
    const extracted = await extractEvidenceFromPdf(pdf);
    assert.ok(extracted);
    assert.equal((await verifyEvidence(extracted!)).valid, true);
    extracted!.document.tiers[0].price += 1;
    const report = await verifyEvidence(extracted!);
    assert.equal(report.valid, false);
    assert.equal(report.checks.find((c) => c.id === "document")?.ok, false);
  });
});
