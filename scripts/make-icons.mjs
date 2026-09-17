// Renders extension/icons/icon-{16,32,48,128}.png from an inline SVG using
// headless Chromium (the same dependency the smoke test has). Run once and
// commit the PNGs: `npm run icons`.

import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BROWSER = process.env.FACTIT_BROWSER || "chromium";
const SIZES = [16, 32, 48, 128];
const OUT_DIR = new URL("../extension/icons/", import.meta.url).pathname;
const PORT = 8768;
const CDP = 9338;

// Dark tile, bold "F", and the three-band support meter used by the bar.
const svg = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="26" fill="#1f2933"/>
  <text x="18" y="86" font-family="system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif" font-size="78" font-weight="800" fill="#f5f7fa">F</text>
  <rect x="70" y="42" width="40" height="10" rx="5" fill="#3b82f6"/>
  <rect x="70" y="60" width="30" height="10" rx="5" fill="#f59e0b"/>
  <rect x="70" y="78" width="20" height="10" rx="5" fill="#ef4444"/>
</svg>`;

const page = (size) => `<!DOCTYPE html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:transparent}</style></head><body>${svg(size)}</body></html>`;

const server = createServer((req, res) => {
  const size = Number(new URL(req.url, "http://x").searchParams.get("size")) || 128;
  res.setHeader("content-type", "text/html");
  res.end(page(size));
}).listen(PORT);

const profile = mkdtempSync(join(tmpdir(), "factit-icons-"));
const browser = spawn(BROWSER, ["--headless=new", "--hide-scrollbars", `--user-data-dir=${profile}`, `--remote-debugging-port=${CDP}`, "--no-first-run", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const list = async () => (await fetch(`http://127.0.0.1:${CDP}/json/list`)).json();
async function cdp(url) {
  const ws = new WebSocket(url); await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const pending = new Map();
  ws.onmessage = ({ data }) => { const m = JSON.parse(data); if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
  return { send: (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); }) };
}

try {
  let targets; for (let i = 0; i < 50 && !targets; i++) { try { targets = await list(); } catch { await sleep(200); } }
  const tab = await cdp(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
  await tab.send("Emulation.setDefaultBackgroundColorOverride", { color: { r: 0, g: 0, b: 0, a: 0 } });
  mkdirSync(OUT_DIR, { recursive: true });
  for (const size of SIZES) {
    await tab.send("Emulation.setDeviceMetricsOverride", { width: size, height: size, deviceScaleFactor: 1, mobile: false });
    await tab.send("Page.navigate", { url: `http://127.0.0.1:${PORT}/?size=${size}` });
    await sleep(400);
    const shot = await tab.send("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: size, height: size, scale: 1 }, captureBeyondViewport: true });
    writeFileSync(join(OUT_DIR, `icon-${size}.png`), Buffer.from(shot.result.data, "base64"));
    console.log(`wrote icon-${size}.png`);
  }
} finally {
  try { const { webSocketDebuggerUrl } = await (await fetch(`http://127.0.0.1:${CDP}/json/version`)).json(); await (await cdp(webSocketDebuggerUrl)).send("Browser.close"); } catch { try { browser.kill(); } catch {} }
  await sleep(300);
  server.close();
  rmSync(profile, { recursive: true, force: true });
}
