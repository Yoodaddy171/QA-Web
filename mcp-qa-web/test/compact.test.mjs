import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildCatalog} from '../catalog.mjs';
import {guide,topics,selectOperation,compactCatalog,briefContract} from '../compact.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const catalog=buildCatalog(root);
test('manual exec is discoverable as a write operation',()=>{
 const op=selectOperation(catalog,'relay_post_manual_exec','write');
 assert.equal(op.path,'/manual/[sessionId]/exec');
 assert.deepEqual(op.fields,['expression','timeoutMs']);
});
test('all endpoint operations remain reachable only through their correct category',()=>{
 for(const op of catalog){const kind=op.method==='DELETE'?'delete':['GET','HEAD'].includes(op.method)?'read':'write';assert.equal(selectOperation(catalog,op.name,kind),op);for(const wrong of ['read','write','delete'].filter(k=>k!==kind))assert.throws(()=>selectOperation(catalog,op.name,wrong));}
});
test('catalog pagination neither drops nor repeats operations',()=>{
 const found=[];let offset=0;do{const p=compactCatalog(catalog,{offset});found.push(...p.operations.map(o=>o.operation));offset=p.nextOffset;}while(offset!==null);
 assert.equal(found.length,catalog.length);assert.equal(new Set(found).size,catalog.length);
 assert.ok(compactCatalog(catalog,{search:'REPORTS'}).total>0);
});
test('guides load by topic, default is short and complete manual remains available',async()=>{
 const overview=await guide(root);assert.ok(JSON.stringify(overview).length<2500);assert.equal(overview.workflows,undefined);
 for(const topic of topics.filter(t=>!['overview','all'].includes(t))){const g=await guide(root,topic);assert.ok(g.text.length>50,topic);}
 assert.ok((await guide(root,'all')).workflows.includes('Report create'));
});
test('default contract excludes source and remains compact',()=>{
 const contract=briefContract(catalog.find(o=>o.name==='web_post_testcases'));assert.equal(contract.source,undefined);assert.ok(JSON.stringify(contract).length<4000);
});
