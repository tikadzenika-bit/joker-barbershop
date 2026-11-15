/**
 * რენდერის საერთო ნაწილები: კონტექსტი, ხატულები, სურათები, ღილაკები.
 * ეს ფაილები სუფთა ფუნქციებია (სტრიქონი → სტრიქონი): მუშაობს build-ზეც და ბრაუზერშიც.
 */
import type { Content, CtaAction, ImageRef, Lang, MediaManifest, Suit, Branch } from '../content/types.ts';
import { esc, fill, pick, safeUrl, waLink } from '../lib/logic.ts';
import type { T } from '../lib/logic.ts';

export interface Ctx {
  lang: Lang;
  /** Vite-ის base, ბოლოში "/" (მაგ. "/" ან "/repo/") */
  base: string;
  /** საიტის სრული მისამართი ბოლო "/"-ის გარეშე (canonical, OG, sitemap) */
  siteUrl: string;
  content: Content;
  media: MediaManifest;
  year: number;
  t: T;
}

export function makeCtx(o: Omit<Ctx, 't'>): Ctx {
  const t: T = (key, vars) => fill(pick(o.content.texts[key], o.lang) || key, vars);
  return { ...o, t };
}

export const visible = <X extends { hidden?: boolean }>(list: X[]): X[] => list.filter((x) => !x.hidden);

/** ენის გვერდის მისამართი: ka → "/", en → "/en/", ru → "/ru/" */
export const langPath = (ctx: Pick<Ctx, 'base'>, lang: Lang): string => (lang === 'ka' ? ctx.base : `${ctx.base}${lang}/`);

// ───────────────────────── ხატულები (inline SVG sprite) ─────────────────────────

const FILL: Record<string, string> = {
  spade: 'M12 1.8c-1.6 3-4 5.2-6.4 7.4-2 1.8-3.2 3.4-3.2 5.5 0 2.5 2 4.4 4.4 4.4 1.6 0 3-.7 3.9-1.9-.2 2-1 3.6-2.5 5h7.6c-1.5-1.4-2.3-3-2.5-5 .9 1.2 2.3 1.9 3.9 1.9 2.4 0 4.4-1.9 4.4-4.4 0-2.1-1.2-3.7-3.2-5.5C16 7 13.6 4.8 12 1.8z',
  heart: 'M12 21.2C5.4 15.6 2 12.3 2 8.3 2 5.4 4.2 3.2 7 3.2c1.9 0 3.8 1 5 2.8 1.2-1.8 3.1-2.8 5-2.8 2.8 0 5 2.2 5 5.1 0 4-3.4 7.3-10 12.9z',
  diamond: 'M12 1.6c2.2 3.9 4.7 7.3 8 10.4-3.3 3.1-5.8 6.5-8 10.4-2.2-3.9-4.7-7.3-8-10.4 3.3-3.1 5.8-6.5 8-10.4z',
  club: 'M12 1.8a4.5 4.5 0 0 0-3.7 7.1 4.5 4.5 0 1 0 2.6 8c-.2 2-1 3.7-2.5 5.3h7.2c-1.5-1.6-2.3-3.3-2.5-5.3a4.5 4.5 0 1 0 2.6-8A4.5 4.5 0 0 0 12 1.8z',
  star: 'M12 1.9l2.95 6.6 7.15.75-5.35 4.8 1.5 7.05L12 17.5l-6.25 3.6 1.5-7.05L1.9 9.25l7.15-.75L12 1.9z',
  play: 'M8 5.2v13.6L19 12 8 5.2z',
  pause: 'M7.5 5h3.2v14H7.5V5zm5.8 0h3.2v14h-3.2V5z',
  facebook: 'M13.6 21v-7.6h2.6l.4-3h-3V8.5c0-.9.3-1.5 1.6-1.5h1.6V4.3c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.3H8.1v3h2.6V21h2.9z',
  whatsapp: 'M12 2.5a9.4 9.4 0 0 0-8.1 14.2L2.6 21.5l4.9-1.3A9.4 9.4 0 1 0 12 2.5zm0 1.8a7.6 7.6 0 1 1-3.9 14.1l-.3-.2-2.7.7.7-2.6-.2-.3A7.6 7.6 0 0 1 12 4.3zM8.9 7.4c-.2 0-.5 0-.7.3-.3.3-1 .9-1 2.3 0 1.300.9 2.600 1.100 2.800.1.2 1.900 3 4.700 4.100 2.300.9 2.800.7 3.300.7.500-.1 1.600-.7 1.800-1.300.2-.6.2-1.200.2-1.300-.1-.1-.3-.2-.5-.3l-1.800-.9c-.3-.1-.4-.1-.6.1l-.8 1c-.2.2-.3.2-.6.1-.300-.1-1.100-.4-2.100-1.300-.8-.7-1.300-1.600-1.500-1.800-.1-.3 0-.4.1-.5l.4-.5c.1-.1.2-.3.3-.4.1-.2 0-.3 0-.5l-.8-1.900c-.2-.5-.4-.5-.6-.5z',
  quote: 'M4 18v-5.6C4 8.800 6 6.400 9.500 6v2.400c-1.700.4-2.500 1.700-2.500 3.100h2.500V18H4zm10.500 0v-5.600c0-3.600 2-6 5.500-6.400v2.400c-1.700.4-2.500 1.700-2.500 3.100H20V18h-5.500z',
};

const STROKE: Record<string, string> = {
  'arrow-right': '<path d="M5 12h14M13 6l6 6-6 6"/>',
  'arrow-left': '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  'arrow-up-right': '<path d="M7 17L17 7M8 7h9v9"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  menu: '<path d="M4 8h16M4 16h16"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  phone: '<path d="M6.600 3.500h3l1.400 4-1.900 1.500a11.500 11.500 0 0 0 5.900 5.900l1.500-1.900 4 1.400v3a2 2 0 0 1-2.200 2A17 17 0 0 1 4.600 5.700a2 2 0 0 1 2-2.200z"/>',
  pin: '<path d="M12 21s-6.500-5.800-6.500-11a6.500 6.500 0 0 1 13 0c0 5.200-6.500 11-6.500 11z"/><circle cx="12" cy="10" r="2.300"/>',
  clock: '<circle cx="12" cy="12" r="8.500"/><path d="M12 7.500V12l3 2"/>',
  flip: '<path d="M4 11a8 8 0 0 1 13.900-4.800L20 8.500M20 4v4.500h-4.500M20 13a8 8 0 0 1-13.900 4.800L4 15.500M4 20v-4.500h4.500"/>',
  instagram: '<rect x="3.500" y="3.500" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.200" cy="6.800" r=".9" fill="currentColor" stroke="none"/>',
};

/** ერთი SVG sprite გვერდის თავში; ხატულები იხატება <use>-ით */
export function sprite(): string {
  const fills = Object.entries(FILL).map(([id, d]) => `<symbol id="i-${id}" viewBox="0 0 24 24"><path d="${d}"/></symbol>`);
  const strokes = Object.entries(STROKE).map(
    ([id, body]) =>
      `<symbol id="i-${id}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.800" stroke-linecap="round" stroke-linejoin="round">${body}</symbol>`,
  );
  return `<svg class="sprite" aria-hidden="true" focusable="false" width="0" height="0">${fills.join('')}${strokes.join('')}</svg>`;
}

/** დეკორატიული ხატულა (ყოველთვის aria-hidden) */
export const icon = (name: string, cls = ''): string =>
  `<svg class="i i-${name}${cls ? ` ${cls}` : ''}" aria-hidden="true" focusable="false"><use href="#i-${name}"/></svg>`;

export const suitIcon = (suit: Suit | undefined): string => icon(suit ?? 'spade', 'suit');

/** კარტის კუთხის ინდექსი: რანგი + ნიშანი */
export const cornerIndex = (rank: string, suit: Suit | undefined, extra = ''): string =>
  `<span class="idx${extra ? ` ${extra}` : ''}" aria-hidden="true"><b>${esc(rank)}</b>${suitIcon(suit)}</span>`;

// ───────────────────────── სურათები ─────────────────────────

export interface PicOpts {
  alt: string;
  sizes: string;
  cls?: string;
  /** პირველი ეკრანის სურათი: lazy-ის ნაცვლად fetchpriority=high */
  eager?: boolean;
}

/** <picture> AVIF/WebP srcset-ით ლოკალური სურათისთვის, ან უბრალო <img> ატვირთულისთვის */
export function picture(ctx: Ctx, ref: ImageRef | null | undefined, o: PicOpts): string {
  if (!ref?.src) return '';
  const cls = o.cls ? ` class="${o.cls}"` : '';
  const load = o.eager ? ' fetchpriority="high"' : ' loading="lazy"';
  if (ref.src.startsWith('local:')) {
    const key = ref.src.slice(6);
    const m = ctx.media[key];
    if (!m) return '';
    const set = (ext: string) => m.widths.map((w) => `${ctx.base}media/${key}-${w}.${ext} ${w}w`).join(', ');
    const fallback = m.widths.includes(800) ? 800 : m.widths[m.widths.length - 1];
    return (
      `<picture><source type="image/avif" srcset="${set('avif')}" sizes="${o.sizes}">` +
      `<source type="image/webp" srcset="${set('webp')}" sizes="${o.sizes}">` +
      `<img${cls} src="${ctx.base}media/${key}-${fallback}.webp" width="${m.w}" height="${m.h}" alt="${esc(o.alt)}"${load} decoding="async" style="background-color:${m.color}"></picture>`
    );
  }
  const dims = ref.w && ref.h ? `width="${ref.w}" height="${ref.h}"` : 'width="800" height="1000"';
  return `<img${cls} src="${esc(safeUrl(ref.src))}" ${dims} alt="${esc(o.alt)}"${load} decoding="async">`;
}

/** სურათის ყველაზე დიდი ვერსია (lightbox) და პროპორცია */
export function imageInfo(ctx: Ctx, ref: ImageRef | null | undefined): { full: string; ratio: number } {
  if (!ref?.src) return { full: '', ratio: 0.75 };
  if (ref.src.startsWith('local:')) {
    const key = ref.src.slice(6);
    const m = ctx.media[key];
    if (!m) return { full: '', ratio: 0.75 };
    return { full: `${ctx.base}media/${key}-${m.widths[m.widths.length - 1]}.webp`, ratio: m.w / m.h };
  }
  return { full: safeUrl(ref.src), ratio: ref.w && ref.h ? ref.w / ref.h : 0.75 };
}

// ───────────────────────── ბმულები და ღილაკები ─────────────────────────

const EXT = 'target="_blank" rel="noopener"';

/** ფილიალის WhatsApp-ის ბმული მზა შეტყობინებით */
export const branchWa = (ctx: Ctx, b: Branch): string =>
  waLink(b.whatsapp || b.phone, ctx.t('wa.message', { branch: pick(b.name, ctx.lang) }));

/** ზოგადი „ჩაწერა" — href არის ქსელის გვერდი; JS ხსნის ფილიალის არჩევას (data-book) */
export const bookBtn = (ctx: Ctx, cls = 'btn btn--red', label = ctx.t('cta.book')): string =>
  `<a class="${cls}" href="${esc(safeUrl(ctx.content.settings.bookingUrl))}" data-book ${EXT}>${esc(label)}</a>`;

export function waBtn(ctx: Ctx, cls = 'btn btn--line', label = ctx.t('cta.whatsapp')): string {
  const first = visible(ctx.content.branches).find((b) => b.whatsapp || b.phone);
  if (!first) return '';
  return `<a class="${cls}" href="${esc(branchWa(ctx, first))}" data-wa ${EXT}>${icon('whatsapp')}<span>${esc(label)}</span></a>`;
}

const SECTION_OF: Partial<Record<CtaAction, string>> = {
  services: 'services', barbers: 'barbers', branches: 'branches', works: 'works', reviews: 'reviews',
};

/** სლაიდის ღილაკი მოქმედების მიხედვით */
export function actionBtn(ctx: Ctx, action: CtaAction, primary: boolean): string {
  if (!action || action === 'none') return '';
  if (action === 'book') return bookBtn(ctx, primary ? 'btn btn--red' : 'btn btn--line');
  if (action === 'whatsapp') return waBtn(ctx, primary ? 'btn btn--red' : 'btn btn--line');
  const id = SECTION_OF[action];
  if (!id) return '';
  return `<a class="${primary ? 'btn btn--red' : 'btn btn--line'}" href="#${id}">${esc(ctx.t(`nav.${action}`))}</a>`;
}

/** სექციის თავი: პატარა წარწერა ნიშნით + დიდი სათაური + შესავალი */
export function sectionHead(ctx: Ctx, key: string, suit: Suit, extra = ''): string {
  const lead = ctx.t(`${key}.lead`);
  return (
    `<header class="sec__head" data-reveal>` +
    `<p class="kicker">${suitIcon(suit)}<span>${esc(ctx.t(`${key}.kicker`))}</span></p>` +
    `<h2 class="display sec__title" id="${key}-h">${esc(ctx.t(`${key}.title`))}</h2>` +
    (lead && lead !== `${key}.lead` ? `<p class="lead">${esc(lead)}</p>` : '') +
    extra +
    `</header>`
  );
}

/** სათაურის ხაზები: "\n" = ახალი ხაზი, "★" = ვარსკვლავის ხატულა */
export function titleLines(text: string): string {
  return text
    .split('\n')
    .map((line) => `<span class="line">${esc(line).replace(/★/g, icon('star', 'star'))}</span>`)
    .join('');
}

export { EXT };
