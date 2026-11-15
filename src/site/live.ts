/**
 * რენდერი ბრაუზერში. ეს მოდული იტვირთება მხოლოდ მაშინ, როცა შიგთავსი build-ის შემდეგ შეიცვალა
 * (ადმინის ცვლილება) — ჩვეულებრივ ვიზიტორს ეს კოდი საერთოდ არ ჩამოეტვირთება.
 */
import seed from '../content/seed.json';
import media from '../content/media-manifest.json';
import { normalize } from '../content/normalize.ts';
import type { Content, Lang, MediaManifest } from '../content/types.ts';
import { pick } from '../lib/logic.ts';
import { renderApp } from '../render/page.ts';
import { makeCtx } from '../render/ui.ts';

/** გადაარენდერებს #app-ს და აბრუნებს შიგთავსის ვერსიას (updatedAt) */
export function renderLive(raw: unknown): string {
  const content = normalize(raw, seed as unknown as Content);
  const lang = (document.documentElement.lang || 'ka') as Lang;
  const ctx = makeCtx({
    lang,
    base: import.meta.env.BASE_URL,
    siteUrl: location.origin,
    content,
    media: media as MediaManifest,
    year: new Date().getFullYear(),
  });
  const y = window.scrollY;
  document.getElementById('app')!.innerHTML = renderApp(ctx);
  document.title = pick(content.settings.seoTitle, lang) || content.settings.brand;
  window.scrollTo(0, y);
  return content.updatedAt;
}
