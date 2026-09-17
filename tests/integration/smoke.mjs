// Browser smoke test for the extension shell.
//
// Loads the unpacked extension into headless Chromium and checks that:
//   1. Chrome accepts the manifest (the service worker target appears)
//   2. the content script executes on a normal http page
//   3. the content script can reach the service worker
//   4. article extraction + normalization runs in the page
//   5. the settings page opens
//   6. the background worker can reach an OpenAI-compatible endpoint
//      configured through settings (fake local server), and a content
//      script cannot trigger provider calls
//
// Requires a Chromium binary that honours --load-extension. Branded Google
// Chrome (137+) silently ignores that flag, so this defaults to `chromium`.
// Override with FACTIT_BROWSER=/path/to/chromium.
//
// Run: npm run test:smoke

import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const EXTENSION_DIR = new URL("../../extension/", import.meta.url).pathname;
const BROWSER = process.env.FACTIT_BROWSER || "chromium";
const CDP_PORT = 9333;
const WEB_PORT = 8765;

const PAGE_HTML = readFileSync(new URL("../fixtures/article.html", import.meta.url), "utf8");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const listTargets = async () => (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();

async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let nextId = 0;
  const pending = new Map();
  const events = [];
  ws.onmessage = ({ data }) => {
    const msg = JSON.parse(data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    else if (msg.method) events.push(msg);
  };
  const send = (method, params = {}) => new Promise((res) => {
    const id = ++nextId;
    pending.set(id, res);
    ws.send(JSON.stringify({ id, method, params }));
  });
  return { send, events, close: () => ws.close() };
}

async function waitFor(fn, { tries = 50, interval = 200 } = {}) {
  for (let i = 0; i < tries; i++) {
    try { const v = await fn(); if (v) return v; } catch { /* not ready */ }
    await sleep(interval);
  }
  return undefined;
}

const failures = [];
const check = (ok, label, detail = "") => {
  console.log(`${ok ? "OK  " : "FAIL"} ${label}${detail ? ": " + detail : ""}`);
  if (!ok) failures.push(label);
};

const profileDir = mkdtempSync(join(tmpdir(), "factit-smoke-"));
// Serves the fixture article and a fake OpenAI-compatible endpoint.
const providerCalls = [];
const web = createServer((req, res) => {
  if (req.method === "POST" && req.url === "/v1/chat/completions") {
    let body = "";
    req.on("data", (d) => (body += d));
    req.on("end", () => {
      providerCalls.push({ headers: req.headers, body: JSON.parse(body) });
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({
        model: "fake-model",
        choices: [{ message: { role: "assistant", content: "OK" }, finish_reason: "stop" }],
        usage: { prompt_tokens: 5, completion_tokens: 1 },
      }));
    });
    return;
  }
  res.setHeader("content-type", "text/html");
  res.end(PAGE_HTML);
}).listen(WEB_PORT);

const browser = spawn(BROWSER, [
  "--headless=new",
  `--user-data-dir=${profileDir}`,
  `--remote-debugging-port=${CDP_PORT}`,
  `--load-extension=${EXTENSION_DIR}`,
  "--no-first-run",
  "--no-default-browser-check",
  "about:blank",
], { stdio: ["ignore", "ignore", "pipe"] });
let stderr = "";
browser.stderr.on("data", (d) => (stderr += d));
browser.on("error", (e) => { console.error(`Could not start ${BROWSER}: ${e.message}`); process.exit(2); });

try {
  if (!(await waitFor(listTargets))) throw new Error("DevTools endpoint never came up\n" + stderr);

  // 1. Manifest accepted: our service worker is registered.
  const sw = await waitFor(async () =>
    (await listTargets()).find((t) => t.type === "service_worker" && t.url.endsWith("/background/service-worker.js")));
  check(Boolean(sw), "service worker registered", sw?.url);
  if (!sw) throw new Error("extension did not load; is " + BROWSER + " a build that supports --load-extension?");
  const extensionId = new URL(sw.url).host;

  // 2 + 3. Content script runs on a normal http page and reaches the worker.
  const pageTarget = (await listTargets()).find((t) => t.type === "page");
  const page = await connect(pageTarget.webSocketDebuggerUrl);
  await page.send("Runtime.enable");
  await page.send("Page.enable");
  await page.send("Page.navigate", { url: `http://127.0.0.1:${WEB_PORT}/` });
  // Objects logged by the content script arrive as previews; flatten them.
  const argText = (a) => a.value ?? (a.preview
    ? a.preview.properties.map((p) => `${p.name}=${p.value}`).join(",")
    : a.description ?? "");
  const consoleText = () => page.events
    .filter((e) => e.method === "Runtime.consoleAPICalled")
    .map((e) => e.params.args.map(argText).join(" "));
  await waitFor(() => consoleText().some((l) => l.includes("service worker responded")), { tries: 25 });
  const logs = consoleText();
  check(logs.some((l) => l.includes("[Fact It] content script loaded")), "content script executed on http page");
  check(logs.some((l) => l.includes("[Fact It] service worker responded")), "content script reached service worker");

  // 4. Extraction + normalization in the content script's isolated world.
  await waitFor(() => consoleText().some((l) => l.startsWith("[Fact It] article:")), { tries: 25 });
  const isolated = page.events.find((e) =>
    e.method === "Runtime.executionContextCreated" &&
    e.params.context.auxData?.type === "isolated" &&
    e.params.context.origin.startsWith(`chrome-extension://${extensionId}`));
  let doc = null;
  if (isolated) {
    const r = await page.send("Runtime.evaluate", {
      contextId: isolated.params.context.id,
      expression: "FactIt.normalizeArticle(FactIt.extractArticle(document, location, { Readability, isProbablyReaderable }))",
      awaitPromise: true,
      returnByValue: true,
    });
    doc = r.result?.result?.value ?? null;
  }
  check(
    Boolean(doc) && doc.schema_version === "1.0" && /^[0-9a-f]{64}$/.test(doc.content_hash) &&
      doc.document.title === "City council approves new transit plan" && doc.document.truncated === false,
    "ArticleDocument built in page",
    doc ? `hash=${doc.content_hash.slice(0, 12)}… chars=${doc.document.content.length} links=${doc.document.links.length}` : "isolated world not found",
  );

  // 5. Settings page opens.
  await page.send("Page.navigate", { url: `chrome-extension://${extensionId}/options/options.html` });
  await sleep(500);
  const evaluated = await page.send("Runtime.evaluate", {
    expression: "document.title + ' | version=' + document.getElementById('version').textContent",
    returnByValue: true,
  });
  const value = evaluated.result?.result?.value ?? "";
  check(value.includes("Fact It") && /version=\d/.test(value), "settings page opens", value);

  // 6a. A content script must not be able to trigger provider calls.
  await page.send("Page.navigate", { url: `http://127.0.0.1:${WEB_PORT}/` });
  await sleep(800);
  const isolated2 = page.events.filter((e) =>
    e.method === "Runtime.executionContextCreated" && e.params.context.auxData?.type === "isolated" &&
    e.params.context.origin.startsWith(`chrome-extension://${extensionId}`)).pop();
  const fromContent = await page.send("Runtime.evaluate", {
    contextId: isolated2.params.context.id,
    expression: "chrome.runtime.sendMessage({ type: 'FACTIT_TEST_PROVIDER' }).then(r => r === undefined ? 'ignored' : 'ANSWERED').catch(e => 'ignored')",
    awaitPromise: true, returnByValue: true,
  });
  check(fromContent.result?.result?.value === "ignored", "content script cannot trigger provider calls", fromContent.result?.result?.value);

  // 6b. Configure a custom endpoint via the settings page and test it.
  await page.send("Page.navigate", { url: `chrome-extension://${extensionId}/options/options.html` });
  await sleep(500);
  const configured = await page.send("Runtime.evaluate", {
    expression: `(async () => {
      await chrome.storage.local.set({ settings: { provider: "openai-compatible", apiKey: "sk-smoke-test-key-0000", model: "fake-model", baseUrl: "http://127.0.0.1:${WEB_PORT}/v1" } });
      const reply = await chrome.runtime.sendMessage({ type: "FACTIT_TEST_PROVIDER" });
      await chrome.storage.local.remove("settings");
      return reply;
    })()`,
    awaitPromise: true, returnByValue: true,
  });
  const reply = configured.result?.result?.value;
  const call = providerCalls[0];
  check(
    Boolean(reply && reply.ok && reply.model === "fake-model" && reply.sample === "OK") &&
      Boolean(call && call.headers.authorization === "Bearer sk-smoke-test-key-0000" && call.body.messages?.length === 2),
    "background reached custom provider endpoint", JSON.stringify(reply),
  );
  check(Boolean(call) && call.body.messages[0].role === "system" && call.body.messages[1].role === "user", "system and input sent as separate roles");

  const exceptions = page.events.filter((e) => e.method === "Runtime.exceptionThrown");
  check(exceptions.length === 0, "no runtime exceptions", exceptions.map((e) => e.params.exceptionDetails.text).join("; "));
  page.close();
} catch (e) {
  console.error("ERROR", e.message);
  failures.push("error");
} finally {
  try {
    const { webSocketDebuggerUrl } = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).json();
    const b = await connect(webSocketDebuggerUrl);
    await b.send("Browser.close");
  } catch { try { browser.kill(); } catch { /* snap-confined browsers refuse signals */ } }
  await sleep(300);
  web.close();
  rmSync(profileDir, { recursive: true, force: true });
}

process.exitCode = failures.length ? 1 : 0;
