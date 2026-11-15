/**
 * მონაცემთა მოდელი — საიტის მთელი შიგთავსი ერთ ობიექტშია (Content).
 * იგივე სტრუქტურა აქვს: src/content/seed.json-ს (დემო), localStorage-ს (დემო ადმინი)
 * და Supabase-ის `content` ცხრილს (თითო ელემენტი = ერთი სტრიქონი).
 */

export type Lang = 'ka' | 'en' | 'ru';
export const LANGS: Lang[] = ['ka', 'en', 'ru'];
export const DEFAULT_LANG: Lang = 'ka';

/** ტექსტი სამ ენაზე */
export type L10n = Record<Lang, string>;

/** ბანქოს ნიშანი (დეკორატიული) */
export type Suit = 'spade' | 'heart' | 'diamond' | 'club' | 'star';

/**
 * სურათის მითითება.
 * src:  "local:<გასაღები>" — ოპტიმიზებული placeholder public/media-დან (იხ. media-manifest.json),
 *       ან სრული URL (Supabase Storage), ან data: URL (დემო რეჟიმში ატვირთული).
 */
export interface ImageRef {
  src: string;
  w?: number;
  h?: number;
}

/** ყველა ელემენტის საერთო ველები */
export interface Item {
  id: string;
  /** დამალულია საიტზე (ადმინში რჩება) */
  hidden?: boolean;
  /** „შესავსებია" — შენიშვნა ადმინისთვის; ცარიელი = ყველაფერი რიგზეა */
  todo?: string;
}

export type SlideVariant = 'brand' | 'photo' | 'rating' | 'branches';
export type CtaAction = 'none' | 'book' | 'whatsapp' | 'services' | 'barbers' | 'branches' | 'works' | 'reviews';

export interface Slide extends Item {
  variant: SlideVariant;
  /** კარტის კუთხის ნიშანი */
  suit: Suit;
  kicker: L10n;
  /** ახალი ხაზი = ხაზის გადატანა; „★" იცვლება ვარსკვლავის ხატულით */
  title: L10n;
  text: L10n;
  cta: CtaAction;
  cta2: CtaAction;
  image: ImageRef | null;
  imageAlt: L10n;
}

export interface Service extends Item {
  name: L10n;
  desc: L10n;
  /** ხანგრძლივობა წუთებში (0 = არ ჩანს) */
  duration: number;
  /** ფასი ლარში: "50" ან "50–70"; ცარიელი = „შეთანხმებით" */
  price: string;
  /** true → „50 ₾-დან" */
  priceFrom: boolean;
}

export interface ServiceCategory extends Item {
  suit: Suit;
  title: L10n;
  items: Service[];
}

export interface Barber extends Item {
  name: L10n;
  role: L10n;
  /** ფილიალის id; ცარიელი = მითითებული არ არის */
  branchId: string;
  specialties: L10n;
  /** ენების კოდები: ka, en, ru, hy, az, tr, uk, de */
  languages: string[];
  photo: ImageRef | null;
  /** false → „ჩაეწერე მასთან" ღილაკის ნაცვლად WhatsApp (მაგ. ადმინისტრატორი) */
  bookable: boolean;
  /** არასავალდებულო: პირდაპირი ბმული ამ ბარბერზე Altegio-ში */
  bookingUrl: string;
}

export interface DayHours {
  open: string; // "11:00"
  close: string; // "21:00"
  closed: boolean;
}

export interface Branch extends Item {
  suit: Suit;
  /** მოკლე სახელი: „ბახტრიონი" */
  name: L10n;
  address: L10n;
  /** ორიენტირი: „მეტრო ... -სთან" */
  hint: L10n;
  lat: number;
  lng: number;
  phone: string;
  /** WhatsApp-ის ნომერი; ცარიელი = იგივე ტელეფონი */
  whatsapp: string;
  /** Altegio-ს ბმული ამ ფილიალისთვის */
  bookingUrl: string;
  /** 7 დღე, ორშაბათიდან კვირამდე */
  hours: DayHours[];
  rating: string;
  reviewsCount: string;
}

export interface GalleryItem extends Item {
  image: ImageRef;
  alt: L10n;
}

export interface Review extends Item {
  text: L10n;
}

export interface FaqItem extends Item {
  q: L10n;
  a: L10n;
}

export interface Settings {
  brand: string;
  /** ლოგო (არასავალდებულო). თუ ცარიელია — ჩანს ტექსტური ლოგო */
  logo: ImageRef | null;
  /** Altegio-ს საერთო გვერდი (ფილიალის არჩევა) */
  bookingUrl: string;
  instagram: string;
  facebook: string;
  ratingValue: string;
  ratingCount: string;
  seoTitle: L10n;
  seoDescription: L10n;
  creditName: string;
  creditUrl: string;
  /** შენიშვნები ადმინისთვის (მაგ. „ლოგო მოსაწოდებელია") */
  todo?: string;
}

export interface Content {
  version: 1;
  settings: Settings;
  /** ინტერფეისის ყველა ტექსტი: გასაღები → სამი ენა */
  texts: Record<string, L10n>;
  slides: Slide[];
  categories: ServiceCategory[];
  barbers: Barber[];
  branches: Branch[];
  gallery: GalleryItem[];
  reviews: Review[];
  faq: FaqItem[];
  /** ბოლო ცვლილების დრო (ISO) — საიტი ამით ხვდება, რომ შიგთავსი განახლდა */
  updatedAt: string;
}

/** კოლექციები, რომლებიც Supabase-ში სტრიქონებად ინახება */
export const COLLECTIONS = ['slides', 'categories', 'barbers', 'branches', 'gallery', 'reviews', 'faq'] as const;
export type CollectionName = (typeof COLLECTIONS)[number];

/** ოპტიმიზებული სურათების მანიფესტი (აგენერირებს scripts/optimize-images.mjs) */
export interface MediaEntry {
  w: number;
  h: number;
  widths: number[];
  /** დომინანტური ფერი — ჩატვირთვამდე ფონად */
  color: string;
}
export type MediaManifest = Record<string, MediaEntry>;
