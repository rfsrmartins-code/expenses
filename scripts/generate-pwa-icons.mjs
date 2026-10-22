import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

const crc32 = (buffer) => {
  let c = 0xffffffff;
  for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const chunk = (name, data) => {
  const type = Buffer.from(name);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([type, data])));
  return Buffer.concat([length, type, data, crc]);
};

function makeIcon(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const circles = [
    { x: 0.42, y: 0.5, r: 0.235, color: [244, 243, 237, 255] },
    { x: 0.59, y: 0.5, r: 0.235, color: [217, 162, 107, 255] },
  ];
  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < size; x += 1) {
      const edge = Math.min(x, y, size - 1 - x, size - 1 - y) / size;
      const base = edge < 0.08 ? [31, 57, 48, 255] : [35, 60, 52, 255];
      let color = base;
      for (const circle of circles) {
        const distance = Math.hypot(x / size - circle.x, y / size - circle.y);
        if (distance <= circle.r) color = circle.color;
      }
      raw.set(color, row + 1 + x * 4);
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync(new URL("../public/icons/", import.meta.url), { recursive: true });
for (const size of [180, 192, 512]) {
  writeFileSync(new URL(`../public/icons/icon-${size}.png`, import.meta.url), makeIcon(size));
}
