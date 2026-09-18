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
//   7. a full analysis round trip (content script -> background ->
//      fake provider -> validated AnalysisResult) works, and extension
//      pages cannot submit articles for analysis
//   8. the Fact It bar is idle on load (no provider call), shows the
//      result after the run, and is absent on non-article pages
//   9. clicking Details (a real click into the closed shadow root via
//      the DOM domain) opens the panel with the analysis
//  10. reloading the article shows the cached result with no provider
//      call; Re-analyze makes exactly one; settings can clear the cache
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


// Real mouse click on a button (by its text) inside the closed shadow root,
// using the DOM domain's shadow-piercing tree. Returns false if not found.
async function clickShadowButton(page, text) {
  await page.send("DOM.enable");
  const tree = await page.send("DOM.getDocument", { depth: -1, pierce: true });
  const matches = [];
  const walk = (node) => {
    if (node.nodeName === "BUTTON" && (node.children || []).some((c) => c.nodeValue === text)) matches.push(node);
    for (const child of [...(node.children || []), ...(node.shadowRoots || [])]) walk(child);
  };
  walk(tree.result.root);
  // First match that is actually rendered (hidden buttons have no box model).
  for (const button of matches) {
    await page.send("DOM.scrollIntoViewIfNeeded", { nodeId: button.nodeId });
    const box = await page.send("DOM.getBoxModel", { nodeId: button.nodeId });
    if (!box.result || !box.result.model) continue;
    const q = box.result.model.content;
    const x = (q[0] + q[2]) / 2, y = (q[1] + q[5]) / 2;
    for (const type of ["mousePressed", "mouseReleased"]) {
      await page.send("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1 });
    }
    return true;
  }
  return false;
}

async function shadowText(page, selectorClass) {
  const tree = await page.send("DOM.getDocument", { depth: -1, pierce: true });
  const collect = (node, out) => {
    if (node.nodeType === 3) out.push(node.nodeValue);
    for (const child of [...(node.children || []), ...(node.shadowRoots || [])]) collect(child, out);
    return out;
  };
  const find = (node) => {
    if ((node.attributes || []).some((a, i, arr) => a === "class" && String(arr[i + 1]).split(" ").includes(selectorClass))) return node;
    for (const child of [...(node.children || []), ...(node.shadowRoots || [])]) { const h = find(child); if (h) return h; }
    return null;
  };
  const node = find(tree.result.root);
  return node ? collect(node, []).join(" ").replace(/\s+/g, " ") : "";
}

const failures = [];
const check = (ok, label, detail = "") => {
  console.log(`${ok ? "OK  " : "FAIL"} ${label}${detail ? ": " + detail : ""}`);
  if (!ok) failures.push(label);
};

const profileDir = mkdtempSync(join(tmpdir(), "factit-smoke-"));
const FAKE_ANALYSIS = {
  assessment: { article_support: 0.6, confidence: 0.5, rationale: "The vote tally is reported from the session; the cost figure is only attributed.", verification_level: "EVIDENCE_VERIFIED", external_verification: "PERFORMED" },
  claims: [
    { id: "c1", text: "The city council voted 7-2 on Tuesday.", type: "FACTUAL", support: "ARTICLE_SUPPORTED", confidence: 0.8, evidence_type: "OFFICIAL_RECORD", evidence: "Vote reported from the session.", gap: "", inference: "", issues: [], external_verification_required: false },
    { id: "c2", text: "The plan is expected to cost 2.4 billion dollars.", type: "FACTUAL", support: "ATTRIBUTED", confidence: 0.6, evidence_type: "SECONDARY_SOURCE", evidence: "Attributed to the council's published report.", gap: "The report's cost table.", inference: "", issues: ["EXTERNAL_VERIFICATION_REQUIRED"], external_verification_required: true },
  ],
  issues: [],
  framing: { detected: false, type: null, strength: null, confidence: 0.2, observations: [] },
  summary: "Preliminary: the vote is backed by the session record; the cost estimate rests on a linked report.",
};

// Serves the fixture article and a fake OpenAI-compatible endpoint.
const providerCalls = [];
const web = createServer((req, res) => {
  if (req.method === "POST" && req.url === "/v1/chat/completions") {
    let body = "";
    req.on("data", (d) => (body += d));
    req.on("end", () => {
      const parsed = JSON.parse(body);
      providerCalls.push({ headers: req.headers, body: parsed });
      // Analysis requests carry the article envelope; answer with a canned
      // AnalysisResult (wrapped in a code fence to exercise tolerant parsing).
      const isAnalysis = parsed.messages.some((m) => m.role === "user" && m.content.includes("Article to analyze"));
      const content = isAnalysis ? "```json\n" + JSON.stringify(FAKE_ANALYSIS) + "\n```" : "OK";
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({
        model: "fake-model",
        choices: [{ message: { role: "assistant", content }, finish_reason: "stop" }],
        usage: { prompt_tokens: 5, completion_tokens: 1 },
      }));
    });
    return;
  }
  res.setHeader("content-type", "text/html");
  res.end(req.url === "/plain" ? "<!DOCTYPE html><html><head><title>Plain</title></head><body><a href='/'>home</a></body></html>" : PAGE_HTML);
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
      await chrome.storage.local.set({ settings: { provider: "openai-compatible", apiKey: "sk-smoke-test-key-0000", model: "fake-model", baseUrl: "http://127.0.0.1:${WEB_PORT}/v1", inputPricePerM: "2", outputPricePerM: "10" } });
      const reply = await chrome.runtime.sendMessage({ type: "FACTIT_TEST_PROVIDER" });
      await chrome.storage.local.remove("settings");
      return reply;
    })()`,
    awaitPromise: true, returnByValue: true,
  });
  const reply = configured.result?.result?.value;
  const call = providerCalls[0];
  check(
    Boolean(reply && reply.ok && reply.model === "fake-model" && reply.sample === "OK" && reply.cost && Math.abs(reply.cost.usd - (5 * 2 + 1 * 10) / 1e6) < 1e-12) &&
      Boolean(call && call.headers.authorization === "Bearer sk-smoke-test-key-0000" && call.body.messages?.length === 2),
    "background reached custom provider endpoint (with cost estimate)", JSON.stringify(reply),
  );
  check(Boolean(call) && call.body.messages[0].role === "system" && call.body.messages[1].role === "user", "system and input sent as separate roles");

  // 7a. Extension pages cannot submit articles for analysis.
  const fromOptions = await page.send("Runtime.evaluate", {
    expression: "chrome.runtime.sendMessage({ type: 'FACTIT_ANALYZE', article: {} }).then(r => r === undefined ? 'ignored' : 'ANSWERED').catch(() => 'ignored')",
    awaitPromise: true, returnByValue: true,
  });
  check(fromOptions.result?.result?.value === "ignored", "extension page cannot submit analysis", fromOptions.result?.result?.value);

  // 7b. Full round trip from the content script with the fake provider configured.
  await page.send("Runtime.evaluate", {
    expression: `chrome.storage.local.set({ settings: { provider: "openai-compatible", apiKey: "sk-smoke-test-key-0000", model: "fake-model", baseUrl: "http://127.0.0.1:${WEB_PORT}/v1", inputPricePerM: "2", outputPricePerM: "10" } })`,
    awaitPromise: true,
  });
  await page.send("Page.navigate", { url: `http://127.0.0.1:${WEB_PORT}/` });
  await sleep(800);
  // 8a. Bar is idle and no provider call has happened just from loading the page.
  const callsBefore = providerCalls.length;
  const idleState = await page.send("Runtime.evaluate", {
    expression: "document.getElementById('factit-bar-host')?.dataset.factitState",
    returnByValue: true,
  });
  check(idleState.result?.result?.value === "idle", "bar idle on article load", idleState.result?.result?.value);

  // Toolbar click (from the worker, like chrome.action.onClicked) must NOT analyze.
  const worker = await connect((await listTargets()).find((t) => t.type === "service_worker" && t.url.endsWith("/background/service-worker.js")).webSocketDebuggerUrl);
  const toggleExpr = `chrome.tabs.query({ active: true }).then((tabs) => chrome.tabs.sendMessage(tabs[0].id, { type: "FACTIT_TOGGLE" }))`;
  const toggled = await worker.send("Runtime.evaluate", { expression: toggleExpr, awaitPromise: true, returnByValue: true });
  await sleep(300);
  check(providerCalls.length === callsBefore && toggled.result?.result?.value?.state === "idle", "toolbar click shows the bar without analyzing", JSON.stringify(toggled.result?.result?.value));

  // Only a real click on the bar's Analyze button runs the analysis.
  const clicked = await clickShadowButton(page, "Analyze");
  await waitFor(() => consoleText().some((l) => l.startsWith("[Fact It] analysis result:")), { tries: 50 });
  const analyzed = { result: { result: { value: clicked ? { ok: true, clicked: true } : undefined } } };
  const resultLine = consoleText().find((l) => l.startsWith("[Fact It] analysis (AI_PRELIMINARY)"));
  check(
    Boolean(analyzed.result.result.value) && Boolean(resultLine) && /article_support=0\.6 /.test(resultLine) && /claims=2 /.test(resultLine) && /fake-model/.test(resultLine),
    "analysis round trip via Analyze click",
    resultLine || "no result line in console",
  );
  const analysisCall = providerCalls.find((c) => c.body.messages.some((m) => m.content.includes("Article to analyze")));
  check(Boolean(analysisCall) && analysisCall.body.messages[0].role === "system" && analysisCall.body.messages[1].content.includes("City council approves"),
    "article sent as data in the user turn, instructions in system");
  check(providerCalls.length === callsBefore + 1, "exactly one provider call, caused by the Analyze click", `${providerCalls.length - callsBefore}`);

  // A second toolbar click toggles the panel, and clicking Analyze/bar again
  // cannot re-run: still exactly one provider call.
  const toggled2 = await worker.send("Runtime.evaluate", { expression: toggleExpr, awaitPromise: true, returnByValue: true });
  await sleep(200);
  const toggled3 = await worker.send("Runtime.evaluate", { expression: toggleExpr, awaitPromise: true, returnByValue: true });
  await sleep(200);
  const analyzeStillThere = await clickShadowButton(page, "Analyze");
  await sleep(500);
  check(
    providerCalls.length === callsBefore + 1 && toggled2.result?.result?.value?.panel === "open" && toggled3.result?.result?.value?.panel === "closed" && analyzeStillThere === false,
    "repeated toolbar clicks toggle the panel and never re-run",
    `calls=${providerCalls.length - callsBefore} panel=${toggled2.result?.result?.value?.panel}/${toggled3.result?.result?.value?.panel} analyzeButton=${analyzeStillThere}`,
  );
  worker.close();

  // 8b. Bar shows the result; page scripts cannot read inside it.
  const barAfter = await page.send("Runtime.evaluate", {
    expression: "(h => ({ state: h?.dataset.factitState, shadow: h?.shadowRoot === null }))(document.getElementById('factit-bar-host'))",
    returnByValue: true,
  });
  check(barAfter.result?.result?.value?.state === "result" && barAfter.result?.result?.value?.shadow === true, "bar shows result in a closed shadow root", JSON.stringify(barAfter.result?.result?.value));

  // 9. Real click on "Details": the Summary opens first (level 2), then a
  // real click on "Detailed analysis" shows the tabs (level 3).
  const detailsButton = await clickShadowButton(page, "Details");
  await sleep(200);
  const summaryText = detailsButton ? await shadowText(page, "panel") : "";
  const viewAfterDetails = await page.send("Runtime.evaluate", { expression: "document.getElementById('factit-bar-host')?.dataset.factitView", returnByValue: true });
  check(
    viewAfterDetails.result?.result?.value === "summary" && /AI PRELIMINARY · NO EXTERNAL VERIFICATION PERFORMED/.test(summaryText) &&
      /Key findings/.test(summaryText) && /supported within article/.test(summaryText) && !/Evidence type/.test(summaryText),
    "Details opens a concise Summary first", `view=${viewAfterDetails.result?.result?.value} chars=${summaryText.length}`,
  );
  if (process.env.FACTIT_SHOT) {
    const shot = await page.send("Page.captureScreenshot", { format: "png" });
    (await import("node:fs")).writeFileSync(process.env.FACTIT_SHOT.replace(/\.png$/, "-summary.png"), Buffer.from(shot.result.data, "base64"));
  }
  const detailed = await clickShadowButton(page, "Detailed analysis");
  await sleep(200);
  const claimsTab = detailed && await clickShadowButton(page, "Claims");
  await sleep(200);
  const panelText = claimsTab ? await shadowText(page, "panel") : "";
  const viewAfterClaims = await page.send("Runtime.evaluate", { expression: "document.getElementById('factit-bar-host')?.dataset.factitView", returnByValue: true });
  check(
    viewAfterClaims.result?.result?.value === "detail:claims" && /Claims \(2\)/.test(panelText) && /The city council voted 7-2/.test(panelText) &&
      /Needs external verification/.test(panelText) && /Supported within article/.test(panelText) && /Overview.*Claims.*Evidence.*Framing.*About/.test(panelText),
    "Detailed analysis shows tabs and structured claims", `view=${viewAfterClaims.result?.result?.value}`,
  );
  const panelState = await page.send("Runtime.evaluate", { expression: "document.getElementById('factit-bar-host')?.dataset.factitPanel", returnByValue: true });
  check(
    Boolean(detailsButton) && panelState.result?.result?.value === "open",
    "panel is open in a closed shadow root after the clicks",
    detailsButton ? `panel=${panelState.result?.result?.value}` : "Details button not found",
  );
  if (process.env.FACTIT_SHOT) {
    const shot = await page.send("Page.captureScreenshot", { format: "png" });
    (await import("node:fs")).writeFileSync(process.env.FACTIT_SHOT, Buffer.from(shot.result.data, "base64"));
  }

  // 10. Cache: reload the same article -> result from cache, zero calls.
  const callsBeforeReload = providerCalls.length;
  page.events.length = 0;
  await page.send("Page.navigate", { url: `http://127.0.0.1:${WEB_PORT}/` });
  await waitFor(() => consoleText().some((l) => l.startsWith("[Fact It] cached analysis found")), { tries: 30 });
  const cachedState = await page.send("Runtime.evaluate", { expression: "document.getElementById('factit-bar-host')?.dataset.factitState", returnByValue: true });
  check(cachedState.result?.result?.value === "result" && providerCalls.length === callsBeforeReload,
    "reload shows cached result with zero provider calls", `state=${cachedState.result?.result?.value} calls=${providerCalls.length - callsBeforeReload}`);
  const barText = await shadowText(page, "bar");
  check(/from cache/.test(barText) && /Article support: 60%/.test(barText) && /1 needs review/.test(barText), "bar marks the result as cached and shows the article-support signal", barText.slice(0, 140));

  // Re-analyze from the panel: exactly one new call, result refreshed.
  await clickShadowButton(page, "Details");
  await sleep(200);
  const reran = await clickShadowButton(page, "Re-analyze (uses tokens)");
  await waitFor(() => consoleText().some((l) => l.includes("analysis requested (re-analyze)")), { tries: 20 });
  await waitFor(() => consoleText().filter((l) => l.startsWith("[Fact It] analysis result:")).length >= 1, { tries: 50 });
  await sleep(300);
  const barAfterRerun = await shadowText(page, "bar");
  check(reran && providerCalls.length === callsBeforeReload + 1 && !/from cache/.test(barAfterRerun),
    "Re-analyze makes exactly one provider call and replaces the cached result", `calls=${providerCalls.length - callsBeforeReload}`);

  // Settings page reports and clears the cache.
  await page.send("Page.navigate", { url: `chrome-extension://${extensionId}/options/options.html` });
  await sleep(600);
  const cacheUi = await page.send("Runtime.evaluate", {
    expression: `(async () => {
      const before = document.getElementById("cacheCount").textContent;
      document.getElementById("clearCache").click();
      await new Promise((r) => setTimeout(r, 400));
      return { before, after: document.getElementById("cacheCount").textContent, status: document.getElementById("cacheStatus").textContent };
    })()`,
    awaitPromise: true, returnByValue: true,
  });
  const usageUi = await page.send("Runtime.evaluate", { expression: "document.getElementById('usageTotals').textContent", returnByValue: true });
  check(/^3 requests since .*: 15 input \+ 3 output tokens, estimated \$0\.0001/.test(usageUi.result?.result?.value || ""), "settings page shows usage totals", usageUi.result?.result?.value);
  const cu = cacheUi.result?.result?.value || {};
  check(/^1 cached analysis\./.test(cu.before) && /^0 cached analyses\./.test(cu.after) && /Removed 1 cached analysis\./.test(cu.status),
    "settings page shows and clears the cache", JSON.stringify(cu));

  // 8c. No bar on a page without an article.
  await page.send("Page.navigate", { url: `http://127.0.0.1:${WEB_PORT}/plain` });
  await sleep(800);
  const plain = await page.send("Runtime.evaluate", { expression: "document.getElementById('factit-bar-host') === null", returnByValue: true });
  check(plain.result?.result?.value === true, "no bar on non-article page");

  await page.send("Runtime.evaluate", { expression: "chrome.storage.local.remove('settings')", awaitPromise: true });

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
