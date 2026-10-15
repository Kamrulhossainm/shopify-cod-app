// Shared (client + server safe) settings types and defaults.

export type FieldType = "text" | "tel" | "email" | "textarea" | "select" | "checkbox";

export interface FormField {
  key: string; // built-ins: firstName,lastName,phone,email,address1,address2,city,province,zip,country,note
  label: string;
  placeholder: string;
  type: FieldType;
  required: boolean;
  enabled: boolean;
  half: boolean; // render at 50% width
  options?: string[]; // for select
  custom?: boolean; // custom field -> saved as order note attribute
}

export interface GeneralSettings {
  enabled: boolean;
  mode: "popup" | "embedded";
  showOnProduct: boolean;
  showOnCart: boolean;
  hideAddToCart: boolean;
  hideBuyNow: boolean;
  hideCheckoutButton: boolean;
  orderType: "order" | "draft";
  orderTags: string;
  orderNote: string;
  redirect: "thank_you" | "order_status" | "custom";
  customRedirectUrl: string;
  codFeeEnabled: boolean;
  codFeeType: "fixed" | "percentage";
  codFeeAmount: number;
  codFeeLabel: string;
}

export interface FormSettings {
  title: string;
  buttonText: string;
  buttonSubtext: string;
  buttonColor: string;
  buttonTextColor: string;
  buttonAnimation: "none" | "shake" | "pulse" | "bounce";
  accentColor: string;
  borderRadius: number;
  submitText: string;
  showOrderSummary: boolean;
  showDiscountCode: boolean;
  showQuantity: boolean;
  stickyMobileButton: boolean;
  successTitle: string;
  successMessage: string;
  defaultCountry: string;
  phonePrefix: string;
  phoneMinDigits: number;
  phoneMaxDigits: number;
  rtl: boolean;
  customCss: string;
  fields: FormField[];
}

export interface ShippingRate {
  id: string;
  name: string;
  price: number;
  countries: string; // comma separated ISO codes or "*"
  minSubtotal: number;
  freeAbove: number; // 0 = never free
}

export interface ShippingSettings {
  rates: ShippingRate[];
}

export interface OtpSettings {
  enabled: boolean;
  provider: "twilio" | "webhook" | "console";
  twilioAccountSid: string;
  twilioAuthToken: string;
  twilioFrom: string;
  webhookUrl: string;
  codeLength: number;
  expiryMinutes: number;
  maxAttempts: number;
  message: string;
}

export interface PixelSettings {
  facebookPixelIds: string; // comma separated
  facebookCapiToken: string;
  facebookTestEventCode: string;
  tiktokPixelIds: string;
  snapchatPixelIds: string;
  pinterestTagIds: string;
  googleAnalyticsId: string; // G-XXXX
  googleAdsId: string; // AW-XXXX
  googleAdsConversionLabel: string;
  fireInitiateCheckout: boolean;
  firePurchase: boolean;
}

export interface SheetsSettings {
  enabled: boolean;
  serviceAccountJson: string;
  spreadsheetId: string;
  ordersSheet: string;
  abandonedSheet: string;
}

export interface ProtectionSettings {
  blockedPhones: string; // newline separated
  blockedEmails: string;
  blockedIps: string;
  blockedMessage: string;
  maxOrdersPerPhonePerDay: number; // 0 = unlimited
  maxOrdersPerIpPerDay: number;
  allowedCountries: string; // comma separated, empty = all
  minOrderTotal: number;
  maxOrderTotal: number; // 0 = unlimited
  maxQuantity: number; // 0 = unlimited
  abandonedEnabled: boolean;
}

export interface AllSettings {
  general: GeneralSettings;
  form: FormSettings;
  shipping: ShippingSettings;
  otp: OtpSettings;
  pixels: PixelSettings;
  sheets: SheetsSettings;
  protection: ProtectionSettings;
}

export type SettingsSection = keyof AllSettings;
export const SETTINGS_SECTIONS: SettingsSection[] = [
  "general",
  "form",
  "shipping",
  "otp",
  "pixels",
  "sheets",
  "protection",
];

const f = (
  key: string,
  label: string,
  type: FieldType,
  required: boolean,
  enabled = true,
  half = false,
  placeholder = label,
): FormField => ({ key, label, placeholder, type, required, enabled, half });

export const BUILTIN_FIELD_KEYS = [
  "firstName",
  "lastName",
  "phone",
  "email",
  "address1",
  "address2",
  "city",
  "province",
  "zip",
  "country",
  "note",
];

export const DEFAULT_SETTINGS: AllSettings = {
  general: {
    enabled: true,
    mode: "popup",
    showOnProduct: true,
    showOnCart: true,
    hideAddToCart: false,
    hideBuyNow: false,
    hideCheckoutButton: false,
    orderType: "order",
    orderTags: "COD",
    orderNote: "",
    redirect: "thank_you",
    customRedirectUrl: "",
    codFeeEnabled: false,
    codFeeType: "fixed",
    codFeeAmount: 0,
    codFeeLabel: "Cash on delivery fee",
  },
  form: {
    title: "Fill in the form to order",
    buttonText: "Buy now - Cash on Delivery",
    buttonSubtext: "Pay when you receive",
    buttonColor: "#111827",
    buttonTextColor: "#ffffff",
    buttonAnimation: "shake",
    accentColor: "#16a34a",
    borderRadius: 8,
    submitText: "Complete order - {total}",
    showOrderSummary: true,
    showDiscountCode: true,
    showQuantity: true,
    stickyMobileButton: true,
    successTitle: "Thank you for your order!",
    successMessage: "We will call you shortly to confirm your order.",
    defaultCountry: "US",
    phonePrefix: "",
    phoneMinDigits: 8,
    phoneMaxDigits: 15,
    rtl: false,
    customCss: "",
    fields: [
      f("firstName", "First name", "text", true, true, true),
      f("lastName", "Last name", "text", false, true, true),
      f("phone", "Phone number", "tel", true),
      f("email", "Email", "email", false, false),
      f("address1", "Address", "text", true),
      f("address2", "Apartment, suite, etc.", "text", false, false),
      f("city", "City", "text", true, true, true),
      f("province", "State / Province", "text", false, true, true),
      f("zip", "Postal code", "text", false, false, true),
      f("country", "Country", "select", true, false, true),
      f("note", "Order note", "textarea", false, false),
    ],
  },
  shipping: {
    rates: [
      {
        id: "standard",
        name: "Standard delivery",
        price: 0,
        countries: "*",
        minSubtotal: 0,
        freeAbove: 0,
      },
    ],
  },
  otp: {
    enabled: false,
    provider: "console",
    twilioAccountSid: "",
    twilioAuthToken: "",
    twilioFrom: "",
    webhookUrl: "",
    codeLength: 4,
    expiryMinutes: 10,
    maxAttempts: 5,
    message: "Your {shop} verification code is {code}",
  },
  pixels: {
    facebookPixelIds: "",
    facebookCapiToken: "",
    facebookTestEventCode: "",
    tiktokPixelIds: "",
    snapchatPixelIds: "",
    pinterestTagIds: "",
    googleAnalyticsId: "",
    googleAdsId: "",
    googleAdsConversionLabel: "",
    fireInitiateCheckout: true,
    firePurchase: true,
  },
  sheets: {
    enabled: false,
    serviceAccountJson: "",
    spreadsheetId: "",
    ordersSheet: "Orders",
    abandonedSheet: "Abandoned",
  },
  protection: {
    blockedPhones: "",
    blockedEmails: "",
    blockedIps: "",
    blockedMessage: "Sorry, we can't accept your order. Please contact support.",
    maxOrdersPerPhonePerDay: 3,
    maxOrdersPerIpPerDay: 5,
    allowedCountries: "",
    minOrderTotal: 0,
    maxOrderTotal: 0,
    maxQuantity: 0,
    abandonedEnabled: true,
  },
};

export interface OfferTier {
  quantity: number;
  discountType: "percentage" | "fixed" | "none";
  discountValue: number; // percentage or fixed amount off the line total
  label: string;
  badge: string;
  preselected: boolean;
}

export function splitList(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function normalizePhone(phone: string): string {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, "");
  return trimmed.startsWith("+") ? `+${digits}` : digits;
}

export function applyDiscount(
  amount: number,
  type: "percentage" | "fixed" | "none" | string,
  value: number,
): number {
  if (type === "percentage") return round2(amount * (Math.min(value, 100) / 100));
  if (type === "fixed") return round2(Math.min(value, amount));
  return 0;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
