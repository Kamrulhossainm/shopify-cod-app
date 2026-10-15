# COD Form, Upsells, Pixels & OTP — Shopify app

A cash-on-delivery order form app for your own Shopify store: a fast COD form on product and cart pages, plus quantity offers, upsells and downsells, ad pixels, SMS OTP verification, abandoned-order recovery, Google Sheets export and fraud protection.

Built on Shopify's official React Router app template (Polaris web components, Prisma, theme app extension).

## Features

| Area | What you get |
| --- | --- |
| **COD form** | Popup or embedded form on product and cart pages. Drag-and-drop-style field builder (show/hide, required, half width, reorder, custom fields). Button text, colors, animation (shake/pulse/bounce), sticky mobile button, RTL, custom CSS. Can hide Add to cart, Buy it now and Checkout. |
| **Orders** | Creates real Shopify orders (payment pending, tagged `COD`) or draft orders. Prices are always recalculated on the server. Discount codes and taxes are validated by Shopify (`draftOrderCalculate`). UTM parameters are saved on the order. |
| **Shipping & fees** | Per-country rates, minimum order amount, free-shipping thresholds, customer can choose a rate, optional fixed or percentage COD fee. |
| **Quantity offers** | "Buy 1 / Buy 2 save 10% / Buy 3 save 20%" tiers with badges and a preselected tier, for all products or chosen ones. |
| **Upsells & downsells** | Order bump (checkbox in the form), pre-purchase popup, and one-click post-purchase upsell (added to the placed order through Order Editing). An optional downsell with a bigger discount appears when the customer declines. Tracks views, conversions and revenue. |
| **Pixels** | Facebook/Meta (plus server-side Conversions API with event deduplication), TikTok, Snapchat, Pinterest, GA4 and Google Ads. Fires InitiateCheckout and Purchase. |
| **SMS OTP** | Phone verification before the order is created, through Twilio or any SMS/WhatsApp gateway (webhook). Includes rate limiting and attempt limits. |
| **Abandoned orders** | Captures name and phone of shoppers who start the form but don't submit. One-click WhatsApp follow-up, and orders are marked recovered automatically. |
| **Google Sheets** | Appends every order and abandoned form to a spreadsheet through a service account. |
| **Fraud protection** | Blocks phone numbers, emails and IPs. Daily limits per phone and per IP, allowed countries, min/max order total, max quantity, phone digit validation. |
| **Dashboard** | Orders, revenue, AOV, upsell revenue and take rate, abandoned/recovered counts, OTP stats, daily chart, setup checklist. |

## Architecture

```
app/
  routes/proxy.$.tsx          Storefront API via App Proxy (/apps/cod/*): config, calculate,
                              otp/send, otp/verify, abandoned, submit, upsell/accept, track
  routes/app.*.tsx            Admin pages (dashboard, form builder, offers, upsells, shipping,
                              orders, abandoned, pixels, otp, sheets, protection)
  routes/webhooks.compliance  GDPR webhooks (customers/redact, shop/redact, data_request)
  lib/settings.ts             Settings types + defaults (shared by client and server)
  lib/pricing.server.ts       Server-side pricing: variants, offers, upsells, shipping, COD fee
  lib/orders.server.ts        draftOrderCreate → draftOrderComplete(paymentPending), order edits
  lib/otp.server.ts           OTP generation (HMAC-hashed), Twilio/webhook delivery, verification
  lib/protection.server.ts    Blocklists and limits
  lib/sheets.server.ts        Google Sheets (service-account JWT, no extra dependencies)
  lib/capi.server.ts          Meta Conversions API
  components/fields.tsx       React wrappers for Polaris web components
extensions/cod-form/          Theme app extension
  blocks/cod-embed.liquid     App embed (loads the script and product data)
  blocks/cod-button.liquid    Optional app block to place the button/form exactly
  assets/cod-form.js|css      The storefront form (vanilla JS, no dependencies)
prisma/schema.prisma          ShopSettings, QuantityOffer, Upsell, CodOrder, AbandonedOrder, OtpCode
```

## Setup

Requirements: Node 22.12+, a [Shopify Partner account](https://partners.shopify.com), and your store (or a development store).

```bash
npm install
npm run dev          # shopify app dev: creates/links the app, tunnels, installs it on your store
```

During `npm run dev` the Shopify CLI asks you to create or select an app and fills in `client_id` in `shopify.app.toml`. The scopes, app proxy (`/apps/cod`) and webhooks are already configured in that file.

Then, in your store:

1. Open the app. The dashboard's **Enable in theme** button opens the theme editor with the **COD Order Form** app embed. Turn it on and save.
2. Optionally, add the **COD Button / Form** app block to the product template to choose exactly where it appears.
3. Configure **Shipping & COD fee**, then the **Form builder**.
4. Optionally add quantity offers, upsells, pixels, OTP and Google Sheets.

### Distribution

`shopify.server.ts` uses `AppDistribution.AppStore`. For a single store you can create the app as a **custom app** in the Partner Dashboard and install it through the link it gives you. The code doesn't change.

### Production

```bash
npm run build
npm run setup        # prisma generate + migrate deploy
npm run start
```

Set `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SHOPIFY_APP_URL` and `SCOPES`, and run `npm run deploy` to push the config and theme extension. SQLite works for one store. To use Postgres or MySQL, change `datasource` in `prisma/schema.prisma`.

## Notes and limitations

- **Currency:** orders are created in the shop's base currency. If you sell in multiple currencies with Shopify Markets, the form shows prices from the server (base currency) once it loads.
- **Post-purchase upsells** need "Create orders as: Orders", because they edit the placed order. They are offered for 30 minutes after the order.
- **OTP "Test mode"** prints codes to the server log. Switch to Twilio or a webhook before going live.
- **Customer IP** comes from the `x-forwarded-for` header that the App Proxy forwards. IP limits are best-effort.
- Shopify may not send an order confirmation email for orders created through the API. If you need one, set it up with Shopify Flow or a notification app.
