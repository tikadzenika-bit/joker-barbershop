/**
 * სუფთა ლოგიკა (DOM-ის და ბრაუზერის API-ების გარეშე) — იყენებს build, საიტი, ადმინი და ტესტები.
 */
import type { DayHours, L10n, Lang } from '../content/types.ts';

/** თარგმანის ფუნქცია: გასაღები → ტექსტი მიმდინარე ენაზე */
export type T = (key: string, vars?: Record<string, string | number>) => string;

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** HTML-ის ეკრანირება — ყველა დინამიკური სტრიქონი ამით გადის */
export function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
}

/** მხოლოდ უსაფრთხო ბმულები: http(s), tel, mailto, data:image, ფარდობითი და #anchor */
export function safeUrl(u: string | undefined | null): string {
  const s = String(u ?? '').trim();
  if (!s) return '#';
  if (/^(https?:|tel:|mailto:|data:image\/|blob:)/i.test(s)) return s;
  if (/^[/#.]/.test(s) && !s.startsWith('//')) return s;
  return '#';
}

/** ტექსტი არჩეულ ენაზე; თუ ცარიელია — ქართული, შემდეგ ინგლისური (ცარიელი ადგილი არასდროს) */
export function pick(v: Partial<L10n> | undefined | null, lang: Lang): string {
  if (!v) return '';
  return v[lang] || v.ka || v.en || v.ru || '';
}

/** "{name}"-ების ჩანაცვლება */
export function fill(tpl: string, vars: Record<string, string | number> = {}): string {
  return tpl.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

/** 90 → „1 სთ 30 წთ" */
export function formatDuration(min: number, t: T): string {
  const m = Math.round(Number(min) || 0);
  if (m <= 0) return '';
  const h = Math.floor(m / 60);
  const rest = m % 60;
  const parts: string[] = [];
  if (h) parts.push(t('duration.h', { n: h }));
  if (rest) parts.push(t('duration.min', { n: rest }));
  return parts.join(' ');
}

/** "50" → „50 ₾", "50-70" → „50–70 ₾", from → „50 ₾-დან", ცარიელი → „შეთანხმებით" */
export function formatPrice(price: string, from: boolean, t: T): string {
  const p = String(price ?? '').trim();
  if (!p) return t('price.onRequest');
  const money = /^[\d\s.,–-]+$/.test(p) ? `${p.replace(/\s*[-–]\s*/g, '–')} ₾` : p;
  return from ? t('price.from', { price: money }) : money;
}

// ───────────────────────── სამუშაო საათები (თბილისის დრო) ─────────────────────────

const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** მიმდინარე დღე (0 = ორშაბათი) და წუთები შუაღამიდან, თბილისის დროით */
export function tbilisiNow(now: Date): { day: number; minutes: number } {
  const f = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tbilisi',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const p: Record<string, string> = {};
  for (const part of f.formatToParts(now)) p[part.type] = part.value;
  return { day: Math.max(0, WEEK.indexOf(p.weekday)), minutes: Number(p.hour) * 60 + Number(p.minute) };
}

const toMin = (hhmm: string): number => {
  const [h, m] = String(hhmm || '0:0').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

export interface OpenStatus {
  state: 'open' | 'closing' | 'closed';
  /** ღიაა → დახურვის დრო */
  until?: string;
  /** დაკეტილია → შემდეგი გახსნის დრო, დღე (0 = ორშ) და არის თუ არა ხვალ/დღეს */
  opensAt?: string;
  opensDay?: number;
  when?: 'today' | 'tomorrow' | 'later';
}

/** „ღიაა ახლა?" — ითვალისწინებს დასვენების დღეს და შუაღამის გადაკვეთას (მაგ. 18:00–02:00) */
export function openStatus(hours: DayHours[], now: Date): OpenStatus {
  if (!Array.isArray(hours) || hours.length !== 7) return { state: 'closed' };
  const { day, minutes } = tbilisiNow(now);
  const span = (h: DayHours) => {
    const o = toMin(h.open);
    let c = toMin(h.close);
    if (c <= o) c += 1440; // იხურება შუაღამის შემდეგ
    return { o, c };
  };
  const state = (left: number): 'open' | 'closing' => (left <= 60 ? 'closing' : 'open');

  const today = hours[day];
  if (today && !today.closed) {
    const { o, c } = span(today);
    if (minutes >= o && minutes < c) return { state: state(c - minutes), until: today.close };
  }
  // გუშინდელი ცვლა, რომელიც შუაღამის შემდეგ გრძელდება
  const prev = hours[(day + 6) % 7];
  if (prev && !prev.closed) {
    const { c } = span(prev);
    if (c > 1440 && minutes < c - 1440) return { state: state(c - 1440 - minutes), until: prev.close };
  }
  if (today && !today.closed && minutes < toMin(today.open)) {
    return { state: 'closed', opensAt: today.open, opensDay: day, when: 'today' };
  }
  for (let i = 1; i <= 7; i++) {
    const d = (day + i) % 7;
    if (hours[d] && !hours[d].closed) {
      return { state: 'closed', opensAt: hours[d].open, opensDay: d, when: i === 1 ? 'tomorrow' : 'later' };
    }
  }
  return { state: 'closed' };
}

/** ყველა დღე ერთნაირია? → „ყოველდღე 11:00–21:00" */
export function uniformHours(hours: DayHours[]): DayHours | null {
  if (!hours?.length) return null;
  const first = hours[0];
  const same = hours.every((h) => !h.closed && h.open === first.open && h.close === first.close);
  return same && !first.closed ? first : null;
}

// ───────────────────────── რუკა: OpenStreetMap-ის ფილები ─────────────────────────

export interface TileGrid {
  tiles: { x: number; y: number; col: number; row: number }[];
  /** მარკერის მდებარეობა ბადის ზედა-მარცხენა კუთხიდან, px (ფილა = 256px) */
  offsetX: number;
  offsetY: number;
  cols: number;
  rows: number;
}

/** 4×3 ფილა ისე, რომ მარკერის ორივე მხარეს ≥ 384px იყოს დაფარული */
export function tileGrid(lat: number, lng: number, zoom = 16): TileGrid {
  const n = 2 ** zoom;
  const xf = ((lng + 180) / 360) * n;
  const rad = (lat * Math.PI) / 180;
  const yf = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n;
  const x0 = Math.floor(xf);
  const y0 = Math.floor(yf);
  const fx = xf - x0;
  const fy = yf - y0;
  const startCol = fx < 0.5 ? -2 : -1;
  const tiles: TileGrid['tiles'] = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4; col++) tiles.push({ x: x0 + startCol + col, y: y0 - 1 + row, col, row });
  }
  return { tiles, offsetX: (fx - startCol) * 256, offsetY: (1 + fy) * 256, cols: 4, rows: 3 };
}

export const hasCoords = (lat: number, lng: number): boolean =>
  Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) > 0.0001 && Math.abs(lng) > 0.0001;

// ───────────────────────── ბმულები ─────────────────────────

const digits = (phone: string): string => String(phone ?? '').replace(/\D/g, '');

export const telLink = (phone: string): string => (digits(phone) ? `tel:+${digits(phone)}` : '#');

export const waLink = (phone: string, text = ''): string =>
  digits(phone) ? `https://wa.me/${digits(phone)}${text ? `?text=${encodeURIComponent(text)}` : ''}` : '#';

export const directionsLink = (lat: number, lng: number): string =>
  `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

export const mapLink = (lat: number, lng: number): string =>
  `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

export const osmEmbed = (lat: number, lng: number): string => {
  const dx = 0.006;
  const dy = 0.0035;
  const bbox = [lng - dx, lat - dy, lng + dx, lat + dy].map((v) => v.toFixed(5)).join('%2C');
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}`;
};
