// Practical travel tips, shopping/platform comparisons, departure/return checklists, Xianyu guide, and curated food map.
import { dataFile, live } from './data';
import { lang } from './i18n';

export type TipPlatform = 'official' | 'xiaohongshu' | 'xianyu' | 'ctrip' | 'internal';

export interface TipLink {
  label: string;
  platform: TipPlatform;
  url: string;
}

export interface PlatformDeal {
  id: string;
  category: 'transport' | 'network' | 'tickets' | 'booking';
  badge: string;
  title: string;
  summary: string;
  verdict: string;
  tips: string[];
  links: TipLink[];
}

export interface PhaseItem {
  id: string;
  tag: string;
  title: string;
  detail: string;
  link?: TipLink;
}

export interface PhaseGroup {
  title: string;
  subtitle: string;
  items: PhaseItem[];
}

export interface XianyuGood {
  id: string;
  tag: string;
  title: string;
  detail: string;
  searchUrl: string;
}

export interface XianyuAvoid {
  title: string;
  detail: string;
}

export interface FoodPick {
  id: string;
  city: 'tokyo' | 'osaka' | 'kyoto' | 'fukuoka' | 'sapporo';
  cityName: string;
  area: string;
  category: 'ramen' | 'meat' | 'sushi' | 'izakaya' | 'cafe';
  categoryName: string;
  name: string;
  local: string;
  dish: string;
  price: string;
  tip: string;
  mapsUrl: string;
  xhsUrl?: string;
}

export interface TravelTipsData {
  checked: string;
  platforms: PlatformDeal[];
  phases: {
    before: PhaseGroup;
    departure: PhaseGroup;
  };
  xianyu: {
    intro: string;
    goodBuys: XianyuGood[];
    avoid: XianyuAvoid[];
  };
  foods: FoodPick[];
  sources: { title: string; url: string }[];
}

export const travelTips = live<TravelTipsData>((l) => dataFile<TravelTipsData>('toolkit/tips.json', l)!);

/** Chinese-only third-party platforms are hidden on English and Japanese builds per site conventions. */
export function visibleLinks(links: TipLink[]): TipLink[] {
  if (lang() === 'zh') return links;
  return links.filter((x) => x.platform === 'official' || x.platform === 'internal');
}
