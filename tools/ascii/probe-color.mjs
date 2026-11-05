import Jimp from "jimp";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const img = await Jimp.read(path.join(dir, "hands.jpg"));
img.crop(0, 130, 1280, 470);
const { width: W, height: H, data } = img.bitmap;
const P = (x, y) => { const i = (y * W + x) * 4; return [data[i], data[i + 1], data[i + 2]]; };

const stat = (name, x0, x1, y0, y1) => {
  let r = 0, g = 0, b = 0, n = 0;
  for (let y = y0; y <= y1; y += 3) for (let x = x0; x <= x1; x += 3) {
    const [R, G, B] = P(x, y); r += R; g += G; b += B; n++;
  }
  r /= n; g /= n; b /= n;
  console.log(name.padEnd(28), `r=${r.toFixed(0)} g=${g.toFixed(0)} b=${b.toFixed(0)}  r-b=${(r - b).toFixed(0)}  r-g=${(r - g).toFixed(0)}`);
};

console.log("crop coords (0-1280 / 0-470). rgb means");
stat("top-left sky",      100, 300, 20, 100);
stat("top-right sky",     800, 1000, 20, 100);
stat("adam hand mid",     350, 450, 180, 260);
stat("adam fingers tips", 520, 590, 200, 260);
stat("adam forearm dark", 60, 200, 160, 240);
stat("god hand knuckles", 950, 1100, 200, 300);
stat("god index finger",  660, 780, 190, 230);
stat("god forearm right", 1150, 1270, 160, 320);
stat("bg centre between", 590, 640, 200, 320);
stat("bg low centre",     600, 900, 400, 460);
stat("dark shadow finger",470, 520, 280, 330);
