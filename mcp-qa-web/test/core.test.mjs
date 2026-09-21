import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import { buildCatalog, resolvePath } from '../catalog.mjs';
import { DeletionGuard, normalizeBody } from '../guard.mjs';
import { Runtime } from '../runtime.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
test('catalog exposes each exported business HTTP handler once with valid MCP names', () => {
  const catalog = buildCatalog(root);
  assert.ok(catalog.length > 90);
  assert.equal(new Set(catalog.map(o => o.name)).size, catalog.length);
  for (const op of catalog) assert.match(op.name, /^[A-Za-z0-9_-]{1,64}$/);
  for (const endpoint of ['/api/projects','/api/testcases','/api/workspaces/members','/api/ai/chat','/api/excel','/api/readiness','/api/reports','/manual/start']) assert.ok(catalog.some(o => o.path === endpoint));
  assert.ok(!catalog.some(o => o.path === '/api/auth/bootstrap'));
});
test('delete confirmation bound to exact scope, single use, never inferred', () => {
  const guard = new DeletionGuard();
  const op = { name:'delete_cases', method:'DELETE', path:'/api/testcases' };
  const args = { query: { projectId:'p', ids:'a,b' } };
  const challenge = guard.check(op, args);
  assert.equal(challenge.executed, false);
  assert.equal(guard.check(op, {...args, confirmation:challenge.confirmation}).executed, false);
  assert.equal(guard.check(op, {query:{projectId:'p',ids:'a,c'},confirmation:challenge.confirmation,userConfirmed:true}).executed, false);
  assert.equal(guard.check(op, {...args, confirmation:challenge.confirmation,userConfirmed:true}), null);
  assert.equal(guard.check(op, {...args, confirmation:challenge.confirmation,userConfirmed:true}).executed, false);
});
test('expired confirmation rejected; project cascade also guarded', () => {
  const g = new DeletionGuard(); const op = {name:'project',method:'DELETE',path:'/api/projects'};
  const args = {query:{id:'project'}}; const c=g.check(op,args);
  g.pending.get(c.confirmation).until=0;
  assert.equal(g.check(op,{...args,confirmation:c.confirmation,userConfirmed:true}).executed,false);
});
test('testcase versus execution actualResult and tags', () => {
  const op={path:'/api/testcases',method:'PUT'};
  assert.throws(()=>normalizeBody(op,{actualResult:'some prose'}));
  assert.throws(()=>normalizeBody(op,{status:'NOT_DONE'}));
  assert.deepEqual(normalizeBody(op,{tags:null,module:{id:'a'},remarks:'observed'}),{tags:[],remarks:'observed'});
  assert.equal(normalizeBody({path:'/api/test-runs/[id]/executions',method:'POST'},{actualResult:'free text'}).actualResult,'free text');
});
test('path parameters cannot redirect credentials or traverse paths', () => {
  for(const id of ['..','../auth/login','a/b','%2e%2e','x?y','x\\y']) assert.throws(()=>resolvePath('/api/reports/[id]',{id}));
  assert.equal(resolvePath('/api/reports/[id]',{id:'abc'}),'/api/reports/abc');
  assert.throws(()=>new Runtime(root,{QA_MCP_WEB_URL:'https://example.com'}));
});
test('HTTP transport preserves envelopes; guard blocks network; multipart and binary work', async () => {
  let calls=0; let received;
  const server=http.createServer(async(req,res)=>{
    calls++; const chunks=[]; for await(const c of req)chunks.push(c);
    received={url:req.url,cookie:req.headers.cookie,body:Buffer.concat(chunks).toString(),type:req.headers['content-type']};
    if(req.url.startsWith('/binary')){res.setHeader('Content-Type','application/octet-stream');res.end('bytes');return;}
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify({testCases:[],total:0}));
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const temp=await fs.mkdtemp(path.join(os.tmpdir(),'qa-mcp-test-'));
  const runtime=new Runtime(temp,{QA_MCP_WEB_URL:`http://127.0.0.1:${server.address().port}`},async()=> 'test-session');
  try {
    const op={name:'get',method:'GET',path:'/api/testcases',target:'web'};
    assert.equal((await runtime.execute(op,{query:{projectId:'p'}})).data.total,0);
    assert.equal(received.cookie,'qa_session=test-session');
    const count=calls; await runtime.execute({...op,method:'DELETE'},{query:{ids:'a,b'}});assert.equal(calls,count);
    const file=path.join(temp,'evidence.txt');await fs.writeFile(file,'observed');
    await runtime.execute({...op,method:'POST'},{form:{projectId:'p'},files:[{path:file}]});
    assert.match(received.type,/multipart/);assert.match(received.url,/projectId=p/);assert.match(received.body,/observed/);
    const binary=await runtime.execute({...op,path:'/binary'});assert.equal(await fs.readFile(binary.data.outputPath,'utf8'),'bytes');
  } finally {await new Promise(r=>server.close(r));await fs.rm(temp,{recursive:true,force:true});}
});
