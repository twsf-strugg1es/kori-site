const Jimp = require("./ascii/node_modules/jimp");

async function main() {
  const img = await Jimp.read("W:/antigravity/test-corner.png");
  const w = img.bitmap.width;
  const h = img.bitmap.height;
  
  console.log("Image size:", w, h);
  // Check brightness around bottom-right (near cursor) at (960, 410)
  console.log("Brightness around (960, 410) in test-corner.png:");
  for (let dy = -50; dy <= 50; dy += 25) {
    let row = "";
    for (let dx = -50; dx <= 50; dx += 25) {
      const c = Jimp.intToRGBA(img.getPixelColor(Math.min(w-1, 960 + dx), Math.min(h-1, 410 + dy)));
      row += ((c.r + c.g + c.b) / 3).toFixed(1) + " ";
    }
    console.log(row);
  }

  // Check brightness around center (450, 200)
  console.log("Brightness around center (450, 200) in test-corner.png:");
  for (let dy = -50; dy <= 50; dy += 25) {
    let row = "";
    for (let dx = -50; dx <= 50; dx += 25) {
      const c = Jimp.intToRGBA(img.getPixelColor(450 + dx, 200 + dy));
      row += ((c.r + c.g + c.b) / 3).toFixed(1) + " ";
    }
    console.log(row);
  }
}
main();

