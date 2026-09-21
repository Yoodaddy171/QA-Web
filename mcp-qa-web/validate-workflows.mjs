import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const rows=[];const stamp=Date.now().toString(36);
const resumeArg=process.argv.indexOf('--resume');
const cached=resumeArg>=0?JSON.parse(await fs.readFile(process.argv[resumeArg+1],'utf8')).rows:[];
let cacheIndex=0;let replay=cached.length>0;
const client=new Client({name:'qa-workflow-validation',version:'1.0.0'});
await client.connect(new StdioClientTransport({command:process.execPath,args:[path.join(root,'mcp-qa-web/server.mjs')],stderr:'pipe'}));
async function invoke(name,args={},expected=200) {
 if(replay && cached[cacheIndex]?.passed && cached[cacheIndex]?.name===name && !(name==='web_patch_reports_by_id' && cached[cacheIndex+1]?.passed===false)) {
   const prior=cached[cacheIndex++]; rows.push({...prior,reusedEvidence:true});return prior.response.data;
 }
 replay=false;
 const tool='qa_web_'+(name.includes('_delete_')?'delete':name.includes('_get_')?'read':'write');
 const raw=await client.callTool({name:tool,arguments:{operation:name,...args}},undefined,{timeout:180000});
 let response;try{response=JSON.parse(raw.content[0].text);}catch{response={error:raw.content[0].text};}
 const passed=response.status===expected;
 rows.push({name,args,expected,status:response.status,passed,response});
 console.log(`${passed?'PASS':'FAIL'} ${name}: ${response.status??response.error}`);
 assert.ok(passed,`${name}: ${JSON.stringify(response)}`);return response.data;
}
try {
 const projects=await invoke('web_get_projects');
 const project=projects.find(p=>p.name==='MCP Smoke Validation'&&p.description==='Isolated MCP validation fixture; safe to remove after review.');
 assert.ok(project,'Run initial smoke fixture first');const p=project.id;const query={projectId:p};
 const module=await invoke('web_post_modules',{body:{projectId:p,name:`MCP workflow ${stamp}`}},201);
 const modules=await invoke('web_get_modules',{query});assert.ok(modules.some(m=>m.id===module.id));
 const suggestion=await invoke('web_get_testcases_next_id',{query:{...query,moduleId:module.id}});assert.ok(suggestion.suggestedTestCaseId);
 const tc=await invoke('web_post_testcases',{body:{projectId:p,moduleId:module.id,testCaseId:`MCP-${stamp}`,page:'MCP synthetic fixture',testAction:'[Adapter test] Synthetic lifecycle validation',steps:'Prerequisite: isolated fixture only\n1. Exercise API record transitions',expectedResult:'Records and links persist',status:'NOT DONE',actualResult:'-',remarks:'Synthetic API fixture, not a product test verdict.'}},201);
 const req=await invoke('web_post_requirements',{body:{projectId:p,key:`MCP-${stamp}`,title:'Synthetic traceability requirement'}},201);
 const plan=await invoke('web_post_test_plans',{body:{projectId:p,name:`MCP plan ${stamp}`}},201);
 await invoke('web_post_requirements_by_id_test_cases',{params:{id:req.id},body:{projectId:p,testCaseIds:[tc.id]}},201);
 const duplicate=await invoke('web_post_requirements_by_id_test_cases',{params:{id:req.id},body:{projectId:p,testCaseIds:[tc.id]}},201);assert.equal(duplicate.linked,0);
 await invoke('web_post_test_plans_by_id_requirements',{params:{id:plan.id},body:{projectId:p,requirementIds:[req.id]}},201);
 const run=await invoke('web_post_test_runs',{body:{projectId:p,name:`MCP workflow ${stamp}`,testPlanId:plan.id}},201);
 await invoke('web_post_test_runs_by_id_cases',{params:{id:run.id},body:{projectId:p,testCaseIds:[tc.id]}},201);
 const membership=await invoke('web_get_test_runs_by_id_cases',{params:{id:run.id},query});assert.ok(membership.testCases.some(c=>c.id===tc.id));
 await invoke('web_post_test_runs_by_id_executions',{params:{id:run.id},body:{projectId:p,testCaseId:tc.id,status:'BLOCKED',actualResult:'Synthetic workflow fixture; no target application test executed.',notes:'Adapter validation only.'}},201);
 const trace=await invoke('web_get_traceability',{query:{...query,testCaseId:tc.id}});assert.ok(JSON.stringify(trace).includes(req.id));
 await invoke('web_put_testcases',{body:{id:tc.id,projectId:p,status:'FAILED',actualResult:'Not As Expected',remarks:'SYNTHETIC FIXTURE: simulate defect lifecycle; not a real product defect.',tags:[]}});
 let bugs=await invoke('web_get_bugfix',{query});const bug=bugs.bugFixItems.find(b=>b.sourceTestCaseId===tc.id);assert.ok(bug);
 await invoke('web_put_bugfix',{body:{id:bug.id,status:'READY TO RETEST'}},400);
 await invoke('web_put_bugfix',{body:{id:bug.id,status:'SEDANG DI FIX'}});
 await invoke('web_put_bugfix',{body:{id:bug.id,status:'READY TO RETEST'}});
 bugs=await invoke('web_get_bugfix',{query});assert.equal(bugs.bugFixItems.find(b=>b.id===bug.id).status,'READY TO RETEST');
 const knowledge=await invoke('web_post_project_knowledge',{body:{projectId:p,type:'ENV_NOTE',title:`MCP ${stamp}`,content:'Synthetic fixture used only for MCP validation.'}},201);
 await invoke('web_put_project_knowledge',{body:{id:knowledge.id,projectId:p,type:'ENV_NOTE',title:`MCP ${stamp}`,content:'Read-back verified adapter fixture.'}});
 const items=await invoke('web_get_project_knowledge',{query});assert.ok(items.items.some(i=>i.id===knowledge.id&&i.content.includes('Read-back')));
 const report=await invoke('web_post_reports',{body:{projectId:p,testRunId:run.id,reportType:'TEST_STATUS_REPORT',version:'1.0',reportingPeriodStart:'2026-09-01T00:00:00Z',reportingPeriodEnd:'2026-09-30T23:59:59Z'}},201);
 assert.ok(report.report.id);const rp={id:report.report.id};
 const fetched=await invoke('web_get_reports_by_id',{params:rp});assert.equal(fetched.report.id,rp.id);
 await invoke('web_post_reports_by_id_refresh',{params:rp});
 const docx=await invoke('web_get_reports_by_id_export_docx',{params:rp});assert.ok(docx.bytes>0);
 await invoke('web_post_reports_by_id_finalize',{params:rp},400);
 await invoke('web_patch_reports_by_id',{params:rp,body:{documentId:`MCP-DOC-${stamp}`,approvedBy:'SYNTHETIC TEST WAIVER - adapter validation only'}});
 await invoke('web_post_reports_by_id_finalize',{params:rp});
 const final=await invoke('web_get_reports_by_id',{params:rp});assert.equal(final.report.status,'FINAL');
 await invoke('web_patch_reports_by_id',{params:rp,body:{version:'must-not-change'}},400);
 await invoke('web_post_reports_by_id_versions',{params:rp},201);
 const exported=await invoke('web_get_excel',{query:{...query,ids:tc.id}});assert.ok(exported.outputPath);
 await invoke('web_post_excel',{query,form:{projectId:p,mode:'preview'},files:[{path:exported.outputPath}]});
 for(const name of ['web_get_stats','web_get_notifications','web_get_activity','web_get_automation_history','web_get_ai_governance'])await invoke(name,{query:name==='web_get_activity'?{...query,entityType:'TestCase',entityId:tc.id}:query});
 await invoke('web_get_readiness');await invoke('web_get_settings_ai');await invoke('web_get_workspaces_members');
 await invoke('web_put_settings_ai',{},405);
 await invoke('web_post_ai_automation',{body:{projectId:p}});
 console.log('WORKFLOW VALIDATION COMPLETE');
} finally {
 await fs.mkdir(path.join(root,'data/mcp-artifacts'),{recursive:true});
 const output=path.join(root,'data/mcp-artifacts',`workflows-${stamp}.json`);
 await fs.writeFile(output,JSON.stringify({createdAt:new Date().toISOString(),rows},null,2));
 console.log(`Evidence: ${output}`);await client.close();
}
