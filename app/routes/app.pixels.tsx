import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getSettings, saveSettingsFromRequest } from "../lib/settings.server";
import type { PixelSettings } from "../lib/settings";
import { useSettingsForm } from "../lib/useSettings";
import { Checkbox, Grid, PasswordField, TextField } from "../components/fields";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  return { pixels: (await getSettings(session.shop)).pixels };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  return saveSettingsFromRequest(session.shop, request);
};

export default function Pixels() {
  const initial = useLoaderData<typeof loader>();
  const { state, update, save, saving, dirty } = useSettingsForm(initial);
  const p = state.pixels;
  const set = (x: Partial<PixelSettings>) => update("pixels", x);

  return (
    <s-page heading="Pixels & conversion tracking">
      <s-button slot="primary-action" variant="primary" onClick={save} {...(saving ? { loading: true } : {})} {...(!dirty ? { disabled: true } : {})}>
        Save
      </s-button>

      <s-banner tone="info">
        COD orders skip Shopify checkout, so the theme&apos;s built-in pixels never see the purchase. The form fires
        InitiateCheckout when it opens and Purchase when the order is placed. Separate multiple IDs with commas.
      </s-banner>

      <s-section heading="Facebook / Meta">
        <Grid>
          <TextField label="Pixel IDs" value={p.facebookPixelIds} onChange={(v) => set({ facebookPixelIds: v })} />
          <PasswordField
            label="Conversions API access token"
            details="Sends a server-side Purchase event, deduplicated with the browser event"
            value={p.facebookCapiToken}
            onChange={(v) => set({ facebookCapiToken: v })}
          />
          <TextField label="Test event code" details="Optional, from Events Manager → Test events" value={p.facebookTestEventCode} onChange={(v) => set({ facebookTestEventCode: v })} />
        </Grid>
      </s-section>

      <s-section heading="TikTok, Snapchat & Pinterest">
        <Grid columns={3}>
          <TextField label="TikTok pixel IDs" value={p.tiktokPixelIds} onChange={(v) => set({ tiktokPixelIds: v })} />
          <TextField label="Snapchat pixel IDs" value={p.snapchatPixelIds} onChange={(v) => set({ snapchatPixelIds: v })} />
          <TextField label="Pinterest tag IDs" value={p.pinterestTagIds} onChange={(v) => set({ pinterestTagIds: v })} />
        </Grid>
      </s-section>

      <s-section heading="Google">
        <Grid columns={3}>
          <TextField label="GA4 measurement ID" placeholder="G-XXXXXXX" value={p.googleAnalyticsId} onChange={(v) => set({ googleAnalyticsId: v })} />
          <TextField label="Google Ads ID" placeholder="AW-XXXXXXX" value={p.googleAdsId} onChange={(v) => set({ googleAdsId: v })} />
          <TextField label="Ads conversion label" value={p.googleAdsConversionLabel} onChange={(v) => set({ googleAdsConversionLabel: v })} />
        </Grid>
      </s-section>

      <s-section heading="Events">
        <s-stack gap="small-200">
          <Checkbox label="Fire InitiateCheckout when the form opens" checked={p.fireInitiateCheckout} onChange={(v) => set({ fireInitiateCheckout: v })} />
          <Checkbox label="Fire Purchase when an order is placed" checked={p.firePurchase} onChange={(v) => set({ firePurchase: v })} />
        </s-stack>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
