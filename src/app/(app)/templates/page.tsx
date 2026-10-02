"use client";

import { FileStack, Layers, Pencil, Plus, Trash2, Wand2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { call, useData } from "@/client/hooks";
import { PageHeader } from "@/components/app-shell";
import { useToast } from "@/components/toast";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Select, Skeleton, Tabs, Textarea } from "@/components/ui";
import { money } from "@/core/format";
import type { PricingBlock, Template, Tier } from "@/core/types";

type BlockForm = Omit<Tier, "id"> & { id?: string };

const emptyBlock = (): BlockForm => ({ name: "", price: 1000, billing: "one-time", description: "", features: [], recommended: false, paymentLink: "" });

export default function TemplatesPage() {
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<"templates" | "pricing">("templates");
  const [editTpl, setEditTpl] = useState<Template | null>(null);
  const [block, setBlock] = useState<BlockForm | null>(null);
  const [busy, setBusy] = useState(false);
  const { data, loading, reload } = useData(async (api) => {
    const [templates, blocks, settings] = await Promise.all([api.listTemplates(), api.listBlocks(), api.getSettings()]);
    return { templates, blocks, settings };
  }, []);
  const currency = data?.settings.brand.defaultCurrency ?? "USD";

  async function startFromTemplate(t: Template) {
    const p = await call((api) => api.createProposal({ templateId: t.id, title: t.name }));
    router.push(`/proposal/?id=${p.id}`);
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Templates & pricing"
        subtitle="Reusable proposal structures and packages. The AI follows a template's structure and pricing style when you pick it."
        actions={
          tab === "pricing" ? (
            <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setBlock(emptyBlock())}>
              New package
            </Button>
          ) : (
            <Button icon={<Wand2 className="h-4 w-4" />} onClick={() => router.push("/new/")}>
              Draft with AI
            </Button>
          )
        }
      />
      <Tabs
        className="mb-5"
        value={tab}
        onChange={setTab}
        items={[
          { value: "templates", label: <span className="flex items-center gap-1.5"><FileStack className="h-3.5 w-3.5" /> Templates</span> },
          { value: "pricing", label: <span className="flex items-center gap-1.5"><Layers className="h-3.5 w-3.5" /> Pricing library</span> },
        ]}
      />

      {loading && !data ? (
        <div className="grid gap-3 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-52" />
          ))}
        </div>
      ) : tab === "templates" ? (
        data!.templates.length === 0 ? (
          <Card>
            <EmptyState title="No templates yet" body="Open any proposal and choose “Save as template” from the menu." />
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data!.templates.map((t) => (
              <Card key={t.id} className="group flex flex-col p-5 transition hover:border-line-strong hover:shadow-soft">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold tracking-tight">{t.name}</h3>
                  <div className="flex opacity-0 transition group-hover:opacity-100">
                    <button onClick={() => setEditTpl(t)} className="rounded-md p-1.5 text-subtle hover:bg-hover hover:text-fg" aria-label="Edit">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm(`Delete template “${t.name}”?`)) return;
                        await call((api) => api.deleteTemplate(t.id));
                        reload();
                      }}
                      className="rounded-md p-1.5 text-subtle hover:bg-danger-soft hover:text-danger"
                      aria-label="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <p className="mt-1.5 text-[13px] text-muted">{t.description}</p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {t.sections.map((s) => (
                    <Badge key={s.id}>{s.title}</Badge>
                  ))}
                </div>
                <div className="mt-4 space-y-1.5 border-t border-line pt-3 text-[13px]">
                  {t.tiers.map((x) => (
                    <div key={x.id} className="flex justify-between">
                      <span className={x.recommended ? "font-medium" : "text-muted"}>{x.name}</span>
                      <span className="tabular-nums">
                        {money(x.price, currency)}
                        {x.billing === "monthly" ? <span className="text-subtle">/mo</span> : null}
                      </span>
                    </div>
                  ))}
                </div>
                <Button className="mt-5" onClick={() => startFromTemplate(t)}>
                  Use template
                </Button>
              </Card>
            ))}
          </div>
        )
      ) : data!.blocks.length === 0 ? (
        <Card>
          <EmptyState title="Your pricing library is empty" body="Save packages you sell often and insert them into any proposal in one click." action={<Button onClick={() => setBlock(emptyBlock())}>New package</Button>} />
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data!.blocks.map((b: PricingBlock) => (
            <Card key={b.id} className="group p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{b.tier.name}</h3>
                  <div className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
                    {money(b.tier.price, currency)}
                    <span className="text-sm font-normal text-subtle">{b.tier.billing === "monthly" ? " / month" : ""}</span>
                  </div>
                </div>
                <div className="flex opacity-0 transition group-hover:opacity-100">
                  <button onClick={() => setBlock({ ...b.tier, id: b.id })} className="rounded-md p-1.5 text-subtle hover:bg-hover hover:text-fg" aria-label="Edit">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={async () => {
                      await call((api) => api.deleteBlock(b.id));
                      reload();
                    }}
                    className="rounded-md p-1.5 text-subtle hover:bg-danger-soft hover:text-danger"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <p className="mt-2 text-[13px] text-muted">{b.tier.description}</p>
              <ul className="mt-3 space-y-1 text-[13px]">
                {b.tier.features.map((f) => (
                  <li key={f}>· {f}</li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={!!block}
        onClose={() => setBlock(null)}
        title={block?.id ? "Edit package" : "New package"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setBlock(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={busy}
              onClick={async () => {
                if (!block?.name.trim()) return toast.error("Give the package a name");
                setBusy(true);
                const { id, ...tier } = block;
                await call((api) => api.saveBlock({ id, tier: { ...tier, features: tier.features.map((f) => f.trim()).filter(Boolean) } }));
                setBusy(false);
                setBlock(null);
                reload();
                toast.success("Package saved");
              }}
            >
              Save
            </Button>
          </>
        }
      >
        {block && (
          <div className="space-y-3">
            <Field label="Name">
              <Input value={block.name} onChange={(e) => setBlock({ ...block, name: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Price">
                <Input type="number" value={block.price} onChange={(e) => setBlock({ ...block, price: Number(e.target.value) || 0 })} />
              </Field>
              <Field label="Billing">
                <Select value={block.billing} onChange={(e) => setBlock({ ...block, billing: e.target.value as Tier["billing"] })}>
                  <option value="one-time">One-time</option>
                  <option value="monthly">Monthly</option>
                </Select>
              </Field>
            </div>
            <Field label="Description">
              <Input value={block.description} onChange={(e) => setBlock({ ...block, description: e.target.value })} />
            </Field>
            <Field label="Included" hint="one per line">
              <Textarea rows={4} value={block.features.join("\n")} onChange={(e) => setBlock({ ...block, features: e.target.value.split("\n") })} />
            </Field>
          </div>
        )}
      </Modal>

      <Modal
        open={!!editTpl}
        onClose={() => setEditTpl(null)}
        title="Edit template"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditTpl(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={async () => {
                await call((api) => api.saveTemplate(editTpl!));
                setEditTpl(null);
                reload();
                toast.success("Template updated");
              }}
            >
              Save
            </Button>
          </>
        }
      >
        {editTpl && (
          <div className="space-y-3">
            <Field label="Name">
              <Input value={editTpl.name} onChange={(e) => setEditTpl({ ...editTpl, name: e.target.value })} />
            </Field>
            <Field label="Description">
              <Textarea rows={3} value={editTpl.description} onChange={(e) => setEditTpl({ ...editTpl, description: e.target.value })} />
            </Field>
            <p className="text-xs text-muted">To change sections or tiers, start a proposal from this template, edit it, then “Save as template”.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
