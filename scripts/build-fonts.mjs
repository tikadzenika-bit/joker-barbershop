/**
 * build-fonts.mjs — ფონტების „დაჭრა" (subsetting) ვებისთვის.
 *
 * რატომ: FiraGO fontsource-ზე თითო წონაზე ~250 KB-ია (ყველა დამწერლობა ერთ ფაილში),
 * Noto Serif-ის ვარიაბელური ფაილები კი ორ ღერძს (wght + wdth) ატარებს.
 * აქ ვტოვებთ მხოლოდ იმ სიმბოლოებს და ღერძებს, რაც საიტს რეალურად სჭირდება —
 * შედეგად თითო ფაილი 5–35 KB-ია და ბრაუზერი unicode-range-ით მხოლოდ საჭიროს ტვირთავს.
 *
 * გაშვება:  npm run fonts      (შედეგი: src/assets/fonts/*.woff2 — რეპოში ინახება)
 * ხელახლა გაშვება საჭიროა მხოლოდ მაშინ, თუ ფონტს ან სიმბოლოების ნაკრებს შეცვლი.
 *
 * ლიცენზია: ყველა ფონტი SIL Open Font License 1.1 (იხ. src/assets/fonts/LICENSES.md).
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import subsetFont from 'subset-font';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'src/assets/fonts');
const nm = (p) => path.join(root, 'node_modules', p);

/** "U+0020-007E,U+00A0" → სიმბოლოების სტრიქონი */
function chars(ranges) {
  let out = '';
  for (const part of ranges.split(',')) {
    const [a, b] = part.trim().replace(/U\+/gi, '').split('-');
    const from = parseInt(a, 16);
    const to = b ? parseInt(b, 16) : from;
    for (let cp = from; cp <= to; cp++) out += String.fromCodePoint(cp);
  }
  return out;
}

// სიმბოლოების ნაკრებები. იგივე დიაპაზონები წერია src/styles/fonts.css-ში (unicode-range).
export const RANGES = {
  latin:
    'U+0020-007E,U+00A0-00FF,U+2010-2015,U+2018-201E,U+2022,U+2026,U+2030,U+2032-2033,U+2039-203A,U+20AC,U+2122,U+2190-2193,U+2212',
  cyrillic: 'U+0400-045F,U+0490-0491,U+2116',
  georgian: 'U+10D0-10FF', // მხედრული
  mtavruli: 'U+1C90-1CBA,U+1CBD-1CBF', // მთავრული (text-transform: uppercase)
  lari: 'U+20BE', // ₾
};

const SERIF = '@fontsource-variable/noto-serif/files/noto-serif-';
const SERIF_KA = '@fontsource-variable/noto-serif-georgian/files/noto-serif-georgian-';
const SANS_KA = '@fontsource-variable/noto-sans-georgian/files/noto-sans-georgian-';
const FIRA = '@fontsource/firago/files/firago-latin-';

// სათაურების ფონტი: სიგანე ფიქსირებულია (ExtraCondensed 62.5), წონა 500–900.
const DISPLAY_AXES = { wdth: 62.5, wght: { min: 500, max: 900, default: 800 } };

const jobs = [
  // ── სათაურები: Noto Serif (ლათინური, კირილიცა, ₾) + Noto Serif Georgian (მხედრული + მთავრული)
  { out: 'display-latin', src: SERIF + 'latin-standard-normal.woff2', ranges: RANGES.latin, axes: DISPLAY_AXES },
  { out: 'display-cyrillic', src: SERIF + 'cyrillic-standard-normal.woff2', ranges: RANGES.cyrillic, axes: DISPLAY_AXES },
  { out: 'display-lari', src: SERIF + 'latin-ext-standard-normal.woff2', ranges: RANGES.lari, axes: DISPLAY_AXES },
  {
    out: 'display-georgian',
    src: SERIF_KA + 'georgian-standard-normal.woff2',
    ranges: RANGES.georgian + ',' + RANGES.mtavruli,
    axes: DISPLAY_AXES,
  },
  // ── ტექსტი: FiraGO 400 / 600 — სამი დამწერლობა ცალ-ცალკე ფაილებად
  ...[400, 600].flatMap((w) => [
    { out: `text-latin-${w}`, src: `${FIRA}${w}-normal.woff2`, ranges: RANGES.latin + ',' + RANGES.lari },
    { out: `text-cyrillic-${w}`, src: `${FIRA}${w}-normal.woff2`, ranges: RANGES.cyrillic },
    { out: `text-georgian-${w}`, src: `${FIRA}${w}-normal.woff2`, ranges: RANGES.georgian },
  ]),
  // ── პატარა მთავრული წარწერები (ღილაკები, ეტიკეტები): FiraGO-ს მთავრული არ აქვს,
  //    ამიტომ მხოლოდ ამ სიმბოლოებს Noto Sans Georgian ავსებს.
  {
    out: 'label-mtavruli',
    src: SANS_KA + 'georgian-standard-normal.woff2',
    ranges: RANGES.mtavruli,
    axes: { wdth: 100, wght: { min: 400, max: 700, default: 600 } },
  },
];

await mkdir(outDir, { recursive: true });
let total = 0;
for (const job of jobs) {
  const input = await readFile(nm(job.src));
  const output = await subsetFont(input, chars(job.ranges), {
    targetFormat: 'woff2',
    ...(job.axes ? { variationAxes: job.axes } : {}),
  });
  await writeFile(path.join(outDir, `${job.out}.woff2`), output);
  total += output.length;
  console.log(`${job.out}.woff2`.padEnd(28), (output.length / 1024).toFixed(1).padStart(6), 'KB');
}
console.log('სულ:'.padEnd(28), (total / 1024).toFixed(1).padStart(6), 'KB');
