/**
 * Content ↔ Supabase-ის სტრიქონები.
 * ცხრილი `content`: (collection, id, position, data jsonb). თითო ელემენტი ცალკე სტრიქონია,
 * ამიტომ შენახვისას იგზავნება მხოლოდ ის, რაც შეიცვალა (diffRows).
 */
import { COLLECTIONS } from '../content/types.ts';
import type { Content, Item } from '../content/types.ts';

export interface Row {
  collection: string;
  id: string;
  position: number;
  data: unknown;
}

export function toRows(c: Content): Row[] {
  const rows: Row[] = [
    { collection: 'settings', id: 'main', position: 0, data: c.settings },
    { collection: 'texts', id: 'main', position: 0, data: c.texts },
    { collection: 'meta', id: 'revision', position: 0, data: { updatedAt: c.updatedAt } },
  ];
  for (const name of COLLECTIONS) {
    (c[name] as Item[]).forEach((item, i) => rows.push({ collection: name, id: item.id, position: i, data: item }));
  }
  return rows;
}

/** სტრიქონებიდან Content-ის აწყობა; რაც აკლია, seed-იდან ივსება normalize()-ში */
export function fromRows(rows: Row[]): Partial<Content> {
  const out: Record<string, unknown> = {};
  const lists: Record<string, Row[]> = {};
  for (const r of rows) {
    if (r.collection === 'settings') out.settings = r.data;
    else if (r.collection === 'texts') out.texts = r.data;
    else if (r.collection === 'meta') out.updatedAt = (r.data as { updatedAt?: string })?.updatedAt;
    else (lists[r.collection] ??= []).push(r);
  }
  for (const name of COLLECTIONS) {
    if (lists[name]) out[name] = lists[name].sort((a, b) => a.position - b.position).map((r) => r.data);
  }
  return out as Partial<Content>;
}

const key = (r: { collection: string; id: string }) => `${r.collection}/${r.id}`;

/** რა უნდა ჩაიწეროს (upsert) და რა წაიშალოს, რომ prev გახდეს next */
export function diffRows(prev: Row[], next: Row[]): { upsert: Row[]; remove: { collection: string; id: string }[] } {
  const before = new Map(prev.map((r) => [key(r), `${r.position}|${JSON.stringify(r.data)}`]));
  const after = new Set(next.map(key));
  return {
    upsert: next.filter((r) => before.get(key(r)) !== `${r.position}|${JSON.stringify(r.data)}`),
    remove: prev.filter((r) => !after.has(key(r))).map(({ collection, id }) => ({ collection, id })),
  };
}
