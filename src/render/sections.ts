/**
 * გვერდის სექციები. თითო ფუნქცია აბრუნებს ერთი სექციის HTML-ს.
 * ქცევები (სლაიდერი, ფილტრი, lightbox…) აქ არ არის — ისინი src/site/main.ts-შია და
 * data-* ატრიბუტებით უკავშირდება ამ მარკაპს.
 */
import type { Barber, Branch, Slide } from '../content/types.ts';
import { LANGS } from '../content/types.ts';
import {
  directionsLink, esc, formatDuration, formatPrice, hasCoords, mapLink, osmEmbed, pick, safeUrl, telLink, tileGrid, uniformHours,
} from '../lib/logic.ts';
import {
  EXT, actionBtn, bookBtn, branchWa, cornerIndex, icon, imageInfo, langPath, picture, sectionHead, suitIcon, titleLines, visible, waBtn,
} from './ui.ts';
import type { Ctx } from './ui.ts';

const RANKS = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5'];
const NAV: [string, string][] = [
  ['services', 'services'], ['barbers', 'barbers'], ['branches', 'branches'], ['works', 'works'], ['reviews', 'reviews'], ['contact', 'contact'],
];
const initial = (s: string): string => [...s.trim()][0] ?? '';

// ───────────────────────── ლოგო, ჰედერი, მობილური მენიუ ─────────────────────────

function logo(ctx: Ctx): string {
  const s = ctx.content.settings;
  if (s.logo?.src) {
    return `<img class="logo__img" src="${esc(safeUrl(s.logo.src))}" width="${s.logo.w ?? 160}" height="${s.logo.h ?? 48}" alt="${esc(s.brand)}">`;
  }
  return (
    `<span class="logo__card" aria-hidden="true"><b>J</b>${icon('star')}</span>` +
    `<span class="logo__txt" translate="no"><b>JOKER</b><small>Barbershop</small></span>`
  );
}

function langSwitch(ctx: Ctx): string {
  const links = LANGS.map(
    (l) =>
      `<a href="${langPath(ctx, l)}" lang="${l}" hreflang="${l}" data-lang="${l}"${l === ctx.lang ? ' aria-current="true"' : ''}>${l.toUpperCase()}</a>`,
  ).join('');
  return `<div class="langs" role="group" aria-label="${esc(ctx.t('nav.lang'))}">${links}</div>`;
}

export function header(ctx: Ctx): string {
  const links = NAV.map(([key, id]) => `<a href="#${id}">${esc(ctx.t(`nav.${key}`))}</a>`).join('');
  return (
    `<header class="hdr" data-header><div class="wrap hdr__in">` +
    `<a class="logo" href="#top" aria-label="${esc(ctx.content.settings.brand)} — ${esc(ctx.t('nav.home'))}">${logo(ctx)}</a>` +
    `<nav class="nav" aria-label="${esc(ctx.t('nav.main'))}">${links}</nav>` +
    `<div class="hdr__tools">${langSwitch(ctx)}${bookBtn(ctx, 'btn btn--red hdr__book')}` +
    `<button class="burger" type="button" data-menu-open aria-haspopup="dialog" aria-controls="menu" aria-expanded="false" aria-label="${esc(ctx.t('nav.menu'))}">${icon('menu')}</button>` +
    `</div></div></header>`
  );
}

export function mobileMenu(ctx: Ctx): string {
  const s = ctx.content.settings;
  const links = NAV.map(
    ([key, id], i) => `<li><a href="#${id}" data-menu-close><span class="menu__n" aria-hidden="true">${RANKS[i]}</span>${esc(ctx.t(`nav.${key}`))}</a></li>`,
  ).join('');
  return (
    `<dialog class="menu" id="menu" aria-label="${esc(ctx.t('nav.menu'))}"><div class="menu__in">` +
    `<div class="menu__top"><span class="logo">${logo(ctx)}</span>` +
    `<button class="burger" type="button" data-menu-close aria-label="${esc(ctx.t('nav.close'))}">${icon('close')}</button></div>` +
    `<nav aria-label="${esc(ctx.t('nav.main'))}"><ul class="menu__links">${links}</ul></nav>` +
    `<div class="menu__foot">${langSwitch(ctx)}<div class="menu__cta">${bookBtn(ctx)}${waBtn(ctx)}</div>` +
    `<div class="social">${socialLinks(ctx, s.instagram, s.facebook)}</div></div>` +
    `</div></dialog>`
  );
}

function socialLinks(ctx: Ctx, instagram: string, facebook: string): string {
  const one = (url: string, name: string, ic: string) =>
    url ? `<a href="${esc(safeUrl(url))}" ${EXT} aria-label="${name} — ${esc(ctx.t('a11y.newTab'))}">${icon(ic)}<span translate="no">${name}</span></a>` : '';
  return one(instagram, 'Instagram', 'instagram') + one(facebook, 'Facebook', 'facebook');
}

// ───────────────────────── სამუშაო საათები და სტატუსი ─────────────────────────

/** ცოცხალი „ღიაა ახლა" — ტექსტს ავსებს JS (თბილისის დროით); აქ მხოლოდ საათები ჩანს */
function statusPill(b: Branch): string {
  const u = uniformHours(b.hours);
  const fallback = u ? `${u.open}–${u.close}` : '';
  return `<span class="status" data-open-status data-hours="${esc(JSON.stringify(b.hours))}"><i aria-hidden="true"></i><span>${esc(fallback)}</span></span>`;
}

function hoursText(ctx: Ctx, b: Branch): string {
  const u = uniformHours(b.hours);
  if (u) return `${esc(ctx.t('hours.everyday'))} · <span class="num">${esc(u.open)}–${esc(u.close)}</span>`;
  const rows = b.hours
    .map(
      (h, i) =>
        `<li data-day="${i}"><span>${esc(ctx.t(`day.${i}`))}</span><span class="num">${h.closed ? esc(ctx.t('hours.closed')) : `${esc(h.open)}–${esc(h.close)}`}</span></li>`,
    )
    .join('');
  return `<ul class="hours">${rows}</ul>`;
}

// ───────────────────────── ჰერო: ხუთკარტიანი ხელი ─────────────────────────

function slideArt(ctx: Ctx, s: Slide, i: number): string {
  const rank = RANKS[i % RANKS.length];
  const corners = cornerIndex(rank, s.suit) + cornerIndex(rank, s.suit, 'idx--b');
  if (s.variant === 'branches') {
    const cards = visible(ctx.content.branches)
      .map((b) => {
        const name = pick(b.name, ctx.lang);
        return (
          `<a class="bcard pcard" href="${esc(safeUrl(b.bookingUrl))}" ${EXT}>` +
          cornerIndex(initial(name), b.suit) +
          `<strong class="display bcard__name">${esc(name)}</strong>` +
          `<span class="bcard__addr">${esc(pick(b.address, ctx.lang))}</span>` +
          statusPill(b) +
          `<span class="bcard__go">${esc(ctx.t('cta.bookOnline'))}${icon('arrow-up-right')}</span></a>`
        );
      })
      .join('');
    return `<div class="bcards">${cards}</div>`;
  }
  let face = '';
  if (s.variant === 'photo' && s.image?.src) {
    face = `<div class="pcard__photo">${picture(ctx, s.image, { alt: pick(s.imageAlt, ctx.lang), sizes: '(min-width: 900px) 380px, 62vw', cls: 'cover', eager: i === 0 })}</div>`;
  } else if (s.variant === 'rating') {
    const st = ctx.content.settings;
    face =
      `<div class="five" role="img" aria-label="${esc(ctx.t('reviews.ratingLabel', { value: st.ratingValue }))}">` +
      icon('star').repeat(5) +
      `</div><p class="five__val display" aria-hidden="true">${esc(st.ratingValue)}</p>`;
  } else {
    // ბრენდის კარტი: ლოგო წრეში + სლოგანი (ყოველთვის ორიგინალი, ინგლისურად)
    const st = ctx.content.settings;
    const mark = st.logo?.src
      ? `<img src="${esc(safeUrl(st.logo.src))}" width="${st.logo.w ?? 240}" height="${st.logo.h ?? 240}" alt="">`
      : `<b class="display">JOKER</b><small>Barbershop</small>`;
    face =
      `<div class="joker" translate="no"><div class="joker__mark">${mark}</div>` +
      `<p class="joker__words"><span>Peace</span>${icon('heart')}<span>Friendship</span>${icon('club')}<span>Haircut</span>${icon('spade')}</p></div>`;
  }
  return `<div class="deck"><div class="pcard pcard--${s.variant}">${corners}<div class="pcard__face">${face}</div></div></div>`;
}

export function hero(ctx: Ctx): string {
  const slides = visible(ctx.content.slides);
  const total = slides.length;
  const items = slides
    .map((s, i) => {
      const kicker = `${suitIcon(s.suit)}<span>${esc(pick(s.kicker, ctx.lang))}</span>`;
      // პირველი სლაიდი: h1 არის პატარა წარწერა (ბრენდი + კატეგორია), სლოგანი — დიდი ტექსტი
      const head =
        i === 0
          ? `<h1 class="kicker">${kicker}</h1><p class="display slide__title">${titleLines(pick(s.title, ctx.lang))}</p>`
          : `<p class="kicker">${kicker}</p><h2 class="display slide__title">${titleLines(pick(s.title, ctx.lang))}</h2>`;
      return (
        `<article class="slide${i === 0 ? ' is-active' : ''}" data-slide role="group" aria-roledescription="slide" aria-label="${esc(ctx.t('hero.slideOf', { n: i + 1, total }))}"${i === 0 ? '' : ' inert'}>` +
        `<div class="slide__text">${head}<p class="slide__lead">${esc(pick(s.text, ctx.lang))}</p>` +
        `<div class="slide__cta">${actionBtn(ctx, s.cta, true)}${actionBtn(ctx, s.cta2, false)}</div></div>` +
        `<div class="slide__art">${slideArt(ctx, s, i)}</div></article>`
      );
    })
    .join('');
  const dots = slides
    .map(
      (_, i) =>
        `<button type="button" class="dot" data-goto="${i}" aria-label="${esc(ctx.t('hero.goto', { n: i + 1 }))}"${i === 0 ? ' aria-current="true"' : ''}><span aria-hidden="true">${RANKS[i % RANKS.length]}</span></button>`,
    )
    .join('');
  const ctrl =
    total > 1
      ? `<div class="hero__ctrl">` +
        `<button type="button" class="ctl" data-prev aria-label="${esc(ctx.t('hero.prev'))}">${icon('arrow-left')}</button>` +
        `<div class="dots">${dots}</div>` +
        `<button type="button" class="ctl" data-next aria-label="${esc(ctx.t('hero.next'))}">${icon('arrow-right')}</button>` +
        `<button type="button" class="ctl ctl--pause" data-pause aria-pressed="false" aria-label="${esc(ctx.t('hero.pause'))}">${icon('pause')}${icon('play')}</button>` +
        `</div>`
      : '';
  return (
    `<section class="hero" id="top" data-slider data-interval="6500" aria-roledescription="carousel" aria-label="${esc(ctx.t('hero.label'))}">` +
    `<div class="wrap hero__in"><div class="slides" data-slides>${items}</div>${ctrl}</div></section>`
  );
}

// ───────────────────────── სერვისები და ფასები ─────────────────────────

export function services(ctx: Ctx): string {
  const cats = visible(ctx.content.categories)
    .map((c) => {
      const items = visible(c.items)
        .map((s) => {
          const desc = pick(s.desc, ctx.lang);
          const dur = formatDuration(s.duration, ctx.t);
          const meta = [desc ? esc(desc) : '', dur ? `<span class="mitem__dur">${icon('clock')}${esc(dur)}</span>` : ''].filter(Boolean).join(' ');
          return (
            `<li class="mitem"><div class="mitem__row"><span class="mitem__name">${esc(pick(s.name, ctx.lang))}</span>` +
            `<span class="mitem__dots" aria-hidden="true"></span><span class="mitem__price num">${esc(formatPrice(s.price, s.priceFrom, ctx.t))}</span></div>` +
            (meta ? `<p class="mitem__meta">${meta}</p>` : '') +
            `</li>`
          );
        })
        .join('');
      return `<section class="mcat"><h3 class="mcat__t">${suitIcon(c.suit)}<span>${esc(pick(c.title, ctx.lang))}</span></h3><ul class="mlist">${items}</ul></section>`;
    })
    .join('');
  const corners = ['spade', 'heart', 'club', 'diamond'].map((s, i) => `<span class="sheet__pip sheet__pip--${i}" aria-hidden="true">${icon(s)}</span>`).join('');
  return (
    `<section class="sec" id="services" aria-labelledby="services-h"><div class="wrap">` +
    sectionHead(ctx, 'services', 'spade') +
    `<div class="sheet">${corners}<div class="sheet__cols">${cats}</div>` +
    `<div class="sheet__foot"><p class="sheet__note">${esc(ctx.t('services.note'))}</p><div class="sheet__cta">${bookBtn(ctx)}${waBtn(ctx)}</div></div></div>` +
    `</div></section>`
  );
}

// ───────────────────────── ბარბერები ─────────────────────────

function barberCard(ctx: Ctx, b: Barber, branches: Branch[]): string {
  const name = pick(b.name, ctx.lang);
  const role = pick(b.role, ctx.lang);
  const branch = branches.find((x) => x.id === b.branchId);
  const suit = branch?.suit ?? 'star';
  const langs = b.languages.map((l) => ctx.t(`lang.${l}`)).join(', ');
  const spec = pick(b.specialties, ctx.lang);
  const fact = (label: string, value: string) => (value ? `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>` : '');
  const front = b.photo?.src
    ? `<div class="pcard__photo">${picture(ctx, b.photo, { alt: `${name}, ${role}`, sizes: '(min-width: 900px) 280px, 70vw', cls: 'cover' })}</div>`
    : `<div class="court" aria-hidden="true"><span>${esc(initial(name))}</span><span>${esc(initial(name))}</span></div>`;
  let action: string;
  if (b.bookable) {
    const url = b.bookingUrl || branch?.bookingUrl || ctx.content.settings.bookingUrl;
    // ფილიალი ცნობილია → პირდაპირ მის Altegio-ზე; უცნობია → ფილიალის არჩევა
    action = `<a class="btn btn--red" href="${esc(safeUrl(url))}"${b.bookingUrl || branch ? '' : ' data-book'} ${EXT}>${esc(ctx.t('cta.bookWith', { name }))}</a>`;
  } else {
    action = branch ? `<a class="btn btn--red" href="${esc(branchWa(ctx, branch))}" ${EXT}>${icon('whatsapp')}<span>WhatsApp</span></a>` : waBtn(ctx, 'btn btn--red', 'WhatsApp');
  }
  return (
    `<li class="flip" data-flip data-branch="${esc(b.branchId)}"><div class="flip__in">` +
    `<div class="flip__face flip__front pcard">${cornerIndex(initial(name), suit)}${cornerIndex(initial(name), suit, 'idx--b')}${front}` +
    `<div class="flip__cap"><h3 class="display flip__name">${esc(name)}</h3><p>${esc(role)}</p></div>` +
    `<button type="button" class="flip__btn" data-flip-btn aria-expanded="false" aria-label="${esc(ctx.t('barbers.flip', { name }))}">${icon('flip')}</button></div>` +
    `<div class="flip__face flip__back pcard" inert>${cornerIndex(initial(name), suit)}` +
    `<p class="display flip__name">${esc(name)}</p><p class="flip__role">${esc(role)}</p>` +
    `<dl class="facts">${fact(ctx.t('barbers.specialty'), spec)}${fact(ctx.t('barbers.languages'), langs)}${fact(ctx.t('barbers.branch'), branch ? `${pick(branch.name, ctx.lang)} · ${pick(branch.address, ctx.lang)}` : '')}</dl>` +
    `<div class="flip__act">${action}<button type="button" class="flip__btn flip__btn--back" data-flip-btn aria-label="${esc(ctx.t('barbers.flip', { name }))}">${icon('flip')}</button></div></div>` +
    `</div></li>`
  );
}

export function barbers(ctx: Ctx): string {
  const branches = visible(ctx.content.branches);
  const crew = visible(ctx.content.barbers);
  if (!crew.length) return '';
  const used = branches.filter((b) => crew.some((p) => p.branchId === b.id));
  const chips =
    used.length > 1
      ? `<div class="chips" role="group" aria-label="${esc(ctx.t('barbers.filter'))}">` +
        `<button type="button" class="chip" data-filter="" aria-pressed="true">${esc(ctx.t('barbers.all'))}</button>` +
        used.map((b) => `<button type="button" class="chip" data-filter="${esc(b.id)}" aria-pressed="false">${suitIcon(b.suit)}<span>${esc(pick(b.name, ctx.lang))}</span></button>`).join('') +
        `</div>`
      : '';
  return (
    `<section class="sec sec--ink" id="barbers" aria-labelledby="barbers-h"><div class="wrap">` +
    sectionHead(ctx, 'barbers', 'club', chips) +
    `<ul class="crew" data-crew>${crew.map((b) => barberCard(ctx, b, branches)).join('')}</ul>` +
    `<p class="crew__empty" data-crew-empty hidden>${esc(ctx.t('barbers.empty'))}</p>` +
    `</div></section>`
  );
}

// ───────────────────────── ფილიალები ─────────────────────────

function branchMap(ctx: Ctx, b: Branch, name: string): string {
  if (!hasCoords(b.lat, b.lng)) return '';
  const g = tileGrid(b.lat, b.lng, 16);
  const tiles = g.tiles
    .map((t) => `<img src="https://tile.openstreetmap.org/16/${t.x}/${t.y}.png" width="256" height="256" alt="" loading="lazy" decoding="async">`)
    .join('');
  return (
    `<div class="map" data-map data-embed="${esc(osmEmbed(b.lat, b.lng))}" data-title="${esc(name)}">` +
    `<a class="map__link" href="${esc(mapLink(b.lat, b.lng))}" ${EXT} aria-label="${esc(ctx.t('branches.mapOpen', { name }))}">` +
    `<span class="map__tiles" style="--ox:${g.offsetX.toFixed(1)}px;--oy:${g.offsetY.toFixed(1)}px" aria-hidden="true">${tiles}</span>` +
    `<span class="map__pin" aria-hidden="true">${suitIcon(b.suit)}</span></a>` +
    `<button type="button" class="map__btn" data-map-live>${esc(ctx.t('branches.mapInteractive'))}</button>` +
    `<small class="map__attr">© <a href="https://www.openstreetmap.org/copyright" ${EXT} translate="no">OpenStreetMap</a></small></div>`
  );
}

export function branches(ctx: Ctx): string {
  const list = visible(ctx.content.branches);
  if (!list.length) return '';
  const cards = list
    .map((b) => {
      const name = pick(b.name, ctx.lang);
      const hint = pick(b.hint, ctx.lang);
      const rating = b.rating
        ? `<div><dt>${icon('star', 'star')}<span class="num">${esc(b.rating)}</span></dt><dd>${b.reviewsCount ? esc(ctx.t('branches.reviews', { count: b.reviewsCount })) : ''}</dd></div>`
        : '';
      const phone = b.phone ? `<div><dt>${esc(ctx.t('a11y.phone'))}</dt><dd><a class="num" href="${telLink(b.phone)}">${esc(b.phone)}</a></dd></div>` : '';
      const wa = b.whatsapp || b.phone ? `<a class="btn btn--line" href="${esc(branchWa(ctx, b))}" ${EXT}>${icon('whatsapp')}<span>WhatsApp</span></a>` : '';
      const dir = hasCoords(b.lat, b.lng) ? `<a class="btn btn--line" href="${esc(directionsLink(b.lat, b.lng))}" ${EXT}>${icon('pin')}<span>${esc(ctx.t('cta.directions'))}</span></a>` : '';
      return (
        `<article class="branch" id="branch-${esc(b.id)}">${branchMap(ctx, b, name)}<div class="branch__body">` +
        `<div class="branch__top">${cornerIndex(initial(name), b.suit)}<h3 class="display branch__name">${esc(name)}</h3>${statusPill(b)}</div>` +
        `<p class="branch__addr">${esc(pick(b.address, ctx.lang))}${hint ? `<span>${esc(hint)}</span>` : ''}</p>` +
        `<dl class="facts facts--row"><div><dt>${esc(ctx.t('hours.title'))}</dt><dd>${hoursText(ctx, b)}</dd></div>${phone}${rating}</dl>` +
        `<div class="branch__cta"><a class="btn btn--red" href="${esc(safeUrl(b.bookingUrl))}" ${EXT}>${esc(ctx.t('cta.bookHere'))}</a>${dir}${wa}</div>` +
        `</div></article>`
      );
    })
    .join('');
  return (
    `<section class="sec" id="branches" aria-labelledby="branches-h"><div class="wrap">` +
    sectionHead(ctx, 'branches', 'diamond') +
    `<div class="branches" data-count="${list.length}">${cards}</div></div></section>`
  );
}

// ───────────────────────── ნამუშევრები ─────────────────────────

export function gallery(ctx: Ctx): string {
  const items = visible(ctx.content.gallery);
  if (!items.length) return '';
  const shots = items
    .map((g, i) => {
      const info = imageInfo(ctx, g.image);
      const alt = pick(g.alt, ctx.lang);
      return (
        `<button type="button" class="shot" data-lb="${i}" data-full="${esc(info.full)}" data-alt="${esc(alt)}" style="--ar:${info.ratio.toFixed(3)}" aria-label="${esc(ctx.t('gallery.open', { alt }))}">` +
        picture(ctx, g.image, { alt, sizes: '(min-width: 900px) 30vw, 50vw', cls: 'cover' }) +
        `</button>`
      );
    })
    .join('');
  const ig = ctx.content.settings.instagram;
  const more = ig
    ? `<a class="shot shot--cta" href="${esc(safeUrl(ig))}" ${EXT}>${icon('instagram')}<span class="display">${esc(ctx.t('cta.moreInstagram'))}</span>${icon('arrow-up-right')}</a>`
    : '';
  return (
    `<section class="sec" id="works" aria-labelledby="gallery-h"><div class="wrap">` +
    sectionHead(ctx, 'gallery', 'heart') +
    `<div class="shots">${shots}${more}</div></div></section>`
  );
}

// ───────────────────────── შეფასებები ─────────────────────────

export function reviews(ctx: Ctx): string {
  const list = visible(ctx.content.reviews);
  const st = ctx.content.settings;
  const quotes = list
    .map(
      (r, i) =>
        `<figure class="quote${i === 0 ? ' is-active' : ''}" data-slide${i === 0 ? '' : ' inert'}>${icon('quote')}` +
        `<blockquote><p>${esc(pick(r.text, ctx.lang))}</p></blockquote><figcaption>${esc(ctx.t('reviews.source'))}</figcaption></figure>`,
    )
    .join('');
  const by = visible(ctx.content.branches)
    .filter((b) => b.rating)
    .map(
      (b) =>
        `<li><span>${esc(pick(b.name, ctx.lang))}</span><span class="num">${esc(b.rating)}${icon('star', 'star')}</span>` +
        (b.reviewsCount ? `<span>${esc(ctx.t('branches.reviews', { count: b.reviewsCount }))}</span>` : '') +
        `</li>`,
    )
    .join('');
  const ctrl =
    list.length > 1
      ? `<div class="hero__ctrl quotes__ctrl">` +
        `<button type="button" class="ctl" data-prev aria-label="${esc(ctx.t('reviews.prev'))}">${icon('arrow-left')}</button>` +
        `<button type="button" class="ctl" data-next aria-label="${esc(ctx.t('reviews.next'))}">${icon('arrow-right')}</button>` +
        `<button type="button" class="ctl ctl--pause" data-pause aria-pressed="false" aria-label="${esc(ctx.t('hero.pause'))}">${icon('pause')}${icon('play')}</button>` +
        `<span class="count num" data-count aria-hidden="true">1 / ${list.length}</span></div>`
      : '';
  return (
    `<section class="sec sec--red" id="reviews" aria-labelledby="reviews-h"><div class="wrap reviews">` +
    `<div class="reviews__score"><header class="sec__head" data-reveal><p class="kicker">${icon('star', 'suit')}<span>${esc(ctx.t('reviews.kicker'))}</span></p>` +
    `<h2 class="display sec__title" id="reviews-h">${esc(ctx.t('reviews.title'))}</h2></header>` +
    `<p class="score"><b class="display num" aria-hidden="true">${esc(st.ratingValue)}</b>` +
    `<span class="score__meta"><span class="stars" role="img" aria-label="${esc(ctx.t('reviews.ratingLabel', { value: st.ratingValue }))}">${icon('star').repeat(5)}</span>` +
    `<span>${esc(ctx.t('reviews.count', { count: st.ratingCount }))}</span></span></p>` +
    (by ? `<ul class="score__by">${by}</ul>` : '') +
    `</div>` +
    (list.length
      ? `<div class="quotes" data-slider data-interval="7000" aria-roledescription="carousel" aria-label="${esc(ctx.t('reviews.title'))}"><div class="quotes__list pcard" data-slides>${quotes}</div>${ctrl}</div>`
      : '') +
    `</div></section>`
  );
}

// ───────────────────────── FAQ ─────────────────────────

export function faq(ctx: Ctx): string {
  const list = visible(ctx.content.faq);
  if (!list.length) return '';
  const items = list
    .map(
      (f, i) =>
        `<details class="qa" name="faq"><summary><span class="qa__n num" aria-hidden="true">${RANKS[i % RANKS.length]}</span>` +
        `<span class="qa__q">${esc(pick(f.q, ctx.lang))}</span>${icon('plus')}</summary><div class="qa__a"><p>${esc(pick(f.a, ctx.lang))}</p></div></details>`,
    )
    .join('');
  return (
    `<section class="sec" id="faq" aria-labelledby="faq-h"><div class="wrap faq">` +
    sectionHead(ctx, 'faq', 'star', `<div class="faq__cta">${waBtn(ctx, 'btn btn--ink')}</div>`) +
    `<div class="faq__list">${items}</div></div></section>`
  );
}

// ───────────────────────── ფუტერი, მცურავი ზოლი, დიალოგები ─────────────────────────

export function footer(ctx: Ctx): string {
  const s = ctx.content.settings;
  const branchList = visible(ctx.content.branches)
    .map((b) => {
      const u = uniformHours(b.hours);
      return (
        `<li><strong>${esc(pick(b.name, ctx.lang))}</strong><span>${esc(pick(b.address, ctx.lang))}</span>` +
        (b.phone ? `<a class="num" href="${telLink(b.phone)}">${esc(b.phone)}</a>` : '') +
        (u ? `<span>${esc(ctx.t('hours.everyday'))} · <span class="num">${esc(u.open)}–${esc(u.close)}</span></span>` : '') +
        `</li>`
      );
    })
    .join('');
  const nav = NAV.slice(0, 5).map(([key, id]) => `<li><a href="#${id}">${esc(ctx.t(`nav.${key}`))}</a></li>`).join('');
  const credit = s.creditName
    ? `<span>${esc(ctx.t('footer.credit'))} ${s.creditUrl ? `<a href="${esc(safeUrl(s.creditUrl))}" ${EXT} translate="no">${esc(s.creditName)}</a>` : `<span translate="no">${esc(s.creditName)}</span>`}</span>`
    : '';
  return (
    `<footer class="ftr" id="contact"><div class="wrap">` +
    `<div class="ftr__cta"><p class="display ftr__title">${titleLines(ctx.t('footer.ctaTitle'))}</p>` +
    `<div class="ftr__act"><p>${esc(ctx.t('footer.ctaText'))}</p><div class="slide__cta">${bookBtn(ctx)}${waBtn(ctx, 'btn btn--paper')}</div></div></div>` +
    `<div class="ftr__cols"><div class="ftr__brand"><span class="logo">${logo(ctx)}</span><p>${esc(ctx.t('footer.tagline'))}</p>` +
    `<div class="social">${socialLinks(ctx, s.instagram, s.facebook)}</div></div>` +
    `<div><h2 class="ftr__h">${esc(ctx.t('footer.branches'))}</h2><ul class="ftr__branches">${branchList}</ul></div>` +
    `<div><h2 class="ftr__h">${esc(ctx.t('footer.nav'))}</h2><ul class="ftr__nav">${nav}</ul></div></div>` +
    `<div class="ftr__legal"><span>© ${ctx.year} <span translate="no">${esc(s.brand)}</span> · ${esc(ctx.t('footer.rights'))}</span>${credit}` +
    `<span>${esc(ctx.t('gallery.credit'))}</span><a href="#top">${esc(ctx.t('footer.top'))}${icon('arrow-up-right')}</a></div>` +
    `</div></footer>`
  );
}

/** მცურავი ზოლი მობილურზე: „ჩაწერა" + WhatsApp */
export function floatBar(ctx: Ctx): string {
  return `<div class="fab" role="group" aria-label="${esc(ctx.t('float.label'))}">${bookBtn(ctx)}${waBtn(ctx, 'btn btn--ink', 'WhatsApp')}</div>`;
}

/** ფილიალის არჩევა: „ჩაწერა" → Altegio ან WhatsApp */
export function bookDialog(ctx: Ctx): string {
  const list = visible(ctx.content.branches);
  const rows = (mode: 'book' | 'wa') =>
    list
      .filter((b) => (mode === 'book' ? b.bookingUrl : b.whatsapp || b.phone))
      .map((b) => {
        const name = pick(b.name, ctx.lang);
        const href = mode === 'book' ? safeUrl(b.bookingUrl) : branchWa(ctx, b);
        return (
          `<li><a class="pick" href="${esc(href)}" ${EXT} data-branch-link="${mode}">${cornerIndex(initial(name), b.suit)}` +
          `<span class="pick__txt"><strong class="display">${esc(name)}</strong><span>${esc(pick(b.address, ctx.lang))}</span>${statusPill(b)}</span>` +
          icon(mode === 'book' ? 'arrow-up-right' : 'whatsapp') +
          `</a></li>`
        );
      })
      .join('');
  const panel = (mode: 'book' | 'wa', title: string, text: string) =>
    `<div class="sheet2__panel" data-mode="${mode}"${mode === 'wa' ? ' hidden' : ''}><h2 class="display" id="pick-${mode}">${esc(title)}</h2><p>${esc(text)}</p><ul class="picks">${rows(mode)}</ul></div>`;
  return (
    `<dialog class="sheet2" id="pick" aria-labelledby="pick-book">` +
    `<button type="button" class="burger sheet2__x" data-dialog-close aria-label="${esc(ctx.t('nav.close'))}">${icon('close')}</button>` +
    panel('book', ctx.t('dialog.bookTitle'), ctx.t('dialog.bookText')) +
    panel('wa', ctx.t('dialog.waTitle'), ctx.t('dialog.waText')) +
    `</dialog>`
  );
}

export function lightbox(ctx: Ctx): string {
  return (
    `<dialog class="lb" id="lightbox" aria-label="${esc(ctx.t('gallery.dialog'))}">` +
    `<button type="button" class="ctl lb__x" data-dialog-close aria-label="${esc(ctx.t('nav.close'))}">${icon('close')}</button>` +
    `<button type="button" class="ctl lb__prev" data-lb-prev aria-label="${esc(ctx.t('gallery.prev'))}">${icon('arrow-left')}</button>` +
    `<img class="lb__img" data-lb-img src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" alt="" width="1200" height="1600" decoding="async">` +
    `<button type="button" class="ctl lb__next" data-lb-next aria-label="${esc(ctx.t('gallery.next'))}">${icon('arrow-right')}</button>` +
    `<p class="lb__count num" data-lb-count aria-live="polite"></p></dialog>`
  );
}

/** ტექსტები, რომლებიც JS-ს სჭირდება (სტატუსები, დღეები, სლაიდერის წარწერები) */
export function clientI18n(ctx: Ctx): string {
  const keys = [
    'status.open', 'status.closing', 'status.closed', 'status.until', 'status.opensToday', 'status.opensTomorrow', 'status.opensLater',
    'hero.pause', 'hero.play', 'day.0', 'day.1', 'day.2', 'day.3', 'day.4', 'day.5', 'day.6',
  ];
  const dict: Record<string, string> = {};
  for (const k of keys) dict[k] = ctx.t(k);
  return `<script type="application/json" id="i18n">${JSON.stringify(dict).replace(/</g, '\\u003c')}</script>`;
}
