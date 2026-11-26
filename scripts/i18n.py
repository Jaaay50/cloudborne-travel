#!/usr/bin/env python3
"""Translate the site's Chinese content and UI strings into English and Japanese.

    python3 -I scripts/i18n.py translate --lang en|ja [--jobs 6] [--only <path-substring>] [--limit N]
    python3 -I scripts/i18n.py build      # assemble src/i18n/<lang>/** from src/data/** + the caches
    python3 -I scripts/i18n.py check      # list units without a translation (exit 1 with --strict)
    python3 -I scripts/i18n.py extract    # rescan the code for t('…') strings -> src/i18n/ui-source.json
    python3 -I scripts/i18n.py import-cache --lang en|ja <mapping.json>
    python3 -I scripts/i18n.py prune      # drop cached translations nothing uses any more

How it works
- Every content file under src/data is split into units: one per item with an "id" (a spot, a food, a guide
  section…), the rest of the file grouped together. A unit is the set of its Chinese strings.
- A unit's translation is cached under sha256(prompt version + language + unit source) in
  src/i18n/cache/<lang>.json, so a changed sentence is re-translated and everything else is reused.
- "build" writes src/i18n/<lang>/<same path>.json: a copy of the Chinese file with every cached string
  replaced. Strings without a translation stay Chinese, and "check" lists them.
- UI strings are the zh literals passed to t('…') in src/**. "extract" collects them; they are translated
  like content (one unit per string) and assembled into src/i18n/<lang>/_ui.json.

Credentials: the API key is read from the file named by CBT_I18N_KEY_FILE (or OPENAI_API_KEY);
the endpoint is OPENAI_BASE_URL (default https://api.cloudborne.cn/v1). Nothing secret is written.
"""
import argparse
import concurrent.futures as cf
import hashlib
import json
import os
import re
import sys
import threading
import time
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "src", "data")
OUT = os.path.join(ROOT, "src", "i18n")
LANGS = ("en", "ja")
PROMPT_VERSION = "v2"
MODEL = os.environ.get("CBT_I18N_MODEL", "gpt-6.1-sol")

HAN = re.compile(r"[㐀-鿿]")
# Fields that are never translated: Japanese originals, readings, image prompts, identifiers.
KEEP_KEYS = {"local", "kana", "ja", "scene", "photo", "url", "id", "slug", "k", "abbr", "code", "number", "phone",
             "country", "places", "category", "date", "checked", "featured", "handle", "tone", "spotRefs", "platform"}
SKIP_FILES = ("geo/", "photo-index.json", "post-photo-index.json", "rates.json", "japan/photos/")
# Entries that only help mainland-Chinese travellers (Chinese embassies, the 12308 hotline, the 中国领事 app).
# The English and Japanese builds drop them; pages show a "contact your own embassy" line instead.
CN_ONLY = re.compile(r"中国驻|12308|中国领事|中国大使馆|中国总领事馆|领事保护")
CN_ONLY_LISTS = {"contacts", "numbers", "sources"}
# Files not translated per language (Japanese readers do not need Japanese phrase cards).
LANG_SKIP = {"ja": ("toolkit/phrases.json",)}
# Whole file is one unit when it is this small (keeps trips and regions consistent).
SMALL_FILE = 3500
BATCH_CHARS = 2600


# ---------------------------------------------------------------- units

def kept(k, v):
    # Post photo objects contain captions/alt; the climate place map contains city names.
    return k in KEEP_KEYS and not (k in {"photo", "places"} and isinstance(v, dict))


def flat(obj, prefix=""):
    """Yield (relpath, string) for every translatable string in obj."""
    if isinstance(obj, dict):
        for k, v in obj.items():
            if kept(k, v):
                continue
            yield from flat(v, f"{prefix}{k}.")
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            yield from flat(v, f"{prefix}{i}.")
    elif isinstance(obj, str) and HAN.search(obj):
        yield prefix[:-1], obj


def refs(obj, prefix=""):
    """Read-only context for a unit: original-language names of every item in it, keyed by item path."""
    out = {}
    if isinstance(obj, dict):
        names = {k: obj[k] for k in ("local", "en") if isinstance(obj.get(k), str) and obj[k]}
        if names:
            out[prefix[:-1] or "."] = names
        for k, v in obj.items():
            if not kept(k, v):
                out.update(refs(v, f"{prefix}{k}."))
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            out.update(refs(v, f"{prefix}{i}."))
    return out


def file_units(rel, data):
    """[(unit_key, path_prefix, {relpath: zh}, ref)] for one content file."""
    total = sum(len(s) for _, s in flat(data))
    if total == 0:
        return []
    if rel.startswith("posts/") and isinstance(data, dict):
        units, meta = [], {}
        for k, v in data.items():
            if kept(k, v):
                continue
            if k == "steps":
                for i, step in enumerate(v):
                    strings = dict(flat(step))
                    if strings:
                        units.append((f"steps#{step['id']}", f"steps.{i}.", strings, refs(step)))
            elif k in {"meta", "lead", "highlights", "pitfalls", "budgetBreakdown"}:
                strings = dict(flat(v))
                if strings:
                    units.append((k, f"{k}.", strings, refs(v)))
            else:
                meta.update(flat(v, f"{k}."))
        if meta:
            units.insert(0, ("@meta", "", meta, refs(data)))
        return units
    if total <= SMALL_FILE or not isinstance(data, dict):
        return [("*", "", dict(flat(data)), refs(data))]
    units, meta = [], {}
    for k, v in data.items():
        if kept(k, v):
            continue
        if isinstance(v, list) and v and all(isinstance(x, dict) and isinstance(x.get("id"), str) for x in v):
            for i, x in enumerate(v):
                strings = dict(flat(x))
                if strings:
                    units.append((f"{k}#{x['id']}", f"{k}.{i}.", strings, refs(x)))
        elif isinstance(v, list) and sum(len(s) for _, s in flat(v)) > 2500:
            for i, x in enumerate(v):
                strings = dict(flat(x))
                if strings:
                    units.append((f"{k}[{i}]", f"{k}.{i}.", strings, refs(x)))
        elif isinstance(v, dict) and sum(len(s) for _, s in flat(v)) > 2500:
            for kk, x in v.items():
                strings = dict(flat(x, ""))
                if isinstance(x, str) and HAN.search(x):
                    strings = {"": x}
                if strings:
                    units.append((f"{k}.{kk}", f"{k}.{kk}.", strings, refs(x)))
        else:
            for p, s in flat(v, f"{k}."):
                meta[p] = s
    if meta:
        units.insert(0, ("@meta", "", meta, refs(data)))
    return units


def content_files():
    for d, _, fs in os.walk(DATA):
        for f in sorted(fs):
            if not f.endswith(".json"):
                continue
            rel = os.path.relpath(os.path.join(d, f), DATA).replace(os.sep, "/")
            if any(rel.startswith(s) or rel == s for s in SKIP_FILES):
                continue
            yield rel


def drop_cn_only(obj):
    """Copy of obj without CN-only entries in contacts / numbers / sources lists (any depth)."""
    if isinstance(obj, dict):
        return {k: ([drop_cn_only(x) for x in v if not CN_ONLY.search(json.dumps(x, ensure_ascii=False))]
                    if k in CN_ONLY_LISTS and isinstance(v, list) else drop_cn_only(v)) for k, v in obj.items()}
    if isinstance(obj, list):
        return [drop_cn_only(x) for x in obj]
    return obj


def load(rel):
    with open(os.path.join(DATA, rel), encoding="utf-8") as fh:
        data = json.load(fh)
        return data if rel.startswith("posts/") else drop_cn_only(data)


def ui_source():
    path = os.path.join(OUT, "ui-source.json")
    if not os.path.exists(path):
        return {"strings": [], "client": [], "where": {}}
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def ui_units():
    return [(s, "", {"s": s}, {}) for s in ui_source()["strings"]]


def unit_hash(lang, strings, ref):
    blob = json.dumps([PROMPT_VERSION, lang, strings, ref], ensure_ascii=False, sort_keys=True)
    return hashlib.sha256(blob.encode()).hexdigest()[:20]


def all_jobs(lang, only=None):
    """[(file, unit_key, prefix, strings, ref, hash, context)]."""
    jobs = []
    for rel in content_files():
        if only and only not in rel:
            continue
        if rel in LANG_SKIP.get(lang, ()):
            continue
        data = load(rel)
        ctx = context_line(rel, data)
        for key, prefix, strings, ref in file_units(rel, data):
            jobs.append((rel, key, prefix, strings, ref, unit_hash(lang, strings, ref), ctx))
    if not only or only == "_ui":
        where = ui_source().get("where", {})
        for key, prefix, strings, ref in ui_units():
            files = where.get(key, ["?"])
            ctx = (f"Interface text of the travel website (buttons, labels, headings, short messages) used in {', '.join(files[:3])}. "
                   "Keep each string as short as the Chinese; a label stays a label. {name}-style placeholders stand for names or numbers.")
            jobs.append((f"_ui:{files[0]}", key, prefix, strings, ref, unit_hash(lang, strings, ref), ctx))
    return jobs


def context_line(rel, data):
    parts = rel.split("/")
    country = {"japan": "Japan", "australia": "Australia", "usa": "the United States"}.get(parts[0], "")
    if parts[0] == "posts":
        return f"Travel post \"{data['title']}\" in {data['country']}. Preserve the author voice and cited facts."
    if isinstance(data, dict) and data.get("name"):
        bits = [f"{data['name']}"] + [data[k] for k in ("local", "en") if isinstance(data.get(k), str)]
        return f"Guide page for {' / '.join(bits)}, {country}."
    if isinstance(data, dict) and data.get("title"):
        return f"Itinerary \"{data['title']}\" in {country}."
    if parts[0] == "toolkit":
        return f"Japan travel toolkit: {parts[1][:-5]}."
    if parts[-1] == "guide.json":
        return f"Practical travel guide for {country}: visas, entry, money, transport, phone, safety."
    return f"Travel guide data ({rel})."


# ---------------------------------------------------------------- model

LANG_RULES = {
    "en": """Target: natural, concise American English, like a well-edited guidebook. Plain words, short sentences.
- Japanese places, foods and sights: use their usual English/romanized names (e.g. Fushimi Inari Taisha, Gion, yudofu). If an "en" reference is given, use it.
- Australian / US places: use the official English names (the "local" reference when given).
- Currencies: 日元 -> ¥ (e.g. "about ¥2,700"); 美元 -> $; 澳元 -> A$; 人民币/元 -> CNY. Keep every amount, date, time and number exactly.
- Months: "3 月" -> "March", "3–5 月" -> "March–May", "11 月中" -> "mid-November".
- Durations: "2–3 小时" -> "2–3 hours", "3–4 天" -> "3–4 days", "半天" -> "half a day".
- Titles, headings and labels use sentence case ("Take the train or fly between cities"), not Title Case.""",
    "ja": """Target: natural, concise Japanese for a travel guide, です・ます調 for sentences; headings, labels and short items can be plain noun phrases.
- Japanese places, foods and sights: use their real Japanese names in normal Japanese script (the "local" reference when given, e.g. 伏見稲荷大社, 祇園, 湯豆腐), never the Chinese simplified forms.
- Australian / US places: usual Japanese katakana names (グランドキャニオン, ゴールドコースト); add the English name in parentheses only when it helps.
- Currencies: 日元 -> 円 (約2,700円); 美元 -> ドル; 澳元 -> 豪ドル; 人民币/元 -> 人民元. Keep every amount, date, time and number exactly.
- Months: "3–5 月" -> "3〜5月". Durations: "2–3 小时" -> "2〜3時間", "3–4 天" -> "3〜4日".""",
}

SYSTEM = """You translate the Chinese travel website 栖云旅行 into {lang_name}. The brand is "Cloudborne Travel" in English and "栖雲旅行" in Japanese.

{lang_rules}

The Chinese text was written for travellers from mainland China. The translation is read by travellers of any nationality, so:
- Where a sentence only holds for mainland-Chinese passport or licence holders (visa type and fees for Chinese citizens, which e-visa/ETA a Chinese passport can use, driving with a Chinese licence plus translation, Chinese embassies and the 12308 hotline, UnionPay/Alipay/WeChat Pay, Chinese mobile carriers, prices "from China", "回国", "国内" meaning China), rewrite it as general guidance that holds for everyone: say the rule depends on the reader's passport or licence and that they should check the official source. Keep any official site or programme names that appear (ImmiAccount, ESTA, EVUS, Visit Japan Web, NAATI…).
- Embassies or consulates of the destination country located in China (e.g. the U.S. Embassy in Beijing, consulates in Shanghai or Guangzhou) become "a U.S. embassy or consulate in your country" (or the Australian / Japanese equivalent).
- Chinese-language services (中文服务, 中文菜单, asking for a Mandarin interpreter) become "in your language" when the service offers several languages; otherwise drop that clause.
- Keep facts that are true for every traveller. Flights "from mainland China" stay as a fact about flights.
- "国内航班"/"国内线" inside Australia, the USA or Japan means domestic flights there.
- Never add facts, prices, rules, links or warnings that are not in the source. Do not mention travel advisories.

Format rules:
- You get a JSON object. Translate every string value. Return a JSON object with exactly the same keys and nesting; values are the translations.
- "_ref" maps item paths (e.g. "spots.3", or "." for the page itself) to that item's original-language names ("local" = name in the local language, "en" = English name). Use them for names, but leave "_ref" out of the output.
- Keep {{placeholders}} like {{n}} or {{name}}, HTML tags, emoji, arrows (→ ·), URLs and numbers exactly.
- Output the JSON object only."""

LANG_NAME = {"en": "English", "ja": "Japanese"}


def api_key():
    kf = os.environ.get("CBT_I18N_KEY_FILE")
    if kf:
        with open(kf) as fh:
            return fh.read().strip()
    k = os.environ.get("CBT_API_KEY") or os.environ.get("OPENAI_API_KEY")
    if not k:
        sys.exit("set CBT_I18N_KEY_FILE or OPENAI_API_KEY")
    return k


def call_model(key, lang, context, payload, timeout=420):
    base = os.environ.get("OPENAI_BASE_URL", "https://api.cloudborne.cn/v1").rstrip("/")
    body = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM.format(lang_name=LANG_NAME[lang], lang_rules=LANG_RULES[lang])},
            {"role": "user", "content": f"Context: {context}\n\n" + json.dumps(payload, ensure_ascii=False, indent=1)},
        ],
        "response_format": {"type": "json_object"},
    }
    req = urllib.request.Request(base + "/chat/completions", data=json.dumps(body).encode(),
                                 headers={"Authorization": "Bearer " + key, "Content-Type": "application/json", "User-Agent": "cbt-i18n/1"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        j = json.load(r)
    text = j["choices"][0]["message"]["content"].strip()
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text)
    return json.loads(text), j.get("usage", {})


PLACEHOLDER = re.compile(r"\{[a-zA-Z_][a-zA-Z0-9_]*\}|<[^>]+>")
DIGITS = re.compile(r"\d[\d,.]*")


def validate(lang, strings, out):
    """Return (clean dict, warnings) or raise ValueError."""
    if not isinstance(out, dict):
        raise ValueError("not an object")
    clean, warns = {}, []
    for p, src in strings.items():
        tr = out.get(p)
        if not isinstance(tr, str) or not tr.strip():
            raise ValueError(f"missing {p!r}")
        if sorted(PLACEHOLDER.findall(src)) != sorted(PLACEHOLDER.findall(tr)):
            raise ValueError(f"placeholders differ in {p!r}")
        if lang == "en" and HAN.search(tr) and not re.search(r"[぀-ヿ]", tr):
            warns.append(f"han left in {p}: {tr[:60]}")
        lost = [d for d in DIGITS.findall(src) if d.replace(",", "") not in tr.replace(",", "")]
        if lost:
            warns.append(f"numbers {lost[:4]} not found in {p}: {tr[:70]}")
        clean[p] = tr.strip()
    extra = set(out) - set(strings) - {"_ref"}
    if extra:
        warns.append(f"extra keys {sorted(extra)[:3]}")
    return clean, warns


# ---------------------------------------------------------------- cache

def cache_path(lang):
    return os.path.join(OUT, "cache", f"{lang}.json")


def read_cache(lang):
    p = cache_path(lang)
    if os.path.exists(p):
        with open(p, encoding="utf-8") as fh:
            return json.load(fh)
    return {}


def write_json(path, obj, compact=False):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        if compact:
            json.dump(obj, fh, ensure_ascii=False, sort_keys=True, indent=0)
        else:
            json.dump(obj, fh, ensure_ascii=False, indent=2)
        fh.write("\n")
    os.replace(tmp, path)


# ---------------------------------------------------------------- commands

def cmd_translate(a):
    lang = a.lang
    cache = read_cache(lang)
    jobs = [j for j in all_jobs(lang, a.only) if j[5] not in cache]
    if a.limit:
        jobs = jobs[: a.limit]
    if not jobs:
        print(f"{lang}: 0 units to translate")
        return
    key = api_key()
    # Batch units of the same file so names stay consistent inside a request.
    batches, cur, size, cur_file = [], [], 0, None
    for j in jobs:
        n = sum(len(s) for s in j[3].values())
        limit = 40 if j[0].startswith("_ui") else 10 ** 9
        if cur and (j[0] != cur_file or size + n > BATCH_CHARS or len(cur) >= limit):
            batches.append(cur)
            cur, size = [], 0
        cur.append(j)
        cur_file = j[0]
        size += n
    if cur:
        batches.append(cur)
    print(f"{lang}: {len(jobs)} units to translate in {len(batches)} requests", flush=True)
    lock = threading.Lock()
    stats = {"done": 0, "fail": 0, "in": 0, "out": 0}
    log = open(os.path.join(OUT, "cache", f"{lang}.log"), "a", encoding="utf-8")

    def run(batch, depth=0):
        payload = {}
        for (_, ukey, _, strings, ref, h, _) in batch:
            item = dict(strings)
            if ref:
                item["_ref"] = ref
            payload[h] = item
        err = None
        for attempt in range(3):
            try:
                out, usage = call_model(key, lang, batch[0][6], payload)
                results, warns = {}, []
                for (rel, ukey, _, strings, ref, h, _) in batch:
                    clean, w = validate(lang, strings, out.get(h))
                    results[h] = clean
                    warns += [f"{rel} {ukey}: {x}" for x in w]
                with lock:
                    cache.update(results)
                    stats["done"] += len(batch)
                    stats["in"] += usage.get("prompt_tokens", 0)
                    stats["out"] += usage.get("completion_tokens", 0)
                    for w in warns:
                        log.write("WARN " + w + "\n")
                    log.flush()
                return
            except (urllib.error.URLError, TimeoutError, ValueError, KeyError, json.JSONDecodeError, OSError) as e:
                err = e
                if isinstance(e, urllib.error.HTTPError) and e.code in (400, 401, 403):
                    err = f"HTTP {e.code}"
                    if e.code != 400:
                        break
                time.sleep(4 * (attempt + 1))
        if len(batch) > 1 and depth == 0:
            for j in batch:
                run([j], 1)
            return
        with lock:
            stats["fail"] += len(batch)
            for (rel, ukey, *_rest) in batch:
                log.write(f"FAIL {rel} {ukey}: {str(err)[:300]}\n")
            log.flush()

    t0 = time.time()
    with cf.ThreadPoolExecutor(a.jobs) as ex:
        futs = [ex.submit(run, b) for b in batches]
        for i, f in enumerate(cf.as_completed(futs), 1):
            f.result()
            if i % 10 == 0 or i == len(futs):
                with lock:
                    write_json(cache_path(lang), cache, compact=True)
                print(f"{lang}: {i}/{len(futs)} requests, {stats['done']} units ok, {stats['fail']} failed, "
                      f"tokens in {stats['in']} out {stats['out']}, {int(time.time() - t0)} s", flush=True)
    write_json(cache_path(lang), cache, compact=True)
    log.close()
    if stats["fail"]:
        sys.exit(1)


def get_path(obj, path):
    for part in path.split(".") if path else ():
        obj = obj[int(part)] if isinstance(obj, list) else obj[part]
    return obj


def cmd_import_cache(a):
    """Validate all supplied translated units before atomically updating the cache."""
    with open(a.mapping, encoding="utf-8") as fh:
        mapping = json.load(fh)
    if not isinstance(mapping, dict):
        raise ValueError("mapping must be a JSON object")
    if "files" in mapping or "ui" in mapping:
        if set(mapping) - {"files", "ui"}:
            raise ValueError("wrapped mapping may only have files and ui keys")
        files, ui = mapping.get("files", {}), mapping.get("ui", {})
    else:
        files, ui = mapping, {}
    if not isinstance(files, dict) or not isinstance(ui, dict):
        raise ValueError("files and ui must be JSON objects")
    allowed = set(content_files()) - set(LANG_SKIP.get(a.lang, ()))
    unknown = set(files) - allowed
    if unknown:
        raise ValueError(f"unknown content file(s): {sorted(unknown)}")
    entries, warnings = {}, []

    def add(strings, ref, out, context):
        clean, warns = validate(a.lang, strings, out)
        h = unit_hash(a.lang, strings, ref)
        if h in entries and entries[h] != clean:
            raise ValueError(f"conflicting translations for unit {h} ({context})")
        entries[h] = clean
        warnings.extend(f"{context}: {w}" for w in warns)

    for rel, translated_obj in files.items():
        for key, prefix, strings, ref in file_units(rel, load(rel)):
            try:
                out = {p: get_path(translated_obj, (prefix + p) if p else prefix[:-1]) for p in strings}
                add(strings, ref, out, f"{rel} {key}")
            except (KeyError, IndexError, TypeError, ValueError) as e:
                raise ValueError(f"{rel} {key}: {e}") from e
    ui_map = {key: (strings, ref) for key, _, strings, ref in ui_units()}
    for key, tr in ui.items():
        if key not in ui_map:
            raise ValueError(f"unknown UI string: {key}")
        strings, ref = ui_map[key]
        add(strings, ref, {"s": tr}, key)

    cache = read_cache(a.lang)
    cache.update(entries)
    write_json(cache_path(a.lang), cache, compact=True)
    for warning in warnings:
        print(f"WARN {warning}")
    print(f"{a.lang}: imported {len(entries)} units ({len(files)} files, {len(ui)} UI strings)")


def set_path(obj, path, value):
    parts = path.split(".") if path else []
    if not parts:
        return value
    cur = obj
    for p in parts[:-1]:
        cur = cur[int(p)] if isinstance(cur, list) else cur[p]
    last = parts[-1]
    if isinstance(cur, list):
        cur[int(last)] = value
    else:
        cur[last] = value
    return obj


# Official pages that exist per language: the en/ja builds link to their own language's version.
URL_MAP = {
    "en": [("services.digital.go.jp/zh-cmn-hans/", "services.digital.go.jp/en/"),
           ("keishicho.metro.tokyo.lg.jp/multilingual/chinese/", "keishicho.metro.tokyo.lg.jp/multilingual/english/")],
    "ja": [("services.digital.go.jp/zh-cmn-hans/", "services.digital.go.jp/"),
           ("keishicho.metro.tokyo.lg.jp/multilingual/chinese/", "keishicho.metro.tokyo.lg.jp/multilingual/english/")],
}


def localise_urls(obj, lang):
    if isinstance(obj, dict):
        return {k: (map_url(v, lang) if k == "url" and isinstance(v, str) else localise_urls(v, lang)) for k, v in obj.items()}
    if isinstance(obj, list):
        return [localise_urls(x, lang) for x in obj]
    return obj


def map_url(u, lang):
    for a, b in URL_MAP.get(lang, ()):
        u = u.replace(a, b)
    return u


def overrides():
    """Hand-written replacements: src/i18n/content-overrides.json {lang: {file: {path: text}}}.
    Used where a fact differs by reader (visa routes) and a translation of the Chinese would be wrong."""
    p = os.path.join(OUT, "content-overrides.json")
    if not os.path.exists(p):
        return {}
    with open(p, encoding="utf-8") as fh:
        return json.load(fh)


def cmd_build(a):
    ov = overrides()
    for lang in LANGS:
        cache = read_cache(lang)
        missing = 0
        for rel in content_files():
            if rel in LANG_SKIP.get(lang, ()):
                continue
            data = load(rel)
            for key, prefix, strings, ref in file_units(rel, data):
                tr = cache.get(unit_hash(lang, strings, ref))
                if not tr:
                    missing += 1
                    continue
                for p in strings:
                    full = (prefix + p) if p else prefix[:-1]
                    data = set_path(data, full, tr[p])
            if not rel.startswith("posts/"):
                data = localise_urls(data, lang)
            for path, text in ov.get(lang, {}).get(rel, {}).items():
                data = set_path(data, path, text)
            write_json(os.path.join(OUT, lang, rel), data)
        ui = {}
        uo = ui_overrides().get(lang, {})
        for key, prefix, strings, ref in ui_units():
            tr = cache.get(unit_hash(lang, strings, ref))
            if tr:
                ui[key] = tr["s"]
            elif key not in uo:
                missing += 1
        write_json(os.path.join(OUT, lang, "_ui.json"), ui)
        print(f"{lang}: built, {missing} units still Chinese")


def cmd_prune(a):
    """Drop cache entries that no current unit uses (after content edits)."""
    for lang in LANGS:
        cache = read_cache(lang)
        used = {j[5] for j in all_jobs(lang)}
        keep = {h: v for h, v in cache.items() if h in used}
        write_json(cache_path(lang), keep, compact=True)
        print(f"{lang}: kept {len(keep)}, dropped {len(cache) - len(keep)}")


def ui_overrides():
    p = os.path.join(OUT, "ui-overrides.json")
    if not os.path.exists(p):
        return {}
    with open(p, encoding="utf-8") as fh:
        return json.load(fh)


def cmd_check(a):
    bad = 0
    uo = ui_overrides()
    for lang in LANGS:
        cache = read_cache(lang)
        miss = [(j[0], j[1]) for j in all_jobs(lang)
                if j[5] not in cache and not (j[0].startswith("_ui") and j[1] in uo.get(lang, {}))]
        bad += len(miss)
        print(f"{lang}: {len(miss)} units without translation")
        for rel, key in miss[:30]:
            print(f"  {rel} {key[:60]}")
    sys.exit(1 if bad and a.strict else 0)


T_CALL = re.compile(r"""\b(t|tr|ct)\(\s*(['"`])((?:\\.|(?!\2).)*?)\2""", re.S)
STR_LIT = re.compile(r"""(['"])((?:\\.|(?!\1).)*?)\1""")
# Files whose Chinese string literals are all UI strings (constant tables read through translated()).
TABLE_FILES = ("src/lib/countries.ts", "src/lib/japan.ts", "src/lib/toolkit.ts", "src/lib/posts.ts")
CLIENT_DIRS = ("src/scripts/",)


def unescape(s):
    return json.loads('"' + s.replace('"', '\\"') + '"') if "\\" in s else s


def cmd_extract(a):
    found, client = {}, set()
    for d, _, fs in os.walk(os.path.join(ROOT, "src")):
        if os.sep + "i18n" in d:
            continue
        for f in fs:
            if not f.endswith((".astro", ".ts")):
                continue
            path = os.path.join(d, f)
            rel = os.path.relpath(path, ROOT).replace(os.sep, "/")
            with open(path, encoding="utf-8") as fh:
                src = fh.read()
            code = re.sub(r"^\s*//.*$", "", src, flags=re.M)
            for m in T_CALL.finditer(code):
                fn, q, s = m.group(1), m.group(2), unescape(m.group(3))
                if q == "`" and "${" in s:
                    print(f"skip template literal in {rel}: {s[:40]}", file=sys.stderr)
                    continue
                if HAN.search(s):
                    found.setdefault(s, set()).add(rel)
                    if fn == "ct" or rel.startswith(CLIENT_DIRS):
                        client.add(s)
            if rel in TABLE_FILES:
                for m in STR_LIT.finditer(code):
                    s = unescape(m.group(2))
                    if HAN.search(s):
                        found.setdefault(s, set()).add(rel)
    strings = sorted(found)
    write_json(os.path.join(OUT, "ui-source.json"),
               {"strings": strings, "client": sorted(client), "where": {k: sorted(found[k]) for k in strings}})
    print(f"{len(strings)} UI strings ({len(client)} used in the browser)")


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    t = sub.add_parser("translate")
    t.add_argument("--lang", choices=LANGS, required=True)
    t.add_argument("--jobs", type=int, default=6)
    t.add_argument("--only")
    t.add_argument("--limit", type=int)
    im = sub.add_parser("import-cache")
    im.add_argument("--lang", choices=LANGS, required=True)
    im.add_argument("mapping")
    sub.add_parser("build")
    c = sub.add_parser("check")
    c.add_argument("--strict", action="store_true")
    sub.add_parser("extract")
    sub.add_parser("prune")
    a = ap.parse_args()
    {"translate": cmd_translate, "import-cache": cmd_import_cache, "build": cmd_build, "check": cmd_check, "extract": cmd_extract, "prune": cmd_prune}[a.cmd](a)


if __name__ == "__main__":
    main()
