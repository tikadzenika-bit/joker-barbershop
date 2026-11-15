/**
 * ნებისმიერი წყაროდან (localStorage, Supabase, იმპორტირებული JSON) მოსული შიგთავსის
 * „გასწორება": რაც აკლია, ივსება seed-იდან, ამიტომ რენდერი არასდროს ტყდება.
 */
import type { Content } from './types.ts';
import { COLLECTIONS } from './types.ts';

export function normalize(raw: unknown, seed: Content): Content {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<Content>;
  const out = {
    version: 1 as const,
    updatedAt: typeof r.updatedAt === 'string' && r.updatedAt ? r.updatedAt : seed.updatedAt,
    settings: { ...seed.settings, ...(r.settings && typeof r.settings === 'object' ? r.settings : {}) },
    // ახალი ტექსტის გასაღები (შაბლონის განახლებისას) ავტომატურად ჩნდება seed-ის მნიშვნელობით
    texts: { ...seed.texts, ...(r.texts && typeof r.texts === 'object' ? r.texts : {}) },
  } as Content;
  for (const name of COLLECTIONS) {
    (out as unknown as Record<string, unknown>)[name] = Array.isArray(r[name]) ? r[name] : seed[name];
  }
  // ფილიალს ყოველთვის 7 დღის საათები უნდა ჰქონდეს
  out.branches = out.branches.map((b) => ({
    ...b,
    hours: Array.from({ length: 7 }, (_, i) => b.hours?.[i] ?? { open: '11:00', close: '21:00', closed: false }),
  }));
  out.categories = out.categories.map((c) => ({ ...c, items: Array.isArray(c.items) ? c.items : [] }));
  out.barbers = out.barbers.map((b) => ({ ...b, languages: Array.isArray(b.languages) ? b.languages : [] }));
  return out;
}
