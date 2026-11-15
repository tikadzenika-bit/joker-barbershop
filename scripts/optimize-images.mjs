/**
 * optimize-images.mjs — media-src/*.jpg → public/media/<სახელი>-<სიგანე>.{avif,webp}
 * და src/content/media-manifest.json (ზომები + დომინანტური ფერი).
 *
 * გაშვება: npm run images
 * ახალი placeholder-ის დასამატებლად ჩააგდე JPG/PNG media-src/-ში და გაუშვი ხელახლა;
 * შიგთავსში მიუთითე როგორც "local:<ფაილის სახელი გაფართოების გარეშე>".
 */
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = path.join(root, 'media-src');
const outDir = path.join(root, 'public/media');
const WIDTHS = [480, 800, 1200, 1600];

await mkdir(outDir, { recursive: true });
const manifest = {};
const files = (await readdir(srcDir)).filter((f) => /\.(jpe?g|png)$/i.test(f)).sort();

for (const file of files) {
  const key = file.replace(/\.[^.]+$/, '');
  const input = sharp(path.join(srcDir, file)).rotate();
  const meta = await input.metadata();
  const widths = WIDTHS.filter((w) => w <= meta.width);
  if (!widths.length) widths.push(meta.width);
  for (const w of widths) {
    const base = input.clone().resize({ width: w, withoutEnlargement: true });
    await base.clone().avif({ quality: 50, effort: 5 }).toFile(path.join(outDir, `${key}-${w}.avif`));
    await base.clone().webp({ quality: 74 }).toFile(path.join(outDir, `${key}-${w}.webp`));
  }
  const { dominant } = await input.clone().resize(64).stats();
  const hex = '#' + [dominant.r, dominant.g, dominant.b].map((v) => v.toString(16).padStart(2, '0')).join('');
  manifest[key] = { w: meta.width, h: meta.height, widths, color: hex };
  console.log(key.padEnd(14), `${meta.width}×${meta.height}`, widths.join('/'));
}

await writeFile(path.join(root, 'src/content/media-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`\n${files.length} სურათი → public/media, მანიფესტი განახლდა.`);
