import Jimp from "jimp";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const img = await Jimp.read(path.join(dir, "hands.jpg"));
img.grayscale().crop(0, 130, 1280, 470);
const { width: W, height: H, data } = img.bitmap;
const L = (x, y) => data[(y * W + x) * 4];

const avg = (xs, ys) => {
  let s = 0;
  for (const y of ys) for (const x of xs) s += L(x, y);
  return s / (xs.length * ys.length);
};

console.log("patch means (x0..x1, y0..y1 in crop coords 0-1280 / 0-470)");
const p = (name, x0, x1, y0, y1) => {
  const xs = [], ys = [];
  for (let x = x0; x <= x1; x += 4) xs.push(x);
  for (let y = y0; y <= y1; y += 4) ys.push(y);
  console.log(name.padEnd(34), avg(xs, ys).toFixed(1));
};

p("top-left sky",        100, 300, 20, 100);
p("top-right sky",       800, 1000, 20, 100);
p("adam hand mid",       350, 450, 180, 260);
p("adam forearm left",   60, 200, 160, 240);
p("god hand knuckles",   950, 1100, 200, 300);
p("god forearm right",   1150, 1270, 160, 320);
p("bg centre between",   560, 620, 200, 320);
p("bg low centre",       600, 900, 400, 460);

// global histogram
const hist = new Array(16).fill(0);
for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) hist[Math.min(15, L(x, y) >> 4)]++;
const total = (H / 2) * (W / 2);
console.log("\nhistogram (bin=16 levels):");
hist.forEach((v, i) => console.log(String(i * 16).padStart(3), (100 * v / total).toFixed(2), "%"));
