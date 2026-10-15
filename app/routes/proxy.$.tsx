/* eslint-disable @typescript-eslint/no-explicit-any -- untyped JSON from GraphQL and requests */
/**
 * Storefront API, served through the Shopify App Proxy:
 *   https://{shop}/apps/cod/<endpoint>  ->  {appUrl}/proxy/<endpoint>
 * Every request is HMAC-verified by authenticate.public.appProxy.
 */
import crypto from "node:crypto";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { getSettings } from "../lib/settings.server";
import { normalizePhone, round2, type AllSettings } from "../lib/settings";
import {
  fetchVariants,
  offerApplies,
  priceCart,
  safeJson,
  scopeIds,
  toVariantGid,
  type AdminGraphql,
  type CheckoutInput,
  type PricedCart,
} from "../lib/pricing.server";
import {
  addUpsellToOrder,
  buildDraftInput,
  calculateDraft,
  createShopifyOrder,
  type CustomerInput,
} from "../lib/orders.server";
import { consumeOtpToken, sendOtp, verifyOtp } from "../lib/otp.server";
import { checkProtection } from "../lib/protection.server";
import { appendRow } from "../lib/sheets.server";
import { sendFacebookPurchase } from "../lib/capi.server";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

const fail = (error: string, status = 400) => json({ ok: false, error }, status);

function clientIp(request: Request) {
  const fwd = request.headers.get("x-forwarded-for");
  return fwd ? fwd.split(",")[0].trim() : undefined;
}

async function context(request: Request) {
  const { session, admin } = await authenticate.public.appProxy(request);
  if (!session || !admin) throw fail("App is not installed on this shop", 401);
  const shop = session.shop;
  const settings = await getSettings(shop);
  return { shop, settings, graphql: admin.graphql as unknown as AdminGraphql };
}

// ───────────────────────────── GET ─────────────────────────────

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const endpoint = params["*"];
  if (endpoint !== "config") return fail("Not found", 404);
  const { shop, settings, graphql } = await context(request);
  const url = new URL(request.url);
  const productId = url.searchParams.get("product_id");
  const productGid = productId ? `gid://shopify/Product/${productId}` : null;
  return json(await publicConfig(shop, settings, graphql, productGid));
};

async function publicConfig(
  shop: string,
  s: AllSettings,
  graphql: AdminGraphql,
  productGid: string | null,
) {
  const offers = (await prisma.quantityOffer.findMany({ where: { shop, active: true } }))
    .filter((o) => !productGid || offerApplies(o.productScope, productGid))
    .map((o) => ({ id: o.id, title: o.title, tiers: safeJson(o.tiers, []) }));

  const upsellRows = (
    await prisma.upsell.findMany({ where: { shop, active: true }, orderBy: { priority: "desc" } })
  ).filter((u) => !productGid || offerApplies(u.triggerScope, productGid));
  const variants = await fetchVariants(
    graphql,
    upsellRows.map((u) => toVariantGid(u.offerVariantId)),
  ).catch(() => new Map());
  const upsells = upsellRows
    .map((u) => {
      const v = variants.get(toVariantGid(u.offerVariantId));
      if (!v || v.availableForSale === false) return null;
      return {
        id: u.id,
        placement: u.placement,
        triggerScope: u.triggerScope === "all" ? "all" : scopeIds(u.triggerScope),
        title: v.product.title + (v.title === "Default Title" ? "" : ` - ${v.title}`),
        image: u.offerImage || v.image?.url || v.product.featuredImage?.url || "",
        price: Number(v.price),
        discountType: u.discountType,
        discountValue: u.discountValue,
        headline: u.headline,
        description: u.description,
        acceptText: u.acceptText,
        declineText: u.declineText,
        downsell: u.downsellEnabled
          ? {
              discountType: u.downsellDiscountType,
              discountValue: u.downsellDiscountValue,
              headline: u.downsellHeadline,
            }
          : null,
      };
    })
    .filter(Boolean);

  const { general: g, form, pixels: px } = s;
  return {
    ok: true,
    currency: (variants as any).currency,
    general: {
      enabled: g.enabled,
      mode: g.mode,
      showOnProduct: g.showOnProduct,
      showOnCart: g.showOnCart,
      hideAddToCart: g.hideAddToCart,
      hideBuyNow: g.hideBuyNow,
      hideCheckoutButton: g.hideCheckoutButton,
      redirect: g.redirect,
      customRedirectUrl: g.customRedirectUrl,
      codFeeEnabled: g.codFeeEnabled,
      codFeeType: g.codFeeType,
      codFeeAmount: g.codFeeAmount,
      codFeeLabel: g.codFeeLabel,
    },
    form,
    shipping: s.shipping.rates,
    otp: { enabled: s.otp.enabled, codeLength: s.otp.codeLength },
    pixels: {
      facebook: px.facebookPixelIds,
      tiktok: px.tiktokPixelIds,
      snapchat: px.snapchatPixelIds,
      pinterest: px.pinterestTagIds,
      ga4: px.googleAnalyticsId,
      googleAds: px.googleAdsId,
      googleAdsLabel: px.googleAdsConversionLabel,
      fireInitiateCheckout: px.fireInitiateCheckout,
      firePurchase: px.firePurchase,
    },
    abandoned: s.protection.abandonedEnabled,
    offers,
    upsells,
  };
}

// ───────────────────────────── POST ─────────────────────────────

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const endpoint = params["*"];
  let body: any;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON");
  }
  const ctx = await context(request);
  try {
    switch (endpoint) {
      case "calculate":
        return json(await handleCalculate(ctx, body));
      case "otp/send":
        if (!ctx.settings.otp.enabled) return fail("OTP disabled");
        await sendOtp(ctx.shop, String(body.phone || ""), ctx.settings.otp);
        return json({ ok: true });
      case "otp/verify": {
        const token = await verifyOtp(ctx.shop, String(body.phone || ""), String(body.code || ""), ctx.settings.otp);
        return json({ ok: true, token });
      }
      case "abandoned":
        return json(await handleAbandoned(ctx, body));
      case "submit":
        return await handleSubmit(ctx, body, request);
      case "upsell/accept":
        return json(await handlePostUpsell(ctx, body));
      case "track":
        if (body.upsellId && body.type === "impression") {
          await prisma.upsell.updateMany({
            where: { id: String(body.upsellId), shop: ctx.shop },
            data: { impressions: { increment: 1 } },
          });
        }
        return json({ ok: true });
      default:
        return fail("Not found", 404);
    }
  } catch (e: any) {
    if (e instanceof Response) return e;
    console.error(`[COD proxy ${endpoint}]`, e);
    return fail(e?.message || "Something went wrong", 400);
  }
};

type Ctx = Awaited<ReturnType<typeof context>>;

function cartInput(body: any): CheckoutInput {
  return {
    lines: Array.isArray(body.lines) ? body.lines : [],
    upsells: Array.isArray(body.upsells) ? body.upsells : [],
    country: body.customer?.country || body.country,
    shippingRateId: body.shippingRateId,
    discountCode: body.discountCode ? String(body.discountCode).slice(0, 100) : undefined,
  };
}

function summary(cart: PricedCart, exact?: Awaited<ReturnType<typeof calculateDraft>>) {
  return {
    ok: true,
    currency: cart.currency,
    lines: cart.lines.map((l) => ({
      variantId: l.variantId,
      title: l.title,
      variantTitle: l.variantTitle,
      image: l.image,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      discount: l.discount,
      upsellId: l.upsellId,
    })),
    subtotal: cart.subtotal,
    offerDiscount: cart.offerDiscount,
    discountCodeAmount: exact ? round2(Math.max(0, exact.discounts - cart.offerDiscount)) : 0,
    shipping: exact ? exact.shipping : cart.shipping,
    shippingRateId: cart.shippingRate?.id ?? null,
    rates: cart.availableRates.map((r) => ({
      id: r.id,
      name: r.name,
      price: r.freeAbove > 0 && cart.subtotal - cart.offerDiscount >= r.freeAbove ? 0 : r.price,
    })),
    codFee: cart.codFee,
    tax: exact?.tax ?? 0,
    total: exact ? exact.total : cart.total,
  };
}

async function handleCalculate({ shop, settings, graphql }: Ctx, body: any) {
  const input = cartInput(body);
  const cart = await priceCart(shop, graphql, settings, input);
  if (!cart.lines.length) return summary(cart);
  if (!input.discountCode) return summary(cart);
  // Let Shopify validate the discount code and compute the exact totals.
  const exact = await calculateDraft(graphql, buildDraftInput(settings, cart, null, input.discountCode));
  const applied = exact.discounts > cart.offerDiscount + 0.001;
  return { ...summary(cart, exact), discountCodeValid: applied };
}

function readCustomer(settings: AllSettings, raw: any): CustomerInput {
  const c: any = {};
  const custom: Record<string, string> = {};
  for (const field of settings.form.fields) {
    if (!field.enabled) continue;
    const value = raw?.[field.key];
    const str = typeof value === "boolean" ? (value ? "Yes" : "") : String(value ?? "").trim();
    if (field.required && !str) throw new Error(`${field.label} is required`);
    if (field.custom) custom[field.label] = str.slice(0, 500);
    else c[field.key] = str.slice(0, 255);
  }
  if (!c.phone) throw new Error("Phone number is required");
  if (c.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)) throw new Error("Invalid email");
  c.phone = normalizePhone(
    settings.form.phonePrefix && !c.phone.startsWith("+") && !c.phone.startsWith("00")
      ? `${settings.form.phonePrefix}${c.phone.replace(/^0+/, "")}`
      : c.phone,
  );
  c.country = c.country || settings.form.defaultCountry;
  c.custom = custom;
  return c as CustomerInput;
}

async function handleAbandoned({ shop, settings }: Ctx, body: any) {
  if (!settings.protection.abandonedEnabled) return { ok: true };
  const sessionKey = String(body.sessionKey || "").slice(0, 64);
  if (!sessionKey) return { ok: false };
  const c = body.customer || {};
  const phone = c.phone ? String(c.phone).slice(0, 32) : null;
  if (!phone && !c.email) return { ok: true }; // nothing useful to recover
  const existing = await prisma.abandonedOrder.findUnique({
    where: { shop_sessionKey: { shop, sessionKey } },
  });
  if (existing?.recovered) return { ok: true };
  const name = [c.firstName, c.lastName].filter(Boolean).join(" ").slice(0, 120) || null;
  const data = JSON.stringify({ customer: c, lines: body.lines, url: body.url }).slice(0, 20_000);
  await prisma.abandonedOrder.upsert({
    where: { shop_sessionKey: { shop, sessionKey } },
    create: {
      shop, sessionKey, name, phone, email: c.email || null, data,
      total: Number(body.total) || 0, currency: String(body.currency || "USD"),
    },
    update: { name, phone, email: c.email || null, data, total: Number(body.total) || 0 },
  });
  if (!existing && phone) {
    appendRow(settings.sheets, settings.sheets.abandonedSheet, [
      new Date().toISOString(), name, phone, c.email, c.address1, c.city, c.country, body.total, body.url,
    ]).catch((e) => console.error("Sheets abandoned", e));
  }
  return { ok: true };
}

async function handleSubmit({ shop, settings, graphql }: Ctx, body: any, request: Request) {
  if (!settings.general.enabled) return fail("Cash on delivery is currently unavailable");
  const customer = readCustomer(settings, body.customer);
  const input = cartInput(body);
  input.country = customer.country;
  const cart = await priceCart(shop, graphql, settings, input);
  if (!cart.lines.some((l) => !l.upsellId)) return fail("Your cart is empty");

  const ip = clientIp(request);
  const blocked = await checkProtection(shop, settings, {
    phone: customer.phone, email: customer.email, ip, country: customer.country, cart,
  });
  if (blocked) return fail(blocked, 403);

  let otpVerified = false;
  if (settings.otp.enabled) {
    otpVerified = await consumeOtpToken(shop, customer.phone, body.otpToken);
    if (!otpVerified) return json({ ok: false, error: "Phone verification required", otpRequired: true }, 403);
  }

  const utm = body.utm && typeof body.utm === "object" ? body.utm : {};
  const attributes = [
    { key: "Order source", value: "COD form" },
    ...Object.entries(utm)
      .filter(([k, v]) => /^utm_/.test(k) && v)
      .map(([k, v]) => ({ key: k, value: String(v).slice(0, 200) })),
  ];
  const draftInput = buildDraftInput(settings, cart, customer, input.discountCode, attributes);
  const eventId = String(body.eventId || crypto.randomUUID()).slice(0, 64);
  const customerName = [customer.firstName, customer.lastName].filter(Boolean).join(" ");

  const record = await prisma.codOrder.create({
    data: {
      shop,
      customerName,
      phone: customer.phone,
      email: customer.email || null,
      address: JSON.stringify({
        address1: customer.address1, address2: customer.address2, city: customer.city,
        province: customer.province, zip: customer.zip, country: customer.country,
      }),
      lineItems: JSON.stringify(cart.lines),
      subtotal: cart.subtotal,
      shipping: cart.shipping,
      discount: cart.offerDiscount,
      codFee: cart.codFee,
      total: cart.total,
      currency: cart.currency,
      upsellRevenue: round2(cart.lines.filter((l) => l.upsellId).reduce((s, l) => s + l.unitPrice - l.discount, 0)),
      otpVerified,
      ip,
      utm: JSON.stringify(utm),
      eventId,
    },
  });

  let created;
  try {
    created = await createShopifyOrder(graphql, settings, draftInput);
  } catch (e: any) {
    await prisma.codOrder.update({ where: { id: record.id }, data: { status: "failed", error: String(e.message).slice(0, 1000) } });
    throw e;
  }
  const upsellToken = crypto.randomBytes(18).toString("hex");
  await prisma.codOrder.update({
    where: { id: record.id },
    data: {
      status: "created",
      shopifyOrderId: created.orderId,
      shopifyOrderName: created.name,
      draftOrderId: created.draftOrderId,
      statusPageUrl: created.statusPageUrl,
      total: created.total,
      upsellToken,
    },
  });

  // Upsell conversion stats
  for (const l of cart.lines.filter((x) => x.upsellId)) {
    await prisma.upsell.updateMany({
      where: { id: l.upsellId!, shop },
      data: { conversions: { increment: 1 }, revenue: { increment: round2(l.unitPrice - l.discount) } },
    });
  }
  if (body.sessionKey) {
    await prisma.abandonedOrder.updateMany({
      where: { shop, sessionKey: String(body.sessionKey) },
      data: { recovered: true },
    });
  }

  const sideEffects = await Promise.allSettled([
    appendRow(settings.sheets, settings.sheets.ordersSheet, [
      new Date().toISOString(), created.name, settings.general.orderType, customerName,
      customer.phone, customer.email, [customer.address1, customer.address2].filter(Boolean).join(", "),
      customer.city, customer.province, customer.zip, customer.country,
      cart.lines.map((l) => `${l.title}${l.variantTitle ? ` (${l.variantTitle})` : ""} x${l.quantity}`).join(" | "),
      cart.totalQuantity, created.total, cart.currency, customer.note,
    ]),
    sendFacebookPurchase(settings.pixels, {
      eventId,
      value: created.total,
      currency: cart.currency,
      contentIds: cart.lines.map((l) => l.productId.split("/").pop()!),
      phone: customer.phone,
      email: customer.email,
      firstName: customer.firstName,
      lastName: customer.lastName,
      city: customer.city,
      zip: customer.zip,
      country: customer.country,
      ip,
      userAgent: request.headers.get("user-agent") || undefined,
      url: body.url,
      fbp: body.fbp,
      fbc: body.fbc,
    }),
  ]);
  for (const r of sideEffects) if (r.status === "rejected") console.error("[COD side effect]", r.reason);

  const productIds = cart.lines.map((l) => l.productId);
  const postUpsells =
    settings.general.orderType === "order"
      ? (await prisma.upsell.findMany({ where: { shop, active: true, placement: "post_submit" }, orderBy: { priority: "desc" } }))
          .filter((u) => offerApplies(u.triggerScope, ...productIds))
          .map((u) => u.id)
      : [];

  return json({
    ok: true,
    orderName: created.name,
    statusPageUrl: created.statusPageUrl,
    total: created.total,
    currency: cart.currency,
    eventId,
    contentIds: cart.lines.map((l) => l.productId.split("/").pop()),
    upsellToken: postUpsells.length ? upsellToken : null,
    postUpsells,
  });
}

async function handlePostUpsell({ shop, graphql }: Ctx, body: any) {
  const token = String(body.upsellToken || "");
  const order = token ? await prisma.codOrder.findUnique({ where: { upsellToken: token } }) : null;
  if (!order || order.shop !== shop || !order.shopifyOrderId) throw new Error("Order not found");
  if (Date.now() - order.createdAt.getTime() > 30 * 60_000) throw new Error("Offer expired");

  const upsell = await prisma.upsell.findFirst({
    where: { id: String(body.upsellId), shop, active: true, placement: "post_submit" },
  });
  if (!upsell) throw new Error("Offer not available");
  const useDown = body.downsell && upsell.downsellEnabled;
  const type = useDown ? upsell.downsellDiscountType : upsell.discountType;
  const value = useDown ? upsell.downsellDiscountValue : upsell.discountValue;

  const variants = await fetchVariants(graphql, [toVariantGid(upsell.offerVariantId)]);
  const v = variants.get(toVariantGid(upsell.offerVariantId));
  if (!v) throw new Error("Product unavailable");
  const price = Number(v.price);
  const percent =
    type === "percentage" ? value : type === "fixed" && price > 0 ? Math.min(100, (value / price) * 100) : 0;

  const newTotal = await addUpsellToOrder(graphql, order.shopifyOrderId, v.id, Number(percent.toFixed(4)), upsell.title);
  const added = round2(price * (1 - percent / 100));
  await prisma.$transaction([
    prisma.codOrder.update({
      where: { id: order.id },
      data: { total: newTotal, upsellRevenue: { increment: added } },
    }),
    prisma.upsell.update({
      where: { id: upsell.id },
      data: { conversions: { increment: 1 }, revenue: { increment: added } },
    }),
  ]);
  return { ok: true, total: newTotal, added };
}
