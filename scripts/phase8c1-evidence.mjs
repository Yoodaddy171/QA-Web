import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
const root=await fs.realpath(process.env.QA_PHASE7_ROOT||'__missing__');
if(!path.basename(root).startsWith('qadesk-phase7-'))throw new Error('Synthetic root required');
const run=process.env.QA_PHASE7_RUN;
if(!/^[a-z0-9-]+$/.test(run||''))throw new Error('Explicit safe run label required');
const isolated='C:/Users/Admin/.codex/worktrees/qadesk-phase2-baseline/QA-Web';
const files=['src/app/globals.css','src/components/ui/table.tsx','src/components/TestCaseTableBody.tsx','src/components/TestCaseTable.tsx','src/components/BugFixPanel.tsx','src/components/BugFixStatusCell.tsx','src/components/BugFixStatsCards.tsx','src/components/TestCaseDialog.tsx','src/components/TestCaseDetailDialog.tsx','src/components/TestCaseDetailDialogHeader.tsx','src/components/TestCaseDetailDialogFooter.tsx'];
const parity=[];
for(const file of files){
 const sha=async p=>crypto.createHash('sha256').update(await fs.readFile(p)).digest('hex');
 const main=await sha(file),candidate=await sha(path.join(isolated,file));
 if(main!==candidate)throw new Error(`Candidate parity mismatch: ${file}`);
 parity.push({file,sha256:main,isolatedMatch:true});
}
const r=JSON.parse(await fs.readFile(path.join(root,`browser-results-${run}.json`),'utf8'));
const tests=[];
function collect(suites){for(const suite of suites){for(const s of suite.specs||[]){for(const t of s.tests){tests.push({title:s.title,status:t.status,results:t.results.map(x=>({status:x.status,duration:x.duration,error:x.error?.message,density:x.attachments?.filter(a=>a.name==='density-measurement').map(a=>JSON.parse(Buffer.from(a.body,'base64').toString()))}))});}}collect(suite.suites||[]);}}
collect(r.suites);
const screenshotManifest=JSON.parse(await fs.readFile('artifacts/ui-review/phase8c1/candidate-final-manifest.json','utf8'));
const result={scope:'Targeted Phase8C.1 only, synthetic data, no full security/performance certification',isolatedBuildId:(await fs.readFile(path.join(isolated,'.next/BUILD_ID'),'utf8')).trim(),primaryBuildId:(await fs.readFile('.next/BUILD_ID','utf8')).trim(),parity,tests,stats:r.stats,screenshots:screenshotManifest.results.filter(x=>x.filename).length,pageErrors:screenshotManifest.errors};
await fs.writeFile('artifacts/ui-review/phase8c1/verification-results.json',JSON.stringify(result,null,2));
console.log(`${tests.length} test summaries and ${result.screenshots} screenshot references exported; no fixture credentials included.`);
