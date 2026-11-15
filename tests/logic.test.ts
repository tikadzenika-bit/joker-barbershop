import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  esc, safeUrl, pick, fill, formatDuration, formatPrice, openStatus, uniformHours, tileGrid, waLink, telLink, hasCoords,
} from '../src/lib/logic.ts';
import { diffRows } from '../src/lib/rows.ts';
import type { DayHours } from '../src/content/types.ts';

const t = (key: string, vars: Record<string, string | number> = {}) =>
  fill(
    ({ 'duration.h': '{n} სთ', 'duration.min': '{n} წთ', 'price.from': '{price}-დან', 'price.onRequest': 'შეთანხმებით' } as Record<string, string>)[key] ?? key,
    vars,
  );

const daily = (open = '11:00', close = '21:00'): DayHours[] => Array.from({ length: 7 }, () => ({ open, close, closed: false }));
// 2026-11-16 არის ორშაბათი. თბილისი = UTC+4.
const tbilisi = (iso: string) => new Date(`${iso}+04:00`);

test('esc ეკრანირებს HTML-ს', () => {
  assert.equal(esc('<script>"a" & \'b\'</script>'), '&lt;script&gt;&quot;a&quot; &amp; &#39;b&#39;&lt;/script&gt;');
});

test('safeUrl უშვებს მხოლოდ უსაფრთხო სქემებს', () => {
  assert.equal(safeUrl('https://n789845.alteg.io/'), 'https://n789845.alteg.io/');
  assert.equal(safeUrl('tel:+995558436368'), 'tel:+995558436368');
  assert.equal(safeUrl('javascript:alert(1)'), '#');
  assert.equal(safeUrl('//evil.example'), '#');
  assert.equal(safeUrl(''), '#');
  assert.equal(safeUrl('#services'), '#services');
});

test('pick: ცარიელი თარგმანი → ქართული', () => {
  assert.equal(pick({ ka: 'შეჭრა', en: '', ru: '' }, 'en'), 'შეჭრა');
  assert.equal(pick({ ka: 'შეჭრა', en: 'Haircut', ru: '' }, 'en'), 'Haircut');
  assert.equal(pick(undefined, 'ru'), '');
});

test('formatDuration', () => {
  assert.equal(formatDuration(30, t), '30 წთ');
  assert.equal(formatDuration(60, t), '1 სთ');
  assert.equal(formatDuration(90, t), '1 სთ 30 წთ');
  assert.equal(formatDuration(0, t), '');
});

test('formatPrice: ცარიელი, დიაპაზონი, „-დან"', () => {
  assert.equal(formatPrice('', false, t), 'შეთანხმებით');
  assert.equal(formatPrice('50', false, t), '50 ₾');
  assert.equal(formatPrice('50-70', false, t), '50–70 ₾');
  assert.equal(formatPrice('50', true, t), '50 ₾-დან');
});

test('openStatus: ღიაა, მალე იხურება, დაკეტილია', () => {
  assert.deepEqual(openStatus(daily(), tbilisi('2026-11-16T12:00:00')), { state: 'open', until: '21:00' });
  assert.deepEqual(openStatus(daily(), tbilisi('2026-11-16T20:30:00')), { state: 'closing', until: '21:00' });
  assert.deepEqual(openStatus(daily(), tbilisi('2026-11-16T21:00:00')), { state: 'closed', opensAt: '11:00', opensDay: 1, when: 'tomorrow' });
  assert.deepEqual(openStatus(daily(), tbilisi('2026-11-16T09:15:00')), { state: 'closed', opensAt: '11:00', opensDay: 0, when: 'today' });
});

test('openStatus: დასვენების დღე და შუაღამის გადაკვეთა', () => {
  const h = daily();
  h[1] = { open: '11:00', close: '21:00', closed: true }; // სამშაბათი დასვენებაა
  assert.deepEqual(openStatus(h, tbilisi('2026-11-16T22:00:00')), { state: 'closed', opensAt: '11:00', opensDay: 2, when: 'later' });
  const late = daily('18:00', '02:00');
  assert.equal(openStatus(late, tbilisi('2026-11-17T01:30:00')).state, 'closing');
  assert.equal(openStatus(late, tbilisi('2026-11-17T03:00:00')).state, 'closed');
  assert.equal(openStatus([], new Date()).state, 'closed');
});

test('uniformHours', () => {
  assert.deepEqual(uniformHours(daily()), { open: '11:00', close: '21:00', closed: false });
  const h = daily();
  h[6] = { open: '12:00', close: '20:00', closed: false };
  assert.equal(uniformHours(h), null);
});

test('tileGrid: მარკერი ბადის შიგნითაა და ორივე მხარეს ≥ 384px', () => {
  const g = tileGrid(41.72015, 44.76568, 16);
  assert.equal(g.tiles.length, 12);
  assert.ok(g.offsetX >= 384 && g.offsetX <= 640, `offsetX=${g.offsetX}`);
  assert.ok(g.offsetY >= 256 && g.offsetY <= 512, `offsetY=${g.offsetY}`);
  assert.equal(hasCoords(0, 0), false);
  assert.equal(hasCoords(41.7, 44.7), true);
});

test('ბმულები: WhatsApp და ტელეფონი', () => {
  assert.equal(telLink('+995 558 43 63 68'), 'tel:+995558436368');
  assert.equal(waLink('+995 558 43 63 68', 'გამარჯობა'), `https://wa.me/995558436368?text=${encodeURIComponent('გამარჯობა')}`);
  assert.equal(waLink('', 'x'), '#');
});

test('diffRows: მხოლოდ შეცვლილი იწერება, წაშლილი იშლება', () => {
  const prev = [
    { collection: 'faq', id: 'a', position: 0, data: { q: 1 } },
    { collection: 'faq', id: 'b', position: 1, data: { q: 2 } },
    { collection: 'faq', id: 'c', position: 2, data: { q: 3 } },
  ];
  const next = [
    { collection: 'faq', id: 'a', position: 0, data: { q: 1 } }, // უცვლელი
    { collection: 'faq', id: 'c', position: 1, data: { q: 3 } }, // გადაადგილდა
    { collection: 'faq', id: 'd', position: 2, data: { q: 4 } }, // ახალი
  ];
  const d = diffRows(prev, next);
  assert.deepEqual(d.upsert.map((r) => r.id), ['c', 'd']);
  assert.deepEqual(d.remove, [{ collection: 'faq', id: 'b' }]);
});
