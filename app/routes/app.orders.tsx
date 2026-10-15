/* eslint-disable @typescript-eslint/no-explicit-any -- untyped JSON from GraphQL and requests */
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Form, useLoaderData, useSearchParams } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { OrdersTable } from "../components/orders";

const PAGE = 50;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const status = url.searchParams.get("status") || "";
  const q = (url.searchParams.get("q") || "").trim();
  const where: any = { shop: session.shop };
  if (status) where.status = status;
  if (q) where.OR = [{ phone: { contains: q } }, { customerName: { contains: q } }, { shopifyOrderName: { contains: q } }];
  const [rows, count] = await Promise.all([
    prisma.codOrder.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE }),
    prisma.codOrder.count({ where }),
  ]);
  return {
    page,
    pages: Math.max(1, Math.ceil(count / PAGE)),
    count,
    rows: rows.map((o) => ({
      id: o.id,
      name: o.shopifyOrderName,
      orderId: o.shopifyOrderId,
      draftOrderId: o.draftOrderId,
      customer: o.customerName,
      phone: o.phone,
      total: o.total,
      currency: o.currency,
      status: o.status,
      error: o.error,
      createdAt: o.createdAt.toISOString(),
    })),
  };
};

export default function Orders() {
  const d = useLoaderData<typeof loader>();
  const [params] = useSearchParams();
  const link = (p: Record<string, string | number>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(p)) next.set(k, String(v));
    return `/app/orders?${next}`;
  };
  const failed = d.rows.filter((r) => r.status === "failed" && r.error);

  return (
    <s-page heading="COD orders" inlineSize="large">
      <s-section padding="none">
        <s-box padding="base">
          <Form method="get" action="/app/orders">
            <s-stack direction="inline" gap="small-200" alignItems="end">
              <s-search-field name="q" label="Search" labelAccessibilityVisibility="exclusive" placeholder="Phone, name or order #" value={params.get("q") || ""} />
              <s-button type="submit">Search</s-button>
              {["", "created", "failed"].map((st) => (
                <s-button key={st || "all"} href={link({ status: st, page: 1 })} variant={(params.get("status") || "") === st ? "primary" : "secondary"}>
                  {st ? st[0].toUpperCase() + st.slice(1) : "All"}
                </s-button>
              ))}
            </s-stack>
          </Form>
        </s-box>
        {d.rows.length ? <OrdersTable rows={d.rows} /> : <s-box padding="base"><s-paragraph>No orders found.</s-paragraph></s-box>}
        <s-box padding="base">
          <s-stack direction="inline" gap="small-200" alignItems="center">
            {d.page > 1 && <s-button href={link({ page: d.page - 1 })}>Previous</s-button>}
            <s-text color="subdued">{`Page ${d.page} of ${d.pages} · ${d.count} orders`}</s-text>
            {d.page < d.pages && <s-button href={link({ page: d.page + 1 })}>Next</s-button>}
          </s-stack>
        </s-box>
      </s-section>

      {failed.length > 0 && (
        <s-section heading="Failed order errors">
          <s-stack gap="small-200">
            {failed.map((f) => (
              <s-text key={f.id}>{`${f.customer} (${f.phone}): ${f.error}`}</s-text>
            ))}
          </s-stack>
        </s-section>
      )}
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
