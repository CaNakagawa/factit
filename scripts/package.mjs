// Builds dist/factit-<version>.zip from extension/ for "Load unpacked" users
// and for a store upload. Runs the unit tests first; refuses to package a
// tree that fails them.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../", import.meta.url).pathname;
const manifest = JSON.parse(readFileSync(join(root, "extension/manifest.json"), "utf8"));
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
if (manifest.version !== pkg.version) {
  console.error(`Version mismatch: manifest ${manifest.version} vs package.json ${pkg.version}`);
  process.exit(1);
}

console.log("Running unit tests…");
execFileSync("npm", ["test"], { cwd: root, stdio: "inherit" });

const dist = join(root, "dist");
mkdirSync(dist, { recursive: true });
const out = join(dist, `factit-${manifest.version}.zip`);
if (existsSync(out)) rmSync(out);

// Zip the *contents* of extension/ so manifest.json sits at the archive root.
execFileSync("zip", ["-r", "-X", "-q", out, ".", "-x", "*.DS_Store", "-x", "__MACOSX/*"], { cwd: join(root, "extension"), stdio: "inherit" });
const listing = execFileSync("unzip", ["-l", out], { encoding: "utf8" });
console.log(listing.split("\n").slice(-3).join("\n"));
console.log(`\nPackaged ${out}`);
