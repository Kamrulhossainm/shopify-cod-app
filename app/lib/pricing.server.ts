/* eslint-disable @typescript-eslint/no-explicit-any -- untyped JSON from GraphQL and requests */
import prisma from "../db.server";
import {
  applyDiscount,
  round2,
  splitList,
  type AllSettings,
  type OfferTier,
  type ShippingRate,
} from "./settings";

export type AdminGraphql = (
  query: string,
  options?: { variables?: Record<string, unknown> },
) => Promise<Response>;

export async function gql<T = any>(
  graphql: AdminGraphql,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const res = await graphql(query, { variables });
  const json: any = await res.json();
  if (json.errors?.length) {
    throw new Error(json.errors.map((e: any) => e.message).join("; "));
  }
  return json.data as T;
}

export interface CartLineInput {
  variantId: string | number;
  quantity: number;
  offerId?: string;
  tierIndex?: number;
}

export interface UpsellSelection {
  upsellId: string;
  downsell?: boolean;
}

export interface CheckoutInput {
  lines: CartLineInput[];
  upsells?: UpsellSelection[];
  country?: string;
  shippingRateId?: string;
  discountCode?: string;
}

export interface PricedLine {
  variantId: string; // gid
  productId: string;
  title: string;
  variantTitle: string;
  image: string;
  quantity: number;
  unitPrice: number;
  discount: number; // total discount on line
  discountTitle?: string;
  upsellId?: string;
}

export interface PricedCart {
  currency: string;
  lines: PricedLine[];
  subtotal: number; // before discounts
  offerDiscount: number;
  shippingRate: ShippingRate | null;
  shipping: number;
  codFee: number;
  total: number; // estimate before discount codes / taxes
  availableRates: ShippingRate[];
  totalQuantity: number;
}

export const toVariantGid = (id: string | number) =>
  String(id).startsWith("gid://") ? String(id) : `gid://shopify/ProductVariant/${id}`;

export async function fetchVariants(graphql: AdminGraphql, ids: string[]) {
  if (!ids.length) return new Map<string, any>();
  const data = await gql<{ nodes: any[]; shop: { currencyCode: string } }>(
    graphql,
    `#graphql
    query CodVariants($ids: [ID!]!) {
      shop { currencyCode }
      nodes(ids: $ids) {
        ... on ProductVariant {
          id
          title
          price
          availableForSale
          image { url }
          product { id title featuredImage { url } }
        }
      }
    }`,
    { ids },
  );
  const map = new Map<string, any>();
  for (const node of data.nodes) if (node?.id) map.set(node.id, node);
  (map as any).currency = data.shop.currencyCode;
  return map;
}

export function ratesForCountry(settings: AllSettings, country?: string) {
  const c = (country || settings.form.defaultCountry || "").toUpperCase();
  return settings.shipping.rates.filter((r) => {
    const list = splitList(r.countries).map((x) => x.toUpperCase());
    return list.includes("*") || list.length === 0 || list.includes(c);
  });
}

/** Server-authoritative price calculation (never trust client prices). */
export async function priceCart(
  shop: string,
  graphql: AdminGraphql,
  settings: AllSettings,
  input: CheckoutInput,
): Promise<PricedCart> {
  const lines = (input.lines || [])
    .filter((l) => l && l.variantId && Number(l.quantity) > 0)
    .slice(0, 50);
  const upsellSel = (input.upsells || []).slice(0, 10);

  const upsells = upsellSel.length
    ? await prisma.upsell.findMany({
        where: { shop, active: true, id: { in: upsellSel.map((u) => u.upsellId) } },
      })
    : [];

  const ids = [
    ...new Set([
      ...lines.map((l) => toVariantGid(l.variantId)),
      ...upsells.map((u) => toVariantGid(u.offerVariantId)),
    ]),
  ];
  const variants = await fetchVariants(graphql, ids);
  const currency: string = (variants as any).currency || "USD";

  const offerIds = lines.map((l) => l.offerId).filter(Boolean) as string[];
  const offers = offerIds.length
    ? await prisma.quantityOffer.findMany({
        where: { shop, active: true, id: { in: offerIds } },
      })
    : [];

  const priced: PricedLine[] = [];
  for (const line of lines) {
    const v = variants.get(toVariantGid(line.variantId));
    if (!v) continue;
    const quantity = Math.max(1, Math.min(999, Math.floor(Number(line.quantity))));
    const unitPrice = Number(v.price);
    let discount = 0;
    let discountTitle: string | undefined;

    const offer = offers.find((o) => o.id === line.offerId);
    if (offer && offerApplies(offer.productScope, v.product.id)) {
      const tiers: OfferTier[] = safeJson(offer.tiers, []);
      const tier = tiers[Number(line.tierIndex)];
      // Tier must match the quantity actually ordered.
      if (tier && tier.quantity === quantity) {
        discount = applyDiscount(unitPrice * quantity, tier.discountType, tier.discountValue);
        discountTitle = tier.label || offer.title;
      }
    }

    priced.push({
      variantId: v.id,
      productId: v.product.id,
      title: v.product.title,
      variantTitle: v.title === "Default Title" ? "" : v.title,
      image: v.image?.url || v.product.featuredImage?.url || "",
      quantity,
      unitPrice,
      discount,
      discountTitle,
    });
  }

  const productIds = priced.map((p) => p.productId);
  for (const sel of upsellSel) {
    const u = upsells.find((x) => x.id === sel.upsellId);
    if (!u || u.placement === "post_submit") continue;
    if (!offerApplies(u.triggerScope, ...productIds)) continue;
    const v = variants.get(toVariantGid(u.offerVariantId));
    if (!v) continue;
    const unitPrice = Number(v.price);
    const useDown = sel.downsell && u.downsellEnabled;
    const discount = applyDiscount(
      unitPrice,
      useDown ? u.downsellDiscountType : u.discountType,
      useDown ? u.downsellDiscountValue : u.discountValue,
    );
    priced.push({
      variantId: v.id,
      productId: v.product.id,
      title: v.product.title,
      variantTitle: v.title === "Default Title" ? "" : v.title,
      image: v.image?.url || v.product.featuredImage?.url || "",
      quantity: 1,
      unitPrice,
      discount,
      discountTitle: discount ? u.title : undefined,
      upsellId: u.id,
    });
  }

  const subtotal = round2(priced.reduce((s, l) => s + l.unitPrice * l.quantity, 0));
  const offerDiscount = round2(priced.reduce((s, l) => s + l.discount, 0));
  const afterDiscount = round2(subtotal - offerDiscount);

  const availableRates = ratesForCountry(settings, input.country).filter(
    (r) => afterDiscount >= (r.minSubtotal || 0),
  );
  const shippingRate =
    availableRates.find((r) => r.id === input.shippingRateId) || availableRates[0] || null;
  let shipping = 0;
  if (shippingRate) {
    shipping =
      shippingRate.freeAbove > 0 && afterDiscount >= shippingRate.freeAbove
        ? 0
        : Number(shippingRate.price) || 0;
  }

  let codFee = 0;
  if (settings.general.codFeeEnabled) {
    codFee =
      settings.general.codFeeType === "percentage"
        ? round2((afterDiscount * settings.general.codFeeAmount) / 100)
        : settings.general.codFeeAmount;
  }

  return {
    currency,
    lines: priced,
    subtotal,
    offerDiscount,
    shippingRate,
    shipping: round2(shipping),
    codFee: round2(codFee),
    total: round2(afterDiscount + shipping + codFee),
    availableRates,
    totalQuantity: priced.reduce((s, l) => s + l.quantity, 0),
  };
}

/** Product GIDs from a stored scope (JSON array of GIDs or {id,title} objects). */
export function scopeIds(scope: string): string[] {
  return safeJson<(string | { id: string })[]>(scope, []).map((p) => (typeof p === "string" ? p : p.id));
}

export function offerApplies(scope: string, ...productIds: string[]) {
  if (!scope || scope === "all") return true;
  const list = scopeIds(scope);
  return productIds.some((id) => list.includes(id));
}

export function safeJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
