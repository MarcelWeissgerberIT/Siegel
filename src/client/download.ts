"use client";

import type { EvidencePackage } from "@/core/types";

export function downloadBlob(data: BlobPart, filename: string, type: string) {
  const blob = new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function downloadCertificate(ev: EvidencePackage, brandName: string) {
  const { buildCertificatePdf } = await import("@/core/certificate");
  const bytes = await buildCertificatePdf(ev, brandName);
  downloadBlob(bytes as BlobPart, `${ev.number}-certificate-of-completion.pdf`, "application/pdf");
}

export function downloadEvidence(ev: EvidencePackage) {
  downloadBlob(JSON.stringify(ev, null, 2), `${ev.number}-siegel-evidence.json`, "application/json");
}
