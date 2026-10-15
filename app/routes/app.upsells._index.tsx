import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

const PLACEMENT: Record<string, string> = {
  in_form: "Checkbox in form",
  pre_submit: "Popup before order",
  post_submit: "One-click after order",
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const rows = await prisma.upsell.findMany({
    where: { shop: session.shop },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
  });
  return { upsells: rows.map((u) => ({ ...u, createdAt: u.createdAt.toISOString(), updatedAt: u.updatedAt.toISOString() })) };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const form = await request.formData();
  const id = String(form.get("id"));
  if (form.get("intent") === "toggle") {
    const u = await prisma.upsell.findFirst({ where: { id, shop: session.shop } });
    if (u) await prisma.upsell.update({ where: { id }, data: { active: !u.active } });
  } else if (form.get("intent") === "delete") {
    await prisma.upsell.deleteMany({ where: { id, shop: session.shop } });
  }
  return { ok: true };
};

export default function Upsells() {
  const { upsells } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  return (
    <s-page heading="Upsells & downsells">
      <s-button slot="primary-action" variant="primary" href="/app/upsells/new">
        Create upsell
      </s-button>
      <s-section padding="none">
        {upsells.length === 0 ? (
          <s-box padding="large">
            <s-stack gap="base" alignItems="center">
              <s-heading>Sell more with every COD order</s-heading>
              <s-paragraph>
                Offer a complementary product inside the form, in a popup before the order is placed, or with one click
                after it&apos;s placed. Add a downsell to recover customers who say no.
              </s-paragraph>
              <s-button variant="primary" href="/app/upsells/new">
                Create your first upsell
              </s-button>
            </s-stack>
          </s-box>
        ) : (
          <s-table>
            <s-table-header-row>
              <s-table-header>Upsell</s-table-header>
              <s-table-header>Placement</s-table-header>
              <s-table-header>Views</s-table-header>
              <s-table-header>Accepted</s-table-header>
              <s-table-header>Revenue</s-table-header>
              <s-table-header>Status</s-table-header>
              <s-table-header>Actions</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {upsells.map((u) => (
                <s-table-row key={u.id}>
                  <s-table-cell>
                    <s-link href={`/app/upsells/${u.id}`}>{u.title}</s-link>
                  </s-table-cell>
                  <s-table-cell>
                    {PLACEMENT[u.placement] || u.placement}
                    {u.downsellEnabled ? " + downsell" : ""}
                  </s-table-cell>
                  <s-table-cell>{u.impressions}</s-table-cell>
                  <s-table-cell>
                    {u.conversions}
                    {u.impressions ? ` (${((u.conversions / u.impressions) * 100).toFixed(1)}%)` : ""}
                  </s-table-cell>
                  <s-table-cell>{u.revenue.toFixed(2)}</s-table-cell>
                  <s-table-cell>
                    <s-badge tone={u.active ? "success" : "neutral"}>{u.active ? "Active" : "Paused"}</s-badge>
                  </s-table-cell>
                  <s-table-cell>
                    <s-stack direction="inline" gap="small-200">
                      <s-button variant="tertiary" onClick={() => fetcher.submit({ intent: "toggle", id: u.id }, { method: "post" })}>
                        {u.active ? "Pause" : "Activate"}
                      </s-button>
                      <s-button
                        variant="tertiary"
                        tone="critical"
                        onClick={() => {
                          if (confirm(`Delete "${u.title}"?`)) fetcher.submit({ intent: "delete", id: u.id }, { method: "post" });
                        }}
                      >
                        Delete
                      </s-button>
                    </s-stack>
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        )}
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
