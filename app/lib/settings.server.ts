/* eslint-disable @typescript-eslint/no-explicit-any -- untyped JSON from GraphQL and requests */
import prisma from "../db.server";
import {
  DEFAULT_SETTINGS,
  SETTINGS_SECTIONS,
  type AllSettings,
  type SettingsSection,
} from "./settings";

function merge<T extends object>(defaults: T, raw: string | null | undefined): T {
  if (!raw) return structuredClone(defaults);
  try {
    const parsed = JSON.parse(raw);
    return { ...structuredClone(defaults), ...parsed };
  } catch {
    return structuredClone(defaults);
  }
}

export async function getSettings(shop: string): Promise<AllSettings> {
  const row = await prisma.shopSettings.findUnique({ where: { shop } });
  const out = {} as AllSettings;
  for (const section of SETTINGS_SECTIONS) {
    (out as any)[section] = merge(DEFAULT_SETTINGS[section], row?.[section]);
  }
  return out;
}

export async function saveSection<S extends SettingsSection>(
  shop: string,
  section: S,
  value: AllSettings[S],
) {
  const json = JSON.stringify(value);
  await prisma.shopSettings.upsert({
    where: { shop },
    create: { shop, [section]: json },
    update: { [section]: json },
  });
}

/**
 * Parses a JSON string posted from an admin form and coerces it to the
 * shape of the defaults (unknown keys dropped, numbers/booleans coerced).
 */
export function coerceSection<S extends SettingsSection>(
  section: S,
  raw: unknown,
): AllSettings[S] {
  const defaults = DEFAULT_SETTINGS[section] as unknown as Record<string, unknown>;
  const input = (typeof raw === "string" ? JSON.parse(raw) : raw) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, def] of Object.entries(defaults)) {
    const v = input?.[key];
    if (v === undefined) out[key] = def;
    else if (typeof def === "number") out[key] = Number(v) || 0;
    else if (typeof def === "boolean") out[key] = v === true || v === "true";
    else if (typeof def === "string") out[key] = String(v);
    else out[key] = v; // arrays / nested objects
  }
  return out as unknown as AllSettings[S];
}

/** Action helper: saves {section: value} pairs posted by useSettingsForm. */
export async function saveSettingsFromRequest(shop: string, request: Request) {
  const form = await request.formData();
  try {
    const payload = JSON.parse(String(form.get("payload") || "{}"));
    for (const section of SETTINGS_SECTIONS) {
      if (payload[section] !== undefined) {
        await saveSection(shop, section, coerceSection(section, payload[section]));
      }
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Invalid settings" };
  }
}
