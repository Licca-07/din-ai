import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = resolve(__dirname, "../public/icons");

const background = "#09090b";
const accent = "#10b981";

function createSvg(size) {
  const radius = Math.round(size * 0.22);
  const fontSize = Math.round(size * 0.42);

  return Buffer.from(`
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" rx="${radius}" fill="${background}"/>
  <text
    x="50%"
    y="54%"
    text-anchor="middle"
    dominant-baseline="middle"
    fill="${accent}"
    font-family="Arial, Helvetica, sans-serif"
    font-size="${fontSize}"
    font-weight="700"
  >D</text>
</svg>`);
}

async function writeIcon(filename, size) {
  const svg = createSvg(size);
  await sharp(svg).png().toFile(resolve(iconsDir, filename));
}

async function writeMaskableIcon(filename, size) {
  const inset = Math.round(size * 0.12);
  const inner = size - inset * 2;
  const svg = createSvg(inner);
  const padded = await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background,
    },
  })
    .composite([{ input: svg, top: inset, left: inset }])
    .png()
    .toBuffer();

  await writeFile(resolve(iconsDir, filename), padded);
}

await mkdir(iconsDir, { recursive: true });
await writeIcon("icon-192.png", 192);
await writeIcon("icon-512.png", 512);
await writeIcon("apple-touch-icon.png", 180);
await writeMaskableIcon("icon-512-maskable.png", 512);

console.log("Generated PWA icons in public/icons/");
