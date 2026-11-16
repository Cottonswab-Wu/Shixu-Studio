'use strict';
// Draw the existing code-native board mark into a standard 32-bit ICO.
// No image library, external font or downloaded asset is required.
const fs = require('node:fs');
const path = require('node:path');
const sizes = [16, 24, 32, 48, 64, 128, 256];
function rounded(x, y, left, top, right, bottom, radius) {
  if (x < left || y < top || x > right || y > bottom) return false;
  const dx = Math.max(left + radius - x, 0, x - (right - radius));
  const dy = Math.max(top + radius - y, 0, y - (bottom - radius));
  return dx * dx + dy * dy <= radius * radius;
}
function image(size) {
  const maskStride = Math.ceil(size / 32) * 4;
  const dib = Buffer.alloc(40 + size * size * 4 + maskStride * size);
  dib.writeUInt32LE(40); dib.writeInt32LE(size, 4); dib.writeInt32LE(size * 2, 8);
  dib.writeUInt16LE(1, 12); dib.writeUInt16LE(32, 14); dib.writeUInt32LE(size * size * 4, 20);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let red = 0, green = 0, blue = 0, alpha = 0;
    for (let sy = 0; sy < 4; sy++) for (let sx = 0; sx < 4; sx++) {
      const px = (x + (sx + .5) / 4) / size, py = (y + (sy + .5) / 4) / size;
      if (!rounded(px, py, .035, .035, .965, .965, .23)) continue;
      let color = [167, 154, 235];
      const frame = rounded(px, py, .22, .22, .78, .78, .105) && !rounded(px, py, .262, .262, .738, .738, .064);
      if (frame || rounded(px, py, .365, .36, .41, .64, .022) || rounded(px, py, .59, .36, .635, .52, .022)) color = [36, 35, 51];
      red += color[0]; green += color[1]; blue += color[2]; alpha++;
    }
    const offset = 40 + ((size - 1 - y) * size + x) * 4;
    if (alpha) { dib[offset] = Math.round(blue / alpha); dib[offset + 1] = Math.round(green / alpha); dib[offset + 2] = Math.round(red / alpha); }
    dib[offset + 3] = Math.round(alpha / 16 * 255);
    if (!alpha) dib[40 + size * size * 4 + (size - 1 - y) * maskStride + Math.floor(x / 8)] |= 1 << (7 - x % 8);
  }
  return dib;
}
const images = sizes.map(image), header = Buffer.alloc(6 + sizes.length * 16);
header.writeUInt16LE(1, 2); header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
sizes.forEach((size, index) => { const base = 6 + index * 16; header[base] = size === 256 ? 0 : size; header[base + 1] = size === 256 ? 0 : size; header.writeUInt16LE(1, base + 4); header.writeUInt16LE(32, base + 6); header.writeUInt32LE(images[index].length, base + 8); header.writeUInt32LE(offset, base + 12); offset += images[index].length; });
const directory = path.join(__dirname, '..', 'assets');
fs.mkdirSync(directory, { recursive: true });
fs.writeFileSync(path.join(directory, 'icon.ico'), Buffer.concat([header, ...images]));
