# JOKER Barbershop Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (Native — ამ სესიაში; მომხმარებელმა თქვა „გეგმა, შემდეგ ააწყე"). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** სამენოვანი (KA/EN/RU) სტატიკური საიტი + ქართული ადმინი JOKER Barbershop-ისთვის, ვიზუალური მიმართულება A1 „ქაღალდი".

**Architecture:** სუფთა შაბლონ-ფუნქციები `src/render/*` აბრუნებს HTML-ს `(Content, Lang)`-დან; Vite-ის პლაგინი მათ build-ზე იძახებს სამივე ენისთვის, ბრაუზერი — მხოლოდ მაშინ, როცა შიგთავსი build-ის შემდეგ შეიცვალა. შიგთავსის წყარო ერთი ინტერფეისია (`src/data/store.ts`): დემო = `seed.json` + localStorage, რეალური = Supabase.

**Tech Stack:** Vite 8, TypeScript 7, `@supabase/supabase-js` 2 (მხოლოდ ადმინში), sharp (სურათები), `node --test` (ტესტები), Node 22.18+.

**Spec:** `docs/superpowers/specs/2026-11-15-joker-site-design.md`

## Global Constraints

- ყველა ფერი — მხოლოდ `src/styles/site.css`-ის `:root` ცვლადებით; არანაირი მწვანე/იისფერი.
- `src/render/*` და `src/lib/*`: იმპორტები `.ts` გაფართოებით, JSON-ის იმპორტის და `import.meta.env`-ის გარეშე (რომ Node-ის ტესტებშიც გაეშვას).
- ყველა დინამიკური სტრიქონი გადის `esc()`-ს; URL — `safeUrl()`-ს.
- „ჩაწერის" ყველა ბმული: ფილიალის ღილაკი → `branch.bookingUrl`; ზოგადი → `settings.bookingUrl` + `data-book` (JS ხსნის ფილიალის არჩევას).
- კონტრასტი ≥ 4.5:1; შეხების ზონა ≥ 44px; `prefers-reduced-motion`; `transition: all` აკრძალულია; ყველა `<img>`-ს `width`/`height`.
- გვარები არ იწერება. უცნობი მონაცემი = `todo` შენიშვნა ელემენტზე.
- კომიტი არ კეთდება (რეპო არ არის; მომხმარებლის ნებართვის გარეშე არ ვაკეთებთ).

## Review Focus

1. **ცარიელი ან ნაკლული თარგმანი** (EN/RU ცარიელია) → ჩანს ქართული ტექსტი, არა ცარიელი ადგილი. ტესტი: `pick` (Task 1).
2. **ფილიალი უკოორდინატოდ ან დამალული** → რუკა არ ირენდერება, „ჩაწერის" არჩევანში დამალული ფილიალი არ ჩანს. ტესტი: `render` (Task 2).
3. **დახურვის შემდეგ / შუაღამის გადაკვეთა / დასვენების დღე** → სტატუსი „დაკეტილია" და სწორი „იხსნება…". ტესტი: `openStatus` (Task 1).
4. **ფასი ცარიელი, დიაპაზონი „50–70", `priceFrom`** → „შეთანხმებით" / „50–70 ₾" / „50 ₾-დან". ტესტი: `formatPrice` (Task 1).
5. **HTML ადმინის ტექსტში** (`<script>`, ბრჭყალები) → ეკრანირდება. ტესტი: `esc` + რენდერი (Task 1–2).

---

### Task 1: სუფთა ლოგიკა
**Files:** Create `src/lib/logic.ts`, Test `tests/logic.test.ts`
**Produces:**
- `esc(s: unknown): string`, `safeUrl(u: string): string`
- `pick(v: L10n | undefined, lang: Lang): string` — ცარიელზე ბრუნდება `ka`, შემდეგ `en`
- `fill(tpl: string, vars: Record<string,string|number>): string` — `{name}` ჩანაცვლება
- `formatDuration(min: number, t: T): string`, `formatPrice(price: string, from: boolean, t: T): string`
- `openStatus(hours: DayHours[], now: Date): { state: 'open'|'closing'|'closed'; until?: string; opensAt?: string; opensDay?: number; tomorrow?: boolean }` — თბილისის დროით (`Asia/Tbilisi`)
- `tileGrid(lat, lng, zoom): { tiles: {x,y,col,row}[]; offsetX: number; offsetY: number }`
- `waLink(phone, text)`, `telLink(phone)`, `directionsLink(lat,lng)`, `osmEmbed(lat,lng)`
- [ ] ტესტები ზემოთ ჩამოთვლილ შემთხვევებზე → `node --test tests/` FAIL → იმპლემენტაცია → PASS

### Task 2: შიგთავსი და რენდერი
**Files:** Create `src/content/seed.json`, `src/content/normalize.ts`, `src/render/{icons,ui,sections,page}.ts`; Test `tests/render.test.ts`
**Consumes:** Task 1. **Produces:**
- `normalize(raw: unknown, seed: Content): Content`
- `renderApp(ctx: Ctx): string`, `renderHead(ctx: Ctx): string`, `interface Ctx { lang; base; siteUrl; content; media; year }`
- [ ] ტესტი: სამივე ენაზე `renderApp` შეიცავს ყველა სექციის `id`-ს; თითო ხილული ფილიალის `bookingUrl` გვხვდება მის ბარათში; დამალული ფილიალის ბმული არსად; `<script>` ტექსტში ეკრანირებულია; JSON-LD-ში `HairSalon` × ხილული ფილიალები.

### Task 3: სტილი და ქცევები
**Files:** Create `src/styles/site.css`, `src/site/main.ts`, `src/site/live.ts`, `index.html`, `en/index.html`, `ru/index.html`, `vite.config.ts`, `scripts/optimize-images.mjs`
- [ ] `npm run build` exit 0; `dist/` შეიცავს `index.html`, `en/`, `ru/`, `admin/`, `sitemap.xml`, `robots.txt`.
- [ ] ბრაუზერში 1440 / 768 / 375: სლაიდერი (ავტო, პაუზა, ისრები, წერტილები, swipe, ←→), მობილური მენიუ, ფილტრი, კარტის გადაბრუნება, lightbox, „ღიაა ახლა", ჩაწერის არჩევანი.

### Task 4: მონაცემთა შრე და ადმინი
**Files:** Create `src/data/store.ts`, `src/admin/{main.ts,admin.css}`, `admin/index.html`, `supabase/schema.sql`, `.env.example`
**Produces:** `loadContent(): Promise<Content>`, `saveContent(next: Content, prev: Content): Promise<void>`, `uploadImage(file: File, folder: string): Promise<ImageRef>`, `MODE: 'demo' | 'supabase'`
- [ ] ადმინში ფასის შეცვლა → „შენახვა" → საიტის ჩანართში ახალი ფასი ჩანს გადატვირთვის გარეშე (დემო რეჟიმი).
- [ ] ტესტი `diffRows(prev, next)`: შეცვლილი/ახალი → upsert სია, წაშლილი → delete სია (`tests/store.test.ts`).

### Task 5: SEO, დოკუმენტაცია, ხარისხის კარიბჭეები
**Files:** Create `public/{favicon.svg,site.webmanifest}`, `scripts/make-og.mjs`, `README.md`, `კლიენტისთვის ინსტრუქცია.md`, `netlify.toml`
- [ ] Lighthouse მობილური (`/`): ოთხივე ≥ 90.
- [ ] `design-taste-frontend`: სქრინშოტები 1440 და 390 → ჩეკლისტი → შესწორებები; გამონაკლისები `.taste-skill/waivers.json`.
- [ ] `web-design-guidelines`: აუდიტი `file:line` ფორმატით → შესწორებები → ანგარიში.
- [ ] `superpowers:verification-before-completion`: ტესტები, build, Lighthouse, ბრაუზერის შემოწმება — ახალი გაშვებით, შედეგები ანგარიშში.
