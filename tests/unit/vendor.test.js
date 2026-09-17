// The extension ships a committed copy of Readability. It must match the
// pinned devDependency exactly so `npm run vendor` is the only way it changes.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

for (const file of ["Readability.js", "Readability-readerable.js", "LICENSE.md"]) {
  test(`extension/vendor/${file} matches @mozilla/readability`, () => {
    const vendored = readFileSync(new URL(`../../extension/vendor/${file}`, import.meta.url), "utf8");
    const upstream = readFileSync(new URL(`../../node_modules/@mozilla/readability/${file}`, import.meta.url), "utf8");
    assert.equal(vendored, upstream);
  });
}
