// Settings storage with an injected in-memory storage area.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createSettingsStore, sanitizeSettings, DEFAULT_SETTINGS } from "../../extension/storage/settings.js";

function memoryArea() {
  const data = {};
  return {
    data,
    async get(key) { return key in data ? { [key]: structuredClone(data[key]) } : {}; },
    async set(obj) { Object.assign(data, structuredClone(obj)); },
    async remove(key) { delete data[key]; },
  };
}

test("sanitizeSettings drops unknown keys, trims, caps and defaults", () => {
  const out = sanitizeSettings({ provider: "evil", apiKey: "  k  ", model: "m".repeat(1000), baseUrl: 42, extra: true });
  assert.deepEqual(Object.keys(out), ["provider", "apiKey", "model", "baseUrl", "inputPricePerM", "outputPricePerM"]);
  assert.equal(out.provider, "openai");
  assert.equal(out.apiKey, "k");
  assert.equal(out.model.length, 512);
  assert.equal(out.baseUrl, "");
  assert.deepEqual(sanitizeSettings(null), { ...DEFAULT_SETTINGS });
  assert.equal(sanitizeSettings({ provider: "anthropic" }).provider, "anthropic");
});

test("store returns defaults when nothing is saved", async () => {
  const store = createSettingsStore(memoryArea());
  assert.deepEqual(await store.get(), { ...DEFAULT_SETTINGS });
});

test("update merges, keeps the key when the patch omits it, and persists", async () => {
  const area = memoryArea();
  const store = createSettingsStore(area);
  await store.update({ provider: "anthropic", apiKey: "sk-secret", model: "claude-opus-5" });
  const after = await store.update({ model: "other" });
  assert.equal(after.apiKey, "sk-secret");
  assert.equal(after.provider, "anthropic");
  assert.equal(after.model, "other");
  assert.deepEqual(area.data.settings, after);
});

test("clearApiKey removes only the key", async () => {
  const store = createSettingsStore(memoryArea());
  await store.update({ provider: "openai", apiKey: "sk-secret", model: "m" });
  const cleared = await store.clearApiKey();
  assert.equal(cleared.apiKey, "");
  assert.equal(cleared.model, "m");
});

test("corrupt stored data is sanitized on read", async () => {
  const area = memoryArea();
  area.data.settings = "garbage";
  assert.deepEqual(await createSettingsStore(area).get(), { ...DEFAULT_SETTINGS });
});

test("throws without a storage area", () => {
  assert.throws(() => createSettingsStore(undefined), /No storage area/);
});

test("prices: numbers and comma decimals accepted, junk and negatives cleared", () => {
  assert.equal(sanitizeSettings({ inputPricePerM: "5" }).inputPricePerM, "5");
  assert.equal(sanitizeSettings({ inputPricePerM: "0,27" }).inputPricePerM, "0.27");
  assert.equal(sanitizeSettings({ inputPricePerM: 2.5 }).inputPricePerM, "2.5");
  assert.equal(sanitizeSettings({ inputPricePerM: "free" }).inputPricePerM, "");
  assert.equal(sanitizeSettings({ outputPricePerM: "-1" }).outputPricePerM, "");
  assert.equal(sanitizeSettings({ outputPricePerM: "" }).outputPricePerM, "");
});
