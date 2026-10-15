import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getSettings, saveSettingsFromRequest } from "../lib/settings.server";
import { BUILTIN_FIELD_KEYS, type FormField, type FormSettings, type GeneralSettings } from "../lib/settings";
import { useSettingsForm } from "../lib/useSettings";
import { Checkbox, ColorField, Grid, NumberField, Select, Switch, TextArea, TextField, UrlField } from "../components/fields";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const s = await getSettings(session.shop);
  return { general: s.general, form: s.form };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  return saveSettingsFromRequest(session.shop, request);
};

export default function FormBuilder() {
  const initial = useLoaderData<typeof loader>();
  const { state, update, save, saving, dirty } = useSettingsForm(initial);
  const g = state.general;
  const f = state.form;
  const setG = (p: Partial<GeneralSettings>) => update("general", p);
  const setF = (p: Partial<FormSettings>) => update("form", p);

  const setField = (i: number, p: Partial<FormField>) =>
    setF({ fields: f.fields.map((x, j) => (j === i ? { ...x, ...p } : x)) });
  const move = (i: number, d: number) => {
    const arr = [...f.fields];
    const j = i + d;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    setF({ fields: arr });
  };
  const addCustom = () =>
    setF({
      fields: [
        ...f.fields,
        {
          key: `custom_${Date.now().toString(36)}`,
          label: "Custom field",
          placeholder: "",
          type: "text",
          required: false,
          enabled: true,
          half: false,
          custom: true,
        },
      ],
    });

  return (
    <s-page heading="Form builder" inlineSize="large">
      <s-button
        slot="primary-action"
        variant="primary"
        onClick={save}
        {...(saving ? { loading: true } : {})}
        {...(!dirty ? { disabled: true } : {})}
      >
        Save
      </s-button>

      <s-section heading="General">
        <s-stack gap="base">
          <Switch label="Enable cash on delivery form" checked={g.enabled} onChange={(v) => setG({ enabled: v })} />
          <Grid>
            <Select
              label="Form display"
              value={g.mode}
              onChange={(v) => setG({ mode: v })}
              options={[
                { value: "popup", label: "Popup (button opens form)" },
                { value: "embedded", label: "Embedded on product page" },
              ]}
            />
            <Select
              label="Create orders as"
              value={g.orderType}
              onChange={(v) => setG({ orderType: v })}
              details="Draft orders let you confirm by phone before converting to a real order."
              options={[
                { value: "order", label: "Orders (payment pending)" },
                { value: "draft", label: "Draft orders" },
              ]}
            />
          </Grid>
          <Grid>
            <Checkbox label="Show on product pages" checked={g.showOnProduct} onChange={(v) => setG({ showOnProduct: v })} />
            <Checkbox label="Show on cart page" checked={g.showOnCart} onChange={(v) => setG({ showOnCart: v })} />
            <Checkbox label="Hide 'Add to cart' button" checked={g.hideAddToCart} onChange={(v) => setG({ hideAddToCart: v })} />
            <Checkbox label="Hide 'Buy it now' button" checked={g.hideBuyNow} onChange={(v) => setG({ hideBuyNow: v })} />
            <Checkbox label="Hide cart 'Checkout' button" checked={g.hideCheckoutButton} onChange={(v) => setG({ hideCheckoutButton: v })} />
          </Grid>
          <Grid>
            <TextField label="Order tags" details="Comma separated. 'COD' is always added." value={g.orderTags} onChange={(v) => setG({ orderTags: v })} />
            <TextField label="Order note" value={g.orderNote} onChange={(v) => setG({ orderNote: v })} />
          </Grid>
          <Grid>
            <Select
              label="After the order is placed"
              value={g.redirect}
              onChange={(v) => setG({ redirect: v })}
              options={[
                { value: "thank_you", label: "Show thank-you message in popup" },
                { value: "order_status", label: "Go to Shopify order status page" },
                { value: "custom", label: "Redirect to a custom URL" },
              ]}
            />
            {g.redirect === "custom" ? (
              <UrlField label="Custom thank-you URL" value={g.customRedirectUrl} onChange={(v) => setG({ customRedirectUrl: v })} />
            ) : (
              <span />
            )}
          </Grid>
        </s-stack>
      </s-section>

      <s-section heading="Form fields">
        <s-stack gap="base">
          {f.fields.map((field, i) => (
            <s-box key={field.key} padding="base" borderWidth="base" borderRadius="base">
              <s-stack gap="small-200">
                <s-stack direction="inline" gap="small-200" alignItems="center" justifyContent="space-between">
                  <s-stack direction="inline" gap="small-200" alignItems="center">
                    <Switch label={`Show ${field.label}`} labelAccessibilityVisibility="exclusive" checked={field.enabled} onChange={(v) => setField(i, { enabled: v })} />
                    <s-text type="strong">{field.label}</s-text>
                    {field.custom ? <s-badge>Custom</s-badge> : <s-badge tone="info">{field.key}</s-badge>}
                  </s-stack>
                  <s-stack direction="inline" gap="small-100">
                    <s-button variant="tertiary" icon="arrow-up" accessibilityLabel="Move up" onClick={() => move(i, -1)} />
                    <s-button variant="tertiary" icon="arrow-down" accessibilityLabel="Move down" onClick={() => move(i, 1)} />
                    {field.custom && (
                      <s-button
                        variant="tertiary"
                        tone="critical"
                        icon="delete"
                        accessibilityLabel="Remove field"
                        onClick={() => setF({ fields: f.fields.filter((_, j) => j !== i) })}
                      />
                    )}
                  </s-stack>
                </s-stack>
                {field.enabled && (
                  <>
                    <Grid columns={3}>
                      <TextField label="Label" value={field.label} onChange={(v) => setField(i, { label: v })} />
                      <TextField label="Placeholder" value={field.placeholder} onChange={(v) => setField(i, { placeholder: v })} />
                      {field.custom ? (
                        <Select
                          label="Type"
                          value={field.type}
                          onChange={(v) => setField(i, { type: v })}
                          options={[
                            { value: "text", label: "Text" },
                            { value: "textarea", label: "Multi-line text" },
                            { value: "select", label: "Dropdown" },
                            { value: "checkbox", label: "Checkbox" },
                            { value: "email", label: "Email" },
                            { value: "tel", label: "Phone" },
                          ]}
                        />
                      ) : (
                        <span />
                      )}
                    </Grid>
                    {(field.type === "select" || field.key === "country") && (
                      <TextField
                        label="Options"
                        details={field.key === "country" ? "Comma separated ISO codes, e.g. US,CA. Leave empty to use countries from shipping rates." : "Comma separated"}
                        value={(field.options || []).join(",")}
                        onChange={(v) => setField(i, { options: v.split(",").map((x) => x.trim()).filter(Boolean) })}
                      />
                    )}
                    <s-stack direction="inline" gap="base">
                      <Checkbox
                        label="Required"
                        checked={field.required || field.key === "phone"}
                        disabled={field.key === "phone"}
                        onChange={(v) => setField(i, { required: v })}
                      />
                      <Checkbox label="Half width" checked={field.half} onChange={(v) => setField(i, { half: v })} />
                    </s-stack>
                  </>
                )}
              </s-stack>
            </s-box>
          ))}
          <s-button icon="plus" onClick={addCustom}>
            Add custom field
          </s-button>
          <s-text color="subdued">
            Custom fields are saved on the order as additional details. Built-in fields: {BUILTIN_FIELD_KEYS.join(", ")}.
          </s-text>
        </s-stack>
      </s-section>

      <s-section heading="Phone validation">
        <Grid columns={3}>
          <TextField label="Default country (ISO)" value={f.defaultCountry} onChange={(v) => setF({ defaultCountry: v.toUpperCase().slice(0, 2) })} />
          <TextField label="Auto prefix (e.g. +212)" details="Prepended when the customer doesn't type a + prefix" value={f.phonePrefix} onChange={(v) => setF({ phonePrefix: v })} />
          <span />
          <NumberField label="Minimum digits" value={f.phoneMinDigits} min={4} max={20} onChange={(v) => setF({ phoneMinDigits: v })} />
          <NumberField label="Maximum digits" value={f.phoneMaxDigits} min={4} max={20} onChange={(v) => setF({ phoneMaxDigits: v })} />
        </Grid>
      </s-section>

      <s-section heading="Texts">
        <s-stack gap="base">
          <Grid>
            <TextField label="Form title" value={f.title} onChange={(v) => setF({ title: v })} />
            <TextField label="Submit button" details="{total} is replaced by the order total" value={f.submitText} onChange={(v) => setF({ submitText: v })} />
            <TextField label="Thank-you title" value={f.successTitle} onChange={(v) => setF({ successTitle: v })} />
            <TextField label="Thank-you message" value={f.successMessage} onChange={(v) => setF({ successMessage: v })} />
          </Grid>
          <s-stack direction="inline" gap="base">
            <Checkbox label="Show order summary" checked={f.showOrderSummary} onChange={(v) => setF({ showOrderSummary: v })} />
            <Checkbox label="Show discount code field" checked={f.showDiscountCode} onChange={(v) => setF({ showDiscountCode: v })} />
            <Checkbox label="Show quantity selector" checked={f.showQuantity} onChange={(v) => setF({ showQuantity: v })} />
            <Checkbox label="Right-to-left (Arabic, Hebrew…)" checked={f.rtl} onChange={(v) => setF({ rtl: v })} />
          </s-stack>
        </s-stack>
      </s-section>

      <s-section heading="Button & design">
        <s-stack gap="base">
          <Grid>
            <TextField label="Button text" value={f.buttonText} onChange={(v) => setF({ buttonText: v })} />
            <TextField label="Button subtitle" value={f.buttonSubtext} onChange={(v) => setF({ buttonSubtext: v })} />
            <ColorField label="Button color" value={f.buttonColor} onChange={(v) => setF({ buttonColor: v })} />
            <ColorField label="Button text color" value={f.buttonTextColor} onChange={(v) => setF({ buttonTextColor: v })} />
            <ColorField label="Accent color" value={f.accentColor} onChange={(v) => setF({ accentColor: v })} />
            <NumberField label="Corner radius" suffix="px" min={0} max={30} value={f.borderRadius} onChange={(v) => setF({ borderRadius: v })} />
            <Select
              label="Button animation"
              value={f.buttonAnimation}
              onChange={(v) => setF({ buttonAnimation: v })}
              options={[
                { value: "none", label: "None" },
                { value: "shake", label: "Shake" },
                { value: "pulse", label: "Pulse" },
                { value: "bounce", label: "Bounce" },
              ]}
            />
            <Checkbox label="Sticky button on mobile" checked={f.stickyMobileButton} onChange={(v) => setF({ stickyMobileButton: v })} />
          </Grid>
          <TextArea label="Custom CSS" rows={4} value={f.customCss} onChange={(v) => setF({ customCss: v })} />
        </s-stack>
      </s-section>

      <s-section slot="aside" heading="Preview">
        <Preview form={f} />
      </s-section>
    </s-page>
  );
}

function Preview({ form: f }: { form: FormSettings }) {
  const r = `${f.borderRadius}px`;
  const input = { width: "100%", boxSizing: "border-box" as const, padding: "9px 10px", border: "1px solid #d1d5db", borderRadius: r, fontSize: 13 };
  return (
    <div dir={f.rtl ? "rtl" : undefined} style={{ fontSize: 13, display: "grid", gap: 10 }}>
      <button
        type="button"
        style={{ background: f.buttonColor, color: f.buttonTextColor, border: 0, borderRadius: r, padding: "10px", fontWeight: 700, width: "100%" }}
      >
        {f.buttonText}
        {f.buttonSubtext && <div style={{ fontWeight: 400, fontSize: 11, opacity: 0.85 }}>{f.buttonSubtext}</div>}
      </button>
      <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 12, display: "grid", gap: 8 }}>
        <strong>{f.title}</strong>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {f.fields
            .filter((x) => x.enabled)
            .map((x) => (
              <div key={x.key} style={{ flex: x.half ? "1 1 calc(50% - 4px)" : "1 1 100%" }}>
                <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 2 }}>
                  {x.label}
                  {x.required && <span style={{ color: "#dc2626" }}> *</span>}
                </div>
                <div style={{ ...input, color: "#9ca3af" }}>{x.placeholder || x.label}</div>
              </div>
            ))}
        </div>
        {f.showOrderSummary && (
          <div style={{ background: "#f9fafb", padding: 8, borderRadius: r, display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
            <span>Total</span>
            <span>$49.00</span>
          </div>
        )}
        <div style={{ background: f.buttonColor, color: f.buttonTextColor, borderRadius: r, padding: 10, textAlign: "center", fontWeight: 700 }}>
          {f.submitText.replace("{total}", "$49.00")}
        </div>
      </div>
    </div>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
