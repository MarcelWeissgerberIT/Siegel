import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFFont,
  PDFHexString,
  PDFName,
  PDFPage,
  PDFRawStream,
  PDFString,
  StandardFonts,
  decodePDFRawStream,
  rgb,
  type RGB,
} from "pdf-lib";
import QRCode from "qrcode";
import { EVENT_LABELS } from "./chain";
import { deviceFromUA, isoUtc, money } from "./format";
import type { EvidencePackage } from "./types";

export const EVIDENCE_FILENAME = "siegel-evidence.json";

const A4 = { w: 595.28, h: 841.89 };
const M = 48;

const C = {
  ink: rgb(0.078, 0.067, 0.059),
  paper: rgb(0.984, 0.973, 0.953),
  muted: rgb(0.42, 0.39, 0.36),
  line: rgb(0.86, 0.83, 0.79),
  wax: rgb(0.78, 0.2, 0.13),
  waxDark: rgb(0.55, 0.12, 0.08),
  gold: rgb(0.72, 0.56, 0.3),
  white: rgb(1, 1, 1),
  green: rgb(0.16, 0.55, 0.38),
};

const WIN_ANSI_EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";
const REPLACE: Record<string, string> = { "→": "->", "←": "<-", "≥": ">=", "≤": "<=", "✓": "v", "×": "x", "−": "-", " ": " ", "‑": "-" };

/** Standard PDF fonts only support WinAnsi; map or drop everything else. */
export function pdfSafe(text: string): string {
  let out = "";
  for (const ch of text.normalize("NFC")) {
    const code = ch.codePointAt(0)!;
    if (code === 10 || (code >= 32 && code < 127) || (code >= 160 && code <= 255) || WIN_ANSI_EXTRA.includes(ch)) out += ch;
    else if (REPLACE[ch]) out += REPLACE[ch];
    else if (code === 9) out += "  ";
    else out += "";
  }
  return out;
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  for (const para of pdfSafe(text).split("\n")) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const w of words) {
      const test = line ? line + " " + w : w;
      if (font.widthOfTextAtSize(test, size) <= width) line = test;
      else {
        if (line) lines.push(line);
        // hard-break very long tokens (hashes, URLs)
        let rest = w;
        while (font.widthOfTextAtSize(rest, size) > width) {
          let i = rest.length;
          while (i > 1 && font.widthOfTextAtSize(rest.slice(0, i), size) > width) i--;
          lines.push(rest.slice(0, i));
          rest = rest.slice(i);
        }
        line = rest;
      }
    }
    lines.push(line);
  }
  return lines;
}

function stripMd(s: string) {
  return s.replace(/\*\*(.+?)\*\*/g, "$1").replace(/__(.+?)__/g, "$1");
}

function drawSeal(page: PDFPage, cx: number, cy: number, r: number, fonts: { serifBold: PDFFont }) {
  // irregular wax blob
  const blobs = 14;
  for (let i = 0; i < blobs; i++) {
    const a = (i / blobs) * Math.PI * 2;
    page.drawCircle({ x: cx + Math.cos(a) * r * 0.82, y: cy + Math.sin(a) * r * 0.82, size: r * 0.26, color: C.wax });
  }
  page.drawCircle({ x: cx, y: cy, size: r, color: C.wax });
  page.drawCircle({ x: cx, y: cy, size: r * 0.74, color: C.waxDark, opacity: 0.35 });
  page.drawCircle({ x: cx, y: cy, size: r * 0.7, borderColor: rgb(1, 0.82, 0.74), borderWidth: 0.8, borderOpacity: 0.7 });
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    const r1 = r * 0.76;
    const r2 = r * (i % 4 === 0 ? 0.88 : 0.83);
    page.drawLine({
      start: { x: cx + Math.cos(a) * r1, y: cy + Math.sin(a) * r1 },
      end: { x: cx + Math.cos(a) * r2, y: cy + Math.sin(a) * r2 },
      thickness: 0.6,
      color: rgb(1, 0.85, 0.78),
      opacity: 0.75,
    });
  }
  const size = r * 1.05;
  const w = fonts.serifBold.widthOfTextAtSize("S", size);
  page.drawText("S", { x: cx - w / 2, y: cy - size * 0.34, size, font: fonts.serifBold, color: rgb(1, 0.93, 0.88) });
}

async function drawQr(page: PDFPage, text: string, x: number, y: number, size: number, color: RGB) {
  const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const cell = size / n;
  page.drawRectangle({ x: x - 6, y: y - 6, width: size + 12, height: size + 12, color: C.white, borderColor: C.line, borderWidth: 0.5 });
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++)
      if (qr.modules.get(r, c)) page.drawRectangle({ x: x + c * cell, y: y + size - (r + 1) * cell, width: cell + 0.05, height: cell + 0.05, color });
}

function dataUrlBytes(dataUrl: string): Uint8Array {
  const b64 = dataUrl.split(",")[1] ?? "";
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function buildCertificatePdf(ev: EvidencePackage, brandName: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const fonts = {
    sans: await pdf.embedFont(StandardFonts.Helvetica),
    sansBold: await pdf.embedFont(StandardFonts.HelveticaBold),
    serif: await pdf.embedFont(StandardFonts.TimesRoman),
    serifBold: await pdf.embedFont(StandardFonts.TimesRomanBold),
    serifItalic: await pdf.embedFont(StandardFonts.TimesRomanItalic),
    mono: await pdf.embedFont(StandardFonts.Courier),
    monoBold: await pdf.embedFont(StandardFonts.CourierBold),
  };
  const doc = ev.document;
  const cur = doc.currency;
  const txt = (page: PDFPage, s: string, x: number, y: number, size: number, font: PDFFont, color: RGB = C.ink) =>
    page.drawText(pdfSafe(s), { x, y, size, font, color });

  pdf.setTitle(`Certificate of Completion · ${doc.number} · ${doc.title}`);
  pdf.setSubject(`siegel:document:${ev.documentHash}`);
  pdf.setKeywords([`siegel:chain:${ev.chainHead}`, `siegel:proposal:${ev.proposalId}`]);
  pdf.setProducer("Siegel");
  pdf.setCreator("Siegel · proposals that close themselves");
  pdf.setCreationDate(new Date(ev.generatedAt));

  // ------------------------------------------------------------ page 1
  const page = pdf.addPage([A4.w, A4.h]);
  page.drawRectangle({ x: 0, y: 0, width: A4.w, height: A4.h, color: C.paper });
  page.drawRectangle({ x: 0, y: A4.h - 150, width: A4.w, height: 150, color: C.ink });
  page.drawRectangle({ x: 0, y: A4.h - 153, width: A4.w, height: 3, color: C.wax });
  // guilloche-ish lines in the band
  for (let i = 0; i < 26; i++) {
    page.drawEllipse({ x: A4.w - 120, y: A4.h - 75, xScale: 160 + i * 9, yScale: 30 + i * 4, borderColor: C.gold, borderWidth: 0.25, borderOpacity: 0.18 });
  }
  txt(page, brandName.toUpperCase(), M, A4.h - 52, 9, fonts.sansBold, rgb(0.85, 0.78, 0.7));
  txt(page, "Certificate of Completion", M, A4.h - 92, 30, fonts.serif, C.white);
  txt(page, "Electronic signature with a tamper-evident, hash-chained audit trail", M, A4.h - 116, 10, fonts.sans, rgb(0.75, 0.7, 0.65));
  drawSeal(page, A4.w - 92, A4.h - 150, 40, fonts);

  let y = A4.h - 196;
  txt(page, `${doc.number} · Version ${doc.version}`, M, y, 9, fonts.sansBold, C.wax);
  y -= 26;
  for (const line of wrap(doc.title, fonts.serif, 22, A4.w - 2 * M - 60).slice(0, 2)) {
    txt(page, line, M, y, 22, fonts.serif);
    y -= 26;
  }
  txt(page, `Between ${doc.issuer.company} and ${doc.client.company || doc.client.name}`, M, y + 4, 10.5, fonts.serifItalic, C.muted);
  y -= 26;

  // details grid
  const tier = doc.tiers.find((t) => t.id === ev.signature.tierId);
  const signedEvent = ev.events.find((e) => e.type === "signed");
  const rows: [string, string][] = [
    ["Signed by", `${ev.signature.name}${ev.signature.email ? ` <${ev.signature.email}>` : ""}`],
    ["Signed at", isoUtc(ev.signature.signedAt)],
    ["Package", `${ev.signature.tierName}${tier ? ` · ${money(tier.price, cur)}${tier.billing === "monthly" ? " / month" : ""}` : ""}`],
    ["Deposit", ev.payment ? `${money(ev.payment.amount, cur, { cents: true })} paid ${isoUtc(ev.payment.paidAt)} (${ev.payment.method})` : `${money(ev.signature.deposit, cur, { cents: true })} (pending)`],
    ["Signer IP", signedEvent?.ip ?? "—"],
    ["Signer device", deviceFromUA(signedEvent?.userAgent ?? "")],
  ];
  const colW = (A4.w - 2 * M) / 2;
  rows.forEach(([k, v], i) => {
    const cx = M + (i % 2) * colW;
    const cy = y - Math.floor(i / 2) * 34;
    txt(page, k.toUpperCase(), cx, cy, 7, fonts.sansBold, C.muted);
    txt(page, wrap(v, fonts.sans, 9.5, colW - 16)[0] ?? "", cx, cy - 13, 9.5, fonts.sans);
  });
  y -= Math.ceil(rows.length / 2) * 34 + 6;

  // signature box
  const boxH = 92;
  page.drawRectangle({ x: M, y: y - boxH, width: A4.w - 2 * M, height: boxH, color: C.white, borderColor: C.line, borderWidth: 0.6 });
  txt(page, "SIGNATURE", M + 14, y - 18, 7, fonts.sansBold, C.muted);
  try {
    const img = await pdf.embedPng(dataUrlBytes(ev.signature.image));
    const maxW = 220;
    const maxH = 56;
    const scale = Math.min(maxW / img.width, maxH / img.height);
    page.drawImage(img, { x: M + 14, y: y - boxH + 12, width: img.width * scale, height: img.height * scale });
  } catch {
    txt(page, ev.signature.name, M + 14, y - 60, 24, fonts.serifItalic);
  }
  const sx = M + 270;
  txt(page, ev.signature.name, sx, y - 36, 14, fonts.serif);
  txt(page, "Typed name, drawn signature and consent recorded", sx, y - 52, 8, fonts.sans, C.muted);
  txt(page, "SIGNATURE IMAGE SHA-256", sx, y - 64, 6.5, fonts.sansBold, C.muted);
  txt(page, ev.signature.imageHash.slice(0, 32), sx, y - 74, 6.8, fonts.mono, C.muted);
  txt(page, ev.signature.imageHash.slice(32), sx, y - 82, 6.8, fonts.mono, C.muted);
  y -= boxH + 22;

  // fingerprint
  page.drawRectangle({ x: M, y: y - 54, width: A4.w - 2 * M, height: 54, color: rgb(0.965, 0.945, 0.915), borderColor: C.line, borderWidth: 0.6 });
  txt(page, "DOCUMENT FINGERPRINT · SHA-256 OF THE SIGNED VERSION", M + 14, y - 16, 7, fonts.sansBold, C.wax);
  txt(page, ev.documentHash, M + 14, y - 34, 9.6, fonts.monoBold);
  txt(page, "Recompute it from the embedded siegel-evidence.json: sha256(canonical JSON of .document)", M + 14, y - 47, 7.5, fonts.sans, C.muted);
  y -= 76;

  // audit trail
  txt(page, "Audit trail", M, y, 13, fonts.serif);
  txt(page, "Each entry commits to the previous one. Changing any byte breaks every hash after it.", M + 78, y + 1, 8, fonts.sans, C.muted);
  y -= 16;
  const cols = [M, M + 22, M + 128, M + 252, M + 330];
  ["#", "EVENT", "TIMESTAMP (UTC)", "IP", "HASH  <-  PREVIOUS"].forEach((h, i) => txt(page, h, cols[i], y, 6.8, fonts.sansBold, C.muted));
  y -= 6;
  page.drawLine({ start: { x: M, y }, end: { x: A4.w - M, y }, thickness: 0.6, color: C.line });
  for (const e of ev.events) {
    y -= 15;
    if (y < 120) break;
    txt(page, String(e.seq), cols[0], y, 8, fonts.mono, C.muted);
    txt(page, EVENT_LABELS[e.type], cols[1], y, 8.5, fonts.sansBold);
    txt(page, isoUtc(e.at).replace(" UTC", ""), cols[2], y, 8, fonts.mono);
    txt(page, e.ip.slice(0, 15), cols[3], y, 8, fonts.mono);
    txt(page, `${e.hash.slice(0, 16)}  <-  ${e.prevHash.slice(0, 8)}`, cols[4], y, 8, fonts.mono);
    page.drawLine({ start: { x: M, y: y - 5 }, end: { x: A4.w - M, y: y - 5 }, thickness: 0.3, color: C.line });
  }
  y -= 22;
  txt(page, "CHAIN HEAD", M, y, 7, fonts.sansBold, C.muted);
  txt(page, ev.chainHead, M + 56, y, 8, fonts.mono);

  // verify block
  const qrSize = 74;
  await drawQr(page, ev.verifyUrl, A4.w - M - qrSize, 52, qrSize, C.ink);
  txt(page, "Verify this certificate", M, 112, 12, fonts.serif);
  const vlines = wrap(
    `Scan the code or drop this PDF on the Siegel verify page. Verification re-hashes the embedded evidence in your browser: if the document, the signature or any audit event was changed after signing, the chain breaks visibly.`,
    fonts.sans,
    8,
    A4.w - 2 * M - qrSize - 40,
  );
  vlines.forEach((l, i) => txt(page, l, M, 96 - i * 11, 8, fonts.sans, C.muted));
  txt(page, ev.verifyUrl, M, 96 - vlines.length * 11 - 4, 7.5, fonts.mono, C.wax);
  page.drawLine({ start: { x: M, y: 36 }, end: { x: A4.w - M, y: 36 }, thickness: 0.4, color: C.line });
  txt(page, `Generated ${isoUtc(ev.generatedAt)} by Siegel · Proposal ID ${ev.proposalId}`, M, 24, 7, fonts.sans, C.muted);
  txt(page, "Page 1", A4.w - M - 24, 24, 7, fonts.sans, C.muted);

  // ------------------------------------------------------------ appendix: the signed document
  let p = pdf.addPage([A4.w, A4.h]);
  let pageNo = 2;
  let ay = A4.h - M;
  const width = A4.w - 2 * M;
  const footer = () => {
    p.drawLine({ start: { x: M, y: 36 }, end: { x: A4.w - M, y: 36 }, thickness: 0.4, color: C.line });
    txt(p, `${doc.number} v${doc.version} · fingerprint ${ev.documentHash.slice(0, 24)}…`, M, 24, 7, fonts.mono, C.muted);
    txt(p, `Page ${pageNo}`, A4.w - M - 24, 24, 7, fonts.sans, C.muted);
  };
  const ensure = (h: number) => {
    if (ay - h < 60) {
      footer();
      p = pdf.addPage([A4.w, A4.h]);
      pageNo++;
      ay = A4.h - M;
    }
  };
  const para = (s: string, size = 10, font = fonts.sans, color: RGB = C.ink, indent = 0, gap = 4) => {
    for (const line of wrap(s, font, size, width - indent)) {
      ensure(size + 4);
      txt(p, line, M + indent, ay, size, font, color);
      ay -= size + 4;
    }
    ay -= gap;
  };
  const md = (body: string) => {
    for (const raw of stripMd(body).split("\n")) {
      const line = raw.trim();
      if (!line) {
        ay -= 4;
        continue;
      }
      if (/^[-*•]\s+/.test(line)) {
        ensure(14);
        txt(p, "•", M + 4, ay, 10, fonts.sans, C.wax);
        para(line.replace(/^[-*•]\s+/, ""), 10, fonts.sans, C.ink, 16, 1);
      } else para(line, 10, fonts.sans, C.ink, 0, 3);
    }
    ay -= 6;
  };

  txt(p, "APPENDIX · SIGNED DOCUMENT", M, ay, 7.5, fonts.sansBold, C.wax);
  ay -= 30;
  for (const l of wrap(doc.title, fonts.serif, 24, width)) {
    txt(p, l, M, ay, 24, fonts.serif);
    ay -= 28;
  }
  para(`Prepared by ${doc.issuer.company}${doc.issuer.contactName ? ` (${doc.issuer.contactName})` : ""} for ${[doc.client.name, doc.client.company].filter(Boolean).join(", ")}. Issued ${isoUtc(doc.issuedAt)}${doc.validUntil ? `, valid until ${doc.validUntil}` : ""}.`, 9, fonts.sans, C.muted, 0, 14);

  for (const s of doc.sections) {
    ensure(40);
    txt(p, s.title, M, ay, 14, fonts.serif);
    ay -= 20;
    md(s.body);
  }
  if (doc.timeline.length) {
    ensure(40);
    txt(p, "Timeline", M, ay, 14, fonts.serif);
    ay -= 20;
    for (const t of doc.timeline) {
      ensure(30);
      txt(p, t.duration, M, ay, 9, fonts.sansBold, C.wax);
      txt(p, t.name, M + 90, ay, 10, fonts.sansBold);
      ay -= 13;
      para(t.description, 9.5, fonts.sans, C.muted, 90, 6);
    }
    ay -= 6;
  }
  ensure(40);
  txt(p, "Investment", M, ay, 14, fonts.serif);
  ay -= 22;
  for (const t of doc.tiers) {
    ensure(50);
    const chosen = t.id === ev.signature.tierId;
    const price = `${money(t.price, cur)}${t.billing === "monthly" ? " / month" : ""}`;
    txt(p, `${t.name}${chosen ? "   ·  SELECTED & SIGNED" : ""}`, M, ay, 11, fonts.sansBold, chosen ? C.wax : C.ink);
    txt(p, price, A4.w - M - fonts.sansBold.widthOfTextAtSize(pdfSafe(price), 11), ay, 11, fonts.sansBold);
    ay -= 14;
    if (t.description) para(t.description, 9.5, fonts.sans, C.muted, 0, 2);
    for (const f of t.features) {
      ensure(13);
      txt(p, "–", M + 4, ay, 9.5, fonts.sans, C.muted);
      para(f, 9.5, fonts.sans, C.ink, 16, 0);
    }
    ay -= 10;
  }
  para(`Deposit due at signing: ${doc.depositPercent}% of the selected package.`, 9.5, fonts.sansBold, C.ink, 0, 12);
  if (doc.terms) {
    ensure(40);
    txt(p, "Terms", M, ay, 14, fonts.serif);
    ay -= 20;
    md(doc.terms);
  }
  footer();

  // Embed the machine-verifiable evidence package.
  const json = new TextEncoder().encode(JSON.stringify(ev, null, 2));
  await pdf.attach(json, EVIDENCE_FILENAME, {
    mimeType: "application/json",
    description: "Siegel evidence package: signed document, signature and hash-chained audit trail",
    creationDate: new Date(ev.generatedAt),
    modificationDate: new Date(ev.generatedAt),
  });

  return pdf.save();
}

/** Pull the embedded evidence JSON back out of a certificate PDF. */
export async function extractEvidenceFromPdf(bytes: Uint8Array | ArrayBuffer): Promise<EvidencePackage | null> {
  const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  const names = pdf.catalog.lookupMaybe(PDFName.of("Names"), PDFDict);
  const ef = names?.lookupMaybe(PDFName.of("EmbeddedFiles"), PDFDict);
  if (!ef) return null;
  const collect = (dict: PDFDict): [string, PDFDict][] => {
    const out: [string, PDFDict][] = [];
    const arr = dict.lookupMaybe(PDFName.of("Names"), PDFArray);
    if (arr) {
      for (let i = 0; i + 1 < arr.size(); i += 2) {
        const n = arr.lookup(i);
        const name = n instanceof PDFString || n instanceof PDFHexString ? n.decodeText() : String(n);
        out.push([name, arr.lookup(i + 1, PDFDict)]);
      }
    }
    const kids = dict.lookupMaybe(PDFName.of("Kids"), PDFArray);
    if (kids) for (let i = 0; i < kids.size(); i++) out.push(...collect(kids.lookup(i, PDFDict)));
    return out;
  };
  for (const [name, spec] of collect(ef)) {
    if (!name.endsWith(".json")) continue;
    const efDict = spec.lookupMaybe(PDFName.of("EF"), PDFDict);
    const stream = efDict?.lookup(PDFName.of("F"));
    if (!(stream instanceof PDFRawStream)) continue;
    const data = decodePDFRawStream(stream).decode();
    const parsed = JSON.parse(new TextDecoder().decode(data));
    if (parsed?.format === "siegel.evidence/v1") return parsed as EvidencePackage;
  }
  return null;
}
