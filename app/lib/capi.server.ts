/* eslint-disable @typescript-eslint/no-explicit-any -- untyped JSON from GraphQL and requests */
import crypto from "node:crypto";
import { splitList, type PixelSettings } from "./settings";

const sha = (v?: string) =>
  v ? crypto.createHash("sha256").update(v.trim().toLowerCase()).digest("hex") : undefined;

/** Facebook Conversions API "Purchase" (deduplicated with the browser pixel via eventId). */
export async function sendFacebookPurchase(
  pixels: PixelSettings,
  data: {
    eventId: string;
    value: number;
    currency: string;
    contentIds: string[];
    phone: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    city?: string;
    zip?: string;
    country?: string;
    ip?: string;
    userAgent?: string;
    url?: string;
    fbp?: string;
    fbc?: string;
  },
) {
  if (!pixels.facebookCapiToken || !pixels.firePurchase) return;
  const ids = splitList(pixels.facebookPixelIds);
  await Promise.all(
    ids.map(async (pixelId) => {
      const body: any = {
        data: [
          {
            event_name: "Purchase",
            event_time: Math.floor(Date.now() / 1000),
            event_id: data.eventId,
            action_source: "website",
            event_source_url: data.url,
            user_data: {
              ph: [sha(data.phone.replace(/\D/g, ""))],
              em: data.email ? [sha(data.email)] : undefined,
              fn: data.firstName ? [sha(data.firstName)] : undefined,
              ln: data.lastName ? [sha(data.lastName)] : undefined,
              ct: data.city ? [sha(data.city)] : undefined,
              zp: data.zip ? [sha(data.zip)] : undefined,
              country: data.country ? [sha(data.country)] : undefined,
              client_ip_address: data.ip,
              client_user_agent: data.userAgent,
              fbp: data.fbp,
              fbc: data.fbc,
            },
            custom_data: {
              value: data.value,
              currency: data.currency,
              content_ids: data.contentIds,
              content_type: "product",
            },
          },
        ],
      };
      if (pixels.facebookTestEventCode) body.test_event_code = pixels.facebookTestEventCode;
      const res = await fetch(
        `https://graph.facebook.com/v21.0/${pixelId}/events?access_token=${encodeURIComponent(pixels.facebookCapiToken)}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
      );
      if (!res.ok) console.error("Facebook CAPI error", pixelId, await res.text());
    }),
  );
}
