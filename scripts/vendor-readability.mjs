// Copies Mozilla Readability from the pinned devDependency into
// extension/vendor/. The extension has no build step, so the files are
// committed. tests/unit/vendor.test.js fails if they drift from node_modules.
//
// Run: npm run vendor

import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../", import.meta.url).pathname;
const src = join(root, "node_modules/@mozilla/readability");
const dest = join(root, "extension/vendor");

const { version } = JSON.parse(readFileSync(join(src, "package.json"), "utf8"));

mkdirSync(dest, { recursive: true });
for (const file of ["Readability.js", "Readability-readerable.js", "LICENSE.md"]) {
  copyFileSync(join(src, file), join(dest, file));
  console.log(`vendored ${file} (@mozilla/readability@${version})`);
}
