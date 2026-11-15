/**
 * ადმინ პანელი (/admin) — ქართული, მობილურზე მოსახერხებელი.
 *
 * როგორ არის აწყობილი:
 *   • SECTIONS — რა ჩანართები არსებობს და რომელ ველებს შეიცავს თითო ელემენტი (დეკლარაციულად);
 *   • listEditor() — ნებისმიერი სიის რედაქტორი (დამატება / წაშლა / გადაადგილება / დამალვა);
 *   • field() — ერთი ველი ტიპის მიხედვით (ტექსტი სამ ენაზე, ფოტო, საათები…).
 * ახალი ველის დასამატებლად საკმარისია SECTIONS-ში ერთი ხაზის ჩამატება.
 */
import './admin.css';
import { LANGS } from '../content/types.ts';
import type { Content, DayHours, ImageRef, L10n, Lang } from '../content/types.ts';
import { normalize } from '../content/normalize.ts';
import { MODE, currentUser, isAdmin, loadContent, resetDemo, saveContent, seed, signIn, signOut, uploadImage } from '../data/store.ts';

type Obj = Record<string, any>;
type Kid = Node | string | null | false | undefined;

const BASE = import.meta.env.BASE_URL;
const app = document.getElementById('admin')!;
const PROPS = new Set(['value', 'checked', 'hidden', 'disabled', 'open', 'selected', 'textContent', 'htmlFor']);

/** პატარა დამხმარე DOM-ის ასაწყობად: h('button', { class: 'btn', onclick }, 'ტექსტი') */
function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Obj = {}, ...kids: Kid[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (PROPS.has(k)) (el as Obj)[k] = v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  el.append(...(kids.filter(Boolean) as (Node | string)[]));
  return el;
}

// ───────────────────────── მდგომარეობა ─────────────────────────

let content: Content;
let savedJson = '';
let tab = 'home';
let lang: Lang = 'ka';
let busy = false;
const openItems = new Set<string>();
let uid = 0;
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${(uid++).toString(36)}`;
const blank = (): L10n => ({ ka: '', en: '', ru: '' });
const isDirty = () => JSON.stringify(content) !== savedJson;
const text = (v: L10n | undefined) => (v?.[lang] || v?.ka || '').trim();

// ───────────────────────── ველების აღწერა ─────────────────────────

type Field = { k: string; type: string; label: string; hint?: string; options?: [string, string][]; folder?: string; mode?: string };

const SUITS: [string, string][] = [['spade', '♠ ყვავი'], ['heart', '♥ გული'], ['diamond', '♦ აგური'], ['club', '♣ ჯვარი'], ['star', '★ ვარსკვლავი']];
const ACTIONS: [string, string][] = [
  ['none', '— ღილაკის გარეშე —'], ['book', 'ჩაწერა (Altegio)'], ['whatsapp', 'WhatsApp'], ['services', 'გადასვლა: სერვისები და ფასები'],
  ['barbers', 'გადასვლა: ბარბერები'], ['branches', 'გადასვლა: ფილიალები'], ['works', 'გადასვლა: ნამუშევრები'], ['reviews', 'გადასვლა: შეფასებები'],
];
const VARIANTS: [string, string][] = [
  ['brand', 'ბრენდის კარტი (ლოგო + სლოგანი)'], ['photo', 'ფოტო-კარტი'], ['rating', 'რეიტინგის კარტი (ხუთი ვარსკვლავი)'], ['branches', 'ფილიალების კარტები'],
];
const SPEAK: [string, string][] = [
  ['ka', 'ქართული'], ['en', 'ინგლისური'], ['ru', 'რუსული'], ['hy', 'სომხური'], ['az', 'აზერბაიჯანული'], ['tr', 'თურქული'], ['uk', 'უკრაინული'], ['de', 'გერმანული'],
];
const DAY_NAMES = ['ორშაბათი', 'სამშაბათი', 'ოთხშაბათი', 'ხუთშაბათი', 'პარასკევი', 'შაბათი', 'კვირა'];

const SERVICE_FIELDS: Field[] = [
  { k: 'name', type: 'l10n', label: 'სერვისის სახელი' },
  { k: 'desc', type: 'l10n', label: 'მოკლე აღწერა' },
  { k: 'price', type: 'text', label: 'ფასი (₾)', hint: 'მაგ. 50 ან 50–70. ცარიელი = „შეთანხმებით“.', mode: 'decimal' },
  { k: 'priceFrom', type: 'toggle', label: '„-დან“ — ფასი იწყება ამ თანხიდან' },
  { k: 'duration', type: 'number', label: 'ხანგრძლივობა (წუთი)', hint: '0 = არ ჩანს.' },
];

interface Section {
  key: string;
  title: string;
  help: string;
  fields: Field[];
  itemTitle: (it: Obj) => string;
  make: () => Obj;
  nested?: { key: string; title: string; fields: Field[]; itemTitle: (it: Obj) => string; make: () => Obj };
}

const SECTIONS: Section[] = [
  {
    key: 'slides', title: 'სლაიდები', help: 'მთავარი გვერდის ზედა სლაიდერი. თითო სლაიდი ერთი „კარტია“.',
    itemTitle: (it) => text(it.title).split('\n').join(' '),
    make: () => ({ id: newId('s'), variant: 'photo', suit: 'spade', kicker: blank(), title: blank(), text: blank(), cta: 'book', cta2: 'none', image: null, imageAlt: blank() }),
    fields: [
      { k: 'variant', type: 'select', label: 'კარტის ტიპი', options: VARIANTS },
      { k: 'suit', type: 'select', label: 'ნიშანი კარტის კუთხეში', options: SUITS },
      { k: 'kicker', type: 'l10n', label: 'პატარა წარწერა სათაურის ზემოთ' },
      { k: 'title', type: 'l10nArea', label: 'სათაური', hint: 'ახალი ხაზი = ხაზის გადატანა. სიმბოლო ★ ვარსკვლავად იქცევა.' },
      { k: 'text', type: 'l10nArea', label: 'ტექსტი' },
      { k: 'cta', type: 'select', label: 'მთავარი ღილაკი', options: ACTIONS },
      { k: 'cta2', type: 'select', label: 'მეორე ღილაკი', options: ACTIONS },
      { k: 'image', type: 'image', label: 'ფოტო (მხოლოდ ფოტო-კარტისთვის)', folder: 'slides' },
      { k: 'imageAlt', type: 'l10n', label: 'ფოტოს აღწერა', hint: 'ერთი წინადადება, რა ჩანს ფოტოზე — Google-ისთვის და ეკრანის წამკითხველისთვის.' },
    ],
  },
  {
    key: 'categories', title: 'სერვისები და ფასები', help: 'კატეგორიები და მათში შემავალი სერვისები. ფასი იცვლება თითო სერვისში.',
    itemTitle: (it) => `${text(it.title)} · ${it.items?.length ?? 0} სერვისი`,
    make: () => ({ id: newId('c'), suit: 'spade', title: blank(), items: [] }),
    fields: [
      { k: 'title', type: 'l10n', label: 'კატეგორიის სახელი' },
      { k: 'suit', type: 'select', label: 'ნიშანი', options: SUITS },
    ],
    nested: {
      key: 'items', title: 'სერვისები ამ კატეგორიაში', fields: SERVICE_FIELDS,
      itemTitle: (it) => `${text(it.name)} — ${it.price ? `${it.price} ₾${it.priceFrom ? '-დან' : ''}` : 'შეთანხმებით'}`,
      make: () => ({ id: newId('sv'), name: blank(), desc: blank(), duration: 30, price: '', priceFrom: false }),
    },
  },
  {
    key: 'barbers', title: 'ბარბერები', help: 'გუნდის წევრები. გვარი არ იწერება. ფოტოს გარეშე ჩანს კარტი სახელის პირველი ასოთი.',
    itemTitle: (it) => `${text(it.name)} — ${text(it.role)}`,
    make: () => ({ id: newId('b'), name: blank(), role: blank(), branchId: '', specialties: blank(), languages: ['ka'], photo: null, bookable: true, bookingUrl: '' }),
    fields: [
      { k: 'name', type: 'l10n', label: 'სახელი' },
      { k: 'role', type: 'l10n', label: 'როლი', hint: 'მაგ. ბარბერი, უფროსი ბარბერი.' },
      { k: 'photo', type: 'image', label: 'ფოტო (ვერტიკალური)', folder: 'barbers' },
      { k: 'branchId', type: 'branch', label: 'ფილიალი' },
      { k: 'specialties', type: 'l10n', label: 'სპეციალობა', hint: 'მოკლედ, მაგ. ფეიდი · წვერი.' },
      { k: 'languages', type: 'langs', label: 'რომელ ენებზე საუბრობს' },
      { k: 'bookable', type: 'toggle', label: 'შეიძლება მასთან ჩაწერა', hint: 'გამორთული → ღილაკი WhatsApp-ზე გადავა (მაგ. ადმინისტრატორი).' },
      { k: 'bookingUrl', type: 'url', label: 'პირადი ბმული Altegio-ში (არასავალდებულო)', hint: 'ცარიელი → ფილიალის ბმული.' },
    ],
  },
  {
    key: 'branches', title: 'ფილიალები', help: 'ყველა „ჩაწერის“ ღილაკი იყენებს აქ მითითებულ Altegio-ს ბმულს.',
    itemTitle: (it) => `${text(it.name)} — ${text(it.address)}`,
    make: () => ({
      id: newId('br'), suit: 'heart', name: blank(), address: blank(), hint: blank(), lat: 0, lng: 0, phone: '', whatsapp: '', bookingUrl: '',
      hours: Array.from({ length: 7 }, () => ({ open: '11:00', close: '21:00', closed: false })), rating: '', reviewsCount: '', hidden: true,
    }),
    fields: [
      { k: 'name', type: 'l10n', label: 'მოკლე სახელი', hint: 'მაგ. ბახტრიონი.' },
      { k: 'address', type: 'l10n', label: 'მისამართი' },
      { k: 'hint', type: 'l10n', label: 'ორიენტირი', hint: 'მაგ. მეტრო „ტექნიკური უნივერსიტეტი“-სთან.' },
      { k: 'suit', type: 'select', label: 'ფილიალის ნიშანი', options: SUITS },
      { k: 'phone', type: 'tel', label: 'ტელეფონი', hint: 'ფორმატი: +995 5XX XX XX XX' },
      { k: 'whatsapp', type: 'tel', label: 'WhatsApp-ის ნომერი', hint: 'ცარიელი → იგივე ტელეფონი.' },
      { k: 'bookingUrl', type: 'url', label: 'Altegio-ს ბმული ამ ფილიალისთვის' },
      { k: 'lat', type: 'number', label: 'განედი (latitude)', hint: 'Google Maps-ში: მარჯვენა ღილაკი წერტილზე → პირველი რიცხვი.' },
      { k: 'lng', type: 'number', label: 'გრძედი (longitude)', hint: 'მეორე რიცხვი. ორივე 0 → რუკა არ ჩანს.' },
      { k: 'hours', type: 'hours', label: 'სამუშაო საათები' },
      { k: 'rating', type: 'text', label: 'რეიტინგი', hint: 'მაგ. 4.9', mode: 'decimal' },
      { k: 'reviewsCount', type: 'text', label: 'შეფასებების რაოდენობა', mode: 'numeric' },
    ],
  },
  {
    key: 'gallery', title: 'გალერეა', help: 'ნამუშევრების ფოტოები. რიგი იცვლება ისრებით.',
    itemTitle: (it) => text(it.alt) || 'ფოტო',
    make: () => ({ id: newId('g'), image: { src: '' }, alt: blank() }),
    fields: [
      { k: 'image', type: 'image', label: 'ფოტო', folder: 'gallery' },
      { k: 'alt', type: 'l10n', label: 'ფოტოს აღწერა', hint: 'ერთი წინადადება, რა ჩანს ფოტოზე.' },
    ],
  },
  {
    key: 'reviews', title: 'შეფასებები', help: 'მოკლე ციტატები, ავტორის სახელის გარეშე.',
    itemTitle: (it) => text(it.text),
    make: () => ({ id: newId('r'), text: blank() }),
    fields: [{ k: 'text', type: 'l10nArea', label: 'ციტატა' }],
  },
  {
    key: 'faq', title: 'კითხვები (FAQ)', help: 'ხშირი კითხვები და პასუხები.',
    itemTitle: (it) => text(it.q),
    make: () => ({ id: newId('f'), q: blank(), a: blank() }),
    fields: [
      { k: 'q', type: 'l10n', label: 'კითხვა' },
      { k: 'a', type: 'l10nArea', label: 'პასუხი' },
    ],
  },
];

const SETTINGS_FIELDS: Field[] = [
  { k: 'brand', type: 'text', label: 'ბრენდის სახელი' },
  { k: 'logo', type: 'image', label: 'ლოგო', folder: 'brand', hint: 'ცარიელი → ჩანს ტექსტური ლოგო. სასურველია გამჭვირვალე PNG.' },
  { k: 'bookingUrl', type: 'url', label: 'Altegio-ს საერთო გვერდი (ფილიალის არჩევა)' },
  { k: 'instagram', type: 'url', label: 'Instagram' },
  { k: 'facebook', type: 'url', label: 'Facebook' },
  { k: 'ratingValue', type: 'text', label: 'საერთო რეიტინგი', hint: 'მაგ. 4.9', mode: 'decimal' },
  { k: 'ratingCount', type: 'text', label: 'შეფასებების რაოდენობა', hint: 'მაგ. 200+' },
  { k: 'seoTitle', type: 'l10n', label: 'გვერდის სათაური Google-ში' },
  { k: 'seoDescription', type: 'l10nArea', label: 'გვერდის აღწერა Google-ში', hint: '150–160 სიმბოლო.' },
  { k: 'creditName', type: 'text', label: 'საიტის ავტორი (ფუტერში)' },
  { k: 'creditUrl', type: 'url', label: 'ავტორის ბმული (არასავალდებულო)' },
];

const TEXT_GROUPS: [string, string][] = [
  ['nav.', 'მენიუ'], ['cta.', 'ღილაკები'], ['hero.', 'სლაიდერი'], ['slogan.', 'სლოგანი'], ['status.', '„ღიაა ახლა“ სტატუსები'], ['hours.', 'საათები'],
  ['day.', 'კვირის დღეები'], ['services.', 'სერვისების სექცია'], ['price.', 'ფასი'], ['duration.', 'ხანგრძლივობა'], ['barbers.', 'ბარბერების სექცია'],
  ['lang.', 'ენების სახელები'], ['branches.', 'ფილიალების სექცია'], ['gallery.', 'გალერეა'], ['reviews.', 'შეფასებების სექცია'], ['faq.', 'FAQ სექცია'],
  ['footer.', 'ფუტერი'], ['dialog.', 'ფილიალის არჩევის ფანჯარა'], ['wa.', 'WhatsApp-ის შეტყობინება'], ['a11y.', 'დამხმარე წარწერები'], ['float.', 'მცურავი ზოლი'],
];

// ───────────────────────── ველები ─────────────────────────

function touch() {
  const bar = document.querySelector<HTMLElement>('.savebar');
  if (!bar) return;
  const dirty = isDirty();
  bar.classList.toggle('is-dirty', dirty);
  bar.querySelectorAll<HTMLButtonElement>('button').forEach((b) => (b.disabled = !dirty || busy));
  const st = bar.querySelector('.savebar__st')!;
  if (dirty) st.textContent = 'შეუნახავი ცვლილებებია';
  else if (st.textContent === 'შეუნახავი ცვლილებებია') st.textContent = 'ყველაფერი შენახულია';
}

const imgSrc = (ref: ImageRef | null | undefined): string => {
  if (!ref?.src) return '';
  return ref.src.startsWith('local:') ? `${BASE}media/${ref.src.slice(6)}-480.webp` : ref.src;
};

function field(obj: Obj, f: Field): HTMLElement {
  const id = `f${uid++}`;
  const hint = f.hint ? h('small', { class: 'fld__hint' }, f.hint) : null;
  const wrap = (control: Kid, extra: Kid = null) => h('div', { class: `fld fld--${f.type}` }, h('label', { for: id }, f.label), control, extra, hint);

  switch (f.type) {
    case 'l10n':
    case 'l10nArea': {
      obj[f.k] ??= blank();
      const v: L10n = obj[f.k];
      // რომელ ენებზე აკლია თარგმანი
      const missing = LANGS.filter((l) => !v[l]?.trim());
      const state = h('small', { class: `fld__langs${missing.length ? ' is-missing' : ''}` }, missing.length ? `აკლია: ${missing.map((l) => l.toUpperCase()).join(', ')}` : 'სამივე ენა შევსებულია ✓');
      const oninput = (e: Event) => {
        v[lang] = (e.target as HTMLInputElement).value;
        const m = LANGS.filter((l) => !v[l]?.trim());
        state.textContent = m.length ? `აკლია: ${m.map((l) => l.toUpperCase()).join(', ')}` : 'სამივე ენა შევსებულია ✓';
        state.classList.toggle('is-missing', m.length > 0);
        touch();
      };
      const control =
        f.type === 'l10n'
          ? h('input', { id, type: 'text', value: v[lang] ?? '', lang, autocomplete: 'off', oninput })
          : h('textarea', { id, rows: 3, value: v[lang] ?? '', lang, autocomplete: 'off', oninput });
      return h('div', { class: `fld fld--${f.type}` }, h('label', { for: id }, f.label, h('span', { class: 'tag' }, lang.toUpperCase())), control, state, hint);
    }
    case 'text':
    case 'url':
    case 'tel':
      return wrap(
        h('input', {
          id, type: f.type, value: obj[f.k] ?? '', autocomplete: 'off', spellcheck: 'false', inputmode: f.mode,
          placeholder: f.type === 'url' ? 'https://…' : f.type === 'tel' ? '+995 5XX XX XX XX…' : undefined,
          oninput: (e: Event) => { obj[f.k] = (e.target as HTMLInputElement).value.trim(); touch(); },
        }),
      );
    case 'number':
      return wrap(
        h('input', {
          id, type: 'number', step: 'any', inputmode: 'decimal', value: String(obj[f.k] ?? 0), autocomplete: 'off',
          oninput: (e: Event) => { obj[f.k] = Number((e.target as HTMLInputElement).value) || 0; touch(); },
        }),
      );
    case 'select':
      return wrap(
        h('select', { id, onchange: (e: Event) => { obj[f.k] = (e.target as HTMLSelectElement).value; touch(); } },
          ...(f.options ?? []).map(([val, label]) => h('option', { value: val, selected: obj[f.k] === val }, label))),
      );
    case 'branch':
      return wrap(
        h('select', { id, onchange: (e: Event) => { obj[f.k] = (e.target as HTMLSelectElement).value; touch(); } },
          h('option', { value: '', selected: !obj[f.k] }, '— არ არის მითითებული —'),
          ...content.branches.map((b) => h('option', { value: b.id, selected: obj[f.k] === b.id }, `${b.name.ka}${b.hidden ? ' (დამალული)' : ''}`))),
      );
    case 'toggle':
      return h('div', { class: 'fld fld--toggle' },
        h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!obj[f.k], onchange: (e: Event) => { obj[f.k] = (e.target as HTMLInputElement).checked; touch(); } }), h('span', {}, f.label)), hint);
    case 'langs': {
      obj[f.k] ??= [];
      const boxes = SPEAK.map(([code, label]) =>
        h('label', { class: 'check check--pill' },
          h('input', { type: 'checkbox', checked: obj[f.k].includes(code), onchange: (e: Event) => {
            const on = (e.target as HTMLInputElement).checked;
            obj[f.k] = on ? [...obj[f.k], code] : obj[f.k].filter((c: string) => c !== code);
            touch();
          } }),
          h('span', {}, label)));
      return h('fieldset', { class: 'fld fld--langs' }, h('legend', {}, f.label), h('div', { class: 'pills' }, ...boxes), hint);
    }
    case 'image': {
      const ref: ImageRef | null = obj[f.k];
      const status = h('small', { class: 'fld__hint', 'aria-live': 'polite' });
      const input = h('input', { id, type: 'file', accept: 'image/*', class: 'sr', onchange: async (e: Event) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        status.textContent = 'იტვირთება…';
        try {
          obj[f.k] = await uploadImage(file, f.folder ?? 'misc');
          touch();
          renderView();
        } catch (err) {
          status.textContent = (err as Error).message;
        }
      } });
      const src = imgSrc(ref);
      const isPlaceholder = !!ref?.src?.startsWith('local:');
      return h('div', { class: 'fld fld--image' },
        h('span', { class: 'fld__label' }, f.label),
        h('div', { class: 'imgrow' },
          src ? h('img', { src, alt: '', width: 96, height: 128, loading: 'lazy' }) : h('div', { class: 'imgrow__empty' }, 'ფოტო არ არის'),
          h('div', { class: 'imgrow__act' },
            h('label', { class: 'btn btn--line', for: id }, src ? 'ფოტოს შეცვლა' : 'ფოტოს ატვირთვა'), input,
            src ? h('button', { type: 'button', class: 'btn btn--ghost', onclick: () => { obj[f.k] = f.k === 'image' && 'alt' in obj ? { src: '' } : null; touch(); renderView(); } }, 'ფოტოს მოხსნა') : null,
            isPlaceholder ? h('small', { class: 'fld__hint' }, 'დროებითი ფოტო (Unsplash) — ჩაანაცვლეთ საკუთარით.') : null,
            status)),
        hint);
    }
    case 'hours':
      return hoursField(obj, f);
  }
  return h('div');
}

function hoursField(obj: Obj, f: Field): HTMLElement {
  const hours: DayHours[] = obj[f.k];
  const same = hours.every((d) => d.open === hours[0].open && d.close === hours[0].close && d.closed === hours[0].closed);
  const time = (d: DayHours, key: 'open' | 'close', all: boolean, label: string) =>
    h('input', { type: 'time', value: d[key], 'aria-label': label, disabled: d.closed && !all, oninput: (e: Event) => {
      const v = (e.target as HTMLInputElement).value;
      (all ? hours : [d]).forEach((x) => (x[key] = v));
      touch();
    } });
  const body = same
    ? h('div', { class: 'hrs__row' }, h('span', {}, 'ყოველდღე'), time(hours[0], 'open', true, 'გახსნა'), h('span', { 'aria-hidden': 'true' }, '–'), time(hours[0], 'close', true, 'დახურვა'))
    : h('div', { class: 'hrs' }, ...hours.map((d, i) =>
        h('div', { class: 'hrs__row' }, h('span', {}, DAY_NAMES[i]), time(d, 'open', false, `${DAY_NAMES[i]}: გახსნა`), h('span', { 'aria-hidden': 'true' }, '–'), time(d, 'close', false, `${DAY_NAMES[i]}: დახურვა`),
          h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: d.closed, onchange: (e: Event) => { d.closed = (e.target as HTMLInputElement).checked; touch(); renderView(); } }), h('span', {}, 'დასვენება')))));
  return h('fieldset', { class: 'fld fld--hours' }, h('legend', {}, f.label), body,
    h('button', { type: 'button', class: 'btn btn--ghost', onclick: () => {
      if (same) hours[6] = { ...hours[6], open: hours[6].open === '12:00' ? '12:30' : '12:00' }; // დღეები ცალ-ცალკე გახდება რედაქტირებადი
      else hours.forEach((d) => Object.assign(d, { open: hours[0].open, close: hours[0].close, closed: false }));
      touch();
      renderView();
    } }, same ? 'დღეების ცალ-ცალკე მითითება' : 'ყველა დღე ერთნაირი'));
}

// ───────────────────────── სიის რედაქტორი ─────────────────────────

interface ListOpts { fields: Field[]; itemTitle: (it: Obj) => string; make: () => Obj; nested?: Section['nested']; addLabel: string }

function listEditor(list: Obj[], o: ListOpts): HTMLElement {
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    touch();
    renderView();
  };
  const stop = (fn: () => void) => (e: Event) => { e.preventDefault(); e.stopPropagation(); fn(); };
  const items = list.map((it, i) => {
    const title = o.itemTitle(it) || 'უსახელო';
    const body = h('div', { class: 'item__body' },
      it.todo
        ? h('div', { class: 'note' }, h('p', {}, h('strong', {}, 'შესავსებია: '), it.todo),
            h('button', { type: 'button', class: 'btn btn--ghost', onclick: () => { delete it.todo; touch(); renderView(); } }, 'მოვაგვარე — ნიშნის მოხსნა'))
        : null,
      ...o.fields.map((f) => field(it, f)),
      o.nested ? h('div', { class: 'nested' }, h('h3', {}, o.nested.title), listEditor((it[o.nested.key] ??= []), { ...o.nested, addLabel: '+ სერვისის დამატება' })) : null,
      h('div', { class: 'item__foot' },
        h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !it.hidden, onchange: (e: Event) => { it.hidden = !(e.target as HTMLInputElement).checked; if (!it.hidden) delete it.hidden; touch(); renderView(); } }), h('span', {}, 'ჩანს საიტზე')),
        h('button', { type: 'button', class: 'btn btn--danger', onclick: () => {
          if (!confirm(`წაიშალოს „${title}“? შენახვამდე შეგიძლიათ „გაუქმება“.`)) return;
          list.splice(i, 1);
          touch();
          renderView();
        } }, 'წაშლა')));
    return h('details', { class: `item${it.hidden ? ' is-hidden' : ''}`, open: openItems.has(it.id), id: `item-${it.id}`,
      ontoggle: (e: Event) => ((e.target as HTMLDetailsElement).open ? openItems.add(it.id) : openItems.delete(it.id)) },
      h('summary', {},
        h('span', { class: 'item__n' }, String(i + 1)),
        h('span', { class: 'item__t' }, title),
        it.hidden ? h('span', { class: 'badge' }, 'დამალულია') : null,
        it.todo ? h('span', { class: 'badge badge--todo' }, 'შესავსებია') : null,
        h('span', { class: 'item__mv' },
          h('button', { type: 'button', 'aria-label': `ზემოთ: ${title}`, disabled: i === 0, onclick: stop(() => move(i, -1)) }, '↑'),
          h('button', { type: 'button', 'aria-label': `ქვემოთ: ${title}`, disabled: i === list.length - 1, onclick: stop(() => move(i, 1)) }, '↓'))),
      body);
  });
  return h('div', { class: 'list' }, ...items,
    h('button', { type: 'button', class: 'btn btn--line list__add', onclick: () => { const it = o.make(); list.push(it); openItems.add(it.id); touch(); renderView(); } }, o.addLabel));
}

// ───────────────────────── ხედები ─────────────────────────

/** ყველა „შესავსებია" შენიშვნა ერთ სიაში */
function todos(): { tab: string; id: string; where: string; note: string }[] {
  const out: { tab: string; id: string; where: string; note: string }[] = [];
  if (content.settings.todo) out.push({ tab: 'settings', id: '', where: 'პარამეტრები', note: content.settings.todo });
  for (const s of SECTIONS) {
    for (const it of (content as Obj)[s.key] as Obj[]) {
      if (it.todo) out.push({ tab: s.key, id: it.id, where: `${s.title}: ${s.itemTitle(it)}`, note: it.todo });
      if (s.nested) for (const sub of it[s.nested.key] ?? []) if (sub.todo) out.push({ tab: s.key, id: it.id, where: `${s.title}: ${s.nested.itemTitle(sub)}`, note: sub.todo });
    }
  }
  return out;
}

function goTo(t: string, id = '') {
  tab = t;
  if (id) openItems.add(id);
  render();
  if (id) document.getElementById(`item-${id}`)?.scrollIntoView({ block: 'start' });
  else window.scrollTo(0, 0);
}

function homeView(): HTMLElement {
  const list = todos();
  const modeBox = MODE === 'demo'
    ? h('div', { class: 'box box--demo' }, h('h2', {}, 'დემო რეჟიმი'),
        h('p', {}, 'ცვლილებები ინახება მხოლოდ ამ ბრაუზერში და ჩანს მხოლოდ ამ მოწყობილობაზე. ნამდვილი გამოქვეყნებისთვის დააკავშირეთ Supabase (იხ. README.md).'),
        h('button', { type: 'button', class: 'btn btn--ghost', onclick: async () => {
          if (!confirm('ყველა ლოკალური ცვლილება წაიშლება და დაბრუნდება საწყისი შიგთავსი. გავაგრძელოთ?')) return;
          resetDemo();
          await boot();
        } }, 'საწყის შიგთავსზე დაბრუნება'))
    : h('div', { class: 'box' }, h('h2', {}, 'Supabase დაკავშირებულია'), h('p', {}, '„შენახვის“ შემდეგ ცვლილება მაშინვე ჩანს საიტზე ყველა ვიზიტორისთვის.'));
  const count = (n: number, label: string, t: string) => h('button', { type: 'button', class: 'stat', onclick: () => goTo(t) }, h('b', {}, String(n)), h('span', {}, label));
  return h('div', { class: 'view' },
    h('h1', {}, 'მთავარი'), modeBox,
    h('div', { class: 'stats' },
      count(content.slides.length, 'სლაიდი', 'slides'), count(content.categories.reduce((n, c) => n + c.items.length, 0), 'სერვისი', 'categories'),
      count(content.barbers.length, 'ბარბერი', 'barbers'), count(content.branches.filter((b) => !b.hidden).length, 'ფილიალი საიტზე', 'branches'),
      count(content.gallery.length, 'ფოტო', 'gallery'), count(content.reviews.length, 'შეფასება', 'reviews')),
    h('div', { class: 'box' }, h('h2', {}, `შესავსებია (${list.length})`),
      list.length
        ? h('ul', { class: 'todos' }, ...list.map((t) => h('li', {}, h('button', { type: 'button', onclick: () => goTo(t.tab, t.id) }, h('strong', {}, t.where), h('span', {}, t.note)))))
        : h('p', {}, 'ყველაფერი შევსებულია ✓')),
    h('div', { class: 'box' }, h('h2', {}, 'ექსპორტი / ბექაპი'),
      h('p', {}, 'ჩამოტვირთეთ მთელი შიგთავსი ერთ JSON ფაილად. იგივე ფაილით შეგიძლიათ აღდგენა.'),
      h('div', { class: 'row' },
        h('button', { type: 'button', class: 'btn btn--line', onclick: () => {
          const a = h('a', { href: URL.createObjectURL(new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' })), download: `joker-backup-${new Date().toISOString().slice(0, 10)}.json` });
          a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        } }, 'ექსპორტი JSON'),
        h('label', { class: 'btn btn--ghost', for: 'import' }, 'იმპორტი JSON-იდან'),
        h('input', { id: 'import', type: 'file', accept: 'application/json,.json', class: 'sr', onchange: async (e: Event) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (!file) return;
          try {
            const data = JSON.parse(await file.text());
            if (!confirm('მიმდინარე შიგთავსი ჩანაცვლდება ფაილის შიგთავსით (შენახვამდე შეგიძლიათ „გაუქმება“). გავაგრძელოთ?')) return;
            content = normalize(data, seed);
            render();
            touch();
          } catch {
            alert('ფაილი ვერ წაიკითხა. აირჩიეთ ადრე ექსპორტირებული JSON ფაილი.');
          }
        } }))));
}

function textsView(): HTMLElement {
  const keys = Object.keys(content.texts);
  const groups = TEXT_GROUPS.map(([prefix, title]) => {
    const own = keys.filter((k) => k.startsWith(prefix));
    if (!own.length) return null;
    return h('details', { class: 'item', open: openItems.has(`t:${prefix}`), ontoggle: (e: Event) => ((e.target as HTMLDetailsElement).open ? openItems.add(`t:${prefix}`) : openItems.delete(`t:${prefix}`)) },
      h('summary', {}, h('span', { class: 'item__t' }, title), h('span', { class: 'badge' }, String(own.length))),
      h('div', { class: 'item__body' }, ...own.map((k) => field(content.texts, { k, type: 'l10n', label: seed.texts[k]?.ka || k }))));
  });
  return h('div', { class: 'view' }, h('h1', {}, 'ტექსტები'),
    h('p', { class: 'help' }, 'საიტის ყველა წარწერა. ფიგურულ ფრჩხილებში ჩაწერილი სიტყვები (მაგ. {time}, {name}) ავტომატურად იცვლება — ნუ წაშლით.'), ...groups);
}

function settingsView(): HTMLElement {
  const s = content.settings as Obj;
  return h('div', { class: 'view' }, h('h1', {}, 'პარამეტრები'),
    s.todo ? h('div', { class: 'note' }, h('p', {}, h('strong', {}, 'შესავსებია: '), s.todo), h('button', { type: 'button', class: 'btn btn--ghost', onclick: () => { delete s.todo; touch(); renderView(); } }, 'მოვაგვარე — ნიშნის მოხსნა')) : null,
    h('div', { class: 'box' }, ...SETTINGS_FIELDS.map((f) => field(s, f))));
}

function currentView(): HTMLElement {
  if (tab === 'home') return homeView();
  if (tab === 'texts') return textsView();
  if (tab === 'settings') return settingsView();
  const s = SECTIONS.find((x) => x.key === tab)!;
  return h('div', { class: 'view' }, h('h1', {}, s.title), h('p', { class: 'help' }, s.help),
    listEditor((content as Obj)[s.key], { fields: s.fields, itemTitle: s.itemTitle, make: s.make, nested: s.nested, addLabel: '+ დამატება' }));
}

function renderView() {
  const y = window.scrollY;
  document.getElementById('view')!.replaceChildren(currentView());
  window.scrollTo(0, y);
}

// ───────────────────────── ჩარჩო ─────────────────────────

async function save() {
  if (busy || !isDirty()) return;
  busy = true;
  const st = document.querySelector('.savebar__st')!;
  st.textContent = 'ინახება…';
  touch();
  try {
    content.updatedAt = new Date().toISOString();
    await saveContent(content);
    savedJson = JSON.stringify(content);
    st.textContent = `შენახულია ✓ ${new Date().toLocaleTimeString('ka-GE', { hour: '2-digit', minute: '2-digit' })}`;
  } catch (err) {
    st.textContent = (err as Error).message;
  } finally {
    busy = false;
    touch();
  }
}

function render() {
  const tabs: [string, string][] = [['home', 'მთავარი'], ...SECTIONS.map((s) => [s.key, s.title] as [string, string]), ['texts', 'ტექსტები'], ['settings', 'პარამეტრები']];
  const count = todos().length;
  app.replaceChildren(
    h('header', { class: 'top' },
      h('strong', { class: 'top__logo', translate: 'no' }, 'JOKER', h('span', {}, 'ადმინი')),
      h('span', { class: `mode mode--${MODE}` }, MODE === 'demo' ? 'დემო რეჟიმი' : 'Supabase'),
      h('a', { class: 'btn btn--paper', href: BASE, target: '_blank', rel: 'noopener' }, 'საიტის ნახვა ↗'),
      MODE === 'supabase' ? h('button', { type: 'button', class: 'btn btn--ghost-inv', onclick: async () => { if (isDirty() && !confirm('შეუნახავი ცვლილებები დაიკარგება. გავიდეთ?')) return; await signOut(); await boot(); } }, 'გასვლა') : null),
    h('nav', { class: 'tabs', 'aria-label': 'ადმინის სექციები' },
      ...tabs.map(([key, title]) => h('button', { type: 'button', class: 'tab', 'aria-current': tab === key ? 'page' : null, onclick: () => goTo(key) }, title, key === 'home' && count ? h('span', { class: 'badge badge--todo' }, String(count)) : null))),
    h('div', { class: 'langbar', hidden: tab === 'home', role: 'group', 'aria-label': 'რედაქტირების ენა' }, h('span', {}, 'ტექსტების ენა:'),
      ...LANGS.map((l) => h('button', { type: 'button', class: 'langbtn', 'aria-pressed': String(lang === l), onclick: () => { lang = l; render(); } }, l.toUpperCase()))),
    h('main', { id: 'view' }, currentView()),
    h('div', { class: 'savebar', role: 'region', 'aria-label': 'შენახვა' },
      h('span', { class: 'savebar__st', role: 'status', 'aria-live': 'polite' }, 'ყველაფერი შენახულია'),
      h('button', { type: 'button', class: 'btn btn--ghost-inv', onclick: () => { if (!confirm('ყველა შეუნახავი ცვლილება გაუქმდება. გავაგრძელოთ?')) return; content = JSON.parse(savedJson); render(); touch(); } }, 'გაუქმება'),
      h('button', { type: 'button', class: 'btn btn--red', onclick: save }, 'შენახვა')));
  touch();
}

function loginView(message = '') {
  const err = h('p', { class: 'login__err', role: 'alert' }, message);
  const submit = h('button', { type: 'submit', class: 'btn btn--red' }, 'შესვლა');
  app.replaceChildren(
    h('form', { class: 'login', onsubmit: async (e: Event) => {
      e.preventDefault();
      const data = new FormData(e.target as HTMLFormElement);
      submit.disabled = true;
      submit.textContent = 'შესვლა…';
      try {
        await signIn(String(data.get('email')), String(data.get('password')));
        await boot();
      } catch (ex) {
        err.textContent = (ex as Error).message;
        submit.disabled = false;
        submit.textContent = 'შესვლა';
      }
    } },
      h('h1', { translate: 'no' }, 'JOKER', h('span', {}, 'ადმინი')),
      h('div', { class: 'fld' }, h('label', { for: 'email' }, 'ელფოსტა'), h('input', { id: 'email', name: 'email', type: 'email', autocomplete: 'username', spellcheck: 'false', required: true })),
      h('div', { class: 'fld' }, h('label', { for: 'password' }, 'პაროლი'), h('input', { id: 'password', name: 'password', type: 'password', autocomplete: 'current-password', required: true })),
      err, submit));
}

async function boot() {
  app.replaceChildren(h('p', { class: 'loading' }, 'იტვირთება…'));
  try {
    if (!(await currentUser())) return loginView();
    if (!(await isAdmin())) {
      await signOut();
      return loginView('ამ მომხმარებელს რედაქტირების უფლება არ აქვს. დაამატეთ ის ცხრილში „admins“ (იხ. README.md).');
    }
    content = await loadContent();
    savedJson = JSON.stringify(content);
    render();
  } catch (err) {
    app.replaceChildren(h('div', { class: 'login' }, h('h1', {}, 'შეცდომა'), h('p', { role: 'alert' }, (err as Error).message), h('button', { type: 'button', class: 'btn btn--red', onclick: boot }, 'ხელახლა ცდა')));
  }
}

// შეუნახავი ცვლილებებით გვერდის დახურვის დაცვა + Ctrl/Cmd+S
window.addEventListener('beforeunload', (e) => { if (content && isDirty()) e.preventDefault(); });
window.addEventListener('keydown', (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); } });

boot();
