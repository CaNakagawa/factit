// Fact It - run the evaluation set against a provider (ADR-015).
//
//   node eval/run.mjs --dry        # estimate cost, no network, no key needed
//   node eval/run.mjs --yes        # run every case; SPENDS TOKENS on your key
//
// Provider settings come from the environment, exactly as in the
// extension's settings page:
//   FACTIT_PROVIDER   openai | anthropic | openai-compatible
//   FACTIT_API_KEY    your key (never printed, never written to results)
//   FACTIT_MODEL      optional for openai/anthropic
//   FACTIT_BASE_URL   required for openai-compatible
//   FACTIT_PRICE_IN / FACTIT_PRICE_OUT   USD per 1M tokens (optional;
//                     pre-filled for known Anthropic models)
//
// Cases: eval/cases/*.json (synthetic, versioned) and eval/cases/local/
// (real articles, git-ignored). Results go to eval/results/, git-ignored.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadCases, checkExpectations } from "./lib.mjs";
import { analyzeArticle } from "../extension/analysis/engine.js";
import { buildPrompt, PROMPT_VERSION } from "../extension/analysis/prompt.js";
import { createProvider, PROVIDERS } from "../extension/providers/provider.js";
import { estimateCost, formatUsd, knownPrice } from "../extension/providers/pricing.js";

const HERE = new URL("./", import.meta.url).pathname;
const dry = process.argv.includes("--dry");
const yes = process.argv.includes("--yes");
if (!dry && !yes) {
  console.error("Refusing to spend tokens without --yes. Run with --dry first to see the estimated cost.");
  process.exit(2);
}

const settings = {
  provider: process.env.FACTIT_PROVIDER || "anthropic",
  apiKey: process.env.FACTIT_API_KEY || "",
  model: process.env.FACTIT_MODEL || "",
  baseUrl: process.env.FACTIT_BASE_URL || "",
};
const cases = loadCases([join(HERE, "cases"), join(HERE, "cases", "local")]);
if (!cases.length) {
  console.error("No cases found in eval/cases/ or eval/cases/local/.");
  process.exit(1);
}

const provider = dry ? null : createProvider(settings, { fetch: globalThis.fetch });
const definition = PROVIDERS.find((p) => p.id === settings.provider);
const model = provider ? provider.model : settings.model || (definition && definition.defaultModel) || "(model not set)";
const listed = knownPrice(settings.provider, model);
const prices = {
  input: process.env.FACTIT_PRICE_IN ?? (listed && listed.input),
  output: process.env.FACTIT_PRICE_OUT ?? (listed && listed.output),
};
// Output tokens measured on real analyses ranged from ~450 to ~1,700;
// the estimate uses the high end.
const EST_OUTPUT_TOKENS = 1700;

console.log(`Fact It eval · prompt ${PROMPT_VERSION} · ${settings.provider}/${model} · ${cases.length} case(s)${dry ? " · DRY RUN" : ""}\n`);

const report = [];
let totalIn = 0, totalOut = 0, passed = 0, failed = 0;
for (const c of cases) {
  const name = c.name || c.path;
  if (dry) {
    const { system, input } = buildPrompt(c.article);
    const tin = Math.ceil((system.length + input.length) / 4);
    totalIn += tin; totalOut += EST_OUTPUT_TOKENS;
    console.log(`  ${name.padEnd(36)} ~${tin} in · ~${EST_OUTPUT_TOKENS} out`);
    continue;
  }
  try {
    const result = await analyzeArticle(c.article, provider);
    const checks = checkExpectations(result, c.expect);
    const ok = checks.every((x) => x.ok);
    ok ? passed++ : failed++;
    const u = result.meta.usage || { input_tokens: 0, output_tokens: 0 };
    totalIn += u.input_tokens; totalOut += u.output_tokens;
    console.log(`${ok ? "PASS" : "FAIL"} ${name}  (${result.assessment.status}, ${result.claims.length} claims, ${u.input_tokens}+${u.output_tokens} tokens)`);
    for (const x of checks.filter((y) => !y.ok)) console.log(`       ✗ ${x.name}: got ${x.detail}`);
    report.push({ name, ok, checks, status: result.assessment.status, article: result.article, claims: result.claims.length, concerns: result.concerns, usage: u, summary: result.summary });
  } catch (error) {
    failed++;
    console.log(`ERR  ${name}: ${error.kind || "error"} - ${error.message}`);
    report.push({ name, ok: false, error: { kind: error.kind || "error", message: error.message } });
  }
}

const cost = estimateCost({ input_tokens: totalIn, output_tokens: totalOut }, prices);
const costText = cost ? formatUsd(cost.usd) : "unknown (set FACTIT_PRICE_IN / FACTIT_PRICE_OUT)";
console.log(`\n${dry ? "Estimated" : "Spent"}: ${totalIn} input + ${totalOut} output tokens, ${costText}.`);
if (!dry) {
  console.log(`${passed} passed, ${failed} failed.`);
  const out = join(HERE, "results");
  mkdirSync(out, { recursive: true });
  const file = join(out, `${new Date().toISOString().replace(/[:.]/g, "-")}-prompt-${PROMPT_VERSION}.json`);
  writeFileSync(file, JSON.stringify({ prompt_version: PROMPT_VERSION, provider: settings.provider, model, passed, failed, usage: { input_tokens: totalIn, output_tokens: totalOut }, cases: report }, null, 2));
  console.log(`Results: ${file}`);
  process.exitCode = failed ? 1 : 0;
}
