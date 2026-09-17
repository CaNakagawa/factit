// Guards the V0.1 acceptance criteria that can be checked statically:
// valid MV3 manifest, minimal permissions, and every referenced file present.

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const EXTENSION_DIR = new URL("../../extension/", import.meta.url).pathname;
const manifest = JSON.parse(readFileSync(join(EXTENSION_DIR, "manifest.json"), "utf8"));

// Any addition here must be justified in docs/DEVELOPMENT.md (see SECURITY.md).
const ALLOWED_PERMISSIONS = ["storage"]; // provider settings + API key (V0.4)

test("manifest is Manifest V3 with required fields", () => {
  assert.equal(manifest.manifest_version, 3);
  assert.equal(typeof manifest.name, "string");
  assert.match(manifest.version, /^\d+(\.\d+){1,3}$/);
});

test("manifest requests only documented permissions", () => {
  const permissions = manifest.permissions ?? [];
  const undocumented = permissions.filter((p) => !ALLOWED_PERMISSIONS.includes(p));
  assert.deepEqual(undocumented, []);
  assert.equal(manifest.host_permissions, undefined);
  assert.equal(manifest.optional_permissions, undefined);
});

test("content script matches only http and https pages", () => {
  assert.equal(manifest.content_scripts.length, 1);
  assert.deepEqual(manifest.content_scripts[0].matches, ["http://*/*", "https://*/*"]);
});

test("every file referenced by the manifest exists", () => {
  const referenced = [
    manifest.background.service_worker,
    manifest.options_ui.page,
    ...manifest.content_scripts.flatMap((cs) => [...(cs.js ?? []), ...(cs.css ?? [])]),
    ...Object.values(manifest.icons ?? {}),
    ...Object.values(manifest.action?.default_icon ?? {}),
  ];
  for (const file of referenced) {
    assert.ok(existsSync(join(EXTENSION_DIR, file)), `missing ${file}`);
  }
});

test("settings page does not use inline scripts", () => {
  const html = readFileSync(join(EXTENSION_DIR, manifest.options_ui.page), "utf8");
  assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/i);
  assert.doesNotMatch(html, /\son\w+\s*=/i);
});

test("release metadata: icons at every size, store-length description, versions in sync", () => {
  assert.deepEqual(Object.keys(manifest.icons), ["16", "32", "48", "128"]);
  assert.ok(manifest.description.length <= 132, "Chrome Web Store caps the description at 132 characters");
  assert.equal(typeof manifest.action.default_title, "string");
  const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
  assert.equal(pkg.version, manifest.version);
});
