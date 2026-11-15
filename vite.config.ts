/**
 * Vite-ის კონფიგურაცია + „joker-prerender" პლაგინი.
 *
 * პლაგინი build-ის (და dev სერვერის) დროს იღებს შიგთავსს — Supabase-იდან, თუ .env შევსებულია,
 * თუ არა seed.json-იდან — და src/render-ის ფუნქციებით აგენერირებს მზა HTML-ს სამივე ენაზე:
 *   index.html → ქართული,  en/index.html → ინგლისური,  ru/index.html → რუსული.
 * ასევე ქმნის sitemap.xml-ს და robots.txt-ს.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import type { Plugin } from 'vite';
import { normalize } from './src/content/normalize.ts';
import { LANGS } from './src/content/types.ts';
import type { Content, Lang, MediaManifest } from './src/content/types.ts';
import { fromRows } from './src/lib/rows.ts';
import { pageUrl, renderApp, renderHead } from './src/render/page.ts';
import { makeCtx } from './src/render/ui.ts';

const root = fileURLToPath(new URL('.', import.meta.url));
const r = (p: string) => resolve(root, p);
const readJson = (p: string) => JSON.parse(readFileSync(r(p), 'utf8'));

function jokerPrerender(env: Record<string, string>): Plugin {
  let base = '/';
  let isBuild = false;
  let cached: Content | null = null;
  // საიტის მისამართი: .env → Netlify (URL) → Vercel → ლოკალური
  const siteUrl = (
    env.VITE_SITE_URL ||
    process.env.URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '') ||
    'http://localhost:4173'
  ).replace(/\/$/, '');

  async function loadContent(): Promise<Content> {
    if (cached && isBuild) return cached;
    const seed = readJson('src/content/seed.json') as Content;
    let raw: unknown = seed;
    const url = (env.VITE_SUPABASE_URL || '').trim().replace(/\/$/, '');
    const key = (env.VITE_SUPABASE_ANON_KEY || '').trim();
    if (url && key) {
      try {
        const res = await fetch(`${url}/rest/v1/content?select=collection,id,position,data`, {
          headers: { apikey: key, Authorization: `Bearer ${key}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const rows = await res.json();
        if (Array.isArray(rows) && rows.length) raw = fromRows(rows);
        else console.warn('[joker] Supabase-ის ცხრილი ცარიელია — გამოიყენება seed.json');
      } catch (err) {
        console.warn('[joker] Supabase-იდან შიგთავსი ვერ ჩამოიტვირთა — გამოიყენება seed.json:', err);
      }
    }
    cached = normalize(raw, seed);
    return cached;
  }
  const media = (): MediaManifest => (existsSync(r('src/content/media-manifest.json')) ? readJson('src/content/media-manifest.json') : {});
  const ctxFor = async (lang: Lang) =>
    makeCtx({ lang, base, siteUrl, content: await loadContent(), media: media(), year: new Date().getFullYear() });

  return {
    name: 'joker-prerender',
    configResolved(c) {
      base = c.base;
      isBuild = c.command === 'build';
    },
    transformIndexHtml: {
      order: 'post',
      async handler(html, { path }) {
        if (!html.includes('<!--app-->')) return html; // ადმინის გვერდი
        const p = path.replace(/\\/g, '/');
        const lang: Lang = p.includes('/en/') ? 'en' : p.includes('/ru/') ? 'ru' : 'ka';
        const ctx = await ctxFor(lang);
        return html
          .replace('<!--head-->', () => renderHead(ctx))
          .replace('<!--app-->', () => renderApp(ctx))
          .replace('data-rev=""', () => `data-rev="${ctx.content.updatedAt}"`);
      },
    },
    async generateBundle() {
      const ctx = await ctxFor('ka');
      const urls = LANGS.map((l) => {
        const alts = LANGS.map((a) => `    <xhtml:link rel="alternate" hreflang="${a}" href="${pageUrl(ctx, a)}"/>`).join('\n');
        return `  <url>\n    <loc>${pageUrl(ctx, l)}</loc>\n    <lastmod>${ctx.content.updatedAt.slice(0, 10)}</lastmod>\n${alts}\n  </url>`;
      }).join('\n');
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls}\n</urlset>\n`,
      });
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: `User-agent: *\nAllow: /\nDisallow: ${base}admin/\n\nSitemap: ${siteUrl}${base}sitemap.xml\n`,
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, root, 'VITE_');
  return {
    // GitHub Pages-ზე ქვესაქაღალდეში გასაშვებად: VITE_BASE=/repo-name/
    base: env.VITE_BASE || '/',
    plugins: [jokerPrerender(env)],
    build: {
      target: 'es2022',
      rolldownOptions: {
        input: { main: r('index.html'), en: r('en/index.html'), ru: r('ru/index.html'), admin: r('admin/index.html') },
      },
    },
  };
});
