import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalize } from '../src/content/normalize.ts';
import { LANGS } from '../src/content/types.ts';
import type { Content, Lang } from '../src/content/types.ts';
import { jsonLd, renderApp, renderHead } from '../src/render/page.ts';
import { makeCtx } from '../src/render/ui.ts';

const seed = JSON.parse(readFileSync(new URL('../src/content/seed.json', import.meta.url), 'utf8')) as Content;
const media = JSON.parse(readFileSync(new URL('../src/content/media-manifest.json', import.meta.url), 'utf8'));
const ctxFor = (lang: Lang, content: Content = seed) =>
  makeCtx({ lang, base: '/', siteUrl: 'https://example.com', content: normalize(content, seed), media, year: 2026 });

const BAKHTRIONI = 'https://n789845.alteg.io/company/733376/personal/menu';
const KAZBEGI = 'https://n789845.alteg.io/company/1308439/personal/menu';
const PALIASHVILI = 'https://n789845.alteg.io/company/1402828/personal/menu';

test('სამივე ენაზე ირენდერება ყველა სექცია', () => {
  for (const lang of LANGS) {
    const html = renderApp(ctxFor(lang));
    for (const id of ['top', 'services', 'barbers', 'branches', 'works', 'reviews', 'faq', 'contact', 'pick', 'lightbox']) {
      assert.ok(html.includes(`id="${id}"`), `${lang}: აკლია #${id}`);
    }
    assert.equal((html.match(/<h1/g) ?? []).length, 1, `${lang}: ზუსტად ერთი h1`);
    assert.equal((html.match(/data-slide role="group"/g) ?? []).length, 5, `${lang}: 5 სლაიდი`);
  }
});

test('ჩაწერის ბმული = ფილიალის ბმული; დამალული ფილიალი არსად ჩანს', () => {
  const html = renderApp(ctxFor('ka'));
  const card = (id: string) => html.slice(html.indexOf(`id="branch-${id}"`), html.indexOf('</article>', html.indexOf(`id="branch-${id}"`)));
  assert.ok(card('bakhtrioni').includes(`href="${BAKHTRIONI}"`), 'ბახტრიონის ბარათი');
  assert.ok(!card('bakhtrioni').includes(KAZBEGI), 'ბახტრიონის ბარათში ყაზბეგის ბმული არ უნდა იყოს');
  assert.ok(card('kazbegi').includes(`href="${KAZBEGI}"`), 'ყაზბეგის ბარათი');
  assert.ok(!html.includes(PALIASHVILI), 'დამალული მესამე ფილიალი');
  assert.ok(!html.includes('ფალიაშვილი'), 'დამალული ფილიალის სახელი');
  // ზოგადი „ჩაწერა" → ქსელის გვერდი + data-book (JS ხსნის ფილიალის არჩევას)
  assert.ok(html.includes('href="https://n789845.alteg.io/" data-book'));
  // ბარბერის „ჩაეწერე მასთან" → მისი ფილიალი (ოქსანა და გიორგი ყაზბეგზე, ელენე ბახტრიონზე)
  const flips = html.split('<li class="flip"').slice(1);
  assert.ok(flips[0].includes(`href="${KAZBEGI}"`) && flips[1].includes(`href="${KAZBEGI}"`) && flips[2].includes(`href="${BAKHTRIONI}"`));
});

test('მესამე ფილიალის ჩართვა ამატებს მას ყველგან', () => {
  const next: Content = structuredClone(seed);
  next.branches[2].hidden = false;
  const html = renderApp(ctxFor('ka', next));
  assert.ok(html.includes(`href="${PALIASHVILI}"`));
  assert.ok(html.includes('id="branch-paliashvili"'));
  assert.ok(!html.slice(html.indexOf('id="branch-paliashvili"')).split('</article>')[0].includes('data-map'), 'კოორდინატების გარეშე რუკა არ ჩანს');
});

test('ადმინის ტექსტში HTML ეკრანირდება', () => {
  const next: Content = structuredClone(seed);
  next.reviews[0].text.ka = '<script>alert(1)</script>"x"';
  const html = renderApp(ctxFor('ka', next));
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
});

test('ცარიელი თარგმანი → ქართული ტექსტი, არა ცარიელი ადგილი', () => {
  const next: Content = structuredClone(seed);
  next.faq[0].q.en = '';
  assert.ok(renderApp(ctxFor('en', next)).includes(seed.faq[0].q.ka));
});

test('SEO: hreflang, canonical და schema.org HairSalon თითო ხილულ ფილიალზე', () => {
  const head = renderHead(ctxFor('en'));
  assert.ok(head.includes('<link rel="canonical" href="https://example.com/en/">'));
  for (const l of LANGS) assert.ok(head.includes(`hreflang="${l}"`));
  assert.ok(head.includes('hreflang="x-default" href="https://example.com/"'));
  const graph = (jsonLd(ctxFor('ka')) as { '@graph': { '@type': string; potentialAction?: { target: string } }[] })['@graph'];
  const shops = graph.filter((n) => n['@type'] === 'HairSalon');
  assert.equal(shops.length, 2);
  assert.deepEqual(shops.map((s) => s.potentialAction?.target), [BAKHTRIONI, KAZBEGI]);
  assert.ok(!JSON.stringify(graph).includes('aggregateRating'));
});
