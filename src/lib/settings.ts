import { inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { SETTINGS_DEFAULTS, type SettingKey } from "./settings-defaults";

type Value<K extends SettingKey> = (typeof SETTINGS_DEFAULTS)[K] extends readonly unknown[]
  ? string[]
  : (typeof SETTINGS_DEFAULTS)[K] extends boolean
    ? boolean
    : (typeof SETTINGS_DEFAULTS)[K] extends number
      ? number
      : string;

export async function getSettings<K extends SettingKey>(keys: K[]): Promise<{ [P in K]: Value<P> }> {
  const rows = await getDb().select().from(schema.settings).where(inArray(schema.settings.key, keys));
  const out = {} as Record<string, unknown>;
  for (const k of keys) out[k] = SETTINGS_DEFAULTS[k];
  for (const r of rows) out[r.key] = r.value;
  return out as { [P in K]: Value<P> };
}

export async function getSetting<K extends SettingKey>(key: K): Promise<Value<K>> {
  return (await getSettings([key]))[key];
}
