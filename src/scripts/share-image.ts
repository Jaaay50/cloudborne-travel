// 行程分享长图：把行程画成一张竖版 PNG（浏览器端，无依赖）。
// Layout is computed once in a fixed 1080-unit design space (measuring text on a scratch
// context), recorded as draw ops, then replayed on a canvas scaled to the requested size.

export interface ShareItem {
  name: string;
  sub?: string;
  food?: boolean;
  /** Same-origin URL of a small photo; may 404 (the row then falls back to an icon). */
  img?: string;
}
export interface ShareDay {
  /** e.g. "第 1 天 · 11月3日" */
  label: string;
  /** e.g. "京都" */
  place?: string;
  items: ShareItem[];
}
export interface ShareTrip {
  title: string;
  /** e.g. "日本 · 6 天 · 14 个地点" */
  subtitle?: string;
  days: ShareDay[];
  /** Same-origin image URL for the header. */
  cover?: string;
}

type Ctx = CanvasRenderingContext2D;
/** Draw op; `k` = device px per design unit (canvas shadows ignore the transform, so they scale by hand). */
type Op = (c: Ctx, k: number) => void;

const COLOR = {
  paper: '#f6f1e7',
  card: '#fffdf8',
  line: '#e3dccd',
  ink: '#1f2430',
  ink2: '#4d5361',
  mut: '#7a7f8a',
  red: '#c2412b',
  redBg: '#f8e6df',
  gold: '#b88a2e',
  goldBg: '#f4ecd9',
};
const SERIF = '"Songti SC", "Noto Serif SC", "Source Han Serif SC", serif';
const SANS = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", sans-serif';
const font = (weight: number, px: number, family = SANS) => `${weight} ${px}px ${family}`;

const W = 1080; // design width; everything below is in these units
const PAD = 56; // outer margin
const CARD_W = W - PAD * 2;
const CARD_PAD = 40;
const INNER_W = CARD_W - CARD_PAD * 2;
const THUMB = 96;
const MAX_PIXELS = 16_000_000; // stays under iOS Safari's 16.7 MP canvas limit
const MAX_SIDE = 32_767; // Firefox/Chromium per-side limit
const IMG_TIMEOUT = 4000;
const FONT_TIMEOUT = 3000;

const F = {
  eyebrow: font(600, 22),
  titlePaper: font(700, 72, SERIF),
  titleCover: font(700, 66, SERIF),
  subtitle: font(400, 28),
  badge: font(700, 22),
  badgeSmall: font(700, 19),
  dayLabel: font(600, 30),
  place: font(600, 22),
  name: font(600, 30),
  sub: font(400, 24),
  empty: font(400, 26),
  footer: font(400, 22),
};

// ---------- text ----------

const CJK = /[⺀-鿿ꥠ-꥿가-힯豈-﫿︰-﹏＀-￯]|[\ud840-\ud87f][\udc00-\udfff]/;
// Kinsoku: never start a line with a closing mark, never end one with an opening mark.
const NO_START = /^[、。，．,.；;：:？?！!）)」』】〕〉》”’…·ー々ゝゞぁぃぅぇぉっゃゅょァィゥェォッャュョ%‰℃]/;
const NO_END = /[（(「『【〔〈《“‘]$/;

/** Splits text into unbreakable chunks: one per CJK character, one per Latin word (+ trailing spaces). */
function tokenize(text: string): string[] {
  const raw: string[] = [];
  let word = '';
  for (const ch of text) {
    if (ch === ' ') {
      word += ch;
      raw.push(word);
      word = '';
    } else if (CJK.test(ch)) {
      if (word) raw.push(word);
      raw.push(ch);
      word = '';
    } else {
      if (word.endsWith(' ')) {
        raw.push(word);
        word = '';
      }
      word += ch;
    }
  }
  if (word) raw.push(word);
  const out: string[] = [];
  for (const t of raw) {
    const prev = out[out.length - 1];
    if (prev !== undefined && (NO_START.test(t) || NO_END.test(prev))) out[out.length - 1] = prev + t;
    else out.push(t);
  }
  return out;
}

/** Collapses whitespace/control chars and caps length by code point (never splits an emoji or rare CJK char). */
const clean = (s: unknown, max = 200) => {
  const chars = Array.from(
    String(s ?? '')
      .replace(/[\u0000-\u001f\u007f]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  );
  return chars.length > max ? chars.slice(0, max - 1).join('').trimEnd() + '…' : chars.join('');
};

/** Shortens `text` with a trailing ellipsis until it fits `maxW`. */
function ellipsize(c: Ctx, text: string, maxW: number): string {
  if (c.measureText(text).width <= maxW) return text;
  const chars = Array.from(text);
  let lo = 0;
  let hi = chars.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (c.measureText(chars.slice(0, mid).join('').trimEnd() + '…').width <= maxW) lo = mid;
    else hi = mid - 1;
  }
  return chars.slice(0, lo).join('').trimEnd() + '…';
}

/** Wraps text to `maxW` (CJK breaks anywhere, Latin prefers spaces), at most `maxLines`, ellipsis on overflow. */
function wrap(c: Ctx, text: string, maxW: number, maxLines: number): string[] {
  const lines: string[] = [];
  let cur = '';
  const fits = (s: string) => c.measureText(s.trimEnd()).width <= maxW;
  for (const tok of tokenize(text)) {
    if (fits(cur + tok)) {
      cur += tok;
      continue;
    }
    if (cur) lines.push(cur.trimEnd());
    cur = '';
    if (fits(tok)) {
      cur = tok;
      continue;
    }
    // A single word wider than the line: hard-break it by character.
    for (const ch of tok) {
      if (cur && !fits(cur + ch)) {
        lines.push(cur.trimEnd());
        cur = '';
      }
      cur += ch;
    }
  }
  if (cur.trim()) lines.push(cur.trimEnd());
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = ellipsize(c, lines[maxLines - 1] + (/[\x21-\x7e]$/.test(lines[maxLines - 1]) ? ' ' : '') + lines[maxLines], maxW);
  return kept;
}

/** Like `wrap`, but for headlines: prefers a break after punctuation, otherwise evens out line widths. */
function wrapBalanced(c: Ctx, text: string, maxW: number, maxLines: number): string[] {
  const lines = wrap(c, text, maxW, maxLines);
  if (lines.length < 2 || lines[lines.length - 1].endsWith('…')) return lines;
  const w = (t: string) => c.measureText(t).width;
  if (lines.length === 2) {
    // "从东京到大阪：本州中部十二日环线" reads better as "从东京到大阪：" / "本州中部十二日环线".
    let best: string[] | null = null;
    let bestRatio = 0.4;
    const chars = Array.from(text);
    chars.forEach((ch, i) => {
      if (i === chars.length - 1 || !/[：:，,、；;·・—｜|/\s]/.test(ch) || NO_START.test(chars[i + 1])) return;
      const a = chars.slice(0, i + 1).join('').trimEnd();
      const b = chars.slice(i + 1).join('').trim();
      const wa = w(a);
      const wb = w(b);
      const ratio = Math.min(wa, wb) / Math.max(wa, wb);
      if (a && b && wa <= maxW && wb <= maxW && ratio >= bestRatio) {
        best = [a, b];
        bestRatio = ratio;
      }
    });
    if (best) return best;
  }
  let lo = maxW / lines.length;
  let hi = maxW;
  let best = lines;
  for (let i = 0; i < 12; i++) {
    const mid = (lo + hi) / 2;
    const t = wrap(c, text, mid, maxLines);
    if (t.length === lines.length && !t[t.length - 1].endsWith('…')) {
      best = t;
      hi = mid;
    } else lo = mid;
  }
  return best;
}

// ---------- drawing helpers ----------

function rr(c: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const k = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + k, y);
  c.arcTo(x + w, y, x + w, y + h, k);
  c.arcTo(x + w, y + h, x, y + h, k);
  c.arcTo(x, y + h, x, y, k);
  c.arcTo(x, y, x + w, y, k);
  c.closePath();
}

function drawCover(c: Ctx, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const s = Math.max(w / iw, h / ih);
  const sw = w / s;
  const sh = h / s;
  c.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, x, y, w, h);
}

function text(c: Ctx, s: string, x: number, yMid: number, f: string, color: string, align: CanvasTextAlign = 'left') {
  c.font = f;
  c.fillStyle = color;
  c.textAlign = align;
  c.textBaseline = 'middle';
  c.fillText(s, x, yMid);
}

function setSpacing(c: Ctx, v: string) {
  if ('letterSpacing' in c) (c as Ctx & { letterSpacing: string }).letterSpacing = v;
}

// ---------- loading ----------

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(ok && img.naturalWidth > 0 && img.naturalHeight > 0 ? img : null);
    };
    const timer = setTimeout(() => {
      finish(false);
      img.src = '';
    }, IMG_TIMEOUT);
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onerror = () => finish(false);
    img.src = src;
    img.decode().then(
      () => finish(true),
      () => finish(img.complete),
    );
  });
}

async function waitFonts(samples: string) {
  const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
  if (!fonts) return;
  const wait = new Promise((r) => setTimeout(r, FONT_TIMEOUT));
  try {
    const loads = Object.values(F).map((f) => fonts.load(f, samples).catch(() => []));
    await Promise.race([Promise.all(loads).then(() => fonts.ready), wait]);
  } catch {
    /* system fonts still render */
  }
}

// ---------- layout ----------

interface Loaded {
  cover: HTMLImageElement | null;
  imgs: Map<string, HTMLImageElement | null>;
}

function cardOp(top: number, h: number): Op {
  return (c, k) => {
    c.save();
    c.shadowColor = 'rgba(42,33,20,0.06)';
    c.shadowBlur = 18 * k;
    c.shadowOffsetY = 4 * k;
    c.fillStyle = COLOR.card;
    rr(c, PAD, top, CARD_W, h, 22);
    c.fill();
    c.restore();
    c.strokeStyle = COLOR.line;
    c.lineWidth = 1;
    rr(c, PAD + 0.5, top + 0.5, CARD_W - 1, h - 1, 21.5);
    c.stroke();
  };
}

function layoutHeader(trip: ShareTrip, cover: HTMLImageElement | null, m: Ctx, ops: Op[]): number {
  const title = clean(trip.title, 120) || '我的行程';
  const subtitle = clean(trip.subtitle, 80);
  let y = PAD;

  if (cover) {
    const hh = 640;
    const top = y;
    const tx = PAD + 52;
    const tw = CARD_W - 104;
    m.font = F.titleCover;
    const tLines = wrapBalanced(m, title, tw, 2);
    const tLh = 84;
    const sLh = 40;
    m.font = F.subtitle;
    const sub = subtitle ? ellipsize(m, subtitle, tw) : '';
    const titleTop = top + hh - 52 - (sub ? sLh + 12 : 0) - tLines.length * tLh;
    ops.push((c, k) => {
      c.save();
      rr(c, PAD, top, CARD_W, hh, 28);
      c.clip();
      c.fillStyle = '#2a2d33';
      c.fillRect(PAD, top, CARD_W, hh);
      drawCover(c, cover, PAD, top, CARD_W, hh);
      const g = c.createLinearGradient(0, top, 0, top + hh);
      g.addColorStop(0, 'rgba(14,16,22,0.30)');
      g.addColorStop(0.2, 'rgba(14,16,22,0)');
      g.addColorStop(0.42, 'rgba(14,16,22,0.04)');
      g.addColorStop(1, 'rgba(14,16,22,0.74)');
      c.fillStyle = g;
      c.fillRect(PAD, top, CARD_W, hh);
      c.shadowColor = 'rgba(0,0,0,0.30)';
      c.shadowBlur = 16 * k;
      setSpacing(c, '4px');
      text(c, '栖云旅行 · 行程', tx, top + 64, F.eyebrow, 'rgba(255,255,255,0.92)');
      setSpacing(c, '0px');
      let ty = titleTop;
      for (const line of tLines) {
        text(c, line, tx, ty + tLh / 2, F.titleCover, '#ffffff');
        ty += tLh;
      }
      if (sub) text(c, sub, tx, ty + 12 + sLh / 2, F.subtitle, 'rgba(255,255,255,0.9)');
      c.restore();
    });
    return top + hh + 40;
  }

  y += 44;
  const ey = y;
  ops.push((c) => {
    c.fillStyle = COLOR.red;
    c.beginPath();
    c.arc(PAD + 6, ey + 17, 6, 0, Math.PI * 2);
    c.fill();
    setSpacing(c, '4px');
    text(c, '栖云旅行 · 行程', PAD + 24, ey + 17, F.eyebrow, COLOR.red);
    setSpacing(c, '0px');
  });
  y += 34 + 26;
  m.font = F.titlePaper;
  const tLh = 92;
  for (const line of wrapBalanced(m, title, CARD_W, 3)) {
    const ly = y;
    ops.push((c) => text(c, line, PAD, ly + tLh / 2, F.titlePaper, COLOR.ink));
    y += tLh;
  }
  if (subtitle) {
    m.font = F.subtitle;
    const sub = ellipsize(m, subtitle, CARD_W);
    const sy = y + 8;
    ops.push((c) => text(c, sub, PAD, sy + 20, F.subtitle, COLOR.ink2));
    y += 8 + 40;
  }
  return y + 52;
}

function layoutDay(day: ShareDay, di: number, top: number, thumbMode: boolean, loaded: Loaded, m: Ctx, ops: Op[]): number {
  const x0 = PAD + CARD_PAD;
  const xEnd = x0 + INNER_W;
  const items = (Array.isArray(day.items) ? day.items : []).filter((it) => it && clean(it.name));
  const start = ops.length;
  let cy = top + 36;

  // Day header: badge, label, place pill
  const badge = `D${di + 1}`;
  const bd = 60;
  const bmid = cy + bd / 2;
  const place = clean(day.place, 24);
  let pillW = 0;
  let placeText = '';
  if (place) {
    m.font = F.place;
    placeText = ellipsize(m, place, 300);
    pillW = Math.ceil(m.measureText(placeText).width) + 40;
  }
  const lx = x0 + bd + 22;
  m.font = F.dayLabel;
  const label = ellipsize(m, clean(day.label, 60) || `第 ${di + 1} 天`, xEnd - lx - (pillW ? pillW + 20 : 0));
  ops.push((c) => {
    c.fillStyle = COLOR.red;
    c.beginPath();
    c.arc(x0 + bd / 2, bmid, bd / 2, 0, Math.PI * 2);
    c.fill();
    text(c, badge, x0 + bd / 2, bmid + 1, badge.length > 2 ? F.badgeSmall : F.badge, '#ffffff', 'center');
    text(c, label, lx, bmid, F.dayLabel, COLOR.ink);
    if (pillW) {
      const px = xEnd - pillW;
      c.fillStyle = COLOR.redBg;
      rr(c, px, bmid - 21, pillW, 42, 21);
      c.fill();
      text(c, placeText, px + pillW / 2, bmid + 1, F.place, COLOR.red, 'center');
    }
  });
  cy += bd;

  if (!items.length) {
    cy += 28;
    const ey = cy;
    ops.push((c) => {
      c.save();
      c.strokeStyle = COLOR.line;
      c.lineWidth = 2;
      c.setLineDash([8, 8]);
      rr(c, x0 + 1, ey + 1, INNER_W - 2, 92, 16);
      c.stroke();
      c.restore();
      text(c, '这一天还没安排', x0 + INNER_W / 2, ey + 47, F.empty, COLOR.mut, 'center');
    });
    cy += 94;
  } else {
    cy += 30;
    const sepY = cy;
    ops.push((c) => {
      c.fillStyle = COLOR.line;
      c.fillRect(x0, sepY, INNER_W, 1);
    });
    cy += 30;

    const nameLh = 42;
    const subLh = 34;
    const tx = thumbMode ? x0 + THUMB + 28 : x0 + 44;
    const tw = xEnd - tx;
    const dots: { y: number; food: boolean }[] = [];

    items.forEach((it, ii) => {
      m.font = F.name;
      const nLines = wrap(m, clean(it.name), tw, 2);
      m.font = F.sub;
      const subRaw = clean(it.sub);
      const subText = subRaw ? ellipsize(m, subRaw, tw) : '';
      const textH = nLines.length * nameLh + (subText ? 4 + subLh : 0);
      const rowH = thumbMode ? Math.max(THUMB, textH) : textH;
      const rowTop = cy;
      const textTop = rowTop + (rowH - textH) / 2;
      const food = !!it.food;
      const img = it.img ? loaded.imgs.get(it.img) ?? null : null;

      if (thumbMode) {
        const ty = rowTop + (rowH - THUMB) / 2;
        ops.push((c) => {
          c.save();
          rr(c, x0, ty, THUMB, THUMB, 18);
          c.clip();
          if (img) {
            c.fillStyle = COLOR.line;
            c.fillRect(x0, ty, THUMB, THUMB);
            drawCover(c, img, x0, ty, THUMB, THUMB);
          } else {
            c.fillStyle = food ? COLOR.goldBg : COLOR.redBg;
            c.fillRect(x0, ty, THUMB, THUMB);
            c.fillStyle = food ? COLOR.gold : COLOR.red;
            c.beginPath();
            c.arc(x0 + THUMB / 2, ty + THUMB / 2, 12, 0, Math.PI * 2);
            c.fill();
          }
          c.restore();
          if (img) {
            c.strokeStyle = 'rgba(31,36,48,0.08)';
            c.lineWidth = 1;
            rr(c, x0 + 0.5, ty + 0.5, THUMB - 1, THUMB - 1, 17.5);
            c.stroke();
          }
        });
      } else {
        dots.push({ y: textTop + nameLh / 2, food });
      }

      ops.push((c) => {
        let ly = textTop;
        for (const line of nLines) {
          text(c, line, tx, ly + nameLh / 2, F.name, COLOR.ink);
          ly += nameLh;
        }
        if (subText) text(c, subText, tx, ly + 4 + subLh / 2, F.sub, COLOR.mut);
      });

      cy += rowH;
      if (ii < items.length - 1) {
        if (thumbMode) {
          const ly = cy + 20;
          ops.push((c) => {
            c.fillStyle = COLOR.line;
            c.fillRect(tx, ly, xEnd - tx, 1);
          });
          cy += 41;
        } else cy += 40;
      }
    });

    if (dots.length) {
      const dx = x0 + 12;
      ops.push((c) => {
        if (dots.length > 1) {
          c.fillStyle = COLOR.line;
          c.fillRect(dx - 1, dots[0].y, 2, dots[dots.length - 1].y - dots[0].y);
        }
        for (const d of dots) {
          c.fillStyle = COLOR.card;
          c.beginPath();
          c.arc(dx, d.y, 14, 0, Math.PI * 2);
          c.fill();
          c.fillStyle = d.food ? COLOR.gold : COLOR.red;
          c.beginPath();
          c.arc(dx, d.y, 8, 0, Math.PI * 2);
          c.fill();
        }
      });
    }
  }

  cy += 40;
  ops.splice(start, 0, cardOp(top, cy - top)); // card sits underneath its contents
  return cy;
}

function layout(trip: ShareTrip, loaded: Loaded, m: Ctx): { ops: Op[]; height: number } {
  const ops: Op[] = [];
  let y = layoutHeader(trip, loaded.cover, m, ops);
  // Once any thumbnail loads, every row gets a thumbnail slot so the text column stays aligned.
  const thumbMode = Array.from(loaded.imgs.values()).some(Boolean);
  const days: ShareDay[] = Array.isArray(trip.days) && trip.days.length ? trip.days : [{ label: '第 1 天', items: [] }];
  days.forEach((day, di) => {
    y = layoutDay(day || { label: '', items: [] }, di, y, thumbMode, loaded, m, ops) + 28;
  });

  // Footer
  y += 20;
  const fy = y;
  ops.push((c) => {
    setSpacing(c, '2px');
    text(c, '栖云旅行 · travel.cloudborne.cn', W / 2, fy + 16, F.footer, COLOR.mut, 'center');
    setSpacing(c, '0px');
  });
  y += 32 + PAD + 8;
  return { ops, height: Math.ceil(y) };
}

// ---------- public ----------

/** Renders the trip as a tall portrait PNG. `width` is in CSS px (default 1080), `scale` is the pixel ratio (default 2, reduced automatically for very long trips). */
export async function renderTripImage(trip: ShareTrip, opts: { width?: number; scale?: number } = {}): Promise<Blob> {
  const width = Math.max(320, Math.min(2160, Math.round(opts.width ?? W)));
  const wantScale = opts.scale && opts.scale > 0 ? opts.scale : 2;

  const samples = [trip.title, trip.subtitle, ...(trip.days || []).flatMap((d) => [d?.label, d?.place, ...(d?.items || []).map((i) => i?.name)])]
    .filter(Boolean)
    .join('')
    .slice(0, 400);
  const urls = new Set<string>();
  for (const d of trip.days || []) for (const it of d?.items || []) if (it?.img) urls.add(it.img);
  const [cover, entries] = await Promise.all([
    trip.cover ? loadImage(trip.cover) : Promise.resolve(null),
    Promise.all(Array.from(urls, async (u) => [u, await loadImage(u)] as const)),
    waitFonts(samples + '栖云旅行行程这一天还没安排D0123456789'),
  ]);
  const loaded: Loaded = { cover, imgs: new Map(entries) };

  const measure = document.createElement('canvas').getContext('2d');
  if (!measure) throw new Error('Canvas 不可用');
  const { ops, height } = layout(trip, loaded, measure);

  // Design units -> CSS px -> device px, capped by total pixels and the max canvas side.
  const unit = width / W;
  const cssH = height * unit;
  let scale = wantScale;
  scale = Math.min(scale, Math.sqrt(MAX_PIXELS / (width * cssH)), MAX_SIDE / cssH, MAX_SIDE / width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  const k = canvas.width / W;
  canvas.height = Math.max(1, Math.min(MAX_SIDE, Math.floor(height * k)));
  const c = canvas.getContext('2d');
  if (!c) throw new Error('Canvas 不可用');
  c.setTransform(k, 0, 0, k, 0, 0);
  c.imageSmoothingEnabled = true;
  c.imageSmoothingQuality = 'high';
  c.fillStyle = COLOR.paper;
  c.fillRect(0, 0, W, height);
  for (const op of ops) {
    c.save();
    op(c, k);
    c.restore();
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('图片生成失败'))), 'image/png');
  });
}
