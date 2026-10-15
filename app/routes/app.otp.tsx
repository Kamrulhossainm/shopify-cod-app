import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getSettings, saveSettingsFromRequest } from "../lib/settings.server";
import type { OtpSettings } from "../lib/settings";
import { useSettingsForm } from "../lib/useSettings";
import { Grid, NumberField, PasswordField, Select, Switch, TextArea, TextField, UrlField } from "../components/fields";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  return { otp: (await getSettings(session.shop)).otp };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  return saveSettingsFromRequest(session.shop, request);
};

export default function Otp() {
  const initial = useLoaderData<typeof loader>();
  const { state, update, save, saving, dirty } = useSettingsForm(initial);
  const o = state.otp;
  const set = (x: Partial<OtpSettings>) => update("otp", x);

  return (
    <s-page heading="SMS OTP verification">
      <s-button slot="primary-action" variant="primary" onClick={save} {...(saving ? { loading: true } : {})} {...(!dirty ? { disabled: true } : {})}>
        Save
      </s-button>

      <s-section heading="Verify phone numbers before accepting orders">
        <s-stack gap="base">
          <s-paragraph>
            Customers receive a one-time code by SMS and must enter it before the order is created. This cuts fake
            orders and wrong numbers dramatically.
          </s-paragraph>
          <Switch label="Require OTP verification" checked={o.enabled} onChange={(v) => set({ enabled: v })} />
          <Select
            label="SMS provider"
            value={o.provider}
            onChange={(v) => set({ provider: v })}
            options={[
              { value: "twilio", label: "Twilio" },
              { value: "webhook", label: "Custom webhook (any SMS / WhatsApp gateway)" },
              { value: "console", label: "Test mode (code printed in server log)" },
            ]}
          />
          {o.provider === "twilio" && (
            <Grid columns={3}>
              <TextField label="Account SID" value={o.twilioAccountSid} onChange={(v) => set({ twilioAccountSid: v })} />
              <PasswordField label="Auth token" value={o.twilioAuthToken} onChange={(v) => set({ twilioAuthToken: v })} />
              <TextField label="From number / Messaging Service" value={o.twilioFrom} onChange={(v) => set({ twilioFrom: v })} />
            </Grid>
          )}
          {o.provider === "webhook" && (
            <UrlField
              label="Webhook URL"
              details='We POST JSON {"phone","code","message"}; respond with HTTP 2xx once sent.'
              value={o.webhookUrl}
              onChange={(v) => set({ webhookUrl: v })}
            />
          )}
          {o.provider === "console" && o.enabled && (
            <s-banner tone="warning">Test mode doesn&apos;t send real SMS. Switch to a provider before going live.</s-banner>
          )}
          <Grid columns={3}>
            <NumberField label="Code length" min={4} max={8} value={o.codeLength} onChange={(v) => set({ codeLength: v })} />
            <NumberField label="Code expires after" suffix="minutes" min={1} max={60} value={o.expiryMinutes} onChange={(v) => set({ expiryMinutes: v })} />
            <NumberField label="Max wrong attempts" min={1} max={20} value={o.maxAttempts} onChange={(v) => set({ maxAttempts: v })} />
          </Grid>
          <TextArea label="SMS message" details="Variables: {code}, {shop}" rows={2} value={o.message} onChange={(v) => set({ message: v })} />
        </s-stack>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
