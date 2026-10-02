"use client";

import { ArrowDown, ArrowUp, BookmarkPlus, Check, CreditCard, GripVertical, Library, Plus, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import { randomId } from "@/core/crypto";
import { money } from "@/core/format";
import type { PricingBlock, Proposal, Section, Tier } from "@/core/types";
import { cn } from "@/lib/cn";
import { COVERS, Img } from "./media";
import { AutoTextarea, Badge, Button, Input, Modal, Select } from "./ui";

type Patch = Partial<Proposal>;

function move<T>(arr: T[], i: number, d: -1 | 1) {
  const j = i + d;
  if (j < 0 || j >= arr.length) return arr;
  const next = [...arr];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

function RowTools({ onUp, onDown, onDelete, className }: { onUp?: () => void; onDown?: () => void; onDelete?: () => void; className?: string }) {
  return (
    <div className={cn("flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100", className)}>
      {onUp && (
        <button type="button" onClick={onUp} className="rounded-md p-1 text-subtle hover:bg-hover hover:text-fg" aria-label="Move up">
          <ArrowUp className="h-3.5 w-3.5" />
        </button>
      )}
      {onDown && (
        <button type="button" onClick={onDown} className="rounded-md p-1 text-subtle hover:bg-hover hover:text-fg" aria-label="Move down">
          <ArrowDown className="h-3.5 w-3.5" />
        </button>
      )}
      {onDelete && (
        <button type="button" onClick={onDelete} className="rounded-md p-1 text-subtle hover:bg-danger-soft hover:text-danger" aria-label="Delete">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export function ProposalEditor({
  p,
  onChange,
  readOnly,
  blocks,
  onSaveBlock,
  brandName,
}: {
  p: Proposal;
  onChange: (patch: Patch) => void;
  readOnly: boolean;
  blocks: PricingBlock[];
  onSaveBlock: (t: Tier) => void;
  brandName: string;
}) {
  const [libraryOpen, setLibraryOpen] = useState(false);
  const cover = p.cover !== "none" ? COVERS[p.cover] : null;

  const setSection = (i: number, s: Partial<Section>) => onChange({ sections: p.sections.map((x, j) => (j === i ? { ...x, ...s } : x)) });
  const setTier = (i: number, t: Partial<Tier>) => onChange({ tiers: p.tiers.map((x, j) => (j === i ? { ...x, ...t } : x)) });
  const setRecommended = (i: number) => onChange({ tiers: p.tiers.map((x, j) => ({ ...x, recommended: j === i })) });

  return (
    <fieldset disabled={readOnly} className="min-w-0">
      <div className="overflow-hidden rounded-2xl border border-line bg-elev shadow-soft">
        {/* Cover */}
        <div className="relative h-36 overflow-hidden sm:h-44">
          {cover ? <Img name={cover.image} className="absolute inset-0 h-full w-full" /> : <div className="absolute inset-0 bg-sunken" />}
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-elev)] via-[color-mix(in_oklab,var(--bg-elev)_30%,transparent)] to-transparent" />
          <div className="absolute bottom-4 left-6 right-6 flex items-end justify-between sm:left-10 sm:right-10">
            <span className="font-mono text-xs text-muted">{p.number}</span>
            <span className="text-xs text-muted">
              by <span className="font-medium text-fg">{brandName}</span>
            </span>
          </div>
        </div>

        <div className="px-6 pb-10 sm:px-10">
          <div className="text-xs font-medium uppercase tracking-[0.14em] text-accent">
            Proposal for {p.client.company || p.client.name || "your client"}
          </div>
          <AutoTextarea
            value={p.title}
            onChange={(e) => onChange({ title: e.target.value.replace(/\n/g, " ") })}
            className="mt-2 font-serif text-[34px] leading-[1.1] tracking-tight sm:text-[44px]"
            placeholder="Proposal title"
            minRows={1}
            aria-label="Proposal title"
          />

          {/* Sections */}
          <div className="mt-8 space-y-8">
            {p.sections.map((s, i) => (
              <section key={s.id} className="group relative">
                <div className="flex items-center gap-2">
                  <GripVertical className="-ml-6 hidden h-4 w-4 text-subtle opacity-0 group-hover:opacity-100 sm:block" />
                  <Input
                    value={s.title}
                    onChange={(e) => setSection(i, { title: e.target.value })}
                    className="h-auto border-transparent bg-transparent px-0 text-[19px] font-semibold tracking-tight focus:ring-0 disabled:opacity-100"
                    placeholder="Section title"
                  />
                  {!readOnly && (
                    <RowTools
                      onUp={i > 0 ? () => onChange({ sections: move(p.sections, i, -1) }) : undefined}
                      onDown={i < p.sections.length - 1 ? () => onChange({ sections: move(p.sections, i, 1) }) : undefined}
                      onDelete={() => onChange({ sections: p.sections.filter((_, j) => j !== i) })}
                    />
                  )}
                </div>
                <AutoTextarea
                  value={s.body}
                  onChange={(e) => setSection(i, { body: e.target.value })}
                  className="mt-1 rounded-lg text-[15px] leading-7 text-muted focus:bg-hover focus:px-2 focus:-mx-2"
                  placeholder="Write here. Use “- ” for bullet points and **bold** for emphasis."
                  minRows={2}
                />
              </section>
            ))}
            {!readOnly && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                icon={<Plus className="h-3.5 w-3.5" />}
                onClick={() => onChange({ sections: [...p.sections, { id: "sec_" + randomId(8), title: "New section", body: "" }] })}
              >
                Add section
              </Button>
            )}
          </div>

          {/* Timeline */}
          <div className="mt-12">
            <h3 className="text-[19px] font-semibold tracking-tight">Timeline</h3>
            <div className="mt-4 space-y-2">
              {p.timeline.map((ph, i) => (
                <div key={ph.id} className="group grid grid-cols-[110px_1fr_auto] items-start gap-3 rounded-xl border border-line bg-sunken/50 p-3">
                  <Input
                    value={ph.duration}
                    onChange={(e) => onChange({ timeline: p.timeline.map((x, j) => (j === i ? { ...x, duration: e.target.value } : x)) })}
                    className="h-8 border-transparent bg-transparent px-1 font-mono text-xs text-accent focus:bg-elev"
                    placeholder="Week 1"
                  />
                  <div>
                    <Input
                      value={ph.name}
                      onChange={(e) => onChange({ timeline: p.timeline.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })}
                      className="h-8 border-transparent bg-transparent px-1 font-medium focus:bg-elev"
                      placeholder="Phase"
                    />
                    <AutoTextarea
                      value={ph.description}
                      onChange={(e) => onChange({ timeline: p.timeline.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)) })}
                      className="px-1 text-[13px] text-muted"
                      minRows={1}
                      placeholder="What happens in this phase"
                    />
                  </div>
                  {!readOnly && (
                    <RowTools
                      onUp={i > 0 ? () => onChange({ timeline: move(p.timeline, i, -1) }) : undefined}
                      onDown={i < p.timeline.length - 1 ? () => onChange({ timeline: move(p.timeline, i, 1) }) : undefined}
                      onDelete={() => onChange({ timeline: p.timeline.filter((_, j) => j !== i) })}
                    />
                  )}
                </div>
              ))}
              {!readOnly && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  icon={<Plus className="h-3.5 w-3.5" />}
                  onClick={() => onChange({ timeline: [...p.timeline, { id: "ph_" + randomId(8), name: "", duration: "", description: "" }] })}
                >
                  Add phase
                </Button>
              )}
            </div>
          </div>

          {/* Investment */}
          <div className="mt-12">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h3 className="text-[19px] font-semibold tracking-tight">Investment</h3>
                <p className="mt-1 text-[13px] text-muted">The client picks one package and signs. Mark one as recommended.</p>
              </div>
              {!readOnly && (
                <div className="flex gap-2">
                  <Button type="button" size="sm" icon={<Library className="h-3.5 w-3.5" />} onClick={() => setLibraryOpen(true)}>
                    From library
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    icon={<Plus className="h-3.5 w-3.5" />}
                    onClick={() =>
                      onChange({
                        tiers: [
                          ...p.tiers,
                          { id: "tier_" + randomId(8), name: "New package", price: 1000, billing: "one-time", description: "", features: [], recommended: p.tiers.length === 0, paymentLink: "" },
                        ],
                      })
                    }
                  >
                    Add tier
                  </Button>
                </div>
              )}
            </div>
            <div className={cn("mt-5 grid gap-3", p.tiers.length >= 3 ? "xl:grid-cols-3" : p.tiers.length === 2 ? "md:grid-cols-2" : "")}>
              {p.tiers.map((t, i) => (
                <div
                  key={t.id}
                  className={cn(
                    "group relative flex flex-col rounded-2xl border bg-elev p-4 transition",
                    t.recommended ? "border-accent shadow-[0_0_0_3px_var(--accent-soft)]" : "border-line",
                  )}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setRecommended(i)}
                      className={cn("flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium", t.recommended ? "bg-accent text-accent-fg" : "text-subtle hover:bg-hover hover:text-fg")}
                    >
                      <Star className="h-3 w-3" /> {t.recommended ? "Recommended" : "Make recommended"}
                    </button>
                    {!readOnly && (
                      <RowTools
                        onUp={i > 0 ? () => onChange({ tiers: move(p.tiers, i, -1) }) : undefined}
                        onDown={i < p.tiers.length - 1 ? () => onChange({ tiers: move(p.tiers, i, 1) }) : undefined}
                        onDelete={() => onChange({ tiers: p.tiers.filter((_, j) => j !== i) })}
                      />
                    )}
                  </div>
                  <Input value={t.name} onChange={(e) => setTier(i, { name: e.target.value })} className="h-8 border-transparent bg-transparent px-1 text-base font-semibold focus:bg-sunken" />
                  <div className="mt-1 flex items-center gap-2">
                    <div className="relative flex-1">
                      <span className="pointer-events-none absolute left-1 top-1/2 -translate-y-1/2 text-lg font-semibold text-subtle">
                        {money(0, p.currency).replace(/[\d.,\s]/g, "")}
                      </span>
                      <Input
                        type="number"
                        min={0}
                        step={50}
                        value={t.price}
                        onChange={(e) => setTier(i, { price: Number(e.target.value) || 0 })}
                        className="h-10 border-transparent bg-transparent pl-6 text-2xl font-semibold tabular-nums tracking-tight focus:bg-sunken"
                      />
                    </div>
                    <Select value={t.billing} onChange={(e) => setTier(i, { billing: e.target.value as Tier["billing"] })} className="h-8 w-[112px] text-xs">
                      <option value="one-time">one-time</option>
                      <option value="monthly">/ month</option>
                    </Select>
                  </div>
                  <AutoTextarea
                    value={t.description}
                    onChange={(e) => setTier(i, { description: e.target.value })}
                    className="mt-2 px-1 text-[13px] text-muted"
                    minRows={1}
                    placeholder="Who is this for?"
                  />
                  <div className="mt-3 border-t border-line pt-3">
                    <div className="mb-1 text-[11px] font-medium uppercase tracking-wider text-subtle">Included · one per line</div>
                    <AutoTextarea
                      value={t.features.join("\n")}
                      onChange={(e) => setTier(i, { features: e.target.value.split("\n") })}
                      className="px-1 text-[13px] leading-6"
                      minRows={3}
                      placeholder={"Feature one\nFeature two"}
                    />
                  </div>
                  <div className="mt-auto pt-3">
                    <label className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-subtle">
                      <CreditCard className="h-3 w-3" /> Stripe Payment Link
                      {t.paymentLink ? <Check className="h-3 w-3 text-ok" /> : null}
                    </label>
                    <Input
                      value={t.paymentLink}
                      onChange={(e) => setTier(i, { paymentLink: e.target.value.trim() })}
                      placeholder="https://buy.stripe.com/…"
                      className="mt-1 h-8 font-mono text-xs"
                    />
                    {!readOnly && (
                      <button type="button" onClick={() => onSaveBlock(t)} className="mt-2 flex items-center gap-1 text-xs text-subtle hover:text-fg">
                        <BookmarkPlus className="h-3.5 w-3.5" /> Save to pricing library
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {p.tiers.length === 0 && <p className="mt-3 text-sm text-muted">Add at least one package before sending.</p>}
          </div>

          {/* Terms */}
          <div className="mt-12">
            <h3 className="text-[19px] font-semibold tracking-tight">Terms</h3>
            <AutoTextarea value={p.terms} onChange={(e) => onChange({ terms: e.target.value })} className="mt-2 text-[13px] leading-6 text-muted" minRows={4} />
          </div>
        </div>
      </div>

      <Modal open={libraryOpen} onClose={() => setLibraryOpen(false)} title="Pricing library" description="Reusable packages you've saved. Insert one into this proposal.">
        {blocks.length === 0 ? (
          <p className="text-sm text-muted">No saved packages yet. Use “Save to pricing library” on any tier.</p>
        ) : (
          <div className="space-y-2">
            {blocks.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => {
                  onChange({ tiers: [...p.tiers, { ...b.tier, id: "tier_" + randomId(8), recommended: p.tiers.length === 0 }] });
                  setLibraryOpen(false);
                }}
                className="flex w-full items-center justify-between rounded-xl border border-line p-3 text-left transition hover:border-accent hover:bg-hover"
              >
                <div>
                  <div className="text-sm font-medium">{b.tier.name}</div>
                  <div className="text-xs text-muted">{b.tier.description}</div>
                </div>
                <Badge>
                  {money(b.tier.price, p.currency)}
                  {b.tier.billing === "monthly" ? "/mo" : ""}
                </Badge>
              </button>
            ))}
          </div>
        )}
      </Modal>
    </fieldset>
  );
}
