#!/usr/bin/env python3
"""Validate Japan content JSON files against CONTENT-SCHEMA.md.

Usage: python3 -I scripts/check_content.py <file.json> [...]
       python3 -I scripts/check_content.py --all
Exit code 1 when any file has errors; warnings do not fail.
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "src", "data", "japan")

SLUGS = ("hokkaido aomori iwate miyagi akita yamagata fukushima ibaraki tochigi gunma saitama chiba tokyo "
         "kanagawa niigata toyama ishikawa fukui yamanashi nagano gifu shizuoka aichi mie shiga kyoto osaka "
         "hyogo nara wakayama tottori shimane okayama hiroshima yamaguchi tokushima kagawa ehime kochi fukuoka "
         "saga nagasaki kumamoto oita miyazaki kagoshima okinawa").split()
REGION_OF = {}
for rid, lo, hi in [("hokkaido", 1, 1), ("tohoku", 2, 7), ("kanto", 8, 14), ("chubu", 15, 23), ("kansai", 24, 30),
                    ("chugoku", 31, 35), ("shikoku", 36, 39), ("kyushu", 40, 46), ("okinawa", 47, 47)]:
    for i in range(lo, hi + 1):
        REGION_OF[i] = rid
KINDS = set("temple shrine castle nature onsen city street museum garden market park island viewpoint theme-park hiking".split())
THEMES = set("sakura flowers autumn snow onsen sea heritage nature art".split())
SEASONS = {"spring", "summer", "autumn", "winter"}
# Rough bounding box per prefecture would be ideal; Japan-wide box catches swapped lon/lat.
LON, LAT = (122.0, 154.0), (24.0, 45.6)
ID_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")


class Report:
    def __init__(self, path):
        self.path, self.errors, self.warnings = path, [], []

    def err(self, msg):
        self.errors.append(msg)

    def warn(self, msg):
        self.warnings.append(msg)


def text_len(s):
    return len(re.sub(r"\s", "", s or ""))


def need_str(r, obj, key, where, lo=1, hi=None, required=True):
    v = obj.get(key)
    if v is None or v == "":
        if required:
            r.err(f"{where}.{key} missing")
        return
    if not isinstance(v, str):
        r.err(f"{where}.{key} must be a string")
        return
    n = text_len(v)
    if n < lo:
        r.warn(f"{where}.{key} short ({n} chars)")
    if hi and n > hi:
        r.warn(f"{where}.{key} long ({n} > {hi} chars)")


def check_no_cover(r, d):
    if "cover" in d:
        r.err("cover is written by the main session (covers.json); remove it")


def check_sources(r, d):
    src = d.get("sources")
    if not isinstance(src, list) or not src:
        r.warn("sources empty")
        return
    for i, s in enumerate(src):
        if not isinstance(s, dict) or not str(s.get("url", "")).startswith("https://"):
            r.err(f"sources[{i}] needs title + https url")


def check_cover(r, d):
    c = d.get("cover")
    if not isinstance(c, dict):
        r.err("cover missing")
        return
    need_str(r, c, "scene", "cover", 40, 600)
    need_str(r, c, "alt", "cover", 4, 24)
    if re.search(r"[一-鿿]", c.get("scene", "")):
        r.err("cover.scene must be English")


def check_pref(r, d, fname):
    slug = d.get("slug")
    if slug not in SLUGS:
        r.err(f"slug {slug!r} unknown")
        return
    if fname != f"{slug}.json":
        r.err(f"file name should be {slug}.json")
    pid = SLUGS.index(slug) + 1
    if d.get("id") != pid:
        r.err(f"id should be {pid}")
    if d.get("region") != REGION_OF[pid]:
        r.err(f"region should be {REGION_OF[pid]}")
    for k, lo, hi in [("name", 1, 6), ("local", 2, 6), ("kana", 2, 12), ("en", 2, 20), ("tagline", 6, 28),
                      ("days", 2, 12), ("stay", 20, 90), ("checked", 4, 10)]:
        need_str(r, d, k, "pref", lo, hi)
    intro = d.get("intro")
    if not isinstance(intro, list) or not 2 <= len(intro) <= 3:
        r.err("intro must be 2-3 paragraphs")
    else:
        for i, p in enumerate(intro):
            if not 40 <= text_len(p) <= 170:
                r.warn(f"intro[{i}] length {text_len(p)} (want 60-140)")
    s = d.get("seasons") or {}
    best = s.get("best")
    if not isinstance(best, list) or not best or not set(best) <= SEASONS:
        r.err("seasons.best must be non-empty subset of spring/summer/autumn/winter")
    need_str(r, s, "note", "seasons", 10, 70)
    acc = d.get("access")
    if not isinstance(acc, list) or not 2 <= len(acc) <= 4:
        r.err("access must have 2-4 entries")
    else:
        for i, a in enumerate(acc):
            need_str(r, a, "from", f"access[{i}]", 1, 16)
            need_str(r, a, "how", f"access[{i}]", 8, 80)
    spots = d.get("spots")
    big = slug in {"tokyo", "kyoto", "osaka", "hokkaido", "okinawa"}
    if not isinstance(spots, list) or not 5 <= len(spots) <= (10 if big else 8):
        r.err(f"spots count {len(spots) if isinstance(spots, list) else 'missing'} (want 5-{10 if big else 8})")
        spots = spots if isinstance(spots, list) else []
    ids = set()
    for i, sp in enumerate(spots):
        w = f"spots[{i}]"
        sid = sp.get("id", "")
        if not ID_RE.match(sid):
            r.err(f"{w}.id {sid!r} must be kebab-case")
        if sid in ids:
            r.err(f"{w}.id {sid!r} duplicated")
        ids.add(sid)
        need_str(r, sp, "name", w, 2, 16)
        need_str(r, sp, "local", w, 1, 24, required=False)
        need_str(r, sp, "en", w, 2, 48, required=False)
        need_str(r, sp, "text", w, 40, 140)
        need_str(r, sp, "time", w, 2, 16)
        need_str(r, sp, "tip", w, 4, 55, required=False)
        need_str(r, sp, "fee", w, 1, 30, required=False)
        if sp.get("kind") not in KINDS:
            r.err(f"{w}.kind {sp.get('kind')!r} not allowed")
        th = sp.get("themes", [])
        if not isinstance(th, list) or not set(th) <= THEMES or len(th) > 3:
            r.err(f"{w}.themes invalid: {th}")
        ll = sp.get("ll")
        if not (isinstance(ll, list) and len(ll) == 2 and all(isinstance(x, (int, float)) for x in ll)):
            r.err(f"{w}.ll must be [lon, lat]")
        elif not (LON[0] <= ll[0] <= LON[1] and LAT[0] <= ll[1] <= LAT[1]):
            r.err(f"{w}.ll {ll} outside Japan (lon,lat order?)")
    foods = d.get("foods")
    if not isinstance(foods, list) or not 3 <= len(foods) <= 5:
        r.err("foods must have 3-5 entries")
        foods = foods if isinstance(foods, list) else []
    fids = set()
    for i, f in enumerate(foods):
        w = f"foods[{i}]"
        fid = f.get("id", "")
        if not ID_RE.match(fid) or fid in fids:
            r.err(f"{w}.id {fid!r} invalid or duplicated")
        fids.add(fid)
        need_str(r, f, "name", w, 1, 12)
        need_str(r, f, "text", w, 30, 110)
        need_str(r, f, "where", w, 4, 55)
        need_str(r, f, "price", w, 2, 30, required=False)
    tips = d.get("tips")
    if not isinstance(tips, list) or not 3 <= len(tips) <= 5:
        r.err("tips must have 3-5 entries")
    else:
        for i, t in enumerate(tips):
            if text_len(t) > 65:
                r.warn(f"tips[{i}] long ({text_len(t)})")
    nb = d.get("nearby")
    if not isinstance(nb, list) or not 2 <= len(nb) <= 4 or not set(nb) <= set(SLUGS) or slug in nb:
        r.err("nearby must list 2-4 other prefecture slugs")
    check_no_cover(r, d)
    check_sources(r, d)


def check_region(r, d, fname):
    slug = d.get("slug")
    if slug not in set(REGION_OF.values()):
        r.err(f"region slug {slug!r} unknown")
        return
    if fname != f"{slug}.json":
        r.err(f"file name should be {slug}.json")
    for k, lo, hi in [("name", 1, 6), ("kana", 2, 12), ("en", 2, 20), ("tagline", 6, 28), ("days", 2, 12),
                      ("season", 8, 50), ("checked", 4, 10)]:
        need_str(r, d, k, "region", lo, hi)
    intro = d.get("intro")
    if not isinstance(intro, list) or len(intro) != 2:
        r.err("intro must be 2 paragraphs")
    for i, g in enumerate(d.get("gateways") or []):
        need_str(r, g, "name", f"gateways[{i}]", 2, 24)
        need_str(r, g, "how", f"gateways[{i}]", 10, 80)
    if not d.get("gateways"):
        r.err("gateways missing")
    for i, p in enumerate(d.get("passes") or []):
        need_str(r, p, "name", f"passes[{i}]", 2, 30)
        need_str(r, p, "text", f"passes[{i}]", 10, 80)
    expect = [SLUGS[i - 1] for i, rid in REGION_OF.items() if rid == slug]
    if sorted(d.get("prefectures") or []) != sorted(expect):
        r.err(f"prefectures should be {expect}")
    check_no_cover(r, d)
    check_sources(r, d)


def load_pref(slug):
    try:
        with open(os.path.join(DATA, "prefectures", slug + ".json"), encoding="utf-8") as fh:
            return json.load(fh)
    except Exception:  # noqa: BLE001
        return None


def check_trip(r, d, fname):
    tid = d.get("id", "")
    if not ID_RE.match(tid) or fname != f"{tid}.json":
        r.err("id must be kebab-case and match file name")
    if d.get("region") not in set(REGION_OF.values()):
        r.err("region unknown")
    for k, lo, hi in [("title", 4, 24), ("for", 4, 40), ("season", 2, 30), ("summary", 40, 140)]:
        need_str(r, d, k, "trip", lo, hi)
    days = d.get("days")
    if not isinstance(days, list) or not days:
        r.err("days missing")
        return
    if d.get("daysCount") != len(days):
        r.err("daysCount must equal len(days)")
    if not isinstance(d.get("bases"), list) or not d.get("bases"):
        r.err("bases missing")
    cache = {}
    for i, day in enumerate(days):
        w = f"days[{i}]"
        need_str(r, day, "title", w, 2, 16)
        need_str(r, day, "stay", w, 1, 12)
        need_str(r, day, "move", w, 4, 60, required=False)
        items = day.get("items")
        if not isinstance(items, list) or not 2 <= len(items) <= 5:
            r.err(f"{w}.items must have 2-5 entries")
            continue
        for j, it in enumerate(items):
            if "note" in it:
                if text_len(it["note"]) > 40:
                    r.warn(f"{w}.items[{j}].note long")
                continue
            slug = it.get("pref")
            if slug not in SLUGS:
                r.err(f"{w}.items[{j}].pref {slug!r} unknown")
                continue
            if slug not in cache:
                cache[slug] = load_pref(slug)
            pd = cache[slug]
            if pd is None:
                r.warn(f"{w}.items[{j}] prefecture file {slug}.json not written yet")
                continue
            if "spot" in it:
                if it["spot"] not in {s.get("id") for s in pd.get("spots", [])}:
                    r.err(f"{w}.items[{j}] spot {it['spot']!r} not in {slug}.json")
            elif "food" in it:
                if it["food"] not in {f.get("id") for f in pd.get("foods", [])}:
                    r.err(f"{w}.items[{j}] food {it['food']!r} not in {slug}.json")
            else:
                r.err(f"{w}.items[{j}] needs spot, food or note")


def check_file(path):
    r = Report(path)
    try:
        with open(path, encoding="utf-8") as fh:
            d = json.load(fh)
    except Exception as exc:  # noqa: BLE001
        r.err(f"invalid JSON: {exc}")
        return r
    fname = os.path.basename(path)
    kind = os.path.basename(os.path.dirname(path))
    if kind == "regions":
        check_region(r, d, fname)
    elif kind == "trips":
        check_trip(r, d, fname)
    else:
        check_pref(r, d, fname)
    return r


def main(argv):
    if argv == ["--all"]:
        files = []
        for sub in ("regions", "prefectures", "trips"):
            p = os.path.join(DATA, sub)
            if not os.path.isdir(p):
                continue
            files += sorted(os.path.join(p, f) for f in os.listdir(p) if f.endswith(".json"))
    else:
        files = argv
    if not files:
        print(__doc__)
        return 2
    bad = 0
    for f in files:
        r = check_file(f)
        status = "FAIL" if r.errors else ("warn" if r.warnings else "ok")
        print(f"{status:4}  {os.path.relpath(f, ROOT)}")
        for e in r.errors:
            print(f"      error: {e}")
        for w in r.warnings:
            print(f"      warn:  {w}")
        bad += bool(r.errors)
    print(f"\n{len(files)} file(s), {bad} with errors")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
