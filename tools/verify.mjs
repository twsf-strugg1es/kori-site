/**
 * Kori verification rig.
 * Serves the workspace root, scrolls the page through positions, and
 * captures: desktop strip, mobile strip, reduced-motion strip, and a
 * no-JS check. Also logs console errors and page render facts.
 *
 * node verify.mjs [--only desktop|mobile|reduced|nojs]
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { chromium } from "playwright-core";

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = join(dir, "..");
const PORT = 4518;
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".png": "image/png", ".jpg": "image/jpeg", ".css": "text/css" };
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p === "/") p = "/index.html";
    const file = normalize(join(root, p));
    if (!file.startsWith(root)) throw new Error("traversal");
    const data = await readFile(file);
    res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404); res.end("no");
  }
});

const mode = ["desktop", "mobile", "reduced", "nojs", "probe"].find((n) => process.argv.includes(n)) || "";
const jobs = [
  { name: "desktop", w: 1280, h: 800, reduced: false, js: true },
  { name: "mobile", w: 390, h: 844, reduced: false, js: true },
  { name: "reduced", w: 1280, h: 800, reduced: true, js: true },
  { name: "nojs", w: 1280, h: 800, reduced: false, js: false },
  { name: "probe", w: 1280, h: 800, reduced: false, js: true }
].filter((j) => !mode || j.name === mode);

console.log("verify: booting, mode =", mode || "all");
await new Promise((r) => server.listen(PORT, r));
console.log("verify: serving on", PORT);

const browser = await chromium.launch({ executablePath: EDGE, headless: true });
console.log("verify: browser up");

async function shoot(job) {
  /* ---------- motion probe: cursor glow, ripple, magnet, spark ---------- */
  if (job.name === "probe") {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: "load" });
    await page.waitForTimeout(2400);
    console.log("probe facts:", await page.evaluate(() => {
      const c = document.getElementById("hands");
      const scene = document.querySelector(".hands-in");
      return { canvas: c.width + "x" + c.height, cssW: getComputedStyle(c).width, styleW: c.style.width, sceneW: scene.clientWidth, frameW: c.parentElement.clientWidth };
    }));
    await page.mouse.move(900, 420); await page.waitForTimeout(120);
    await page.mouse.move(901, 421); await page.waitForTimeout(700);
    await page.screenshot({ path: "lab/probe/a_glow_ripple.png" });

    const badge = await page.$(".badge");
    const b = await badge.boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: "lab/probe/b_magnet.png" });

    await page.$eval(".h-frame", (el) => el.scrollIntoView({ block: "center" }));
    await page.waitForTimeout(3600);
    await page.screenshot({ path: "lab/probe/c_reach.png" });
    await page.waitForTimeout(1200);                              /* tense -> near touch */
    await page.screenshot({ path: "lab/probe/d_tense.png" });
    await page.waitForTimeout(820);                               /* inside spark */
    await page.screenshot({ path: "lab/probe/e_spark.png" });
    await page.waitForTimeout(1500);                              /* breathe */
    await page.screenshot({ path: "lab/probe/f_breathe.png" });
    await page.waitForTimeout(2600);                              /* relax */
    await page.screenshot({ path: "lab/probe/g_relax.png" });
    console.log("=== probe done ===");
    await ctx.close();
    return;
  }

  const ctx = await browser.newContext({
    viewport: { width: job.w, height: job.h },
    deviceScaleFactor: 1,
    reducedMotion: job.reduced ? "reduce" : "no-preference",
    javaScriptEnabled: job.js
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: "load" });
  await page.waitForTimeout(job.js ? 2600 : 900);

  const facts = await page.evaluate(() => ({
    scrollH: document.documentElement.scrollHeight,
    innerH: innerHeight,
    canvHands: (() => { const c = document.getElementById("hands"); return c ? { w: c.width, h: c.height, vis: getComputedStyle(c).display } : null; })(),
    pre: (() => { const p = document.querySelector(".hands-pre"); return p ? getComputedStyle(p).display : "gone"; })(),
    gsap: typeof gsap !== "undefined",
    classes: document.documentElement.className,
    h1: document.querySelector("h1")?.textContent.replace(/\s+/g, " ").trim()
  })).catch((e) => ({ evalError: String(e) }));

  const footProbe = await page.evaluate(() => {
    const f = document.querySelector(".foot");
    if (!f) return { hasFoot: false };
    const cs = getComputedStyle(f);
    const k = f.querySelector(".k");
    const kr = k.getBoundingClientRect();
    const fr = f.getBoundingClientRect();
    return {
      hasFoot: true, dir: cs.flexDirection, justify: cs.justifyContent,
      ta: cs.textAlign, footW: Math.round(fr.width), footX: Math.round(fr.x),
      kX: Math.round(kr.x), kY: Math.round(kr.y), docW: document.documentElement.clientWidth
    };
  }).catch((e) => ({ probeErr: String(e) }));
  Object.assign(facts, footProbe);

  const scrollH = facts.scrollH || 4000;
  const stops = [0, 0.12, 0.25, 0.38, 0.5, 0.62, 0.75, 0.86, 1];
  for (let i = 0; i < stops.length; i++) {
    const frac = stops[i];
    const y = Math.min(scrollH - job.h + 2, Math.max(0, Math.round(scrollH * frac - job.h / 2)));
    await page.evaluate((yy) => { document.documentElement.scrollTop = yy; window.scrollTo(0, yy); }, y).catch(() => {});
    await page.waitForTimeout(job.js ? 1500 : 260);
    const name = `${String(i).padStart(2, "0")}_${String(Math.round(frac * 100)).padStart(3, "0")}`;
    await page.screenshot({ path: `lab/${job.name}/${name}.png` });
  }

  await page.screenshot({ path: `lab/${job.name}/full.png`, fullPage: true });

  console.log(`\n=== ${job.name} (${job.w}x${job.h}, js=${job.js}, rm=${job.reduced}) ===`);
  console.log("facts:", JSON.stringify(facts));
  console.log("console errors:", errors.length ? errors.slice(0, 6) : "none");
  await ctx.close();
}

try {
  for (const job of jobs) { console.log("verify: pass", job.name); await shoot(job); }
} catch (e) {
  console.log("verify: FAILED", e && e.stack || String(e));
} finally {
  server.close();
  await browser.close();
  console.log("verify: done");
}
