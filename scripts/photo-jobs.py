"""Build image-generation jobs from the photo descriptions.

Usage: python3 -I scripts/photo-jobs.py . > jobs.json
Each job: {"out": "out/<country>/<place>/<s|f>-<id>.jpg" or ".../cover.jpg", "prompt", "size", "quality", "fmt"}.
Japan: src/data/japan/photos/*.json ("s:<pref>/<id>" -> description). Australia / USA: the "photo" field of
each spot and food, and "cover.scene" of each state. Generate 1536x1024, then convert to WebP
(spots/foods 400+800 wide, covers 800+1600) under public/img/photos/ and run `npm run photos`.
"""
import json, glob, os, sys
repo = sys.argv[1]
STYLE = (" Photorealistic travel photograph, shot on a full-frame camera with a 24-70mm lens, natural colours, true-to-life textures,"
         " realistic lighting and depth, editorial travel magazine quality. No text, no letters, no signage, no logos, no watermark,"
         " no frames or borders, no close-up faces; any people are small and in the distance.")
FOOD = (" Photorealistic food photograph, 50mm lens, shallow depth of field, soft natural light, appetising true-to-life colours"
        " and textures, editorial food magazine quality. No text, no letters, no logos, no watermark, no hands or faces.")
COVER = (" Photorealistic wide travel photograph for a page banner, shot on a full-frame camera, natural colours, true-to-life textures,"
         " beautiful but believable light, editorial travel magazine quality. Leave calm space in the lower third. No text, no letters,"
         " no signage, no logos, no watermark, no frames, no close-up faces; any people are small and in the distance.")
jobs = []
def add(out, prompt, size="1536x1024"):
    jobs.append({"out": out, "prompt": prompt, "size": size, "quality": "medium", "fmt": "jpeg"})
for f in sorted(glob.glob(os.path.join(repo, 'src/data/japan/photos/*.json'))):
    for k, v in json.load(open(f)).items():
        kind, rest = k.split(':', 1)
        pref, iid = rest.split('/')
        add(f"out/japan/{pref}/{kind}-{iid}.jpg", v.strip() + (FOOD if kind == 'f' else STYLE))
for country in ('australia', 'usa'):
    for f in sorted(glob.glob(os.path.join(repo, f'src/data/{country}/states/*.json'))):
        d = json.load(open(f))
        st = d['slug']
        if d.get('cover', {}).get('scene'):
            add(f"out/{country}/{st}/cover.jpg", d['cover']['scene'].strip() + COVER)
        for s in d.get('spots', []):
            if s.get('photo'): add(f"out/{country}/{st}/s-{s['id']}.jpg", s['photo'].strip() + STYLE)
        for x in d.get('foods', []):
            if x.get('photo'): add(f"out/{country}/{st}/f-{x['id']}.jpg", x['photo'].strip() + FOOD)
json.dump(jobs, sys.stdout, ensure_ascii=False, indent=0)
print(len(jobs), file=sys.stderr)
