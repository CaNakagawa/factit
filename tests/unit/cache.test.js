// Analysis cache with an injected in-memory storage area.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createAnalysisCache } from "../../extension/storage/cache.js";

function memoryArea() {
  const data = {};
  return {
    data,
    async get(key) {
      const keys = Array.isArray(key) ? key : [key];
      const out = {};
      for (const k of keys) if (k in data) out[k] = structuredClone(data[k]);
      return out;
    },
    async set(obj) { for (const [k, v] of Object.entries(obj)) data[k] = structuredClone(v); },
    async remove(key) { for (const k of Array.isArray(key) ? key : [key]) delete data[k]; },
  };
}

const hash = (n) => n.toString(16).padStart(64, "0");

function result(overrides = {}) {
  return {
    schema_version: "2.1",
    assessment: { status: "NO_SIGNIFICANT_CONCERNS", confidence: 0.5, rationale: "", verification_level: "AI_PRELIMINARY", external_verification: "NOT_PERFORMED" },
    source_transparency: {},
    claims: [{ id: "c1", text: "c", type: "FACTUAL", support: "UNCLEAR", attribution: "UNCLEAR", evidence_type: "UNKNOWN", evidence: "", concerns: [], gap: "", inference: "" }],
    concerns: [],
    framing: { detected: false, type: null, strength: null, confidence: 0, observations: [] },
    summary: "s",
    meta: { provider: "fake", model: "m", prompt_version: "1.0.1", schema_version: "1.0", analyzed_at: "2026-09-17T12:00:00.000Z", content_hash: hash(1), truncated_input: false, finish: "stop", usage: null, validation_issues: [] },
    ...overrides,
  };
}

function clock(start = 0) {
  let t = start;
  return { now: () => new Date(Date.UTC(2026, 8, 17, 0, 0, t++)), tick: () => t++ };
}

test("miss, put, hit; article text is never stored", async () => {
  const area = memoryArea();
  const cache = createAnalysisCache(area, clock());
  assert.equal(await cache.get(hash(1)), null);

  const put = await cache.put(hash(1), result());
  assert.match(put.cached_at, /^2026-09-17T/);
  const hit = await cache.get(hash(1));
  assert.equal(hit.cached_at, put.cached_at);
  assert.equal(hit.result.summary, "s");
  assert.equal(hit.result.meta.model, "m");
  assert.equal(hit.result.assessment.verification_level, "AI_PRELIMINARY");
  assert.doesNotMatch(JSON.stringify(area.data), /"content":/);
  assert.deepEqual((await cache.stats()).count, 1);
});

test("invalid hashes are rejected / ignored", async () => {
  const cache = createAnalysisCache(memoryArea());
  assert.equal(await cache.get("nope"), null);
  assert.equal(await cache.get(undefined), null);
  await assert.rejects(cache.put("nope", result()), /Invalid content hash/);
});

test("schema 1.x entries are still served, migrated to 2.0 and marked", async () => {
  const area = memoryArea();
  const cache = createAnalysisCache(area);
  const legacy = {
    schema_version: "1.2",
    analysis: { overall_factual_support: 0.7, confidence: 0.6, verification_level: "AI_PRELIMINARY", rationale: "r" },
    claims: [{ text: "t", type: "FACTUAL", classification: "SUPPORTED", confidence: 0.8, explanation: "quoted", basis: "EVIDENCE", missing_information: "", implied: "" }],
    flags: [{ type: "MISSING_CONTEXT", explanation: "ctx" }],
    framing: { detected: false, type: null, strength: null, confidence: 0.1, explanation: "" },
    summary: "s",
    meta: { provider: "p", model: "m", prompt_version: "1.2.0", analyzed_at: "2026-09-17T00:00:00.000Z" },
  };
  area.data["analysis:" + hash(9)] = { result: legacy, cached_at: "2026-09-17T00:00:00.000Z" };
  const hit = await cache.get(hash(9));
  assert.ok(hit);
  assert.equal(hit.result.schema_version, "2.1");
  assert.equal(hit.result.claims[0].support, "ARTICLE_SUPPORTED");
  assert.equal(hit.result.claims[0].evidence, "quoted");
  assert.deepEqual(hit.result.concerns, [{ type: "MATERIAL_MISSING_CONTEXT", severity: "MODERATE", note: "ctx", claim_ids: [] }]);
  assert.equal(hit.result.assessment.status, "REVIEW_RECOMMENDED");
  assert.equal(hit.result.meta.migrated_from, "1.2");
  assert.equal(hit.result.meta.model, "m");
});

test("corrupt or schema-mismatched entries are misses", async () => {
  const area = memoryArea();
  const cache = createAnalysisCache(area);
  area.data["analysis:" + hash(2)] = "garbage";
  area.data["analysis:" + hash(3)] = { result: result({ schema_version: "3.0" }), cached_at: "x" };
  area.data["analysis:" + hash(4)] = { result: { schema_version: "1.0", analysis: {} }, cached_at: "x" };
  assert.equal(await cache.get(hash(2)), null);
  assert.equal(await cache.get(hash(3)), null);
  assert.equal(await cache.get(hash(4)), null);
});

test("stored results are re-validated: verification level cannot be escalated from disk", async () => {
  const area = memoryArea();
  const cache = createAnalysisCache(area);
  const tampered = result();
  tampered.assessment.verification_level = "EVIDENCE_VERIFIED";
  tampered.assessment.external_verification = "PERFORMED";
  tampered.assessment.status = "SIGNIFICANT_CONCERNS";
  tampered.meta.provider = 42;
  area.data["analysis:" + hash(5)] = { result: tampered, cached_at: "2026-01-01T00:00:00.000Z" };
  const hit = await cache.get(hash(5));
  assert.equal(hit.result.assessment.verification_level, "AI_PRELIMINARY");
  assert.equal(hit.result.meta.provider, "unknown");
});

test("LRU eviction beyond the cap; reads refresh recency", async () => {
  const c = clock();
  const cache = createAnalysisCache(memoryArea(), { now: c.now, maxEntries: 3 });
  for (const n of [1, 2, 3]) await cache.put(hash(n), result());
  await cache.get(hash(1)); // 1 becomes most recent; 2 is now oldest
  const put = await cache.put(hash(4), result());
  assert.equal(put.evicted, 1);
  assert.equal(await cache.get(hash(2)), null, "oldest evicted");
  assert.ok(await cache.get(hash(1)));
  assert.ok(await cache.get(hash(3)));
  assert.ok(await cache.get(hash(4)));
  assert.equal((await cache.stats()).count, 3);
});

test("remove and clear", async () => {
  const area = memoryArea();
  const cache = createAnalysisCache(area);
  await cache.put(hash(1), result());
  await cache.put(hash(2), result());
  await cache.remove(hash(1));
  assert.equal(await cache.get(hash(1)), null);
  assert.equal((await cache.stats()).count, 1);
  const cleared = await cache.clear();
  assert.equal(cleared.removed, 1);
  assert.deepEqual(Object.keys(area.data), []);
});

test("throws without a storage area", () => {
  assert.throws(() => createAnalysisCache(undefined), /No storage area/);
});
