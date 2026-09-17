// Loads a classic (non-module) extension script into this Node process,
// the same way the browser evaluates it, so its globals can be tested.

import { readFileSync } from "node:fs";
import vm from "node:vm";

export function loadClassicScript(fileUrl) {
  const path = fileUrl instanceof URL ? fileUrl.pathname : fileUrl;
  vm.runInThisContext(readFileSync(path, "utf8"), { filename: path });
}
