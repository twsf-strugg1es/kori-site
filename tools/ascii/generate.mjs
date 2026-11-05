/**
 * Kori — ASCII hands generator v6 (engraved hands).
 * Samples the Creation of Adam hand detail (public domain, Wikimedia Commons)
 * tight on the two hands. A closed skin silhouette in directional glyphs holds
 * the shape, long interior creases describe the fingers, and a gamma-graded
 * luminance fill gives the hands body without saturating them into blobs.
 * Splits at the fingertip gap into LEFT/RIGHT halves for runtime animation.
 *
 * Output: kori-ascii.txt (preview), kori-ascii.js (snippet)
 */
import Jimp from "jimp";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));

// ---- Tuning ----------------------------------------------------------------
const SRC = process.argv[2] ? path.resolve(process.argv[2]) : path.join(dir, "adam.jpg");
const COLS = 143;
const SRC_CROP = { x: 460, y: 250, w: 470, h: 280 };
const CELL_ASPECT = 0.6;   // monospace char width ≈ 0.6 * font-size
const FILL_BLUR = 3;       // blur passes on luminance for the tonal fill
const FILL_GAMMA = 1.4;    // >1 compresses highlights so lit skin keeps form
const EDGE_PCT = 0.87;     // keep structural edges (knuckles, finger gaps)
const EDGE_MIN = 6;        // drop tiny edge fragments
const MIN_SKIN = 80;       // drop mask components smaller than this (cracks)

// ---- Load ------------------------------------------------------------------
const img = await Jimp.read(SRC);
const { width: IW, data } = img.bitmap;

const ROWS = Math.round(COLS * (SRC_CROP.h / SRC_CROP.w) * CELL_ASPECT);

/** average luminance + skin-warmth mask per cell */
function sampleGrid(crop, cols, rows) {
  const L = new Float32Array(cols * rows);
  const M = new Float32Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    const y0 = crop.y + Math.floor((r * crop.h) / rows);
    const y1 = crop.y + Math.floor(((r + 1) * crop.h) / rows);
    for (let c = 0; c < cols; c++) {
      const x0 = crop.x + Math.floor((c * crop.w) / cols);
      const x1 = crop.x + Math.floor(((c + 1) * crop.w) / cols);
      let sl = 0, sw = 0, n = 0;
      for (let y = y0; y < y1; y += 2)
        for (let x = x0; x < x1; x += 2) {
          const i = (y * IW + x) * 4;
          sl += data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
          sw += data[i] - data[i + 2];
          n++;
        }
      const k = r * cols + c;
      L[k] = sl / n;
      // plaster r-b ≤ ~14, skin r-b ≥ ~24
      M[k] = Math.max(0, Math.min(1, (sw / n - 14) / 12));
    }
  }
  return { L, M };
}

const AX = 1 / CELL_ASPECT; // display cells are narrower than tall

function blur(F, cols, rows, passes = 1) {
  let src = F;
  const at = (r, c) =>
    src[Math.min(rows - 1, Math.max(0, r)) * cols + Math.min(cols - 1, Math.max(0, c))];
  for (let p = 0; p < passes; p++) {
    const dst = new Float32Array(F.length);
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        dst[r * cols + c] =
          (at(r - 1, c - 1) + 2 * at(r - 1, c) + at(r - 1, c + 1) +
            2 * at(r, c - 1) + 4 * at(r, c) + 2 * at(r, c + 1) +
            at(r + 1, c - 1) + 2 * at(r + 1, c) + at(r + 1, c + 1)) / 16;
    src = dst;
  }
  return src;
}

function sobel(F, cols, rows, sx = 1) {
  const gx = new Float32Array(cols * rows);
  const gy = new Float32Array(cols * rows);
  const at = (r, c) =>
    F[Math.min(rows - 1, Math.max(0, r)) * cols + Math.min(cols - 1, Math.max(0, c))];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      gx[r * cols + c] =
        ((at(r - 1, c + 1) + 2 * at(r, c + 1) + at(r + 1, c + 1)) -
          (at(r - 1, c - 1) + 2 * at(r, c - 1) + at(r + 1, c - 1))) * sx;
      gy[r * cols + c] =
        (at(r + 1, c - 1) + 2 * at(r + 1, c) + at(r + 1, c + 1)) -
        (at(r - 1, c - 1) + 2 * at(r - 1, c) + at(r - 1, c + 1));
    }
  return { gx, gy };
}

/** pick a directional glyph from the edge normal */
function glyph(gx, gy) {
  const ax = Math.abs(gx), ay = Math.abs(gy);
  if (ax > ay * 1.7) return "|";
  if (ay > ax * 1.7) return "-";
  return gx * gy > 0 ? "/" : "\\";
}

/** drop connected components smaller than minSize */
function filterComponents(mask, cols, rows, minSize) {
  const seen = new Uint8Array(cols * rows);
  const keep = new Uint8Array(cols * rows);
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i] || seen[i]) continue;
    const comp = [], stack = [i];
    seen[i] = 1;
    while (stack.length) {
      const j = stack.pop();
      comp.push(j);
      const r = (j / cols) | 0, c = j % cols;
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          const rr = r + dr, cc = c + dc;
          if (rr < 0 || rr >= rows || cc < 0 || cc >= cols) continue;
          const k = rr * cols + cc;
          if (mask[k] && !seen[k]) { seen[k] = 1; stack.push(k); }
        }
    }
    if (comp.length >= minSize) for (const j of comp) keep[j] = 1;
  }
  return keep;
}

// ---- Sample + skin mask ----------------------------------------------------
const { L, M: M0 } = sampleGrid(SRC_CROP, COLS, ROWS);
const M = filterComponents(
  Float32Array.from(M0, (v) => (v >= 0.5 ? 1 : 0)),
  COLS,
  ROWS,
  MIN_SKIN
);
const Mb = blur(M, COLS, ROWS, 1);
const Lb = blur(L, COLS, ROWS, FILL_BLUR);
const ms = sobel(M0, COLS, ROWS, AX);

// ---- Silhouette: interior cells only, so the crop edges stay open ----------
const bound = new Uint8Array(COLS * ROWS);
for (let r = 1; r < ROWS - 1; r++)
  for (let c = 1; c < COLS - 1; c++) {
    const i = r * COLS + c;
    if (!M[i]) continue;
    const nb = [M[i - COLS], M[i + COLS], M[i - 1], M[i + 1]];
    if (nb.some((v) => !v)) bound[i] = 1;
  }

// ---- Structural edges (knuckles, finger separations) -----------------------
const lg = sobel(Lb, COLS, ROWS, AX);
const gmag = Float32Array.from(lg.gx, (_, i) => Math.hypot(lg.gx[i], lg.gy[i]));

const vals = [];
for (let i = 0; i < gmag.length; i++) if (M[i] && !bound[i]) vals.push(gmag[i]);
vals.sort((a, b) => a - b);
const thr = vals[Math.floor(vals.length * EDGE_PCT)] || 0;

let em = new Uint8Array(COLS * ROWS);
for (let i = 0; i < gmag.length; i++)
  if (M[i] && !bound[i] && gmag[i] > thr) em[i] = 1;
em = filterComponents(em, COLS, ROWS, EDGE_MIN);

const edge = [];
for (let r = 0; r < ROWS; r++) {
  const row = [];
  for (let c = 0; c < COLS; c++) {
    const i = r * COLS + c;
    row.push(em[i] ? glyph(lg.gx[i], lg.gy[i]) : " ");
  }
  edge.push(row);
}

// ---- Fill levels ------------------------------------------------------------
const ls = [];
for (let i = 0; i < Lb.length; i++) if (Mb[i] > 0.5) ls.push(Lb[i]);
ls.sort((a, b) => a - b);
const lo = ls[Math.floor(ls.length * 0.04)], hiV = ls[Math.floor(ls.length * 0.96)];
const RAMP = " .:;=+*#%@";

// ---- Compose ----------------------------------------------------------------
const grid = [];
for (let r = 0; r < ROWS; r++) {
  let line = "";
  for (let c = 0; c < COLS; c++) {
    const i = r * COLS + c;
    if (bound[i]) { line += glyph(ms.gx[i], ms.gy[i]); continue; }
    if (!M[i]) { line += " "; continue; }
    if (edge[r][c] !== " ") { line += edge[r][c]; continue; }
    const t = Math.max(0, Math.min(1, (Lb[i] - lo) / (hiV - lo)));
    const k = Math.max(1, Math.min(9, Math.round(Math.pow(t, FILL_GAMMA) * 9)));
    line += RAMP[k];
  }
  grid.push(line.replace(/\s+$/, ""));
}

// ---- Split at the fingertip gap --------------------------------------------
const counts = new Array(COLS).fill(0);
for (const line of grid)
  for (let c = 0; c < line.length; c++) if (line[c] !== " ") counts[c]++;

const winLo = Math.floor(COLS * 0.35), winHi = Math.ceil(COLS * 0.65);
let best = { start: -1, len: 0 }, runStart = -1;
for (let c = winLo; c <= winHi; c++) {
  if (counts[c] <= 1) {
    if (runStart < 0) runStart = c;
  } else if (runStart >= 0) {
    const len = c - runStart;
    if (len > best.len) best = { start: runStart, len };
    runStart = -1;
  }
}
let SPLIT_COL;
if (best.len > 0) SPLIT_COL = Math.round(best.start + best.len / 2);
else {
  let minC = winLo;
  for (let c = winLo; c <= winHi; c++) if (counts[c] < counts[minC]) minC = c;
  SPLIT_COL = minC;
}

// ---- Section preview -------------------------------------------------------
writeFileSync(path.join(dir, "kori-ascii.txt"), grid.join("\n"));

// ---- Emit runtime snippet --------------------------------------------------
const left = grid.map((line) => line.slice(0, SPLIT_COL));
const right = grid.map((line) => line.slice(SPLIT_COL));
const q = (s) => JSON.stringify(s);
const snippet =
  `/* ASCII hands sampled from Michelangelo, Creation of Adam (public domain, Wikimedia Commons) */\n` +
  `const KORI_HANDS = {\n  rows: ${ROWS}, cols: ${COLS}, splitCol: ${SPLIT_COL},\n` +
  `  static: [\n    ${grid.map(q).join(",\n    ")}\n  ],\n` +
  `  left: [\n    ${left.map(q).join(",\n    ")}\n  ],\n` +
  `  right: [\n    ${right.map(q).join(",\n    ")}\n  ]\n};\n`;
writeFileSync(path.join(dir, "kori-ascii.js"), snippet);
console.log(
  `grid ${COLS}x${ROWS}, split ${SPLIT_COL} (gap ${best.len} cols), snippet ${(snippet.length / 1024).toFixed(1)} KB`
);
