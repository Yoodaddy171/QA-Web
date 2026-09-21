import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const dir=path.dirname(fileURLToPath(import.meta.url));
const client=new Client({name:'qa-web-smoke',version:'1.0.0'});
await client.connect(new StdioClientTransport({command:process.execPath,args:[path.join(dir,'server.mjs')],stderr:'pipe'}));
async function call(name,args={}) {
  if (/^(web|relay)_/.test(name)) {const operation=name;name='qa_web_'+(operation.includes('_delete_')?'delete':operation.includes('_get_')?'read':'write');args={operation,...args};}
  const result=await client.callTool({name,arguments:args},undefined,{timeout:180000});
  assert.ok(!result.isError,`${name}: ${JSON.stringify(result.content)}`);
  const data=JSON.parse(result.content[0].text);
  assert.notEqual(data.ok,false,`${name}: ${JSON.stringify(data)}`);
  return data;
}
try {
  const tools=await client.listTools();console.log('MCP tools:',tools.tools.length);
  const guide=await call('qa_web_guide',{topic:'reports'});assert.ok(guide.text.includes('Report create'));console.log('Topic-specific cookbook delivered through MCP: PASS');
  const auth=await call('web_get_auth_status');assert.equal(auth.data.authenticated,true);
  const projects=await call('web_get_projects');assert.ok(Array.isArray(projects.data));
  console.log('Authenticated projects read: PASS');
  const guard=await call('web_delete_testcases',{query:{projectId:'smoke-placeholder',ids:'one,two'}});assert.equal(guard.executed,false);
  console.log('Bulk delete blocked without confirmation: PASS');
  const relay=await call('relay_get_health');assert.equal(relay.data.status,'ready');console.log('Relay health: PASS');
  if(process.argv.includes('--write-fixture')) {
    let project=projects.data.find(p=>p.name.startsWith('MCP Smoke ') && p.description==='Isolated MCP validation fixture; safe to remove after review.');
    if(project) project=(await call('web_put_projects',{body:{id:project.id,name:'MCP Smoke Validation'}})).data;
    else project=(await call('web_post_projects',{body:{name:'MCP Smoke Validation',description:'Isolated MCP validation fixture; safe to remove after review.'}})).data;
    const projectId=project.id;
    const existing=(await call('web_get_testcases',{query:{projectId,search:'MCP-001'}})).data.testCases;
    const tc=existing.find(t=>t.testCaseId==='MCP-001') || (await call('web_post_testcases',{body:{projectId,testCaseId:'MCP-001',page:'Local login',testAction:'Render login screen',steps:'Open local login page and inspect text',expectedResult:'Login screen renders',status:'NOT DONE',actualResult:'-',tags:['mcp-smoke']}})).data;
    await call('qa_browser',{action:'open',url:'http://127.0.0.1:3000/login'});
    const observed=await call('qa_browser',{action:'assert_text',value:'Masuk ke workspace'});assert.equal(observed.passed,true);
    const screenshot=await call('qa_browser',{action:'screenshot'});
    const run=(await call('web_post_test_runs',{body:{projectId,name:'MCP local login smoke'}})).data;
    const execution=(await call('web_post_test_runs_by_id_executions',{params:{id:run.id},body:{projectId,testCaseId:tc.id,status:'PASSED',actualResult:'Browser assertion found Masuk ke workspace on local login screen',notes:'MCP browser assertion + screenshot; login submission not tested.'}})).data;
    await call('web_post_test_runs_by_id_executions_by_executionId_evidence',{params:{id:run.id,executionId:execution.id},query:{projectId},files:[{path:screenshot.outputPath,mimeType:'image/png'}]});
    const evidence=await call('web_get_test_runs_by_id_executions_by_executionId_evidence',{params:{id:run.id,executionId:execution.id},query:{projectId}});assert.equal(evidence.data.evidence.length,1);
    const cases=await call('web_get_testcases',{query:{projectId,search:'MCP-001'}});assert.equal(cases.data.testCases.filter(c=>c.testCaseId==='MCP-001').length,1);
    const exported=await call('web_get_excel',{query:{projectId}});assert.ok(exported.data.bytes>0);
    console.log(JSON.stringify({fixtureProjectId:projectId,testcase:tc.id,run:run.id,execution:execution.id,evidence:evidence.data.evidence[0].id,export:exported.data.outputPath}));
    console.log('Create/read-back testcase, browser assertion, execution, evidence upload/read-back, XLSX export: PASS');
  }
} finally { await client.close(); }
