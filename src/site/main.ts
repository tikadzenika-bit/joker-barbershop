/**
 * საიტის ქცევები. HTML უკვე მზადაა (build-ზე დარენდერებული) — აქ მხოლოდ „ვაცოცხლებთ":
 * ჰედერი, მობილური მენიუ, სლაიდერები, „ღიაა ახლა", კარტის გადაბრუნება, ფილტრი, რუკა,
 * lightbox, ფილიალის არჩევა, ენის დამახსოვრება და შიგთავსის ცოცხალი განახლება.
 *
 * initSite() შეიძლება ბევრჯერ გამოიძახო: ყოველ ჯერზე ძველი მსმენელები იხსნება (AbortController).
 */
import '../styles/site.css';
import { LS_CONTENT, LS_LANG, MODE, SUPABASE_KEY, SUPABASE_URL, TABLE } from '../config.ts';
import { fill, openStatus } from '../lib/logic.ts';
import { fromRows } from '../lib/rows.ts';
import type { Row } from '../lib/rows.ts';
import type { DayHours } from '../content/types.ts';

const $ = <E extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<E>(sel);
const $$ = <E extends Element = HTMLElement>(sel: string, root: ParentNode = document) => Array.from(root.querySelectorAll<E>(sel));
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

let ac = new AbortController();
let cleanups: (() => void)[] = [];
let i18n: Record<string, string> = {};
const tr = (key: string, vars?: Record<string, string | number>) => fill(i18n[key] ?? '', vars);

function on<K extends keyof HTMLElementEventMap>(el: EventTarget | null, type: K | string, fn: (e: any) => void, opts: AddEventListenerOptions = {}) {
  el?.addEventListener(type, fn as EventListener, { signal: ac.signal, ...opts });
}

export function initSite(): void {
  ac.abort();
  ac = new AbortController();
  cleanups.forEach((fn) => fn());
  cleanups = [];
  try {
    i18n = JSON.parse($('#i18n')?.textContent || '{}');
  } catch {
    i18n = {};
  }
  initHeader();
  initMenu();
  $$('[data-slider]').forEach(initSlider);
  initStatus();
  initFlip();
  initFilter();
  initMaps();
  initLightbox();
  initPick();
  initReveal();
  initLang();
}

// ───────────────────────── ჰედერი და მენიუ ─────────────────────────

function initHeader() {
  const hdr = $('[data-header]');
  if (!hdr) return;
  const update = () => hdr.classList.toggle('is-stuck', scrollY > 8);
  update();
  on(window, 'scroll', update, { passive: true });
}

function initMenu() {
  const menu = $<HTMLDialogElement>('#menu');
  const opener = $('[data-menu-open]');
  if (!menu || !opener) return;
  on(opener, 'click', () => {
    menu.showModal();
    opener.setAttribute('aria-expanded', 'true');
  });
  $$('[data-menu-close]', menu).forEach((el) => on(el, 'click', () => menu.close()));
  on(menu, 'close', () => opener.setAttribute('aria-expanded', 'false'));
}

// ───────────────────────── სლაიდერი (ჰერო და შეფასებები) ─────────────────────────

function initSlider(root: HTMLElement) {
  const slides = $$('[data-slide]', root);
  if (slides.length < 2) return;
  const list = $('[data-slides]', root);
  const dots = $$('[data-goto]', root);
  const pauseBtn = $('[data-pause]', root);
  const count = $('[data-count]', root);
  const interval = Number(root.dataset.interval) || 6500;
  root.style.setProperty('--interval', `${interval}ms`);

  let index = Math.max(0, slides.findIndex((s) => s.classList.contains('is-active')));
  let timer = 0;
  let userPaused = reduceMotion.matches; // მოძრაობის შემცირებისას ავტოგადართვა გამორთულია
  let hover = false;
  let focus = false;

  const schedule = () => {
    clearTimeout(timer);
    const paused = userPaused || hover || focus || document.hidden;
    root.classList.toggle('is-paused', paused);
    if (!paused) timer = window.setTimeout(() => show(index + 1, false), interval);
  };
  const show = (n: number, manual: boolean) => {
    index = (n + slides.length) % slides.length;
    slides.forEach((s, i) => {
      s.classList.toggle('is-active', i === index);
      s.toggleAttribute('inert', i !== index);
    });
    dots.forEach((d, i) => (i === index ? d.setAttribute('aria-current', 'true') : d.removeAttribute('aria-current')));
    if (count) count.textContent = `${index + 1} / ${slides.length}`;
    // ხელით გადართვისას ეკრანის წამკითხველი აცხადებს ახალ სლაიდს; ავტომატურზე — არა
    list?.setAttribute('aria-live', manual ? 'polite' : 'off');
    schedule();
  };
  const setPaused = (p: boolean) => {
    userPaused = p;
    pauseBtn?.setAttribute('aria-pressed', String(p));
    pauseBtn?.setAttribute('aria-label', tr(p ? 'hero.play' : 'hero.pause'));
    schedule();
  };

  on($('[data-prev]', root), 'click', () => show(index - 1, true));
  on($('[data-next]', root), 'click', () => show(index + 1, true));
  dots.forEach((d, i) => on(d, 'click', () => show(i, true)));
  on(pauseBtn, 'click', () => setPaused(!userPaused));
  on(root, 'pointerenter', (e: PointerEvent) => { if (e.pointerType === 'mouse') { hover = true; schedule(); } });
  on(root, 'pointerleave', () => { hover = false; schedule(); });
  on(root, 'focusin', () => { focus = true; schedule(); });
  on(root, 'focusout', (e: FocusEvent) => { if (!root.contains(e.relatedTarget as Node)) { focus = false; schedule(); } });
  on(document, 'visibilitychange', schedule);
  on(root, 'keydown', (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') show(index - 1, true);
    else if (e.key === 'ArrowRight') show(index + 1, true);
  });
  swipe(root, (dir) => show(index + dir, true));

  setPaused(userPaused);
  cleanups.push(() => clearTimeout(timer));
}

/** ჰორიზონტალური swipe (შეხება/კალამი). ვერტიკალური სქროლი არ იბლოკება. */
function swipe(el: HTMLElement, go: (dir: 1 | -1) => void) {
  let x = 0;
  let y = 0;
  let tracking = false;
  on(el, 'pointerdown', (e: PointerEvent) => {
    if (e.pointerType === 'mouse') return;
    tracking = true;
    x = e.clientX;
    y = e.clientY;
  });
  on(el, 'pointerup', (e: PointerEvent) => {
    if (!tracking) return;
    tracking = false;
    const dx = e.clientX - x;
    const dy = e.clientY - y;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
  });
  on(el, 'pointercancel', () => (tracking = false));
}

// ───────────────────────── „ღიაა ახლა" (თბილისის დრო) ─────────────────────────

function initStatus() {
  const pills = $$('[data-open-status]');
  const update = () => {
    const now = new Date();
    for (const pill of pills) {
      let hours: DayHours[] = [];
      try {
        hours = JSON.parse(pill.dataset.hours || '[]');
      } catch {
        continue;
      }
      const s = openStatus(hours, now);
      let text: string;
      if (s.state === 'open') text = `${tr('status.open')} · ${tr('status.until', { time: s.until! })}`;
      else if (s.state === 'closing') text = `${tr('status.closing')} · ${tr('status.until', { time: s.until! })}`;
      else if (!s.opensAt) text = tr('status.closed');
      else {
        const key = s.when === 'today' ? 'status.opensToday' : s.when === 'tomorrow' ? 'status.opensTomorrow' : 'status.opensLater';
        text = `${tr('status.closed')} · ${tr(key, { time: s.opensAt, day: tr(`day.${s.opensDay}`) })}`;
      }
      pill.dataset.state = s.state;
      const label = pill.querySelector('span');
      if (label && text.trim()) label.textContent = text;
    }
    // დღევანდელი დღის გამოყოფა საათების ცხრილში
    const today = (new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tbilisi' })).getDay() + 6) % 7;
    $$('.hours li').forEach((li) => li.classList.toggle('is-today', Number(li.dataset.day) === today));
  };
  update();
  const id = window.setInterval(update, 60_000);
  cleanups.push(() => clearInterval(id));
}

// ───────────────────────── ბარბერების კარტები ─────────────────────────

function setFlipped(card: HTMLElement, flipped: boolean, moveFocus = false) {
  if (card.classList.contains('is-flipped') === flipped) return;
  card.classList.toggle('is-flipped', flipped);
  const front = $('.flip__front', card);
  const back = $('.flip__back', card);
  front?.toggleAttribute('inert', flipped);
  back?.toggleAttribute('inert', !flipped);
  $$('[data-flip-btn]', card).forEach((b) => b.setAttribute('aria-expanded', String(flipped)));
  if (moveFocus) (flipped ? $('a, button', back!) : $('[data-flip-btn]', front!))?.focus({ preventScroll: true });
}

function initFlip() {
  for (const card of $$('[data-flip]')) {
    on(card, 'click', (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('a')) return; // „ჩაეწერე მასთან" ჩვეულებრივ ბმულად მუშაობს
      const btn = target.closest('[data-flip-btn]');
      // detail === 0 → კლავიატურით (Enter/Space): ფოკუსი გადადის მეორე მხარეს
      setFlipped(card, !card.classList.contains('is-flipped'), !!btn && e.detail === 0);
    });
    on(card, 'pointerenter', (e: PointerEvent) => { if (e.pointerType === 'mouse') setFlipped(card, true); });
    on(card, 'pointerleave', (e: PointerEvent) => { if (e.pointerType === 'mouse') setFlipped(card, false); });
    on(card, 'keydown', (e: KeyboardEvent) => { if (e.key === 'Escape') setFlipped(card, false, true); });
  }
}

function initFilter() {
  const chips = $$('[data-filter]');
  const cards = $$('[data-flip]');
  const empty = $('[data-crew-empty]');
  chips.forEach((chip) =>
    on(chip, 'click', () => {
      const id = chip.dataset.filter || '';
      chips.forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
      let shown = 0;
      cards.forEach((card) => {
        const match = !id || card.dataset.branch === id;
        card.hidden = !match;
        setFlipped(card, false);
        if (match) shown++;
      });
      if (empty) empty.hidden = shown > 0;
    }),
  );
}

// ───────────────────────── რუკა: სტატიკური ფილები → ინტერაქტიული iframe ─────────────────────────

function initMaps() {
  for (const map of $$('[data-map]')) {
    const btn = $('[data-map-live]', map);
    on(btn, 'click', () => {
      const frame = document.createElement('iframe');
      frame.className = 'map__frame';
      frame.src = map.dataset.embed || '';
      frame.title = map.dataset.title || '';
      frame.loading = 'lazy';
      frame.referrerPolicy = 'strict-origin-when-cross-origin';
      $('.map__link', map)?.replaceWith(frame);
      btn?.remove();
    });
  }
}

// ───────────────────────── გალერეის lightbox ─────────────────────────

function initLightbox() {
  const dialog = $<HTMLDialogElement>('#lightbox');
  const shots = $$('[data-lb]');
  if (!dialog || !shots.length) return;
  const img = $<HTMLImageElement>('[data-lb-img]', dialog)!;
  const count = $('[data-lb-count]', dialog)!;
  let index = 0;
  const show = (n: number) => {
    index = (n + shots.length) % shots.length;
    const shot = shots[index];
    img.src = shot.dataset.full || '';
    img.alt = shot.dataset.alt || '';
    count.textContent = `${index + 1} / ${shots.length}`;
    // მომდევნო ფოტოს წინასწარ ჩატვირთვა
    const next = shots[(index + 1) % shots.length].dataset.full;
    if (next) new Image().src = next;
  };
  shots.forEach((shot, i) => on(shot, 'click', () => { show(i); dialog.showModal(); }));
  on($('[data-lb-prev]', dialog), 'click', () => show(index - 1));
  on($('[data-lb-next]', dialog), 'click', () => show(index + 1));
  on(dialog, 'keydown', (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') show(index - 1);
    else if (e.key === 'ArrowRight') show(index + 1);
  });
  on(dialog, 'click', (e: MouseEvent) => { if (e.target === dialog) dialog.close(); }); // ფონზე დაჭერა
  on(dialog, 'close', () => shots[index]?.focus({ preventScroll: true }));
  swipe(dialog, (dir) => show(index + dir));
}

// ───────────────────────── ფილიალის არჩევა: „ჩაწერა" / WhatsApp ─────────────────────────

function initPick() {
  const dialog = $<HTMLDialogElement>('#pick');
  if (!dialog) return;
  $$('[data-dialog-close]').forEach((b) => on(b, 'click', () => b.closest('dialog')?.close()));
  on(dialog, 'click', (e: MouseEvent) => {
    if (e.target === dialog || (e.target as HTMLElement).closest('[data-branch-link]')) dialog.close();
  });

  const wire = (mode: 'book' | 'wa', selector: string) => {
    const rows = $$<HTMLAnchorElement>(`[data-mode="${mode}"] [data-branch-link]`, dialog);
    const triggers = $$<HTMLAnchorElement>(selector);
    if (rows.length === 1) {
      // ერთი ფილიალი → არჩევა ზედმეტია, ღილაკი პირდაპირ მასზე მიდის
      triggers.forEach((t) => (t.href = rows[0].href));
      return;
    }
    if (!rows.length) return;
    triggers.forEach((t) =>
      on(t, 'click', (e: MouseEvent) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey) return; // ახალ ჩანართში გახსნა ჩვეულებრივ მუშაობს
        e.preventDefault();
        $<HTMLDialogElement>('#menu')?.close();
        $$('[data-mode]', dialog).forEach((p) => (p.hidden = p.dataset.mode !== mode));
        dialog.setAttribute('aria-labelledby', `pick-${mode}`);
        dialog.showModal();
      }),
    );
  };
  wire('book', 'a[data-book]');
  wire('wa', 'a[data-wa]');
}

// ───────────────────────── წვრილმანები ─────────────────────────

function initReveal() {
  const items = $$('[data-reveal]');
  if (!('IntersectionObserver' in window) || reduceMotion.matches) {
    items.forEach((el) => el.classList.add('is-in'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } }),
    { rootMargin: '0px 0px -10% 0px' },
  );
  items.forEach((el) => io.observe(el));
  cleanups.push(() => io.disconnect());
}

/** ენის არჩევანის დამახსოვრება; გადასვლისას მიმდინარე სექცია (#hash) ნარჩუნდება */
function initLang() {
  $$<HTMLAnchorElement>('a[data-lang]').forEach((a) =>
    on(a, 'click', () => {
      try {
        localStorage.setItem(LS_LANG, a.dataset.lang || 'ka');
      } catch { /* private რეჟიმი */ }
      if (location.hash) a.href = a.href.split('#')[0] + location.hash;
    }),
  );
}

// ───────────────────────── შიგთავსის ცოცხალი განახლება ─────────────────────────
// build-ის HTML-ში წერია შიგთავსის ვერსია (data-rev). თუ წყაროში უფრო ახალია
// (დემო: localStorage; რეალური: Supabase), გვერდი ადგილზე გადაირენდერება.

const root = document.documentElement;
const BUILD_REV = root.dataset.rev || '';
let checking = false;
let lastCheck = 0;

async function apply(raw: unknown) {
  const { renderLive } = await import('./live.ts');
  root.dataset.rev = renderLive(raw);
  initSite();
}

async function refresh(force = false) {
  if (checking || (!force && Date.now() - lastCheck < 4000)) return;
  checking = true;
  lastCheck = Date.now();
  try {
    const rev = root.dataset.rev || '';
    if (MODE === 'demo') {
      const raw = localStorage.getItem(LS_CONTENT);
      if (!raw) {
        if (rev !== BUILD_REV) await apply(null); // ადმინში „საწყისზე დაბრუნება"
      } else {
        const data = JSON.parse(raw);
        if (data?.updatedAt !== rev) await apply(data);
      }
    } else {
      const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };
      const api = `${SUPABASE_URL}/rest/v1/${TABLE}`;
      const meta = await fetch(`${api}?collection=eq.meta&id=eq.revision&select=data`, { headers }).then((r) => r.json());
      const live = meta?.[0]?.data?.updatedAt;
      if (live && live !== rev) {
        const rows: Row[] = await fetch(`${api}?select=collection,id,position,data`, { headers }).then((r) => r.json());
        if (Array.isArray(rows) && rows.length) await apply(fromRows(rows));
      }
    }
  } catch (err) {
    console.warn('[joker] შიგთავსის განახლება ვერ მოხერხდა', err);
  } finally {
    checking = false;
    root.classList.remove('is-local');
  }
}

initSite();
refresh(true);
window.addEventListener('storage', (e) => { if (e.key === LS_CONTENT) refresh(true); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
