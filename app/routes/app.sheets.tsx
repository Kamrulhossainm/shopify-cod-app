/* eslint-disable @typescript-eslint/no-explicit-any -- untyped JSON from GraphQL and requests */
import { useEffect } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getSettings, saveSettingsFromRequest } from "../lib/settings.server";
import type { SheetsSettings } from "../lib/settings";
import { appendRow, ORDER_SHEET_HEADER } from "../lib/sheets.server";
import { useSettingsForm } from "../lib/useSettings";
import { Grid, Switch, TextArea, TextField } from "../components/fields";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const sheets = (await getSettings(session.shop)).sheets;
  let clientEmail = "";
  try {
    clientEmail = JSON.parse(sheets.serviceAccountJson || "{}").client_email || "";
  } catch {
    /* invalid JSON – shown as empty */
  }
  return { sheets, clientEmail };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  if (new URL(request.url).searchParams.get("test")) {
    const s = (await getSettings(session.shop)).sheets;
    try {
      await appendRow({ ...s, enabled: true }, s.ordersSheet, ORDER_SHEET_HEADER);
      return { ok: true, test: true };
    } catch (e: any) {
      return { ok: false, test: true, error: e.message };
    }
  }
  return saveSettingsFromRequest(session.shop, request);
};

export default function Sheets() {
  const data = useLoaderData<typeof loader>();
  const { state, update, save, saving, dirty } = useSettingsForm(data);
  const s = state.sheets;
  const set = (x: Partial<SheetsSettings>) => update("sheets", x);
  const test = useFetcher<{ ok: boolean; error?: string }>();
  const shopify = useAppBridge();

  useEffect(() => {
    if (test.state === "idle" && test.data) {
      shopify.toast.show(test.data.ok ? "Header row written to your sheet" : test.data.error || "Failed", {
        isError: !test.data.ok,
      });
    }
  }, [test.state, test.data, shopify]);

  return (
    <s-page heading="Google Sheets">
      <s-button slot="primary-action" variant="primary" onClick={save} {...(saving ? { loading: true } : {})} {...(!dirty ? { disabled: true } : {})}>
        Save
      </s-button>

      <s-section heading="Export orders to Google Sheets">
        <s-stack gap="base">
          <Switch label="Send every COD order and abandoned form to Google Sheets" checked={s.enabled} onChange={(v) => set({ enabled: v })} />
          <s-ordered-list>
            <s-list-item>In Google Cloud Console, create a service account and enable the Google Sheets API.</s-list-item>
            <s-list-item>Create a JSON key for the service account and paste it below.</s-list-item>
            <s-list-item>
              Share your spreadsheet with the service account email{data.clientEmail ? ` (${data.clientEmail})` : ""} as Editor.
            </s-list-item>
            <s-list-item>Create tabs named after the sheet names below.</s-list-item>
          </s-ordered-list>
          <TextArea label="Service account JSON key" rows={4} value={s.serviceAccountJson} onChange={(v) => set({ serviceAccountJson: v })} />
          <Grid columns={3}>
            <TextField
              label="Spreadsheet ID"
              details="The long ID in the sheet's URL"
              value={s.spreadsheetId}
              onChange={(v) => {
                const m = v.match(/\/d\/([a-zA-Z0-9-_]+)/);
                set({ spreadsheetId: m ? m[1] : v.trim() });
              }}
            />
            <TextField label="Orders tab" value={s.ordersSheet} onChange={(v) => set({ ordersSheet: v })} />
            <TextField label="Abandoned tab" value={s.abandonedSheet} onChange={(v) => set({ abandonedSheet: v })} />
          </Grid>
          <s-stack direction="inline">
            <s-button
              onClick={() => test.submit({}, { method: "post", action: "?test=1" })}
              {...(test.state !== "idle" ? { loading: true } : {})}
              {...(dirty ? { disabled: true } : {})}
            >
              Test connection (writes header row)
            </s-button>
          </s-stack>
        </s-stack>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
