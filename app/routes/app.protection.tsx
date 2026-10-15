import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getSettings, saveSettingsFromRequest } from "../lib/settings.server";
import type { ProtectionSettings } from "../lib/settings";
import { useSettingsForm } from "../lib/useSettings";
import { Grid, NumberField, Switch, TextArea, TextField } from "../components/fields";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  return { protection: (await getSettings(session.shop)).protection };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  return saveSettingsFromRequest(session.shop, request);
};

export default function Protection() {
  const initial = useLoaderData<typeof loader>();
  const { state, update, save, saving, dirty } = useSettingsForm(initial);
  const p = state.protection;
  const set = (x: Partial<ProtectionSettings>) => update("protection", x);

  return (
    <s-page heading="Fraud protection & limits">
      <s-button slot="primary-action" variant="primary" onClick={save} {...(saving ? { loading: true } : {})} {...(!dirty ? { disabled: true } : {})}>
        Save
      </s-button>

      <s-section heading="Order limits">
        <Grid columns={3}>
          <NumberField label="Max orders per phone / 24h" details="0 = unlimited" min={0} value={p.maxOrdersPerPhonePerDay} onChange={(v) => set({ maxOrdersPerPhonePerDay: v })} />
          <NumberField label="Max orders per IP / 24h" details="0 = unlimited" min={0} value={p.maxOrdersPerIpPerDay} onChange={(v) => set({ maxOrdersPerIpPerDay: v })} />
          <NumberField label="Max items per order" details="0 = unlimited" min={0} value={p.maxQuantity} onChange={(v) => set({ maxQuantity: v })} />
          <NumberField label="Minimum order total" min={0} step={0.01} value={p.minOrderTotal} onChange={(v) => set({ minOrderTotal: v })} />
          <NumberField label="Maximum order total" details="0 = unlimited" min={0} step={0.01} value={p.maxOrderTotal} onChange={(v) => set({ maxOrderTotal: v })} />
          <TextField label="Allowed countries" details="ISO codes, comma separated. Empty = all" value={p.allowedCountries} onChange={(v) => set({ allowedCountries: v.toUpperCase() })} />
        </Grid>
      </s-section>

      <s-section heading="Blocklist">
        <s-stack gap="base">
          <Grid columns={3}>
            <TextArea label="Blocked phone numbers" details="One per line" rows={5} value={p.blockedPhones} onChange={(v) => set({ blockedPhones: v })} />
            <TextArea label="Blocked emails" details="One per line" rows={5} value={p.blockedEmails} onChange={(v) => set({ blockedEmails: v })} />
            <TextArea label="Blocked IP addresses" details="One per line" rows={5} value={p.blockedIps} onChange={(v) => set({ blockedIps: v })} />
          </Grid>
          <TextField label="Message shown to blocked customers" value={p.blockedMessage} onChange={(v) => set({ blockedMessage: v })} />
        </s-stack>
      </s-section>

      <s-section heading="Abandoned orders">
        <Switch
          label="Capture abandoned forms"
          details="Saves name and phone when a customer starts the form but doesn't submit, so you can call them back."
          checked={p.abandonedEnabled}
          onChange={(v) => set({ abandonedEnabled: v })}
        />
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
