/* eslint-disable @typescript-eslint/no-explicit-any -- untyped JSON from GraphQL and requests */
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData, useSearchParams } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { safeJson } from "../lib/pricing.server";
import { fmtMoney } from "../components/orders";

const PAGE = 50;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const show = url.searchParams.get("show") || "open";
  const where: any = { shop: session.shop };
  if (show === "open") where.recovered = false;
  if (show === "recovered") where.recovered = true;
  const [rows, count] = await Promise.all([
    prisma.abandonedOrder.findMany({ where, orderBy: { updatedAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE }),
    prisma.abandonedOrder.count({ where }),
  ]);
  return {
    page,
    pages: Math.max(1, Math.ceil(count / PAGE)),
    show,
    rows: rows.map((r) => {
      const data = safeJson<{ customer?: Record<string, string>; url?: string }>(r.data, {});
      return {
        id: r.id,
        name: r.name || "—",
        phone: r.phone || "",
        email: r.email || "",
        address: [data.customer?.address1, data.customer?.city].filter(Boolean).join(", "),
        url: data.url || "",
        total: r.total,
        currency: r.currency,
        recovered: r.recovered,
        contacted: r.contacted,
        updatedAt: r.updatedAt.toISOString(),
      };
    }),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const form = await request.formData();
  const id = String(form.get("id"));
  const intent = form.get("intent");
  if (intent === "contacted") {
    await prisma.abandonedOrder.updateMany({ where: { id, shop: session.shop }, data: { contacted: true } });
  } else if (intent === "recovered") {
    await prisma.abandonedOrder.updateMany({ where: { id, shop: session.shop }, data: { recovered: true } });
  } else if (intent === "delete") {
    await prisma.abandonedOrder.deleteMany({ where: { id, shop: session.shop } });
  }
  return { ok: true };
};

export default function Abandoned() {
  const d = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const [params] = useSearchParams();
  const act = (intent: string, id: string) => fetcher.submit({ intent, id }, { method: "post" });
  const wa = (phone: string, name: string, url: string) =>
    `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(
      `Hi ${name}, we noticed you didn't finish your order. Can we help you complete it? ${url}`,
    )}`;
  const page = (p: number) => {
    const n = new URLSearchParams(params);
    n.set("page", String(p));
    return `/app/abandoned?${n}`;
  };

  return (
    <s-page heading="Abandoned orders" inlineSize="large">
      <s-section padding="none">
        <s-box padding="base">
          <s-stack direction="inline" gap="small-200">
            {[
              ["open", "Not recovered"],
              ["recovered", "Recovered"],
              ["all", "All"],
            ].map(([k, label]) => (
              <s-button key={k} href={`/app/abandoned?show=${k}`} variant={d.show === k ? "primary" : "secondary"}>
                {label}
              </s-button>
            ))}
          </s-stack>
        </s-box>
        {d.rows.length === 0 ? (
          <s-box padding="base">
            <s-paragraph>
              Nothing here yet. When a shopper enters their phone number but doesn&apos;t submit, they appear here so you can
              follow up.
            </s-paragraph>
          </s-box>
        ) : (
          <s-table>
            <s-table-header-row>
              <s-table-header>Customer</s-table-header>
              <s-table-header>Phone</s-table-header>
              <s-table-header>Address</s-table-header>
              <s-table-header>Cart value</s-table-header>
              <s-table-header>Status</s-table-header>
              <s-table-header>Last activity</s-table-header>
              <s-table-header>Actions</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {d.rows.map((r) => (
                <s-table-row key={r.id}>
                  <s-table-cell>{r.name}</s-table-cell>
                  <s-table-cell>
                    {r.phone ? <s-link href={`tel:${r.phone}`}>{r.phone}</s-link> : r.email}
                  </s-table-cell>
                  <s-table-cell>{r.address}</s-table-cell>
                  <s-table-cell>{fmtMoney(r.total, r.currency)}</s-table-cell>
                  <s-table-cell>
                    {r.recovered ? (
                      <s-badge tone="success">Recovered</s-badge>
                    ) : r.contacted ? (
                      <s-badge tone="info">Contacted</s-badge>
                    ) : (
                      <s-badge tone="warning">Open</s-badge>
                    )}
                  </s-table-cell>
                  <s-table-cell>{new Date(r.updatedAt).toLocaleString()}</s-table-cell>
                  <s-table-cell>
                    <s-stack direction="inline" gap="small-100">
                      {r.phone && (
                        <s-button
                          variant="tertiary"
                          href={wa(r.phone, r.name, r.url)}
                          target="_blank"
                          onClick={() => act("contacted", r.id)}
                        >
                          WhatsApp
                        </s-button>
                      )}
                      {!r.recovered && (
                        <s-button variant="tertiary" onClick={() => act("recovered", r.id)}>
                          Mark recovered
                        </s-button>
                      )}
                      <s-button variant="tertiary" tone="critical" onClick={() => act("delete", r.id)}>
                        Delete
                      </s-button>
                    </s-stack>
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        )}
        <s-box padding="base">
          <s-stack direction="inline" gap="small-200" alignItems="center">
            {d.page > 1 && <s-button href={page(d.page - 1)}>Previous</s-button>}
            <s-text color="subdued">{`Page ${d.page} of ${d.pages}`}</s-text>
            {d.page < d.pages && <s-button href={page(d.page + 1)}>Next</s-button>}
          </s-stack>
        </s-box>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
