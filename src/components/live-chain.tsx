"use client";

import { CheckCircle2, Link2, RotateCcw, Skull, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { canonicalize, GENESIS_HASH, sha256Hex } from "@/core/crypto";
import { cn } from "@/lib/cn";

// A real, in-browser hash chain. Nothing is faked: every hash below is
// computed with Web Crypto SHA-256 on each render.

const BASE_DOC = { title: "AI Lead Response System", client: "Brightside Dental", package: "Growth", price: 6500, deposit: "50%" };
const EVENTS = [
  { type: "created", at: "09:12:04" },
  { type: "sent", at: "09:31:40" },
  { type: "viewed", at: "14:02:11" },
  { type: "signed", at: "14:09:57" },
  { type: "paid", at: "14:10:31" },
];

interface Row {
  type: string;
  at: string;
  data: Record<string, unknown>;
  prev: string;
  hash: string;
  ok: boolean;
}

export function LiveChain({ onTamperChange }: { onTamperChange?: (t: boolean) => void }) {
  const [tampered, setTampered] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [docHash, setDocHash] = useState("");
  const [signedHash, setSignedHash] = useState("");

  useEffect(() => {
    (async () => {
      const original = await sha256Hex(canonicalize(BASE_DOC));
      const shown = tampered ? { ...BASE_DOC, price: 9100 } : BASE_DOC;
      const current = await sha256Hex(canonicalize(shown));
      setDocHash(current);
      setSignedHash(original);
      // The chain was written at signing time and commits to the ORIGINAL fingerprint.
      const out: Row[] = [];
      let prev = GENESIS_HASH;
      for (const e of EVENTS) {
        const data = e.type === "signed" || e.type === "sent" ? { docHash: original } : {};
        const hash = await sha256Hex(canonicalize({ ...e, data, prev }));
        const ok = !(tampered && (e.type === "signed" || e.type === "sent")) || current === original;
        out.push({ ...e, data, prev, hash, ok });
        prev = hash;
      }
      setRows(out);
    })();
    onTamperChange?.(tampered);
  }, [tampered, onTamperChange]);

  return (
    <div className="rounded-2xl border border-white/10 bg-black/40 p-5 backdrop-blur-md sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/50">Live in your browser · SHA-256</div>
          <div className="mt-1 text-sm text-white/80">
            Signed document: <span className="text-white">{BASE_DOC.package}</span> for{" "}
            <span className={cn("font-mono transition", tampered ? "text-[#ff6b6b]" : "text-white")}>${tampered ? "9,100" : "6,500"}</span>
          </div>
        </div>
        <button
          onClick={() => setTampered((t) => !t)}
          className={cn(
            "inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition",
            tampered ? "border-white/20 bg-white/10 text-white hover:bg-white/20" : "border-[#ff6b6b]/40 bg-[#ff6b6b]/10 text-[#ffb3a6] hover:bg-[#ff6b6b]/20",
          )}
        >
          {tampered ? <RotateCcw className="h-4 w-4" /> : <Skull className="h-4 w-4" />}
          {tampered ? "Restore original" : "Change the price after signing"}
        </button>
      </div>

      <div className={cn("mt-4 rounded-xl border px-3 py-2.5 font-mono text-[11.5px] transition", tampered ? "border-[#ff6b6b]/40 bg-[#ff6b6b]/10" : "border-white/10 bg-white/5")}>
        <div className="flex justify-between gap-3 text-white/50">
          <span>document fingerprint now</span>
          <span>{tampered ? "≠ signed" : "= signed"}</span>
        </div>
        <div className={cn("mt-1 break-all", tampered ? "text-[#ff8f7d]" : "text-[#3ccf91]")}>{docHash}</div>
      </div>

      <ol className="mt-4 space-y-1.5">
        {rows.map((r, i) => (
          <li
            key={r.type}
            className={cn(
              "grid grid-cols-[18px_70px_1fr_auto] items-center gap-3 rounded-lg px-3 py-2 text-[12px] transition-colors duration-500",
              r.ok ? "bg-white/[0.04]" : "bg-[#ff6b6b]/15",
            )}
            style={{ transitionDelay: `${i * 90}ms` }}
          >
            {r.ok ? <CheckCircle2 className="h-4 w-4 text-[#3ccf91]" /> : <XCircle className="h-4 w-4 text-[#ff6b6b]" />}
            <span className="font-medium capitalize text-white">{r.type}</span>
            <span className="truncate font-mono text-white/45">
              <Link2 className="mr-1 inline h-3 w-3" />
              {r.prev.slice(0, 8)} → <span className={r.ok ? "text-white/80" : "text-[#ff8f7d]"}>{r.hash.slice(0, 20)}…</span>
            </span>
            <span className="font-mono text-white/35">{r.at}</span>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-xs leading-relaxed text-white/55">
        {tampered
          ? `Broken. The signing event committed to ${signedHash.slice(0, 12)}…, but the document now hashes to ${docHash.slice(0, 12)}…. Anyone can see it.`
          : "Each event hashes its own data plus the previous hash. The signing event commits to the document fingerprint, so the price can't move without breaking the proof."}
      </p>
    </div>
  );
}
