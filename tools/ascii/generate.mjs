/**
 * Kori — ASCII hands generator v7 (five-level stipple engraving).
 * Samples the Creation of Adam hand detail (public domain, Wikimedia Commons)
 * tight on the two hands. A closed skin silhouette in directional glyphs holds
 * the shape, 2×-supersampled structural edges describe knuckles and creases,
 * and a five-level stipple fill (.:;+#) gives the hands body while keeping
 * interior form readable — never a solid bright blob.
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
const HX = 2;              // edge supersample factor
const FILL_BLUR = 5;       // blur passes on luminance for the tonal fill
const FILL_GAMMA = 0.9;    // <1 opens shadows so form reads within the ramp
const EDGE_PCT = 0.9;      // keep structural edges (knuckles, finger gaps)
const EDGE_MIN = 14;       // drop tiny edge fragments (at HX resolution)
const MIN_SKIN = 80;       // drop mask components smaller than this (cracks)
const RAMP = [".", ":", ";", "+", "#"]; // five stipple levels, dark → dense

// ---- Load ------------------------------------------------------------------
const img = await Jimp.read(SRC);
const { width: IW, data } = img.bitmap;

const ROWS = Math.round(COLS * (SRC_CROP.h / SRC_CROP.w) * CELL_ASPECT);

/** average luminance + skin-warmth mask per cell */
function sampleGrid(crop, cols, rows, step = 1) {
  const L = new Float32Array(cols * rows);
  const M = new Float32Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    const y0 = crop.y + Math.floor((r * crop.h) / rows);
    const y1 = crop.y + Math.floor(((r + 1) * crop.h) / rows);
    for (let c = 0; c < cols; c++) {
      const x0 = crop.x + Math.floor((c * crop.w) / cols);
      const x1 = crop.x + Math.floor(((c + 1) * crop.w) / cols);
      let sl = 0, sw = 0, n = 0;
      for (let y = y0; y < y1; y += step)
        for (let x = x0; x < x1; x += step) {
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

function median3(F, cols, rows) {
  const out = new Float32Array(F.length);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const v = [];
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          const rr = Math.min(rows - 1, Math.max(0, r + dr));
          const cc = Math.min(cols - 1, Math.max(0, c + dc));
          v.push(F[rr * cols + cc]);
        }
      v.sort((a, b) => a - b);
      out[r * cols + c] = v[4];
    }
  return out;
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
const Lm = median3(L, COLS, ROWS);
const Lb = blur(Lm, COLS, ROWS, FILL_BLUR);
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

// ---- Structural edges, 2× supersampled (knuckles, creases, finger gaps) ----
const hc = COLS * HX, hr = ROWS * HX;
const hi = sampleGrid(SRC_CROP, hc, hr);
const hl = blur(median3(hi.L, hc, hr), hc, hr, 2);
const hg = sobel(hl, hc, hr, AX);
const gm = Float32Array.from(hg.gx, (_, i) => Math.hypot(hg.gx[i], hg.gy[i]));

const hv = [];
for (let i = 0; i < gm.length; i++) if (hi.M[i] > 0.55) hv.push(gm[i]);
hv.sort((a, b) => a - b);
const thr = hv[Math.floor(hv.length * EDGE_PCT)] || 0;

let em = new Uint8Array(hc * hr);
for (let i = 0; i < gm.length; i++)
  if (hi.M[i] > 0.55 && gm[i] > thr) em[i] = 1;
em = filterComponents(em, hc, hr, EDGE_MIN);

// one glyph per display cell: strongest kept 2×2 supersample edge
const edge = [];
for (let r = 0; r < ROWS; r++) {
  const row = [];
  for (let c = 0; c < COLS; c++) {
    let bi = -1, bv = 0;
    for (let dr = 0; dr < HX; dr++)
      for (let dc = 0; dc < HX; dc++) {
        const i = (r * HX + dr) * hc + (c * HX + dc);
        if (em[i] && gm[i] > bv) { bv = gm[i]; bi = i; }
      }
    row.push(bi >= 0 ? glyph(hg.gx[bi], hg.gy[bi]) : " ");
  }
  edge.push(row);
}

// ---- Fill levels ------------------------------------------------------------
const ls = [];
for (let i = 0; i < Lb.length; i++) if (Mb[i] > 0.5) ls.push(Lb[i]);
ls.sort((a, b) => a - b);
const lo = ls[Math.floor(ls.length * 0.02)], hiV = ls[Math.floor(ls.length * 0.98)];

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
    const k = Math.max(1, Math.min(RAMP.length, Math.round(Math.pow(t, FILL_GAMMA) * RAMP.length)));
    line += RAMP[k - 1];
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
