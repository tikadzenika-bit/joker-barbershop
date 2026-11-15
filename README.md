# JOKER Barbershop · ჯოკერი

სამენოვანი (KA / EN / RU) საიტი თბილისური ბარბერშოპების ქსელისთვის. „Peace | Friendship | Haircut".
დამკვეთი: NNN Holding.

> **სტატუსი (2026-11-15):** საჯარო საიტი მზადაა დემოსთვის. ადმინ პანელი დაწერილია (`src/admin`, `src/data`), მაგრამ **ჯერ გამორთულია და შემოწმებული არ არის** — იხ. „რა რჩება".

## გაშვება ლოკალურად

საჭიროა [Node.js](https://nodejs.org) 22.18 ან უფრო ახალი.

```bash
npm install
```

```bash
npm run dev
```

გაიხსნება `http://localhost:5173` (ქართული), `/en/` და `/ru/`.

| ბრძანება | რას აკეთებს |
|---|---|
| `npm run dev` | dev სერვერი |
| `npm test` | ტესტები (ლოგიკა + რენდერი, 17 ტესტი) |
| `npm run build` | ტიპების შემოწმება + სტატიკური საიტი `dist/`-ში |
| `npm run preview` | აწყობილი `dist/`-ის ნახვა |
| `npm run images` | `media-src/*.jpg` → `public/media/*.avif, *.webp` + მანიფესტი |
| `npm run fonts` | ფონტების დაჭრა (მხოლოდ ფონტის ან სიმბოლოების შეცვლისას) |
| `npm run icons` | `favicon.svg` → PNG ხატულები |

## როგორ არის აწყობილი

- **შიგთავსი ერთ ფაილშია:** `src/content/seed.json` — სლაიდები, სერვისები და ფასები, ბარბერები, ფილიალები, გალერეა, შეფასებები, FAQ და ყველა წარწერა სამ ენაზე. სტრუქტურა აღწერილია `src/content/types.ts`-ში.
- **შაბლონები:** `src/render/` — სუფთა ფუნქციები `(შიგთავსი, ენა) → HTML`. build-ის დროს `vite.config.ts`-ის პლაგინი მათ იძახებს და ქმნის მზა HTML-ს სამივე ენაზე (სწრაფი ჩატვირთვა, SEO).
- **ქცევები:** `src/site/main.ts` — სლაიდერი, მობილური მენიუ, „ღიაა ახლა" (თბილისის დრო), კარტის გადაბრუნება, ფილტრი, რუკა, lightbox, ფილიალის არჩევა.
- **სტილი:** `src/styles/site.css`. **ყველა ფერი `:root` ბლოკშია** — ლოგოს მოსვლისას მხოლოდ ის იცვლება.
- **ლოგიკა და ტესტები:** `src/lib/` + `tests/`.

### ყველაზე ხშირი ცვლილებები (სანამ ადმინი ჩაირთვება)

| რა | სად |
|---|---|
| ფასი, სერვისი | `seed.json` → `categories[].items[]` (`price`, `priceFrom`, `duration`) |
| ფილიალი, საათები, Altegio-ს ბმული | `seed.json` → `branches[]` |
| მესამე ფილიალის ჩართვა | `branches[2]`: წაშალე `"hidden": true`, შეავსე `lat`, `lng`, `phone` |
| ბარბერი | `seed.json` → `barbers[]` |
| ნებისმიერი წარწერა | `seed.json` → `texts` |
| ფოტო | ჩააგდე JPG `media-src/`-ში → `npm run images` → მიუთითე `"local:<ფაილის-სახელი>"` |

ცვლილების შემდეგ: `npm run build`.

## „ჩაწერის" ღილაკები

საიტი Altegio-ს არ ანაცვლებს. ფილიალის ღილაკი ხსნის ამ ფილიალის Altegio-ს; ზოგადი „ჩაწერა" ჯერ ფილიალს გაარჩევინებს (JS-ის გარეშე — ქსელის გვერდს ხსნის).

| ფილიალი | ბმული |
|---|---|
| ქსელი | `https://n789845.alteg.io/` |
| ბახტრიონის 22 | `https://n789845.alteg.io/company/733376/personal/menu` |
| ყაზბეგის 31ა | `https://n789845.alteg.io/company/1308439/personal/menu` |
| ფალიაშვილის 60 (დამალულია) | `https://n789845.alteg.io/company/1402828/personal/menu` |

## ჰოსტინგი

საიტი სტატიკურია: `npm run build` → ატვირთე `dist/`.

- **Netlify:** დააკავშირე რეპო; `netlify.toml` უკვე გამზადებულია.
- **Vercel:** Framework = Vite, Build = `npm run build`, Output = `dist`.
- **GitHub Pages (ქვესაქაღალდეში):** ააწყე ასე და `dist/` ატვირთე `gh-pages` ტოტზე:

```bash
VITE_BASE=/joker-barbershop/ VITE_SITE_URL=https://<მომხმარებელი>.github.io npm run build
```

**საკუთარი დომენი:** `.env`-ში ჩაწერე `VITE_SITE_URL=https://დომენი.ge` (canonical, Open Graph და sitemap ამას იყენებს), ააწყე ხელახლა და დომენი მიაბი ჰოსტინგის პანელიდან.

## რა არის placeholder და რა უნდა მოგვცეს კლიენტმა

`seed.json`-ში ყველა ასეთი ადგილი მონიშნულია ველით `"todo"`.

| რა | ახლა | საჭიროა |
|---|---|---|
| ლოგო | ტექსტური „JOKER" | ლოგოს ფაილი (SVG ან გამჭვირვალე PNG) → ფერების მორგება |
| ფოტოები (12) | Unsplash-ის ფოტოები | ჯოკერის საკუთარი ფოტოები: ინტერიერი, ნამუშევრები |
| ბარბერების ფოტოები | კარტი სახელის პირველი ასოთი | პორტრეტები (ვერტიკალური) |
| ფასები, ხანგრძლივობა | Altegio-დან, 15.11.2026 | დადასტურება |
| „კრეატიული დიზაინი თმაზე" | ფასი: „შეთანხმებით" | ფასი და ხანგრძლივობა |
| ბარბერების ფილიალი, ენები, სპეციალობა | Altegio-დან / პირობითი | დადასტურება; მარის ფილიალი |
| მესამე ფილიალი | დამალული, მისამართი Altegio-დან | მისამართის დადასტურება, კოორდინატები, ტელეფონი, საათები |
| FAQ: ბარათით გადახდა | პირობითი „კი" | დადასტურება |
| რეიტინგი „4.9 · 200+" | ბრიფიდან | პერიოდული განახლება |
| „საიტი: NNN Holding" | ბმულის გარეშე | სასურველი ბმული |

## SEO

- სათაური და აღწერა სამივე ენაზე, `canonical`, `hreflang` (+ `x-default`), Open Graph, `sitemap.xml`, `robots.txt`.
- schema.org: თითო ფილიალი ცალკე `HairSalon` (`LocalBusiness`-ის ქვეტიპი; `BarberShop` ტიპი schema.org-ში არ არსებობს) მისამართით, კოორდინატებით, საათებით და `ReserveAction`-ით.
- `aggregateRating` განზრახ არ არის: Google კრძალავს სხვა საიტებიდან აღებული რეიტინგის მონიშვნას.
- ორივე მოქმედი მისამართი საბურთალოზეა, ამიტომ ტექსტში წერია „საბურთალო, ვაკესთან ახლოს" და არა „ვაკეში".
- გაზიარების სურათი: `public/og-image.jpg` (შაბლონი — `og.html`).

## ლიცენზიები

- **ფოტოები:** [Unsplash License](https://unsplash.com/license) — უფასო კომერციული გამოყენება. ავტორები: @natejohnston (slide-hair), @mrshave (slide-beard), @onatecan (work-01, work-03), @agustinfernandez (work-02), @tafocandofotoefilme (work-04), @petervimalis (work-05), @orangetiephotography (work-06), @demoya (work-07), @modelyano (work-08), @ninjason (work-09), @seteph (work-10), @salaheregouane (extra-01), @ebadi__ahmad (extra-02). ფოტოებზე ჯოკერის თანამშრომლები **არ** არიან — გაშვებამდე უნდა ჩანაცვლდეს.
- **ფონტები:** Noto Serif, Noto Serif Georgian, Noto Sans Georgian და FiraGO — SIL Open Font License 1.1. `src/assets/fonts`-ში მათი დაჭრილი ვერსიებია.
- **რუკა:** © OpenStreetMap-ის მონაწილეები.

## რა რჩება

1. **ადმინ პანელი** (`/admin`): კოდი დაწერილია, აკლია სტილი (`src/admin/admin.css`), `supabase/schema.sql` და შემოწმება. ჩასართავად `vite.config.ts`-ში დააბრუნე `admin: r('admin/index.html')`.
2. **Supabase:** ცხრილი `content`, ნებართვების ცხრილი `admins`, Storage bucket `media`, RLS.
3. „კლიენტისთვის ინსტრუქცია.md" — ადმინთან ერთად.
4. Lighthouse-ის, `design-taste-frontend`-ის და `web-design-guidelines`-ის სრული აუდიტი.

დიზაინის დასაბუთება: `docs/superpowers/specs/2026-11-15-joker-site-design.md`. გეგმა: `docs/superpowers/plans/2026-11-15-joker-site.md`.
