// Toolkit data (src/data/toolkit/*.json). Each file is optional while content is being written.
const mods = import.meta.glob<unknown>('../data/toolkit/*.json', { eager: true, import: 'default' });
const get = <T>(name: string): T | null => (mods[`../data/toolkit/${name}.json`] as T) ?? null;

export interface Src { title: string; url: string }
export interface Phrase { id: string; zh: string; ja: string; kana: string; note?: string }
export interface Phrases { categories: { id: string; title: string; items: Phrase[] }[]; sources?: Src[] }
export interface Emergency {
  numbers: { label: string; number: string; note?: string }[];
  contacts: { name: string; phone: string; hours?: string; note?: string; url?: string }[];
  steps: { title: string; items: string[] }[];
  sources?: Src[];
}
export interface TaxFree {
  summary: string; effective: string;
  rules: { title: string; text: string }[]; steps: { title: string; text: string }[]; faq: { q: string; a: string }[];
  taxRates?: { rate: number; label: string; items: string; note?: string }[];
  calculator: { taxRate: number; reducedRate: number; minPurchase: number | null; note: string };
  sources?: Src[];
}
export interface Checklist { groups: { id: string; title: string; items: { id: string; text: string; detail?: string; url?: string }[] }[]; sources?: Src[] }
export interface Transport {
  airports: { id: string; name: string; code: string; city: string; options: { name: string; to: string; time: string; price: string; note?: string; url?: string }[] }[];
  tips: { title: string; text: string }[];
  passes: { name: string; price: string; text: string }[];
  sources?: Src[];
}
export interface Rules { items: { id: string; title: string; date: string; text: string; url: string }[]; sources?: Src[] }

export const phrases = get<Phrases>('phrases');
export const emergency = get<Emergency>('emergency');
export const taxfree = get<TaxFree>('taxfree');
export const checklist = get<Checklist>('checklist');
export const transport = get<Transport>('transport');
export const rules = get<Rules>('rules2026');

export const TOOLS = [
  { slug: 'phrases', t: '日语大字卡', d: '点餐、忌口、购物、交通、求助，放大给店员看', ico: 'あ', ready: !!phrases },
  { slug: 'airports', t: '机场进城', d: '7 个主要机场怎么进市区、多久、多少钱', ico: '✈', ready: !!transport },
  { slug: 'transport', t: '交通常识', d: 'IC 卡、新干线行李、周游券值不值', ico: '⇄', ready: !!transport },
  { slug: 'tax-free', t: '退税与计算', d: '2026 年 11 月起改为出境退税', ico: '¥', ready: !!taxfree },
  { slug: 'checklist', t: '行前清单', d: '证件、支付、网络、插头，勾选自动保存', ico: '✓', ready: !!checklist },
  { slug: 'emergency', t: '紧急求助', d: '报警急救、使领馆、护照丢失', ico: '!', ready: !!emergency },
  { slug: 'rules-2026', t: '2026 新规', d: '出国税、住宿税、免税改退税', ico: '新', ready: !!rules },
] as const;
