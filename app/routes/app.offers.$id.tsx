import { useEffect, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { redirect, useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { safeJson } from "../lib/pricing.server";
import type { OfferTier } from "../lib/settings";
import { Checkbox, Grid, NumberField, Select, Switch, TextField } from "../components/fields";
import { ProductScopePicker, type PickedProduct } from "../components/ProductScopePicker";

const DEFAULT_TIERS: OfferTier[] = [
  { quantity: 1, discountType: "none", discountValue: 0, label: "Buy 1", badge: "", preselected: false },
  { quantity: 2, discountType: "percentage", discountValue: 10, label: "Buy 2", badge: "Most popular", preselected: true },
  { quantity: 3, discountType: "percentage", discountValue: 20, label: "Buy 3", badge: "Best value", preselected: false },
];

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  if (params.id === "new") {
    return { id: null, title: "Quantity discount", active: true, products: [] as PickedProduct[], allProducts: true, tiers: DEFAULT_TIERS };
  }
  const o = await prisma.quantityOffer.findFirst({ where: { id: params.id, shop: session.shop } });
  if (!o) throw redirect("/app/offers");
  return {
    id: o.id,
    title: o.title,
    active: o.active,
    allProducts: o.productScope === "all",
    products: o.productScope === "all" ? [] : scopeToProducts(o.productScope),
    tiers: safeJson<OfferTier[]>(o.tiers, []),
  };
};

function scopeToProducts(scope: string): PickedProduct[] {
  return safeJson<(string | PickedProduct)[]>(scope, []).map((p) => (typeof p === "string" ? { id: p, title: p } : p));
}

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const body = JSON.parse(String((await request.formData()).get("payload")));
  const tiers: OfferTier[] = (body.tiers || []).map((t: OfferTier) => ({
    quantity: Math.max(1, Math.floor(Number(t.quantity) || 1)),
    discountType: ["percentage", "fixed", "none"].includes(t.discountType) ? t.discountType : "none",
    discountValue: Math.max(0, Number(t.discountValue) || 0),
    label: String(t.label || ""),
    badge: String(t.badge || ""),
    preselected: !!t.preselected,
  }));
  if (!tiers.length) return { ok: false, error: "Add at least one tier" };
  const data = {
    title: String(body.title || "Offer"),
    active: !!body.active,
    productScope: body.allProducts
      ? "all"
      : JSON.stringify((body.products || []).map((p: PickedProduct) => ({ id: p.id, title: p.title }))),
    tiers: JSON.stringify(tiers),
  };
  if (params.id === "new") {
    const created = await prisma.quantityOffer.create({ data: { ...data, shop: session.shop } });
    return redirect(`/app/offers/${created.id}`);
  }
  await prisma.quantityOffer.updateMany({ where: { id: params.id, shop: session.shop }, data });
  return { ok: true };
};

export default function OfferEdit() {
  const initial = useLoaderData<typeof loader>();
  const [s, setS] = useState(initial);
  const fetcher = useFetcher<{ ok: boolean; error?: string }>();
  const shopify = useAppBridge();
  const [prevInitial, setPrevInitial] = useState(initial);
  if (prevInitial !== initial) {
    setPrevInitial(initial);
    setS(initial);
  }
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      shopify.toast.show(fetcher.data.ok ? "Offer saved" : fetcher.data.error || "Error", { isError: !fetcher.data.ok });
    }
  }, [fetcher.state, fetcher.data, shopify]);

  const setTier = (i: number, p: Partial<OfferTier>) =>
    setS({
      ...s,
      tiers: s.tiers.map((t, j) =>
        j === i ? { ...t, ...p } : p.preselected ? { ...t, preselected: false } : t,
      ),
    });

  return (
    <s-page heading={s.id ? s.title : "New quantity offer"}>
      <s-link slot="breadcrumb-actions" href="/app/offers">
        Quantity offers
      </s-link>
      <s-button
        slot="primary-action"
        variant="primary"
        onClick={() => fetcher.submit({ payload: JSON.stringify(s) }, { method: "post" })}
        {...(fetcher.state !== "idle" ? { loading: true } : {})}
      >
        Save
      </s-button>

      <s-section heading="Offer">
        <s-stack gap="base">
          <TextField label="Internal name" value={s.title} onChange={(v) => setS({ ...s, title: v })} />
          <Switch label="Active" checked={s.active} onChange={(v) => setS({ ...s, active: v })} />
          <ProductScopePicker
            all={s.allProducts}
            products={s.products}
            onChange={(all, products) => setS({ ...s, allProducts: all, products })}
          />
        </s-stack>
      </s-section>

      <s-section heading="Tiers">
        <s-stack gap="base">
          {s.tiers.map((t, i) => (
            <s-box key={i} padding="base" borderWidth="base" borderRadius="base">
              <s-stack gap="small-200">
                <Grid columns={3}>
                  <NumberField label="Quantity" min={1} value={t.quantity} onChange={(v) => setTier(i, { quantity: v })} />
                  <Select
                    label="Discount"
                    value={t.discountType}
                    onChange={(v) => setTier(i, { discountType: v })}
                    options={[
                      { value: "none", label: "No discount" },
                      { value: "percentage", label: "Percentage off" },
                      { value: "fixed", label: "Fixed amount off (total)" },
                    ]}
                  />
                  <NumberField
                    label="Value"
                    min={0}
                    step={0.01}
                    disabled={t.discountType === "none"}
                    suffix={t.discountType === "percentage" ? "%" : undefined}
                    value={t.discountValue}
                    onChange={(v) => setTier(i, { discountValue: v })}
                  />
                  <TextField label="Title" value={t.label} onChange={(v) => setTier(i, { label: v })} />
                  <TextField label="Badge" placeholder="e.g. Most popular" value={t.badge} onChange={(v) => setTier(i, { badge: v })} />
                  <Checkbox label="Selected by default" checked={t.preselected} onChange={(v) => setTier(i, { preselected: v })} />
                </Grid>
                <s-stack direction="inline" justifyContent="end">
                  <s-button variant="tertiary" tone="critical" icon="delete" onClick={() => setS({ ...s, tiers: s.tiers.filter((_, j) => j !== i) })}>
                    Remove tier
                  </s-button>
                </s-stack>
              </s-stack>
            </s-box>
          ))}
          <s-button
            icon="plus"
            onClick={() => {
              const q = (s.tiers[s.tiers.length - 1]?.quantity || 0) + 1;
              setS({ ...s, tiers: [...s.tiers, { quantity: q, discountType: "percentage", discountValue: 10, label: `Buy ${q}`, badge: "", preselected: false }] });
            }}
          >
            Add tier
          </s-button>
        </s-stack>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
