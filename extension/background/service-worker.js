// Fact It - background service worker (V0.6).
//
// Privileged extension context. Provider requests are made here so that
// API keys never reach content scripts or the webpage. Orchestrates:
//
//   toolbar click -> FACTIT_TOGGLE -> content script shows the bar / panel
//   bar "Analyze" click -> FACTIT_ANALYZE (article) -> provider
//     -> validated result -> reply
//
// Only the Analyze button ever triggers a provider call.

import { createSettingsStore } from "../storage/settings.js";
import { createProvider, ProviderError } from "../providers/provider.js";
import { analyzeArticle, AnalysisError, articleDocumentProblem } from "../analysis/engine.js";

const settings = createSettingsStore();

chrome.runtime.onInstalled.addListener((details) => {
  console.log(`[Fact It] service worker installed (${details.reason})`);
});

// The toolbar button only reveals the bar or toggles the panel; it never
// starts an analysis, so an accidental click cannot spend tokens (ADR-006).
chrome.action.onClicked.addListener((tab) => {
  if (!tab || !tab.id) return;
  chrome.tabs.sendMessage(tab.id, { type: "FACTIT_TOGGLE" }).catch(() => {
    // No content script on this page (chrome://, store, file://, ...).
  });
});

// True only for the extension's own pages (settings page). Content scripts
// report the webpage's http(s) URL/origin here, set by the browser, so
// they can never pass this check.
function isExtensionPage(sender) {
  const extensionOrigin = chrome.runtime.getURL("").replace(/\/$/, "");
  return Boolean(
    sender &&
      sender.id === chrome.runtime.id &&
      typeof sender.url === "string" &&
      sender.url.startsWith(extensionOrigin + "/") &&
      (sender.origin === undefined || sender.origin === extensionOrigin),
  );
}

// Content scripts run inside a tab on an http(s) page. Extension pages
// also live in tabs, so the URL scheme is the discriminator.
function isContentScript(sender) {
  return Boolean(
    sender &&
      sender.id === chrome.runtime.id &&
      sender.tab &&
      sender.tab.id &&
      typeof sender.url === "string" &&
      /^https?:\/\//.test(sender.url),
  );
}

function errorDetail(error) {
  if (error instanceof ProviderError || error instanceof AnalysisError) return error.toJSON();
  return { kind: "unknown", message: "Unexpected error." };
}

// Minimal round trip to confirm the configured provider works. Returns
// only what the settings page needs to show; never the key.
async function testProvider() {
  const provider = createProvider(await settings.get());
  const result = await provider.complete({
    system: "You are a connectivity check. Reply with the single word OK.",
    input: "ping",
    maxTokens: 16,
  });
  return {
    ok: true,
    provider: provider.id,
    model: result.model,
    finish: result.finish,
    sample: result.text.slice(0, 40),
    usage: result.usage,
  };
}

async function analyze(article) {
  const problem = articleDocumentProblem(article);
  if (problem) throw new AnalysisError("invalid_output", `Invalid article document: ${problem}.`);
  const provider = createProvider(await settings.get());
  const result = await analyzeArticle(article, provider);
  return { ok: true, result };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!sender || sender.id !== chrome.runtime.id) return false;
  if (!message || typeof message.type !== "string") return false;

  switch (message.type) {
    case "FACTIT_PING":
      sendResponse({ type: "FACTIT_PONG", version: chrome.runtime.getManifest().version });
      return false;

    case "FACTIT_TEST_PROVIDER":
      if (!isExtensionPage(sender)) return false;
      testProvider()
        .then(sendResponse)
        .catch((error) => sendResponse({ ok: false, error: errorDetail(error) }));
      return true; // async

    case "FACTIT_ANALYZE":
      if (!isContentScript(sender)) return false;
      analyze(message.article)
        .then(sendResponse)
        .catch((error) => sendResponse({ ok: false, error: errorDetail(error) }));
      return true; // async

    case "FACTIT_OPEN_SETTINGS":
      if (!isContentScript(sender)) return false;
      chrome.runtime.openOptionsPage();
      return false;

    default:
      return false;
  }
});
