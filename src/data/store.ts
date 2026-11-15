/**
 * მონაცემთა შრე ადმინისთვის — ერთი ინტერფეისი ორი რეჟიმისთვის (იხ. src/config.ts):
 *   demo     → seed.json + ბრაუზერის localStorage (ფოტოები data: URL-ად)
 *   supabase → Postgres ცხრილი `content` + Storage bucket `media` + Auth
 * საჯარო საიტი ამ ფაილს არ ტვირთავს (ის პირდაპირ REST-ით კითხულობს), ამიტომ
 * supabase-js მხოლოდ ადმინის გვერდზე ჩამოიტვირთება.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import seedJson from '../content/seed.json';
import { BUCKET, LS_CONTENT, MODE, SUPABASE_KEY, SUPABASE_URL, TABLE } from '../config.ts';
import { normalize } from '../content/normalize.ts';
import type { Content, ImageRef } from '../content/types.ts';
import { diffRows, fromRows, toRows } from '../lib/rows.ts';
import type { Row } from '../lib/rows.ts';

export const seed = seedJson as unknown as Content;
export { MODE };

let client: SupabaseClient | null = null;
/** ბოლოს ჩატვირთული/შენახული სტრიქონები — შენახვისას იგზავნება მხოლოდ განსხვავება */
let lastRows: Row[] = [];

async function sb(): Promise<SupabaseClient> {
  if (!client) {
    const { createClient } = await import('@supabase/supabase-js');
    client = createClient(SUPABASE_URL, SUPABASE_KEY);
  }
  return client;
}

// ───────────────────────── ავტორიზაცია ─────────────────────────

/** შესული მომხმარებლის ელფოსტა (დემოში ყოველთვის "demo") */
export async function currentUser(): Promise<string | null> {
  if (MODE === 'demo') return 'demo';
  const { data } = await (await sb()).auth.getSession();
  return data.session?.user.email ?? null;
}

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await (await sb()).auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message === 'Invalid login credentials' ? 'ელფოსტა ან პაროლი არასწორია.' : error.message);
}

export async function signOut(): Promise<void> {
  if (MODE === 'supabase') await (await sb()).auth.signOut();
}

/** არის თუ არა შესული მომხმარებელი `admins` ცხრილში (მხოლოდ მათ შეუძლიათ ჩაწერა — RLS) */
export async function isAdmin(): Promise<boolean> {
  if (MODE === 'demo') return true;
  const c = await sb();
  const { data: auth } = await c.auth.getUser();
  if (!auth.user) return false;
  const { data, error } = await c.from('admins').select('user_id').eq('user_id', auth.user.id).maybeSingle();
  return !error && !!data;
}

// ───────────────────────── შიგთავსი ─────────────────────────

export async function loadContent(): Promise<Content> {
  if (MODE === 'demo') {
    try {
      const raw = localStorage.getItem(LS_CONTENT);
      return normalize(raw ? JSON.parse(raw) : null, seed);
    } catch {
      return normalize(null, seed);
    }
  }
  const { data, error } = await (await sb()).from(TABLE).select('collection,id,position,data');
  if (error) throw new Error(`შიგთავსი ვერ ჩაიტვირთა: ${error.message}`);
  lastRows = (data ?? []) as Row[];
  // ცარიელი ბაზა → seed; პირველი „შენახვა" ბაზას შეავსებს
  return normalize(lastRows.length ? fromRows(lastRows) : null, seed);
}

export async function saveContent(next: Content): Promise<void> {
  if (MODE === 'demo') {
    try {
      localStorage.setItem(LS_CONTENT, JSON.stringify(next));
    } catch {
      throw new Error('ბრაუზერის მეხსიერება გაივსო (დემო რეჟიმის ლიმიტი). წაშალეთ რამდენიმე ატვირთული ფოტო — Supabase-ის დაკავშირების შემდეგ ლიმიტი აღარ იქნება.');
    }
    return;
  }
  const c = await sb();
  const rows = toRows(next);
  const { upsert, remove } = diffRows(lastRows, rows);
  if (upsert.length) {
    const { error } = await c.from(TABLE).upsert(upsert, { onConflict: 'collection,id' });
    if (error) throw new Error(`შენახვა ვერ მოხერხდა: ${error.message}`);
  }
  for (const r of remove) {
    const { error } = await c.from(TABLE).delete().eq('collection', r.collection).eq('id', r.id);
    if (error) throw new Error(`წაშლა ვერ მოხერხდა: ${error.message}`);
  }
  lastRows = rows;
}

/** დემო: ყველა ლოკალური ცვლილების წაშლა */
export function resetDemo(): void {
  localStorage.removeItem(LS_CONTENT);
}

// ───────────────────────── ფოტოები ─────────────────────────

/** ფოტოს დაპატარავება ბრაუზერშივე (ტელეფონის 5 MB ფოტო → ~150 KB WebP) */
async function shrink(file: File, max: number, quality: number): Promise<{ blob: Blob; w: number; h: number }> {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const encode = (type: string) =>
    new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('ფოტოს დამუშავება ვერ მოხერხდა.'))), type, quality));
  let blob = await encode('image/webp');
  if (blob.type !== 'image/webp') blob = await encode('image/jpeg'); // Safari WebP-ს ვერ წერს
  return { blob, w, h };
}

const toDataUrl = (blob: Blob) =>
  new Promise<string>((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result));
    fr.onerror = () => rej(new Error('ფოტოს წაკითხვა ვერ მოხერხდა.'));
    fr.readAsDataURL(blob);
  });

export async function uploadImage(file: File, folder: string): Promise<ImageRef> {
  if (!file.type.startsWith('image/')) throw new Error('აირჩიეთ სურათის ფაილი (JPG, PNG, WebP).');
  if (MODE === 'demo') {
    const { blob, w, h } = await shrink(file, 1100, 0.72);
    return { src: await toDataUrl(blob), w, h };
  }
  const { blob, w, h } = await shrink(file, 1600, 0.8);
  const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const c = await sb();
  const { error } = await c.storage.from(BUCKET).upload(path, blob, { contentType: blob.type, cacheControl: '31536000' });
  if (error) throw new Error(`ატვირთვა ვერ მოხერხდა: ${error.message}`);
  return { src: c.storage.from(BUCKET).getPublicUrl(path).data.publicUrl, w, h };
}
