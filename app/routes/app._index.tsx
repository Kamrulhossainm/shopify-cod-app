import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { getSettings } from "../lib/settings.server";
import { fmtMoney, OrdersTable } from "../components/orders";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const url = new URL(request.url);
  const days = Math.min(365, Math.max(1, Number(url.searchParams.get("days")) || 30));
  const since = new Date(Date.now() - days * 86400_000);

  const [settings, orders, failed, abandoned, recovered, upsells, recent, offers] = await Promise.all([
    getSettings(shop),
    prisma.codOrder.findMany({
      where: { shop, status: "created", createdAt: { gte: since } },
      select: { total: true, upsellRevenue: true, otpVerified: true, currency: true, createdAt: true },
    }),
    prisma.codOrder.count({ where: { shop, status: "failed", createdAt: { gte: since } } }),
    prisma.abandonedOrder.count({ where: { shop, createdAt: { gte: since } } }),
    prisma.abandonedOrder.count({ where: { shop, recovered: true, createdAt: { gte: since } } }),
    prisma.upsell.findMany({ where: { shop }, select: { title: true, impressions: true, conversions: true, revenue: true } }),
    prisma.codOrder.findMany({ where: { shop }, orderBy: { createdAt: "desc" }, take: 8 }),
    prisma.quantityOffer.count({ where: { shop, active: true } }),
  ]);

  const revenue = orders.reduce((s, o) => s + o.total, 0);
  const upsellRevenue = orders.reduce((s, o) => s + o.upsellRevenue, 0);

  // Daily buckets for the bar chart
  const byDay = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) {
    byDay.set(new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10), 0);
  }
  for (const o of orders) {
    const k = o.createdAt.toISOString().slice(0, 10);
    byDay.set(k, (byDay.get(k) || 0) + 1);
  }

  return {
    shop,
    apiKey: process.env.SHOPIFY_API_KEY || "",
    days,
    currency: orders[0]?.currency || recent[0]?.currency || "",
    enabled: settings.general.enabled,
    setup: {
      shipping: settings.shipping.rates.length > 0,
      offers: offers > 0,
      upsells: upsells.length > 0,
      pixels: !!(settings.pixels.facebookPixelIds || settings.pixels.tiktokPixelIds || settings.pixels.googleAnalyticsId),
    },
    stats: {
      orders: orders.length,
      revenue,
      aov: orders.length ? revenue / orders.length : 0,
      upsellRevenue,
      failed,
      abandoned,
      recovered,
      otpVerified: orders.filter((o) => o.otpVerified).length,
      upsellImpressions: upsells.reduce((s, u) => s + u.impressions, 0),
      upsellConversions: upsells.reduce((s, u) => s + u.conversions, 0),
    },
    chart: [...byDay.entries()],
    recent: recent.map((o) => ({
      id: o.id,
      name: o.shopifyOrderName,
      orderId: o.shopifyOrderId,
      customer: o.customerName,
      phone: o.phone,
      total: o.total,
      currency: o.currency,
      status: o.status,
      createdAt: o.createdAt.toISOString(),
    })),
  };
};

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <s-box padding="base" borderWidth="base" borderRadius="base" background="base">
      <s-stack gap="small-200">
        <s-text color="subdued">{label}</s-text>
        <s-heading>{value}</s-heading>
        {sub ? <s-text color="subdued">{sub}</s-text> : null}
      </s-stack>
    </s-box>
  );
}

export default function Dashboard() {
  const d = useLoaderData<typeof loader>();
  const s = d.stats;
  const max = Math.max(1, ...d.chart.map(([, n]) => n));
  const embedUrl = `https://${d.shop}/admin/themes/current/editor?context=apps&activateAppId=${d.apiKey}/cod-embed`;
  const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(1)}%` : "—");

  return (
    <s-page heading="COD dashboard">
      <s-button slot="primary-action" variant="primary" href={embedUrl} target="_blank">
        Enable in theme
      </s-button>

      {!d.enabled && (
        <s-banner tone="warning" heading="The COD form is turned off">
          Turn it on in <s-link href="/app/form">Form builder → General</s-link>.
        </s-banner>
      )}

      <s-section heading="Setup checklist">
        <s-stack gap="small-200">
          <Check done label="Install the app" />
          <Check
            done={false}
            label="Activate the 'COD Order Form' app embed in your theme"
            href={embedUrl}
            external
          />
          <Check done={d.setup.shipping} label="Configure shipping rates & COD fee" href="/app/shipping" />
          <Check done={d.setup.offers} label="Create a quantity offer (optional)" href="/app/offers" />
          <Check done={d.setup.upsells} label="Create an upsell or downsell (optional)" href="/app/upsells" />
          <Check done={d.setup.pixels} label="Connect your ad pixels (optional)" href="/app/pixels" />
        </s-stack>
      </s-section>

      <s-section heading={`Last ${d.days} days`}>
        <s-stack direction="inline" gap="small-200">
          {[7, 30, 90].map((n) => (
            <s-button key={n} href={`/app?days=${n}`} variant={n === d.days ? "primary" : "secondary"}>
              {`${n} days`}
            </s-button>
          ))}
        </s-stack>
        <s-box paddingBlockStart="base">
          <s-grid gridTemplateColumns="repeat(auto-fit, minmax(180px, 1fr))" gap="base">
            <Stat label="COD orders" value={String(s.orders)} sub={s.failed ? `${s.failed} failed` : undefined} />
            <Stat label="Revenue" value={fmtMoney(s.revenue, d.currency)} />
            <Stat label="Average order value" value={fmtMoney(s.aov, d.currency)} />
            <Stat
              label="Upsell revenue"
              value={fmtMoney(s.upsellRevenue, d.currency)}
              sub={`${pct(s.upsellConversions, s.upsellImpressions)} take rate`}
            />
            <Stat
              label="Abandoned forms"
              value={String(s.abandoned)}
              sub={`${pct(s.recovered, s.abandoned)} recovered`}
            />
            <Stat label="OTP-verified orders" value={String(s.otpVerified)} sub={pct(s.otpVerified, s.orders)} />
          </s-grid>
        </s-box>
        <s-box paddingBlockStart="large">
          <s-text color="subdued">Orders per day</s-text>
          <div
            role="img"
            aria-label="Orders per day"
            style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 120, marginTop: 8 }}
          >
            {d.chart.map(([day, n]) => (
              <div
                key={day}
                title={`${day}: ${n} orders`}
                style={{
                  flex: 1,
                  height: `${Math.max(2, (n / max) * 100)}%`,
                  background: n ? "#2c6ecb" : "#e3e3e3",
                  borderRadius: "3px 3px 0 0",
                }}
              />
            ))}
          </div>
        </s-box>
      </s-section>

      <s-section heading="Recent COD orders" padding="none">
        {d.recent.length === 0 ? (
          <s-box padding="base">
            <s-paragraph>No orders yet. Once the form is live, orders show up here.</s-paragraph>
          </s-box>
        ) : (
          <OrdersTable rows={d.recent} />
        )}
      </s-section>
    </s-page>
  );
}

function Check({ done, label, href, external }: { done: boolean; label: string; href?: string; external?: boolean }) {
  return (
    <s-stack direction="inline" gap="small-200" alignItems="center">
      <s-icon type={done ? "check-circle-filled" : "circle-dashed"} tone={done ? "success" : "neutral"} />
      {href ? (
        <s-link href={href} {...(external ? { target: "_blank" } : {})}>
          {label}
        </s-link>
      ) : (
        <s-text>{label}</s-text>
      )}
    </s-stack>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
