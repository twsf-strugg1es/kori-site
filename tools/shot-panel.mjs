/** Screenshot just the hands panel at desktop + mobile. */
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { chromium } from "playwright-core";

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const html = readFileSync("W:/antigravity/index.html", "utf8");
const server = createServer((req, res) => {
  if (req.url === "/") { res.writeHead(200, { "content-type": "text/html" }); res.end(html); return; }
  res.writeHead(404); res.end();
});
await new Promise((r) => server.listen(4521, r));

const b = await chromium.launch({ executablePath: EDGE, headless: true });
for (const [name, vp] of [["desktop", { width: 1280, height: 800 }], ["mobile", { width: 390, height: 844 }]]) {
  const pg = await b.newPage({ viewport: vp, deviceScaleFactor: 2 });
  await pg.goto("http://localhost:4521/", { waitUntil: "networkidle" });
  await pg.evaluate(() => document.fonts.ready);
  await pg.waitForTimeout(900);
  const el = await pg.$(".hands");
  await el.scrollIntoViewIfNeeded();
  await pg.waitForTimeout(600);
  await el.screenshot({ path: `lab/panel-${name}.png` });
  const box = await el.boundingBox();
  console.log(name, JSON.stringify(box));
  await pg.close();
}
await b.close();
server.close();
