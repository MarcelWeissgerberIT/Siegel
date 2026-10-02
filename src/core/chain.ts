import { GENESIS_HASH, hashCanonical, randomId, sha256Hex, canonicalize } from "./crypto";
import type {
  Brand,
  ChainEvent,
  Check,
  EventType,
  EvidencePackage,
  Proposal,
  ProposalDocument,
  VerificationReport,
  DocVersion,
} from "./types";

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------

export function buildDocument(p: Proposal, brand: Brand, version: number, issuedAt: string): ProposalDocument {
  return {
    schema: "siegel.proposal/v1",
    proposalId: p.id,
    number: p.number,
    version,
    issuedAt,
    title: p.title.trim(),
    issuer: {
      company: brand.companyName,
      contactName: brand.contactName,
      email: brand.email,
      website: brand.website,
      address: brand.address,
    },
    client: { name: p.client.name.trim(), company: p.client.company.trim(), email: p.client.email.trim() },
    currency: p.currency,
    sections: p.sections.map((s) => ({ title: s.title.trim(), body: s.body.trim() })),
    timeline: p.timeline.map((t) => ({ name: t.name.trim(), duration: t.duration.trim(), description: t.description.trim() })),
    tiers: p.tiers.map((t) => ({
      id: t.id,
      name: t.name.trim(),
      price: Math.round(t.price * 100) / 100,
      billing: t.billing,
      description: t.description.trim(),
      features: t.features.map((f) => f.trim()).filter(Boolean),
      recommended: !!t.recommended,
    })),
    depositPercent: p.depositPercent,
    validUntil: p.validUntil,
    terms: p.terms.trim(),
  };
}

export function hashDocument(doc: ProposalDocument): Promise<string> {
  return hashCanonical(doc);
}

// ---------------------------------------------------------------------------
// Hash-chained event log
// ---------------------------------------------------------------------------

type EventMaterial = Omit<ChainEvent, "hash" | "id">;

function material(e: EventMaterial) {
  return {
    proposalId: e.proposalId,
    seq: e.seq,
    type: e.type,
    at: e.at,
    ip: e.ip,
    userAgent: e.userAgent,
    data: e.data,
    prevHash: e.prevHash,
  };
}

export function computeEventHash(e: EventMaterial): Promise<string> {
  return hashCanonical(material(e));
}

export async function createEvent(
  previous: ChainEvent | null,
  input: { proposalId: string; type: EventType; at: string; ip: string; userAgent: string; data: Record<string, unknown> },
): Promise<ChainEvent> {
  const base: EventMaterial = {
    proposalId: input.proposalId,
    seq: previous ? previous.seq + 1 : 0,
    type: input.type,
    at: input.at,
    ip: input.ip,
    userAgent: input.userAgent,
    data: JSON.parse(canonicalize(input.data)),
    prevHash: previous ? previous.hash : GENESIS_HASH,
  };
  return { id: "evt_" + randomId(14), ...base, hash: await computeEventHash(base) };
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

export async function verifyChain(events: ChainEvent[]) {
  const sorted = [...events].sort((a, b) => a.seq - b.seq);
  const results: VerificationReport["eventResults"] = [];
  let brokenAtSeq: number | null = null;
  let prev = GENESIS_HASH;
  for (let i = 0; i < sorted.length; i++) {
    const e = sorted[i];
    const expected = await computeEventHash(e);
    const ok = expected === e.hash && e.seq === i;
    const linkOk = e.prevHash === prev;
    results.push({ seq: e.seq, ok, linkOk, expected });
    if ((!ok || !linkOk) && brokenAtSeq === null) brokenAtSeq = e.seq;
    prev = e.hash;
  }
  return { results, brokenAtSeq, head: sorted.length ? sorted[sorted.length - 1].hash : null };
}

function fmtSeq(n: number | null) {
  return n === null ? "" : `event #${n}`;
}

/**
 * Verify a portable evidence package (from a certificate PDF or JSON export).
 * Runs entirely client-side: no trust in any server is required.
 */
export async function verifyEvidence(ev: EvidencePackage): Promise<VerificationReport> {
  const checks: Check[] = [];
  const docHash = await hashDocument(ev.document);
  checks.push({
    id: "document",
    label: "Document fingerprint matches",
    ok: docHash === ev.documentHash,
    detail:
      docHash === ev.documentHash
        ? `SHA-256 of the signed document recomputes to ${docHash.slice(0, 16)}…`
        : `Recomputed ${docHash.slice(0, 16)}… but the record says ${ev.documentHash.slice(0, 16)}…. The content was changed after signing.`,
  });

  const chain = await verifyChain(ev.events);
  const chainOk = chain.brokenAtSeq === null && ev.events.length > 0;
  checks.push({
    id: "chain",
    label: "Audit trail is unbroken",
    ok: chainOk,
    detail: chainOk
      ? `${ev.events.length} events, every hash recomputes and links to its predecessor.`
      : `The hash chain breaks at ${fmtSeq(chain.brokenAtSeq)}: an event was edited, removed or reordered.`,
  });

  const signed = ev.events.find((e) => e.type === "signed");
  const signedOk = !!signed && signed.data.docHash === docHash;
  checks.push({
    id: "signed-event",
    label: "Signature is bound to this exact document",
    ok: signedOk,
    detail: signed
      ? signedOk
        ? `The signing event (#${signed.seq}) commits to fingerprint ${String(signed.data.docHash).slice(0, 16)}…`
        : `The signing event commits to ${String(signed.data.docHash).slice(0, 16)}…, not to this document.`
      : "No signing event found in the audit trail.",
  });

  let imageOk = false;
  if (ev.signature?.image) {
    const imgHash = await sha256Hex(ev.signature.image);
    imageOk = imgHash === ev.signature.imageHash && (!signed || signed.data.imageHash === imgHash);
  }
  checks.push({
    id: "signature-image",
    label: "Drawn signature is untouched",
    ok: imageOk,
    detail: imageOk
      ? "The signature image hashes to the value recorded at signing time."
      : "The signature image does not match the hash recorded at signing time.",
  });

  const headOk = chain.head === ev.chainHead;
  checks.push({
    id: "head",
    label: "Chain head matches certificate",
    ok: headOk,
    detail: headOk ? `Head ${String(chain.head).slice(0, 16)}…` : "The latest event hash differs from the certified chain head.",
  });

  return {
    valid: checks.every((c) => c.ok),
    checks,
    brokenAtSeq: chain.brokenAtSeq,
    chainHead: chain.head,
    eventResults: chain.results,
  };
}

/** Verify the live record stored on this instance (detects tampering in the database). */
export async function verifyRecord(p: Proposal, versions: DocVersion[], events: ChainEvent[]): Promise<VerificationReport> {
  const checks: Check[] = [];
  const chain = await verifyChain(events);
  const chainOk = chain.brokenAtSeq === null;
  checks.push({
    id: "chain",
    label: "Audit trail is unbroken",
    ok: chainOk,
    detail: chainOk
      ? `${events.length} events, every hash recomputes and links to its predecessor.`
      : `The hash chain breaks at ${fmtSeq(chain.brokenAtSeq)}.`,
  });

  let allVersionsOk = true;
  let firstBad: number | null = null;
  for (const v of versions) {
    const h = await hashDocument(v.content);
    const published = events.find((e) => (e.type === "sent" || e.type === "revised") && e.data.version === v.version);
    if (h !== v.hash || (published && published.data.docHash !== h)) {
      allVersionsOk = false;
      if (firstBad === null) firstBad = v.version;
    }
  }
  checks.push({
    id: "versions",
    label: "Every published version matches its fingerprint",
    ok: allVersionsOk,
    detail: versions.length === 0
      ? "Nothing has been published yet."
      : allVersionsOk
        ? `${versions.length} version${versions.length === 1 ? "" : "s"} re-hashed successfully.`
        : `Version ${firstBad} no longer matches the fingerprint recorded when it was sent. The content was altered.`,
  });

  if (p.signature) {
    const signed = events.find((e) => e.type === "signed");
    const v = versions.find((x) => x.version === p.signature!.version);
    const h = v ? await hashDocument(v.content) : null;
    const ok = !!signed && !!h && signed.data.docHash === h;
    checks.push({
      id: "signed-event",
      label: "Signed content is exactly what the client saw",
      ok,
      detail: ok
        ? `The signature commits to v${p.signature.version} · ${h!.slice(0, 16)}…`
        : `The signed version re-hashes to ${h ? h.slice(0, 16) + "…" : "nothing"}, but the signature committed to ${String(signed?.data.docHash ?? "").slice(0, 16)}…`,
    });
    const imgHash = await sha256Hex(p.signature.image);
    const imgOk = imgHash === p.signature.imageHash && signed?.data.imageHash === imgHash;
    checks.push({
      id: "signature-image",
      label: "Drawn signature is untouched",
      ok: imgOk,
      detail: imgOk ? "Signature image hash verified." : "Signature image hash mismatch.",
    });
  }

  return {
    valid: checks.every((c) => c.ok),
    checks,
    brokenAtSeq: chain.brokenAtSeq,
    chainHead: chain.head,
    eventResults: chain.results,
  };
}

export const EVENT_LABELS: Record<EventType, string> = {
  created: "Created",
  sent: "Sent to client",
  revised: "Revision published",
  viewed: "Opened by client",
  signed: "Signed",
  paid: "Deposit paid",
};
