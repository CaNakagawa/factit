// Cost estimation and cumulative usage totals.

import { test } from "node:test";
import assert from "node:assert/strict";
import { estimateCost, formatUsd, knownPrice, parsePrice } from "../../extension/providers/pricing.js";
import { createUsageTotals } from "../../extension/storage/usage.js";

function memoryArea() {
  const data = {};
  return {
    data,
    async get(key) { return key in data ? { [key]: structuredClone(data[key]) } : {}; },
    async set(obj) { Object.assign(data, structuredClone(obj)); },
    async remove(key) { delete data[key]; },
  };
}

test("estimateCost: USD per 1M tokens, both prices required", () => {
  const usage = { input_tokens: 2246, output_tokens: 2219 };
  const c = estimateCost(usage, { input: 5, output: 25 });
  assert.ok(Math.abs(c.usd - (2246 * 5 + 2219 * 25) / 1e6) < 1e-12);
  assert.equal(estimateCost(usage, { input: "", output: 25 }), null);
  assert.equal(estimateCost(null, { input: 5, output: 25 }), null);
  assert.equal(estimateCost({ input_tokens: "x" }, { input: 5, output: 25 }), null);
  assert.equal(estimateCost({ input_tokens: 0, output_tokens: 0 }, { input: "0", output: "0" }).usd, 0);
});

test("parsePrice and formatUsd", () => {
  assert.equal(parsePrice("0,27"), 0.27);
  assert.equal(parsePrice(""), null);
  assert.equal(parsePrice("abc"), null);
  assert.equal(parsePrice(-1), null);
  assert.equal(formatUsd(0), "$0");
  assert.equal(formatUsd(0.00123), "$0.0012");
  assert.equal(formatUsd(0.0667), "$0.067");
  assert.equal(formatUsd(3.14159), "$3.14");
  assert.equal(formatUsd(NaN), "");
});

test("knownPrice covers Anthropic models only", () => {
  assert.deepEqual(knownPrice("anthropic", "claude-opus-5"), { input: 5, output: 25 });
  assert.deepEqual(knownPrice("anthropic", "claude-sonnet-5"), { input: 2, output: 10 });
  assert.equal(knownPrice("anthropic", "claude-unknown"), null);
  assert.equal(knownPrice("openai", "gpt-4o-mini"), null);
  assert.equal(knownPrice("openai-compatible", "deepseek-chat"), null);
});

test("usage totals accumulate, tolerate missing usage, and reset", async () => {
  const totals = createUsageTotals(memoryArea(), { now: () => new Date("2026-09-18T00:00:00Z") });
  assert.deepEqual(await totals.get(), { requests: 0, input_tokens: 0, output_tokens: 0, cost_usd: 0, since: null });
  await totals.add({ input_tokens: 100, output_tokens: 50 }, 0.001);
  const t = await totals.add(null, null);
  assert.equal(t.requests, 2);
  assert.equal(t.input_tokens, 100);
  assert.equal(t.output_tokens, 50);
  assert.ok(Math.abs(t.cost_usd - 0.001) < 1e-12);
  assert.equal(t.since, "2026-09-18T00:00:00.000Z");
  assert.equal((await totals.reset()).requests, 0);
  assert.equal((await totals.get()).since, null);
});

test("usage totals: corrupt stored data is sanitized", async () => {
  const area = memoryArea();
  area.data.usage_totals = { requests: "many", input_tokens: -5, cost_usd: "x", since: 3 };
  assert.deepEqual(await createUsageTotals(area).get(), { requests: 0, input_tokens: 0, output_tokens: 0, cost_usd: 0, since: null });
});
