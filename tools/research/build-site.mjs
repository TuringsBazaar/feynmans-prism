import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Store } from "./store.mjs";
import { buildView } from "./view.mjs";

const database = fileURLToPath(new URL("../outputs/credit-assignment-passages.sqlite", import.meta.url));
const directory = new URL("../outputs/prism-site/", import.meta.url);
const store = new Store(database, { readOnly: true });
try {
  const html = buildView(store);
  mkdirSync(directory, { recursive: true });
  writeFileSync(new URL("index.html", directory), html);
  console.log(`Built ${fileURLToPath(new URL("index.html", directory))} (${Buffer.byteLength(html)} bytes)`);
} finally {
  store.close();
}
