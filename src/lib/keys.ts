// Place and item keys shared by build code and browser code.
// Japan places keep their bare prefecture slug ("kyoto") so saved trips and old share links stay valid;
// other countries are prefixed: "au.victoria", "us.new-york".
// Trip items: "s:<place>/<spotId>" or "f:<place>/<foodId>".
export type Country = 'japan' | 'australia' | 'usa';
const PREFIX: Record<Country, string> = { japan: '', australia: 'au.', usa: 'us.' };

export const placeKey = (country: Country, slug: string) => PREFIX[country] + slug;

export function parsePlace(key: string): { country: Country; slug: string } {
  if (key.startsWith('au.')) return { country: 'australia', slug: key.slice(3) };
  if (key.startsWith('us.')) return { country: 'usa', slug: key.slice(3) };
  return { country: 'japan', slug: key };
}

export const placeHref = (key: string) => {
  const { country, slug } = parsePlace(key);
  return `/${country}/${slug}/`;
};

/** "s:us.california/golden-gate-bridge" -> parts. */
export function parseItem(item: string) {
  const kind = item[0] === 'f' ? 'food' : 'spot';
  const [place, id] = item.slice(2).split('/');
  return { kind, place, id, ...parsePlace(place), href: `${placeHref(place)}#${kind}-${id}` } as const;
}

export const ITEM_RE = /^[sf]:(?:(?:au|us)\.)?[a-z]+(?:-[a-z]+)*\/[a-z0-9]+(?:-[a-z0-9]+)*$/;
