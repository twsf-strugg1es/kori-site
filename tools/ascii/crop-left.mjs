/** Crop the left-hand region out of a panel screenshot for 1:1 review. */
import Jimp from "jimp";

const src = process.argv[2] || "lab/panel-desktop.png";
const out = process.argv[3] || "lab/left-z.png";
const img = await Jimp.read(src);
const { width, height } = img.bitmap;
// left hand occupies roughly the left 40% / vertical band of the panel
const x = Math.round(width * 0.065), y = Math.round(height * 0.16);
const w = Math.min(width - x, Math.round(width * 0.335));
const h = Math.min(height - y, Math.round(height * 0.58));
const crop = img.clone().crop(x, y, w, h);
crop.scale(1, 1);
await crop.quality(90).writeAsync(out);
console.log(`saved ${out} from ${src} (${width}x${height}) -> crop ${w}x${h} at ${x},${y}`);
