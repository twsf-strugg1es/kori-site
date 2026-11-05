/** One-off: bisect the phantom vertical line near the canvas right edge. */
import { chromium } from "playwright-core";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const root = join(dir, "..");
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const MIME = { ".html": "text/html", ".png": "image/png", ".jpg": "image/jpeg", ".css": "text/css", ".js": "text/javascript" };

const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p.endsWith("/")) p += "index.html";
    const { extname } = await import("node:path");
    const file = join(root, p);
    const d = await readFile(file);
    res.writeHead(200, { "content-type": MIME[extname(file)] || "text/plain" });
    res.end(d);
  } catch { res.writeHead(404); res.end("no"); }
});
await new Promise((r) => server.listen(4519, r));

const b = await chromium.launch({ executablePath: EDGE, headless: true });
const pg = await b.newPage();
await pg.goto("http://localhost:4519/", { waitUntil: "load" });
await pg.waitForTimeout(2500);
await pg.$eval(".h-frame", (el) => el.scrollIntoView({ block: "center" }));
await pg.mouse.move(901, 420, { steps: 8 });
await pg.waitForTimeout(1600);

const clip = { x: 1040, y: 0, width: 240, height: 800 };
await pg.screenshot({ path: "lab/line-1-base.png", clip });

await pg.evaluate(() => { document.getElementById("hands").style.visibility = "hidden"; });
await pg.screenshot({ path: "lab/line-2-nocanvas.png", clip });
await pg.evaluate(() => { document.getElementById("hands").style.visibility = ""; });

await pg.evaluate(() => { const g = document.getElementById("glow"); g.style.visibility = "hidden"; });
await pg.screenshot({ path: "lab/line-3-noglow.png", clip });
await pg.evaluate(() => { const g = document.getElementById("glow"); g.style.visibility = ""; });

await pg.evaluate(() => { document.getElementById("field").style.visibility = "hidden"; });
await pg.screenshot({ path: "lab/line-4-nofield.png", clip });

console.log("shots saved");
await b.close();
server.close();
