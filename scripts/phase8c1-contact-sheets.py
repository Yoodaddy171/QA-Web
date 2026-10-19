"""Pair untouched Phase8A originals with final browser captures; no image retouching."""
import json
from pathlib import Path
from PIL import Image, ImageDraw

base = Path(__file__).resolve().parents[1] / 'artifacts/ui-review'
before = json.loads((base / 'phase8a/manifest.json').read_text(encoding='utf-8'))
after = json.loads((base / 'phase8c1/candidate-final-manifest.json').read_text(encoding='utf-8'))
out = base / 'phase8c1/before-after'
out.mkdir(parents=True, exist_ok=True)
pairs = []
for key in ['UI-004', 'UI-006', 'UI-013', 'UI-015', 'UI-024', 'UI-043', 'UI-046', 'UI-127']:
    old = next(x for x in before['screens'] if x['id'] == key)
    new = next(x for x in after['results'] if x.get('id') == key and x['theme'] == 'dark' and x['viewport']['width'] == 1440)
    sheet = Image.new('RGB', (1440, 512), '#17171b')
    draw = ImageDraw.Draw(sheet)
    draw.text((12, 10), f'{key} | BEFORE: Phase8A original | AFTER: Phase8C.1 final', fill='white')
    draw.text((12, 30), 'Logical fixture, viewport, theme and scale matched; generated UUIDs/timestamps differ. Thumbnails: 50%.', fill='#d0d0d5')
    for index, file in enumerate([base / 'phase8a' / old['filename'], base / 'phase8c1' / new['filename']]):
        with Image.open(file) as image:
            assert image.size == (1440, 900), (file, image.size)
            sheet.paste(image.convert('RGB').resize((720, 450), Image.Resampling.LANCZOS), (720 * index, 58))
    name = f'{key}-before-after.png'
    sheet.save(out / name)
    pairs.append({'id': key, 'before': old['filename'], 'after': new['filename'], 'contactSheet': f'before-after/{name}'})
(out / 'manifest.json').write_text(json.dumps({'pairs': pairs, 'note': 'Original screenshots unchanged. Contact sheets are explicitly resized comparison thumbnails.'}, indent=2), encoding='utf-8')
print(f'{len(pairs)} before/after pairs generated.')
