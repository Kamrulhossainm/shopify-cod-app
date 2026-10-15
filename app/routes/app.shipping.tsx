import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getSettings, saveSettingsFromRequest } from "../lib/settings.server";
import type { GeneralSettings, ShippingRate } from "../lib/settings";
import { useSettingsForm } from "../lib/useSettings";
import { Grid, NumberField, Select, Switch, TextField } from "../components/fields";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const s = await getSettings(session.shop);
  return { shipping: s.shipping, general: s.general };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  return saveSettingsFromRequest(session.shop, request);
};

export default function Shipping() {
  const initial = useLoaderData<typeof loader>();
  const { state, update, save, saving, dirty } = useSettingsForm(initial);
  const rates = state.shipping.rates;
  const g = state.general;
  const setG = (p: Partial<GeneralSettings>) => update("general", p);
  const setRate = (i: number, p: Partial<ShippingRate>) =>
    update("shipping", { rates: rates.map((r, j) => (j === i ? { ...r, ...p } : r)) });

  return (
    <s-page heading="Shipping rates & COD fee">
      <s-button slot="primary-action" variant="primary" onClick={save} {...(saving ? { loading: true } : {})} {...(!dirty ? { disabled: true } : {})}>
        Save
      </s-button>

      <s-section heading="Shipping rates">
        <s-stack gap="base">
          <s-paragraph>
            Customers see the rates that match their country. When several rates match, they can pick one in the form.
          </s-paragraph>
          {rates.map((r, i) => (
            <s-box key={r.id} padding="base" borderWidth="base" borderRadius="base">
              <s-stack gap="small-200">
                <Grid columns={3}>
                  <TextField label="Name" value={r.name} onChange={(v) => setRate(i, { name: v })} />
                  <NumberField label="Price" min={0} step={0.01} value={r.price} onChange={(v) => setRate(i, { price: v })} />
                  <TextField
                    label="Countries"
                    details="ISO codes, comma separated. * = all"
                    value={r.countries}
                    onChange={(v) => setRate(i, { countries: v.toUpperCase() })}
                  />
                  <NumberField label="Only for orders above" min={0} step={0.01} value={r.minSubtotal} onChange={(v) => setRate(i, { minSubtotal: v })} />
                  <NumberField label="Free shipping above" details="0 = never free" min={0} step={0.01} value={r.freeAbove} onChange={(v) => setRate(i, { freeAbove: v })} />
                </Grid>
                <s-stack direction="inline" justifyContent="end">
                  <s-button
                    tone="critical"
                    variant="tertiary"
                    icon="delete"
                    onClick={() => update("shipping", { rates: rates.filter((_, j) => j !== i) })}
                  >
                    Remove
                  </s-button>
                </s-stack>
              </s-stack>
            </s-box>
          ))}
          <s-button
            icon="plus"
            onClick={() =>
              update("shipping", {
                rates: [
                  ...rates,
                  { id: `rate_${Date.now().toString(36)}`, name: "Express delivery", price: 5, countries: "*", minSubtotal: 0, freeAbove: 0 },
                ],
              })
            }
          >
            Add rate
          </s-button>
        </s-stack>
      </s-section>

      <s-section heading="Cash on delivery fee">
        <s-stack gap="base">
          <Switch label="Charge a COD fee" checked={g.codFeeEnabled} onChange={(v) => setG({ codFeeEnabled: v })} />
          {g.codFeeEnabled && (
            <Grid columns={3}>
              <Select
                label="Fee type"
                value={g.codFeeType}
                onChange={(v) => setG({ codFeeType: v })}
                options={[
                  { value: "fixed", label: "Fixed amount" },
                  { value: "percentage", label: "Percentage of order" },
                ]}
              />
              <NumberField
                label="Amount"
                min={0}
                step={0.01}
                suffix={g.codFeeType === "percentage" ? "%" : undefined}
                value={g.codFeeAmount}
                onChange={(v) => setG({ codFeeAmount: v })}
              />
              <TextField label="Label on order" value={g.codFeeLabel} onChange={(v) => setG({ codFeeLabel: v })} />
            </Grid>
          )}
        </s-stack>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
