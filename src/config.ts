/**
 * კონფიგურაცია — ერთადერთი ადგილი, სადაც რეჟიმი ირჩევა.
 * .env-ში VITE_SUPABASE_URL და VITE_SUPABASE_ANON_KEY თუ შევსებულია → რეჟიმი "supabase",
 * თუ არა → "demo" (შიგთავსი seed.json-იდან, ადმინის ცვლილებები ბრაუზერის localStorage-ში).
 */
export const SUPABASE_URL: string = (import.meta.env.VITE_SUPABASE_URL ?? '').trim().replace(/\/$/, '');
export const SUPABASE_KEY: string = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim();
export const MODE: 'demo' | 'supabase' = SUPABASE_URL && SUPABASE_KEY ? 'supabase' : 'demo';

/** Supabase-ის ცხრილი და ფოტოების საცავი (იხ. supabase/schema.sql) */
export const TABLE = 'content';
export const BUCKET = 'media';

/** localStorage-ის გასაღებები */
export const LS_CONTENT = 'joker.content';
export const LS_LANG = 'joker.lang';
