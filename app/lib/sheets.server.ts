/* eslint-disable @typescript-eslint/no-explicit-any -- untyped JSON from GraphQL and requests */
import crypto from "node:crypto";
import type { SheetsSettings } from "./settings";

const tokenCache = new Map<string, { token: string; exp: number }>();

const b64url = (input: Buffer | string) =>
  Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

async function accessToken(serviceAccountJson: string) {
  const sa = JSON.parse(serviceAccountJson);
  const cached = tokenCache.get(sa.client_email);
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;

  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/spreadsheets",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const signature = b64url(
    crypto.createSign("RSA-SHA256").update(`${header}.${claim}`).sign(sa.private_key),
  );
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claim}.${signature}`,
    }),
  });
  const json: any = await res.json();
  if (!res.ok) throw new Error(`Google auth failed: ${json.error_description || res.status}`);
  tokenCache.set(sa.client_email, { token: json.access_token, exp: Date.now() + json.expires_in * 1000 });
  return json.access_token as string;
}

export async function appendRow(settings: SheetsSettings, sheet: string, row: unknown[]) {
  if (!settings.enabled || !settings.serviceAccountJson || !settings.spreadsheetId) return;
  const token = await accessToken(settings.serviceAccountJson);
  const range = encodeURIComponent(`${sheet}!A1`);
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${settings.spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ values: [row.map((v) => (v == null ? "" : String(v)))] }),
    },
  );
  if (!res.ok) throw new Error(`Google Sheets append failed: ${res.status} ${await res.text()}`);
}

export const ORDER_SHEET_HEADER = [
  "Date", "Order", "Status", "Name", "Phone", "Email", "Address", "City",
  "Province", "Zip", "Country", "Products", "Quantity", "Total", "Currency", "Note",
];
