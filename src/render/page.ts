/**
 * მთელი გვერდი: renderApp (შიგთავსი #app-ში) და renderHead (SEO ტეგები <head>-ში).
 */
import type { Lang } from '../content/types.ts';
import { LANGS } from '../content/types.ts';
import { esc, hasCoords, mapLink, pick, safeUrl } from '../lib/logic.ts';
import { langPath, sprite, visible } from './ui.ts';
import type { Ctx } from './ui.ts';
import {
  barbers, bookDialog, branches, clientI18n, faq, floatBar, footer, gallery, header, hero, lightbox, mobileMenu, reviews, services,
} from './sections.ts';

export function renderApp(ctx: Ctx): string {
  return [
    `<a class="skip" href="#main">${esc(ctx.t('nav.skip'))}</a>`,
    sprite(),
    header(ctx),
    mobileMenu(ctx),
    `<main id="main">`,
    hero(ctx),
    services(ctx),
    barbers(ctx),
    branches(ctx),
    gallery(ctx),
    reviews(ctx),
    faq(ctx),
    `</main>`,
    footer(ctx),
    floatBar(ctx),
    bookDialog(ctx),
    lightbox(ctx),
    clientI18n(ctx),
  ].join('');
}

const OG_LOCALE: Record<Lang, string> = { ka: 'ka_GE', en: 'en_US', ru: 'ru_RU' };
const CITY: Record<Lang, string> = { ka: 'თბილისი', en: 'Tbilisi', ru: 'Тбилиси' };
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** სრული მისამართი მოცემული ენის გვერდისთვის */
export const pageUrl = (ctx: Ctx, lang: Lang): string => `${ctx.siteUrl}${langPath(ctx, lang)}`;

/** schema.org: ორგანიზაცია + თითო ფილიალი ცალკე HairSalon-ად (LocalBusiness-ის ქვეტიპი; BarberShop ტიპი არ არსებობს) */
export function jsonLd(ctx: Ctx): object {
  const s = ctx.content.settings;
  const home = pageUrl(ctx, ctx.lang);
  const org = `${pageUrl(ctx, 'ka')}#org`;
  const image = `${ctx.siteUrl}${ctx.base}og-image.jpg`;
  const sameAs = [s.instagram, s.facebook].filter(Boolean);
  const shops = visible(ctx.content.branches).map((b) => {
    // ერთნაირი საათების მქონე დღეები ერთ ჩანაწერად
    const groups = new Map<string, string[]>();
    b.hours.forEach((h, i) => {
      if (h.closed) return;
      const k = `${h.open}|${h.close}`;
      groups.set(k, [...(groups.get(k) ?? []), `https://schema.org/${DAYS[i]}`]);
    });
    return {
      '@type': 'HairSalon',
      '@id': `${pageUrl(ctx, 'ka')}#branch-${b.id}`,
      name: `${s.brand} — ${pick(b.name, ctx.lang)}`,
      url: `${home}#branch-${b.id}`,
      image,
      ...(b.phone ? { telephone: `+${b.phone.replace(/\D/g, '')}` } : {}),
      address: {
        '@type': 'PostalAddress',
        streetAddress: pick(b.address, ctx.lang),
        addressLocality: CITY[ctx.lang],
        addressCountry: 'GE',
      },
      ...(hasCoords(b.lat, b.lng)
        ? { geo: { '@type': 'GeoCoordinates', latitude: b.lat, longitude: b.lng }, hasMap: mapLink(b.lat, b.lng) }
        : {}),
      openingHoursSpecification: [...groups.entries()].map(([k, days]) => ({
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: days,
        opens: k.split('|')[0],
        closes: k.split('|')[1],
      })),
      currenciesAccepted: 'GEL',
      parentOrganization: { '@id': org },
      ...(sameAs.length ? { sameAs } : {}),
      ...(b.bookingUrl ? { potentialAction: { '@type': 'ReserveAction', target: safeUrl(b.bookingUrl) } } : {}),
    };
  });
  return {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Organization', '@id': org, name: s.brand, url: pageUrl(ctx, 'ka'), logo: `${ctx.siteUrl}${ctx.base}apple-touch-icon.png`, ...(sameAs.length ? { sameAs } : {}) },
      { '@type': 'WebSite', '@id': `${pageUrl(ctx, 'ka')}#site`, name: s.brand, url: pageUrl(ctx, 'ka'), inLanguage: LANGS, publisher: { '@id': org } },
      ...shops,
    ],
  };
}

/** <head>-ის SEO ნაწილი: სათაური, აღწერა, canonical, hreflang, Open Graph, JSON-LD */
export function renderHead(ctx: Ctx): string {
  const s = ctx.content.settings;
  const title = pick(s.seoTitle, ctx.lang) || s.brand;
  const desc = pick(s.seoDescription, ctx.lang);
  const url = pageUrl(ctx, ctx.lang);
  const image = `${ctx.siteUrl}${ctx.base}og-image.jpg`;
  const alternates = LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${esc(pageUrl(ctx, l))}">`).join('\n');
  const ogAlt = LANGS.filter((l) => l !== ctx.lang).map((l) => `<meta property="og:locale:alternate" content="${OG_LOCALE[l]}">`).join('\n');
  return [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(desc)}">`,
    `<link rel="canonical" href="${esc(url)}">`,
    alternates,
    `<link rel="alternate" hreflang="x-default" href="${esc(pageUrl(ctx, 'ka'))}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="${esc(s.brand)}">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(desc)}">`,
    `<meta property="og:url" content="${esc(url)}">`,
    `<meta property="og:image" content="${esc(image)}">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta property="og:image:alt" content="${esc(s.brand)} — Peace | Friendship | Haircut">`,
    `<meta property="og:locale" content="${OG_LOCALE[ctx.lang]}">`,
    ogAlt,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<script type="application/ld+json">${JSON.stringify(jsonLd(ctx)).replace(/</g, '\\u003c')}</script>`,
  ].join('\n');
}
