// Browser smoke test for the extension shell.
//
// Loads the unpacked extension into headless Chromium and checks that:
//   1. Chrome accepts the manifest (the service worker target appears)
//   2. the content script executes on a normal http page
//   3. the content script can reach the service worker
//   4. the settings page opens
//
// Requires a Chromium binary that honours --load-extension. Branded Google
// Chrome (137+) silently ignores that flag, so this defaults to `chromium`.
// Override with FACTIT_BROWSER=/path/to/chromium.
//
// Run: npm run test:smoke

import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const EXTENSION_DIR = new URL("../../extension/", import.meta.url).pathname;
const BROWSER = process.env.FACTIT_BROWSER || "chromium";
const CDP_PORT = 9333;
const WEB_PORT = 8765;

const PAGE_HTML = "<!DOCTYPE html><html><head><title>Fact It smoke page</title></head><body><p>A normal webpage.</p></body></html>";

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
const web = createServer((_, res) => { res.setHeader("content-type", "text/html"); res.end(PAGE_HTML); }).listen(WEB_PORT);

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
  const consoleText = () => page.events
    .filter((e) => e.method === "Runtime.consoleAPICalled")
    .map((e) => e.params.args.map((a) => a.value ?? a.description ?? "").join(" "));
  await waitFor(() => consoleText().some((l) => l.includes("service worker responded")), { tries: 25 });
  const logs = consoleText();
  check(logs.some((l) => l.includes("[Fact It] content script loaded")), "content script executed on http page");
  check(logs.some((l) => l.includes("[Fact It] service worker responded")), "content script reached service worker");

  // 4. Settings page opens.
  await page.send("Page.navigate", { url: `chrome-extension://${extensionId}/options/options.html` });
  await sleep(500);
  const evaluated = await page.send("Runtime.evaluate", {
    expression: "document.title + ' | version=' + document.getElementById('version').textContent",
    returnByValue: true,
  });
  const value = evaluated.result?.result?.value ?? "";
  check(value.includes("Fact It") && /version=\d/.test(value), "settings page opens", value);

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
