import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { safeJson } from "../lib/pricing.server";
import type { OfferTier } from "../lib/settings";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const offers = await prisma.quantityOffer.findMany({
    where: { shop: session.shop },
    orderBy: { createdAt: "desc" },
  });
  return {
    offers: offers.map((o) => ({
      id: o.id,
      title: o.title,
      active: o.active,
      tiers: safeJson<OfferTier[]>(o.tiers, []).length,
      scope: o.productScope === "all" ? "All products" : `${safeJson<unknown[]>(o.productScope, []).length} products`,
    })),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const form = await request.formData();
  const id = String(form.get("id"));
  if (form.get("intent") === "toggle") {
    const offer = await prisma.quantityOffer.findFirst({ where: { id, shop: session.shop } });
    if (offer) await prisma.quantityOffer.update({ where: { id }, data: { active: !offer.active } });
  } else if (form.get("intent") === "delete") {
    await prisma.quantityOffer.deleteMany({ where: { id, shop: session.shop } });
  }
  return { ok: true };
};

export default function Offers() {
  const { offers } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  return (
    <s-page heading="Quantity offers">
      <s-button slot="primary-action" variant="primary" href="/app/offers/new">
        Create offer
      </s-button>
      <s-section padding="none">
        {offers.length === 0 ? (
          <s-box padding="large">
            <s-stack gap="base" alignItems="center">
              <s-heading>Increase order value with quantity breaks</s-heading>
              <s-paragraph>Show &ldquo;Buy 1 / Buy 2 save 10% / Buy 3 save 20%&rdquo; options inside the COD form.</s-paragraph>
              <s-button variant="primary" href="/app/offers/new">
                Create your first offer
              </s-button>
            </s-stack>
          </s-box>
        ) : (
          <s-table>
            <s-table-header-row>
              <s-table-header>Offer</s-table-header>
              <s-table-header>Applies to</s-table-header>
              <s-table-header>Tiers</s-table-header>
              <s-table-header>Status</s-table-header>
              <s-table-header>Actions</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {offers.map((o) => (
                <s-table-row key={o.id}>
                  <s-table-cell>
                    <s-link href={`/app/offers/${o.id}`}>{o.title}</s-link>
                  </s-table-cell>
                  <s-table-cell>{o.scope}</s-table-cell>
                  <s-table-cell>{o.tiers}</s-table-cell>
                  <s-table-cell>
                    <s-badge tone={o.active ? "success" : "neutral"}>{o.active ? "Active" : "Paused"}</s-badge>
                  </s-table-cell>
                  <s-table-cell>
                    <s-stack direction="inline" gap="small-200">
                      <s-button variant="tertiary" onClick={() => fetcher.submit({ intent: "toggle", id: o.id }, { method: "post" })}>
                        {o.active ? "Pause" : "Activate"}
                      </s-button>
                      <s-button
                        variant="tertiary"
                        tone="critical"
                        onClick={() => {
                          if (confirm(`Delete "${o.title}"?`)) fetcher.submit({ intent: "delete", id: o.id }, { method: "post" });
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
