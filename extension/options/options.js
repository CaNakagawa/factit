// Fact It - settings page (V1.4).
//
// Extension page (privileged). Reads and writes settings directly; provider
// requests are delegated to the background worker. The stored API key is
// never written back into the form.
//
// Interface text goes through FactIt.i18n (ui/i18n.js, loaded as a classic
// script before this module). Static text is marked with data-i18n in
// options.html; dynamic text is wrapped in t() here.

import { createSettingsStore } from "../storage/settings.js";
import { PROVIDERS } from "../providers/provider.js";
import { knownPrice, formatUsd } from "../providers/pricing.js";

const store = createSettingsStore();
const { t, setLanguage, LANGUAGES } = globalThis.FactIt.i18n;
const $ = (id) => document.getElementById(id);

const form = $("settings");
const languageSelect = $("uiLanguage");
const providerSelect = $("provider");
const baseUrlField = $("baseUrlField");
const baseUrlInput = $("baseUrl");
const apiKeyInput = $("apiKey");
const apiKeyHint = $("apiKeyHint");
const modelInput = $("model");
const modelHint = $("modelHint");
const inputPrice = $("inputPrice");
const outputPrice = $("outputPrice");
const priceHint = $("priceHint");
const status = $("status");

let hasStoredKey = false;

function definition() {
  return PROVIDERS.find((p) => p.id === providerSelect.value) || PROVIDERS[0];
}

function setStatus(text, kind = "") {
  status.textContent = text;
  status.className = kind;
}

/** Translate everything marked with data-i18n, keeping the English source. */
function applyStaticI18n() {
  for (const el of document.querySelectorAll("[data-i18n]")) {
    if (!el.dataset.i18nSource) el.dataset.i18nSource = el.textContent.replace(/\s+/g, " ").trim();
    el.textContent = t(el.dataset.i18nSource);
  }
  document.title = t("Fact It - Settings");
}

function renderProviderFields() {
  const def = definition();
  baseUrlField.hidden = !def.needsBaseUrl;
  modelInput.placeholder = def.defaultModel || t("model name");
  modelHint.textContent = def.defaultModel
    ? t("Leave empty to use {model}.", { model: def.defaultModel })
    : t("Required. Use the model name your server expects.");
  apiKeyInput.placeholder = hasStoredKey ? t("(saved - leave empty to keep)") : "";
  apiKeyHint.textContent = def.needsApiKey
    ? t("Required. Stored locally, never shown again.")
    : t("Optional for local servers. Stored locally, never shown again.");
  suggestPrices();
}

// Pre-fill list prices we know (Anthropic models); never overwrite what
// the user typed.
function suggestPrices() {
  const model = modelInput.value.trim() || definition().defaultModel;
  const known = knownPrice(providerSelect.value, model);
  if (known && inputPrice.value.trim() === "" && outputPrice.value.trim() === "") {
    inputPrice.value = String(known.input);
    outputPrice.value = String(known.output);
  }
  priceHint.textContent = known
    ? t("List price for {model}: ${input} in / ${output} out per 1M tokens (pre-filled; edit if your plan differs).", { model, input: known.input, output: known.output })
    : t("Optional. Used only to estimate the cost of each analysis; leave empty to see token counts only. Check your provider's pricing page.");
}

/** Re-render every string after a language change. */
function applyLanguage(preference) {
  setLanguage(preference);
  document.documentElement.lang = globalThis.FactIt.i18n.language;
  applyStaticI18n();
  renderProviderFields();
  return Promise.all([refreshCacheCount(), refreshUsage()]);
}

async function load() {
  for (const language of LANGUAGES) {
    const option = document.createElement("option");
    option.value = language.code;
    option.textContent = language.native;
    languageSelect.append(option);
  }
  for (const p of PROVIDERS) {
    const option = document.createElement("option");
    option.value = p.id;
    option.textContent = p.label;
    providerSelect.append(option);
  }

  const settings = await store.get();
  languageSelect.value = settings.uiLanguage;
  providerSelect.value = settings.provider;
  baseUrlInput.value = settings.baseUrl;
  modelInput.value = settings.model;
  inputPrice.value = settings.inputPricePerM;
  outputPrice.value = settings.outputPricePerM;
  hasStoredKey = settings.apiKey !== "";
  apiKeyInput.value = "";

  setLanguage(settings.uiLanguage);
  document.documentElement.lang = globalThis.FactIt.i18n.language;
  applyStaticI18n();
  renderProviderFields();

  $("version").textContent = chrome.runtime.getManifest().version;
}

async function save() {
  const patch = {
    provider: providerSelect.value,
    model: modelInput.value,
    baseUrl: baseUrlInput.value,
    inputPricePerM: inputPrice.value,
    outputPricePerM: outputPrice.value,
    uiLanguage: languageSelect.value,
  };
  // Only replace the key when the user typed one.
  if (apiKeyInput.value.trim() !== "") patch.apiKey = apiKeyInput.value;

  const saved = await store.update(patch);
  hasStoredKey = saved.apiKey !== "";
  apiKeyInput.value = "";
  renderProviderFields();
  return saved;
}

languageSelect.addEventListener("change", async () => {
  await store.update({ uiLanguage: languageSelect.value });
  await applyLanguage(languageSelect.value);
  setStatus(t("Saved."), "ok");
});

providerSelect.addEventListener("change", renderProviderFields);
modelInput.addEventListener("change", suggestPrices);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  await save();
  setStatus(t("Saved."), "ok");
});

$("removeKey").addEventListener("click", async () => {
  await store.clearApiKey();
  hasStoredKey = false;
  apiKeyInput.value = "";
  renderProviderFields();
  setStatus(t("API key removed."), "ok");
});

$("test").addEventListener("click", async () => {
  const button = $("test");
  button.disabled = true;
  setStatus(t("Saving and testing…"));
  try {
    await save();
    const reply = await chrome.runtime.sendMessage({ type: "FACTIT_TEST_PROVIDER" });
    if (reply && reply.ok) {
      const cost = reply.cost && Number.isFinite(reply.cost.usd) ? t(" Cost ≈ {cost}.", { cost: formatUsd(reply.cost.usd) }) : "";
      setStatus(t("Connected: {provider} / {model} replied \"{sample}\".{cost}", { provider: reply.provider, model: reply.model, sample: reply.sample, cost }), "ok");
      refreshUsage();
    } else {
      const err = (reply && reply.error) || { kind: "unknown", message: t("No response from background.") };
      setStatus(t("Failed ({kind}): {message}", { kind: err.kind, message: err.message }), "error");
    }
  } catch (error) {
    setStatus(t("Failed: {message}", { message: (error && error.message) || t("unknown error") }), "error");
  } finally {
    button.disabled = false;
  }
});

async function refreshUsage() {
  const totals = await chrome.runtime.sendMessage({ type: "FACTIT_USAGE_STATS" });
  if (!totals) return;
  const n = (v) => Number(v || 0).toLocaleString();
  if (!totals.requests) {
    $("usageTotals").textContent = t("No requests yet.");
    return;
  }
  const requests = t(totals.requests === 1 ? "{n} request" : "{n} requests", { n: n(totals.requests) });
  const since = totals.since ? t(" since {date}", { date: new Date(totals.since).toLocaleDateString() }) : "";
  $("usageTotals").textContent = `${t("{requests}{since}: {input} input + {output} output tokens, estimated {cost}.", {
    requests, since, input: n(totals.input_tokens), output: n(totals.output_tokens), cost: formatUsd(totals.cost_usd),
  })} ${t("Only requests made with prices set are counted in the estimate.")}`;
}

$("resetUsage").addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "FACTIT_USAGE_RESET" });
  await refreshUsage();
});

async function refreshCacheCount() {
  const stats = await chrome.runtime.sendMessage({ type: "FACTIT_CACHE_STATS" });
  const n = stats && Number.isFinite(stats.count) ? stats.count : 0;
  $("cacheCount").textContent = t(n === 1 ? "{n} cached analysis." : "{n} cached analyses.", { n });
}

$("clearCache").addEventListener("click", async () => {
  const reply = await chrome.runtime.sendMessage({ type: "FACTIT_CACHE_CLEAR" });
  const n = reply && reply.removed ? reply.removed : 0;
  $("cacheStatus").textContent = t(n === 1 ? "Removed {n} cached analysis." : "Removed {n} cached analyses.", { n });
  await refreshCacheCount();
});

load().then(() => Promise.all([refreshCacheCount(), refreshUsage()]));
