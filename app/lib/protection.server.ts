import prisma from "../db.server";
import { normalizePhone, splitList, type AllSettings } from "./settings";
import type { PricedCart } from "./pricing.server";

/** Returns an error message if the order must be rejected, otherwise null. */
export async function checkProtection(
  shop: string,
  settings: AllSettings,
  ctx: { phone: string; email?: string; ip?: string; country?: string; cart: PricedCart },
): Promise<string | null> {
  const p = settings.protection;
  const blocked = p.blockedMessage || "Order blocked";
  const phone = normalizePhone(ctx.phone);
  const phoneDigits = phone.replace(/\D/g, "");

  if (splitList(p.blockedPhones).some((b) => {
    const d = b.replace(/\D/g, "");
    return d && (phoneDigits === d || phoneDigits.endsWith(d));
  })) return blocked;
  if (ctx.email && splitList(p.blockedEmails).map((e) => e.toLowerCase()).includes(ctx.email.toLowerCase()))
    return blocked;
  if (ctx.ip && splitList(p.blockedIps).includes(ctx.ip)) return blocked;

  const allowed = splitList(p.allowedCountries).map((c) => c.toUpperCase());
  const country = (ctx.country || settings.form.defaultCountry || "").toUpperCase();
  if (allowed.length && !allowed.includes(country)) return "We don't deliver to your country yet.";

  const digits = phoneDigits.length;
  if (digits < settings.form.phoneMinDigits || digits > settings.form.phoneMaxDigits)
    return "Please enter a valid phone number.";

  if (p.minOrderTotal > 0 && ctx.cart.total < p.minOrderTotal)
    return `Minimum order amount is ${p.minOrderTotal} ${ctx.cart.currency}.`;
  if (p.maxOrderTotal > 0 && ctx.cart.total > p.maxOrderTotal)
    return `Maximum order amount for cash on delivery is ${p.maxOrderTotal} ${ctx.cart.currency}.`;
  if (p.maxQuantity > 0 && ctx.cart.totalQuantity > p.maxQuantity)
    return `You can order at most ${p.maxQuantity} items.`;

  const since = new Date(Date.now() - 24 * 3600_000);
  if (p.maxOrdersPerPhonePerDay > 0) {
    const n = await prisma.codOrder.count({
      where: { shop, phone, status: "created", createdAt: { gte: since } },
    });
    if (n >= p.maxOrdersPerPhonePerDay) return "You've reached the daily order limit.";
  }
  if (p.maxOrdersPerIpPerDay > 0 && ctx.ip) {
    const n = await prisma.codOrder.count({
      where: { shop, ip: ctx.ip, status: "created", createdAt: { gte: since } },
    });
    if (n >= p.maxOrdersPerIpPerDay) return "You've reached the daily order limit.";
  }
  return null;
}
