/* eslint-disable @typescript-eslint/no-explicit-any -- untyped JSON from GraphQL and requests */
import { useEffect, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { redirect, useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { safeJson } from "../lib/pricing.server";
import { Grid, NumberField, Select, Switch, TextArea, TextField, UrlField } from "../components/fields";
import { ProductScopePicker, type PickedProduct } from "../components/ProductScopePicker";

const EMPTY = {
  id: null as string | null,
  title: "Upsell",
  active: true,
  placement: "pre_submit",
  allProducts: true,
  products: [] as PickedProduct[],
  offerVariantId: "",
  offerProductTitle: "",
  offerImage: "",
  discountType: "percentage",
  discountValue: 20,
  headline: "Wait! Add this to your order",
  description: "",
  acceptText: "Yes, add to my order",
  declineText: "No thanks",
  downsellEnabled: false,
  downsellDiscountType: "percentage",
  downsellDiscountValue: 35,
  downsellHeadline: "Last chance! Even bigger discount",
  priority: 0,
};
type UpsellForm = typeof EMPTY;

export const loader = async ({ request, params }: LoaderFunctionArgs): Promise<UpsellForm> => {
  const { session } = await authenticate.admin(request);
  if (params.id === "new") return EMPTY;
  const u = await prisma.upsell.findFirst({ where: { id: params.id, shop: session.shop } });
  if (!u) throw redirect("/app/upsells");
  return {
    id: u.id,
    title: u.title,
    active: u.active,
    placement: u.placement,
    allProducts: u.triggerScope === "all",
    products:
      u.triggerScope === "all"
        ? []
        : safeJson<(string | PickedProduct)[]>(u.triggerScope, []).map((p) => (typeof p === "string" ? { id: p, title: p } : p)),
    offerVariantId: u.offerVariantId,
    offerProductTitle: u.offerProductTitle,
    offerImage: u.offerImage,
    discountType: u.discountType,
    discountValue: u.discountValue,
    headline: u.headline,
    description: u.description,
    acceptText: u.acceptText,
    declineText: u.declineText,
    downsellEnabled: u.downsellEnabled,
    downsellDiscountType: u.downsellDiscountType,
    downsellDiscountValue: u.downsellDiscountValue,
    downsellHeadline: u.downsellHeadline,
    priority: u.priority,
  };
};

const DISCOUNT_TYPES = ["percentage", "fixed", "none"];

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const b: UpsellForm = JSON.parse(String((await request.formData()).get("payload")));
  if (!b.offerVariantId) return { ok: false, error: "Choose the product to offer" };
  const data = {
    title: String(b.title || "Upsell"),
    active: !!b.active,
    placement: ["in_form", "pre_submit", "post_submit"].includes(b.placement) ? b.placement : "pre_submit",
    triggerScope: b.allProducts ? "all" : JSON.stringify(b.products.map((p) => ({ id: p.id, title: p.title }))),
    offerVariantId: String(b.offerVariantId),
    offerProductTitle: String(b.offerProductTitle || ""),
    offerImage: String(b.offerImage || ""),
    discountType: DISCOUNT_TYPES.includes(b.discountType) ? b.discountType : "none",
    discountValue: Math.max(0, Number(b.discountValue) || 0),
    headline: String(b.headline || ""),
    description: String(b.description || ""),
    acceptText: String(b.acceptText || "Yes"),
    declineText: String(b.declineText || "No thanks"),
    downsellEnabled: !!b.downsellEnabled && b.placement !== "in_form",
    downsellDiscountType: DISCOUNT_TYPES.includes(b.downsellDiscountType) ? b.downsellDiscountType : "none",
    downsellDiscountValue: Math.max(0, Number(b.downsellDiscountValue) || 0),
    downsellHeadline: String(b.downsellHeadline || ""),
    priority: Math.floor(Number(b.priority) || 0),
  };
  if (params.id === "new") {
    const created = await prisma.upsell.create({ data: { ...data, shop: session.shop } });
    return redirect(`/app/upsells/${created.id}`);
  }
  await prisma.upsell.updateMany({ where: { id: params.id, shop: session.shop }, data });
  return { ok: true };
};

const discountOptions = [
  { value: "percentage", label: "Percentage off" },
  { value: "fixed", label: "Fixed amount off" },
  { value: "none", label: "No discount" },
];

export default function UpsellEdit() {
  const initial = useLoaderData<typeof loader>();
  const [s, setS] = useState<UpsellForm>(initial);
  const set = (p: Partial<UpsellForm>) => setS((x) => ({ ...x, ...p }));
  const fetcher = useFetcher<{ ok: boolean; error?: string }>();
  const shopify = useAppBridge();
  const [prevInitial, setPrevInitial] = useState(initial);
  if (prevInitial !== initial) {
    setPrevInitial(initial);
    setS(initial);
  }
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      shopify.toast.show(fetcher.data.ok ? "Upsell saved" : fetcher.data.error || "Error", { isError: !fetcher.data.ok });
    }
  }, [fetcher.state, fetcher.data, shopify]);

  const pickOffer = async () => {
    const selected: any = await shopify.resourcePicker({ type: "product", multiple: false });
    const p = selected?.[0];
    if (!p) return;
    const v = p.variants?.[0];
    if (!v) return;
    set({
      offerVariantId: v.id,
      offerProductTitle: p.title + (v.title && v.title !== "Default Title" ? ` - ${v.title}` : ""),
      offerImage: s.offerImage || p.images?.[0]?.originalSrc || "",
    });
  };

  return (
    <s-page heading={s.id ? s.title : "New upsell"}>
      <s-link slot="breadcrumb-actions" href="/app/upsells">
        Upsells
      </s-link>
      <s-button
        slot="primary-action"
        variant="primary"
        onClick={() => fetcher.submit({ payload: JSON.stringify(s) }, { method: "post" })}
        {...(fetcher.state !== "idle" ? { loading: true } : {})}
      >
        Save
      </s-button>

      <s-section heading="Setup">
        <s-stack gap="base">
          <Grid>
            <TextField label="Internal name" value={s.title} onChange={(v) => set({ title: v })} />
            <NumberField label="Priority" details="Higher shows first" value={s.priority} onChange={(v) => set({ priority: v })} />
          </Grid>
          <Switch label="Active" checked={s.active} onChange={(v) => set({ active: v })} />
          <Select
            label="Where to show it"
            value={s.placement}
            onChange={(v) => set({ placement: v })}
            details={
              s.placement === "post_submit"
                ? "Added to the existing order with one click (needs 'Create orders as: Orders')."
                : undefined
            }
            options={[
              { value: "pre_submit", label: "Popup when the customer clicks Complete order" },
              { value: "in_form", label: "Checkbox inside the form (order bump)" },
              { value: "post_submit", label: "One-click offer after the order is placed" },
            ]}
          />
          <ProductScopePicker
            label="Show for every product"
            all={s.allProducts}
            products={s.products}
            onChange={(all, products) => set({ allProducts: all, products })}
          />
        </s-stack>
      </s-section>

      <s-section heading="Offered product">
        <s-stack gap="base">
          <s-stack direction="inline" gap="base" alignItems="center">
            {s.offerImage ? <s-thumbnail src={s.offerImage} alt="" size="small" /> : null}
            <s-text>{s.offerProductTitle || "No product selected"}</s-text>
            <s-button onClick={pickOffer}>{s.offerVariantId ? "Change" : "Select product"}</s-button>
          </s-stack>
          <Grid>
            <Select label="Discount" value={s.discountType} onChange={(v) => set({ discountType: v })} options={discountOptions} />
            <NumberField
              label="Value"
              min={0}
              step={0.01}
              disabled={s.discountType === "none"}
              suffix={s.discountType === "percentage" ? "%" : undefined}
              value={s.discountValue}
              onChange={(v) => set({ discountValue: v })}
            />
          </Grid>
          <UrlField label="Custom image URL (optional)" value={s.offerImage} onChange={(v) => set({ offerImage: v })} />
        </s-stack>
      </s-section>

      <s-section heading="Texts">
        <s-stack gap="base">
          <TextField label="Headline" value={s.headline} onChange={(v) => set({ headline: v })} />
          <TextArea label="Description" rows={2} value={s.description} onChange={(v) => set({ description: v })} />
          <Grid>
            <TextField label="Accept button" value={s.acceptText} onChange={(v) => set({ acceptText: v })} />
            <TextField label="Decline link" value={s.declineText} onChange={(v) => set({ declineText: v })} />
          </Grid>
        </s-stack>
      </s-section>

      {s.placement !== "in_form" && (
        <s-section heading="Downsell">
          <s-stack gap="base">
            <Switch
              label="If declined, offer a bigger discount"
              checked={s.downsellEnabled}
              onChange={(v) => set({ downsellEnabled: v })}
            />
            {s.downsellEnabled && (
              <Grid columns={3}>
                <TextField label="Downsell headline" value={s.downsellHeadline} onChange={(v) => set({ downsellHeadline: v })} />
                <Select label="Discount" value={s.downsellDiscountType} onChange={(v) => set({ downsellDiscountType: v })} options={discountOptions} />
                <NumberField
                  label="Value"
                  min={0}
                  step={0.01}
                  suffix={s.downsellDiscountType === "percentage" ? "%" : undefined}
                  value={s.downsellDiscountValue}
                  onChange={(v) => set({ downsellDiscountValue: v })}
                />
              </Grid>
            )}
          </s-stack>
        </s-section>
      )}
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
