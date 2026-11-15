/** favicon.svg → PNG ხატულები (favicon-32, apple-touch-icon, icon-192/512). გაშვება: node scripts/make-icons.mjs */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
const pub = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public');
const svg = path.join(pub, 'favicon.svg');
const onPaper = async (size, file) => {
  const inner = Math.round(size * 0.72);
  const mark = await sharp(svg, { density: 600 }).resize(inner, inner).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: '#f2e9d8' } }).composite([{ input: mark, gravity: 'centre' }]).png().toFile(path.join(pub, file));
};
await sharp(svg, { density: 300 }).resize(32, 32).png().toFile(path.join(pub, 'favicon-32.png'));
await onPaper(180, 'apple-touch-icon.png');
await onPaper(192, 'icon-192.png');
await onPaper(512, 'icon-512.png');
console.log('icons ok');
