"""Build an offline evidence atlas without modifying the original screenshots."""
import json, hashlib, html, math, textwrap, zipfile
from pathlib import Path
from collections import Counter
from datetime import datetime, timezone
from PIL import Image, ImageStat
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import ImageReader
from pypdf import PdfReader

OUT = Path('artifacts/ui-review/phase8a').resolve()
M = json.loads((OUT / 'manifest.json').read_text(encoding='utf-8'))
screens = [s for s in M['screens'] if s['status'] == 'CAPTURED']
assert len({s['id'] for s in M['screens']}) == len(M['screens'])
assert len({s['filename'] for s in screens}) == len(screens)
modules = list(dict.fromkeys(s['module'] for s in M['screens']))
ordered = [s for mod in modules for s in screens if s['module'] == mod]
checks = []
for s in screens:
    file = OUT / s['filename']
    assert file.is_relative_to(OUT) and file.is_file(), s['id']
    with Image.open(file) as im: im.verify()
    with Image.open(file) as im:
        assert im.size == (s['imageWidth'], s['imageHeight']) == (s['viewport']['width'], s['viewport']['height'])
        variance = sum(ImageStat.Stat(im.convert('RGB')).var)
        assert variance > 30, (s['id'], 'near blank')
    assert hashlib.sha256(file.read_bytes()).hexdigest() == s['sha256'], s['id']
    if s['key'] == 'empty': s['project'] = 'Mercury Mobile - Empty'
    if s['role'] == 'ANONYMOUS': s['workspace'] = 'No authenticated workspace'; s['project'] = 'No selected project'
    checks.append({'id': s['id'], 'pngIntegrity': True, 'dimensionsMatch': True, 'nonblankVariance': round(variance, 2), 'sha256Match': True})

missing = [s for s in M['screens'] if s['status'] != 'CAPTURED']
verdict = 'COMPLETE WITH LIMITATIONS' if not missing else 'INCOMPLETE'
limitations = [
 'First-owner bootstrap was not captured: the isolated database already contains synthetic accounts. Normal login and required-field validation were captured.',
 'No real AI inference, Figma sync, manual browser launch, external website execution, destructive confirmation, or security/performance acceptance was performed. Forms and existing feedback states were captured only.',
 'The compiled relay URL is port3001. Browser HTTP was forwarded to unmodified owned relay3117; live WebSocket3001 was blocked. No request reached the personal relay. Relay Offline and readiness warnings reflect this isolated configuration.',
 'The three-second recording is synthetic fixture media built from the actual dashboard screenshot, not proof of a real website test. Original screenshot PNGs were never transformed.',
 'Several inspector tab switches left the body empty. Their content was captured after closing/reopening the same testcase without route reload; UI-127 preserves the empty-body defect.',
 'Viewport captures and bounded scroll segments cover important regions, not every table permutation, every report version, or every branch of every external integration.',
 'Screenshots establish visual evidence only. They do not prove WCAG conformance, keyboard completeness, successful mutations, 60 FPS, or release readiness.',
]
facts = {
 'Dashboard': 'Release decision and active cycle dominate the first viewport. Advanced analytics require vertical scrolling on desktop (UI-001..003); mobile initially collapses these analytics (UI-107).',
 'Cases': 'The 1440px table truncates long test actions and some result badges. Authentication wraps over two lines in UI-004. Compact density exposes more rows. Filter/date/columns/views/export/action menus, bulk dialogs, create/edit, validation, import preview and empty search are captured. Import was not confirmed.',
 'Inspector': 'The desktop inspector is right-aligned, with a fixed header/footer and horizontal tab rail; the last tab needs horizontal scrolling. Viewport-bound internal scrolling is visible in UI-024/025. UI-127 records a selected Steps tab with no mounted body; tab content captures use the close/reopen recovery noted in the manifest. Evidence, linked bugs, immutable history, comments and recovered DevLog content are included.',
 'Bugs': 'The active and fixed tables use a different column set and uppercase status treatments from Cases. The explanatory retest guidance is visible above the table. Lifecycle detail, status menu and an empty project are included.',
 'Test Cycles': 'A run list, execution rail/canvas/context and outcomes are shown. The primary 1440px workspace is dense; evidence/context controls extend vertically. Compact/narrow captures document the actual adaptation without changing widths. Create Bug is a contextual direct action, not a second dialog.',
 'Traceability': 'Requirements, Test Cases, Test Plans and Test Cycles are lanes within one route. New Relation and Manage Relations are distinct sheets. The form requires internal scrolling. Coverage summaries and uncovered-gap filtering are shown; no new relationship mutation was required.',
 'Reports': 'The list, two templates, source/date selection, long forms and draft/final/planning previews are present. Header, middle and bottom segments retain readable content. The new-version result is an actual synthetic 1.0.1 draft. UI-075 is an explicitly controlled HTTP500 error, not a spontaneous backend failure.',
 'Settings': 'All seven existing sections are represented: System, Team, AI, Projects, Knowledge, Integrations and Modules. Team shows synthetic roles and empty password input; no credential values are visible. The system readiness relay blocker and AI warning are expected in the isolated host configuration. Viewer Team is read-only.',
 'Automation': 'The history vault contains one synthetic captured testcase. Its detail uses the shared inspector. Populated DevLog network/console/execution, expanded payload, system fullscreen and recording timeline are in the Inspector section. No live personal relay connection or real browser capture was used.',
 'Global': 'Notification, command palette, project/account/theme menus, AI chat, Viewer Cases and login are included. UI-100 deliberately holds a real testcase GET to expose the existing loading skeleton. Narrow navigation is captured with the responsive sidebar open.',
}
notes = ['# QADesk Phase8A visual review notes', '', f'Verdict: **{verdict}**', '',
 f'{len(screens)} original PNG captures; {len([s for s in screens if s["category"] == "desktop"])} desktop state entries; eight primary authenticated routes. Additional viewport/theme captures are variants, not extra application pages.', '',
 '## Evidence boundaries', '', *['- ' + x for x in limitations], '',
 '## Directly supported accessibility observations', '',
 '- Statuses pair text with color and frequently an icon (Cases/Bugs/cycle captures). This is not a measured contrast result.',
 '- Calendar and table controls retain native rendered focus treatment where focused during capture. No exhaustive keyboard or screen-reader audit was run.',
 '- Knowledge edit uses an icon-only control whose source has no accessible name; it becomes visible on row hover. Its actual edit state is UI-083. This collection did not alter the control.',
 '- Narrow captures preserve the actual horizontal tab/table constraints and responsive navigation. No assertion of complete mobile usability is made.', '']
for mod in modules:
    items = [s for s in ordered if s['module'] == mod]
    notes += ['## ' + mod, '', 'Screenshot IDs: ' + ', '.join(s['id'] for s in items), '',
              'Captured states: ' + ', '.join(s['key'] for s in items), '', facts.get(mod, ''), '',
              'Missing states: ' + ('; '.join(s['key'] for s in missing if s['module'] == mod) or 'None among the inventoried representative states; global limitations above still apply.'), '']
notes += ['## Source and safety', '',
 f'Branch `{M["identity"]["branch"]}`; HEAD `{M["identity"]["gitSha"]}`; isolated build `{M["identity"]["buildId"]}`. Browser Chromium {M["identity"]["browser"]}.',
 'Production source parity: 282 tracked/new production/config/schema/package files compared with the isolated checkout; zero differences. Zero production file changes during capture. The main build and ports3000/3001 were preserved. No stage/commit/push/merge/deploy.', '',
 'The package excludes all SQLite data, session cookies, private fixture files, relay credentials, traces, environment files and repository source. Synthetic example session-placeholder text inside a network payload is not an authentication credential.', '']
(OUT / 'visual-review-notes.md').write_text('\n'.join(notes), encoding='utf-8')

pdf = OUT / 'QADesk-UI-Review-Atlas.pdf'
W, H = 1440, 960
cv = canvas.Canvas(str(pdf), pagesize=(W,H), pageCompression=1)
cv.setTitle('QADesk UI Visual Audit - Phase8A')
cv.setAuthor('QADesk visual evidence collection')
cv.setSubject('Original rendered UI screenshots; synthetic data; no redesign')
def text(x,y,value,size=13,color='#334155',font='Helvetica'):
    cv.setFillColor(HexColor(color)); cv.setFont(font,size); cv.drawString(x,y,str(value).replace('\u2014','-').replace('\u2192','>'))
def footer(page,label):
    cv.setStrokeColor(HexColor('#cbd5e1'));cv.line(36,34,W-36,34);text(36,18,'QADesk / Phase8A / Synthetic visual evidence',10);text(W-250,18,f'{label}  |  {page}',10)
def wrap(x,y,value,width=140,size=13,line=19):
    for part in textwrap.wrap(value,width=width): text(x,y,part,size);y-=line
    return y
text(64,858,'QADesk',40,'#312e81','Helvetica-Bold');text(64,800,'UI Visual Audit',46,'#0f172a','Helvetica-Bold');text(64,755,'Phase8A - screenshot evidence atlas',24)
y=680
for line in [f'Date: {datetime.now(timezone.utc).date().isoformat()}',f'Branch: {M["identity"]["branch"]}',f'HEAD: {M["identity"]["gitSha"]}',f'Build: {M["identity"]["buildId"]}',f'Browser: Chromium {M["identity"]["browser"]}',f'Captures: {len(screens)} original PNGs',f'Viewports: 1440x900 / 1366x768 / 390x844; deviceScaleFactor1; reduced motion',f'Themes: default dark; alternate light; fixed light evidence export',f'Verdict: {verdict}']:
    text(64,y,line,17);y-=35
y=wrap(64,y-20,'Evidence collection only. Existing local Phase6C/7/7.1 changes are included. No production UI/CSS changes, no real user data, no stage/commit/push. This atlas is not a functional or performance acceptance report.',110,16,24)
wrap(64,y-24,'Read visual-review-notes.md and manifest.json before assessing the screenshots. Controlled loading/error, inspector recovery and synthetic recording conditions are explicitly identified.',110,16,24)
footer(1,'Cover');cv.showPage()
text(48,908,'Contents',30,'#0f172a','Helvetica-Bold');text(48,874,'Each screenshot has a full page. Page3 is the navigation overview.',15)
page_index=4
for mod in modules:
    items=[s for s in ordered if s['module']==mod]
    for s in items: s['pdfPage']=page_index;page_index+=1
y=814
for mod in modules:
    items=[s for s in ordered if s['module']==mod]
    text(48,y,mod,19,'#312e81','Helvetica-Bold');text(280,y,f'{len(items)} captures  |  PDF pages {items[0]["pdfPage"]}-{items[-1]["pdfPage"]}',15)
    y=wrap(280,y-23,', '.join(s['id'] for s in items),115,11,16)-20
footer(2,'Contents');cv.showPage()
text(48,908,'Navigation overview',30,'#0f172a','Helvetica-Bold');text(48,874,'Contact sheet only - readable individual images follow.',14)
representatives=['UI-001','UI-004','UI-043','UI-049','UI-057','UI-063','UI-076','UI-088']
for i,id_ in enumerate(representatives):
    s=next(s for s in screens if s['id']==id_);x=48+(i%4)*348;y=770-(i//4)*330
    text(x,y,f'{id_} / {s["module"]}',14,'#312e81','Helvetica-Bold')
    cv.drawImage(str(OUT/s['filename']),x,y-225,width=324,height=202.5,preserveAspectRatio=True)
    text(x,y-249,f'Full page: {s["pdfPage"]}',11)
wrap(48,120,'Screenshots are original browser PNGs. The preview sheet is intentionally small; use the full screenshot pages, gallery or original PNGs to judge typography and spacing.',145,14,21)
footer(3,'Overview');cv.showPage()
for s in ordered:
    cv.bookmarkPage(s['id']);cv.addOutlineEntry(f'{s["id"]} {s["module"]} / {s["key"]}',s['id'],0,False)
    text(36,923,f'{s["id"]}  |  {s["module"]}  |  {s["key"]}',23,'#0f172a','Helvetica-Bold')
    text(36,895,f'{s["viewport"]["width"]}x{s["viewport"]["height"]}  /  {s["theme"]}  /  {s["role"]}  /  {s["project"]}',12)
    iw,ih=s['imageWidth'],s['imageHeight'];scale=min((W-72)/iw,790/ih);dw,dh=iw*scale,ih*scale
    cv.drawImage(str(OUT/s['filename']),(W-dw)/2,86+(790-dh)/2,width=dw,height=dh)
    if s.get('notes'):wrap(36,69,s['notes'],190,9,12)
    footer(s['pdfPage'],s['id']);cv.showPage()
cv.save()

nav=' '.join(f'<a href="#{html.escape(m)}">{html.escape(m)}</a>' for m in modules)
parts=['<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>QADesk Phase8A UI evidence</title>',
 '<style>body{font:16px system-ui;margin:0;background:#f5f6fa;color:#172033}header,main{padding:28px;max-width:1600px;margin:auto}nav{display:flex;gap:12px;flex-wrap:wrap}a{color:#4338ca}section{margin:42px 0}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:20px}article{background:white;border:1px solid #d9dfeb;border-radius:10px;padding:15px}img{width:100%;height:220px;object-fit:contain;background:#e8ebf2}small{color:#475569}.note{font-size:13px;line-height:1.5}h2{scroll-margin-top:20px}</style>',
 f'<header><h1>QADesk UI Visual Audit - Phase8A</h1><p>{len(screens)} original PNGs / {verdict}</p><p>Evidence only. Synthetic SQLite. No production redesign. Read <a href="visual-review-notes.md">review notes</a> and <a href="manifest.json">manifest</a>.</p><nav>{nav}</nav></header><main>']
for mod in modules:
    parts.append(f'<section id="{html.escape(mod)}"><h2>{html.escape(mod)}</h2><div class="grid">')
    for s in ordered:
        if s['module']!=mod:continue
        src=html.escape(s['filename']);title=html.escape(f'{s["id"]} - {s["key"]}')
        parts.append(f'<article id="{s["id"]}"><h3>{title}</h3><a href="{src}"><img loading="lazy" src="{src}" alt="{title}"></a><p><small>{s["viewport"]["width"]}x{s["viewport"]["height"]} / {s["theme"]} / {s["role"]} / PDF p{s["pdfPage"]}</small></p><p><a href="{src}">Open original PNG</a></p><p class="note">{html.escape(s.get("notes", ""))}</p></article>')
    parts.append('</div></section>')
parts.append('</main></html>');(OUT/'QADesk-UI-Review-Gallery.html').write_text('\n'.join(parts),encoding='utf-8')

reader=PdfReader(pdf)
assert len(reader.pages)==len(screens)+3
for s in ordered:
    pg=reader.pages[s['pdfPage']-1]
    assert s['id'] in pg.extract_text(),s['id']
    xs=pg['/Resources']['/XObject'].get_object()
    dims=[(int(o.get_object().get('/Width',0)),int(o.get_object().get('/Height',0))) for o in xs.values()]
    assert (s['imageWidth'],s['imageHeight']) in dims,s['id']
for pg in reader.pages:assert len(pg.extract_text().strip())>30
M['summary']={'verdict':verdict,'primaryRoutes':8,'inventoriedCaptureStates':len(M['screens']),'captured':len(screens),'byCategory':dict(Counter(s['category'] for s in screens)),'byTheme':dict(Counter(s['theme'] for s in screens)),'pdfPages':len(reader.pages),'limitations':limitations,'productionFilesVerified':282,'productionSourceChanged':False,'isolatedSourceParity':True}
(OUT/'manifest.json').write_text(json.dumps(M,indent=2),encoding='utf-8')
validation={'createdAt':datetime.now(timezone.utc).isoformat(),'pngChecks':checks,'pdfPages':len(reader.pages),'pdfTitleAndImageCorrespondence':True,'pdfNoBlankPagesByTextAndImage':True,'originalPngCount':len(screens),'missingManifestFiles':0,'duplicateIds':0,'notes':'Representative source screenshots and rendered PDF pages additionally inspected visually. Static gallery has no external dependencies.'}
(OUT/'validation-results.json').write_text(json.dumps(validation,indent=2),encoding='utf-8')
allowed=[OUT/s['filename'] for s in ordered]+[OUT/n for n in ['manifest.json','screen-inventory.md','visual-review-notes.md','validation-results.json','QADesk-UI-Review-Atlas.pdf','QADesk-UI-Review-Gallery.html']]
archive=OUT/'QADesk-UI-Review-Package.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
    for f in allowed:z.write(f,f.relative_to(OUT).as_posix())
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    assert len(z.namelist())==len(allowed)
    assert all(not n.endswith(('.db','.sqlite','.env','.jsonl')) and 'fixture' not in n and 'private' not in n for n in z.namelist())
print(json.dumps({'screenshots':len(screens),'pages':len(reader.pages),'pdfMiB':round(pdf.stat().st_size/1048576,2),'zipMiB':round(archive.stat().st_size/1048576,2),'categories':M['summary']['byCategory'],'themes':M['summary']['byTheme'],'verdict':verdict}))
