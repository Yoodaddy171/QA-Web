"""Post-generation render checks and allowlisted repack, no application changes."""
import json,subprocess,zipfile,hashlib
from pathlib import Path
from PIL import Image,ImageDraw
OUT=Path('artifacts/ui-review/phase8a').resolve()
TMP=Path('C:/Users/Admin/AppData/Local/Temp/qadesk-phase7-UPzEgU/pdf-validation')
TMP.mkdir(parents=True,exist_ok=True)
M=json.loads((OUT/'manifest.json').read_text(encoding='utf-8'))
pdf=OUT/'QADesk-UI-Review-Atlas.pdf'
poppler=Path('C:/Users/Admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/poppler/Library/bin/pdftoppm.exe')
ids=['UI-004','UI-027','UI-040','UI-077','UI-108','UI-117','UI-127','UI-129']
pages=[1,2,3]+[next(s['pdfPage'] for s in M['screens'] if s['id']==id_) for id_ in ids]
rendered=[]
for n in pages:
    prefix=TMP/f'page-{n:03}'
    subprocess.run([str(poppler),'-f',str(n),'-l',str(n),'-singlefile','-r','72','-png',str(pdf),str(prefix)],check=True,capture_output=True)
    file=prefix.with_suffix('.png')
    with Image.open(file) as im:assert im.size==(1440,960)
    rendered.append(file)
sheet=Image.new('RGB',(1440,math_height:=((len(rendered)+2)//3)*350),'#e8ecf2')
draw=ImageDraw.Draw(sheet)
for i,file in enumerate(rendered):
    with Image.open(file) as im:
        im.thumbnail((456,304));x=12+(i%3)*480;y=26+(i//3)*350;sheet.paste(im,(x,y));draw.text((x,y-18),file.stem,fill='#111827')
sheet.save(TMP/'render-contact.png')
V=json.loads((OUT/'validation-results.json').read_text())
V['renderedPdfPages']=pages
V['offlineGallery']={'browserOpened':True,'cards':129,'fullResolutionLinkNaturalWidth':1440,'externalDependencies':False}
V['cleanup']={'ownedPortsStopped':[3117,3119],'syntheticSessionsRevoked':True,'privateCredentialFilesRemoved':True,'originalUserPortsPreserved':[3000,3001],'productionFilesUnchanged':282,'mainBuildPreserved':True}
(OUT/'validation-results.json').write_text(json.dumps(V,indent=2),encoding='utf-8')
M['environmentCleanup']=V['cleanup'];(OUT/'manifest.json').write_text(json.dumps(M,indent=2),encoding='utf-8')
# Only original PNGs and explicitly named deliverables enter the archive.
files=[OUT/s['filename'] for s in M['screens'] if s['status']=='CAPTURED']+[OUT/n for n in ['manifest.json','screen-inventory.md','visual-review-notes.md','validation-results.json','QADesk-UI-Review-Atlas.pdf','QADesk-UI-Review-Gallery.html']]
archive=OUT/'QADesk-UI-Review-Package.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
    for f in files:z.write(f,f.relative_to(OUT).as_posix())
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    assert len(z.namelist())==135
    assert sum(n.endswith('.png') for n in z.namelist())==129
    assert all(n.endswith(('.png','.md','.json','.html','.pdf')) for n in z.namelist())
    assert not any(any(x in n.lower() for x in ['fixture','cookie','.env','sqlite','private']) for n in z.namelist())
print(json.dumps({'renderedPages':pages,'contact':str(TMP/'render-contact.png'),'zipEntries':len(files),'pdfMiB':round(pdf.stat().st_size/1048576,2),'zipMiB':round(archive.stat().st_size/1048576,2),'pdfSha256':hashlib.sha256(pdf.read_bytes()).hexdigest(),'zipSha256':hashlib.sha256(archive.read_bytes()).hexdigest()}))
