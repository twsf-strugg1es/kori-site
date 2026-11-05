/** One-off: probe the hands canvas for stray columns + brightness stats. */
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
await pg.waitForTimeout(1800);
const r = await pg.evaluate(() => {
  const c = document.getElementById("hands");
  const x = c.getContext("2d");
  const W = c.width, H = c.height;
  const res = { W, H };
  /* brightness histogram across the whole bitmap */
  let sum = 0, lit = 0, total = 0;
  const step = 6;
  for (let yy = 0; yy < H; yy += step) for (let xx = 0; xx < W; xx += step) {
    const a = x.getImageData(xx, yy, 1, 1).data[3];
    total++; sum += a; if (a > 8) lit++;
  }
  res.meanAlpha = +(sum / total / 255).toFixed(3);
  res.litFrac = +(lit / total).toFixed(3);
  return res;
});
console.log(JSON.stringify(r, null, 1));
await pg.$eval("#hands", (el) => el.screenshot ? el : el).catch(() => {});
const shot = await pg.$("#hands");
if (shot) await shot.screenshot({ path: "lab/hands-canvas.png" });
console.log("saved lab/hands-canvas.png");
await b.close();
server.close();
