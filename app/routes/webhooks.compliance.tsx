import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

// customers/data_request, customers/redact, shop/redact
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);
  console.log(`Received ${topic} compliance webhook for ${shop}`);

  if (topic === "CUSTOMERS_REDACT") {
    const p = payload as { customer?: { phone?: string; email?: string } };
    const or = [
      p.customer?.phone ? { phone: p.customer.phone } : null,
      p.customer?.email ? { email: p.customer.email } : null,
    ].filter(Boolean) as object[];
    if (or.length) {
      await db.codOrder.updateMany({
        where: { shop, OR: or },
        data: { customerName: "[redacted]", phone: "[redacted]", email: null, address: "{}", ip: null },
      });
      await db.abandonedOrder.deleteMany({ where: { shop, OR: or } });
    }
  } else if (topic === "SHOP_REDACT") {
    await Promise.all([
      db.codOrder.deleteMany({ where: { shop } }),
      db.abandonedOrder.deleteMany({ where: { shop } }),
      db.otpCode.deleteMany({ where: { shop } }),
      db.upsell.deleteMany({ where: { shop } }),
      db.quantityOffer.deleteMany({ where: { shop } }),
      db.shopSettings.deleteMany({ where: { shop } }),
    ]);
  }
  // CUSTOMERS_DATA_REQUEST: the data we store is visible to the merchant in the
  // Orders / Abandoned pages, so there is nothing extra to send here.
  return new Response();
};
