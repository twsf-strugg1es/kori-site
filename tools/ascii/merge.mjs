/**
 * Merge template + generated ASCII snippet into the single deliverable.
 * Output: ../../index.html (workspace root, self-contained).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const template = readFileSync(path.join(dir, "..", "index.template.html"), "utf8");
const snippet = readFileSync(path.join(dir, "kori-ascii.js"), "utf8").trim();
const txt = readFileSync(path.join(dir, "kori-ascii.txt"), "utf8");

const escHtml = (s) => s.replace(/&/g, "&amp;");
const out = template
  .replace("/*__KORI_HANDS__*/", () => snippet)
  .replace("__KORI_STATIC__", () => escHtml(txt));

if (out.includes("__KORI")) throw new Error("placeholder survived");
writeFileSync(path.join(dir, "..", "..", "index.html"), out, "utf8");
console.log("wrote index.html", (out.length / 1024).toFixed(1), "KB");
