import test from 'node:test';import assert from 'node:assert/strict';import {readFile,mkdtemp,rm} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {normalize,review,PlanStore,markdown} from '../src/plans.mjs';import {planFields,planTargets} from '../web/plan-content.js';import {compactContext} from '../src/agent-request.mjs';import {documentCatalog} from '../src/document.mjs';
const bdd=JSON.parse(await readFile(new URL('../examples/workflows/bdd.json',import.meta.url)));
test('workflow names do not choose templates and authored ordering survives normalization and export',()=>{
 const p=normalize({...bdd,workflow:{name:'Our custom delivery method',constraints:['Keep the review gate']},sections:[bdd.sections[2],bdd.sections[0],bdd.sections[1]]});assert.equal(p.schemaVersion,2);assert.deepEqual(p.sections.map(s=>s.id),['early','promise','ready']);assert.deepEqual(review(p).findings,[]);assert.equal(p.steps.length,0);const md=markdown({plan:p,revision:1,feedback:[]});assert.ok(md.indexOf('## The customer arrives early')<md.indexOf('## The promise to customers'));assert.ok(!md.includes('## Tools & technology'));assert.ok(md.includes('Keep the review gate'));assert.ok(documentCatalog().blocks.some(b=>b.type==='sequence'));
});
test('invalid, hidden or duplicate document references and malformed content are rejected',()=>{
 const bad=patch=>normalize({...bdd,...patch});
 assert.throws(()=>bad({schemaVersion:1}),/schemaVersion 2/);assert.throws(()=>bad({sections:[]}),/sections need/);
 assert.throws(()=>bad({sections:[{id:'x',title:'X',blocks:[{id:'x',type:'script',text:'alert(1)'}]}]}),/Unknown document block/);
 assert.throws(()=>bad({sections:[{id:'x',title:'X',blocks:[{id:'x',type:'table',columns:['One'],rows:[{id:'r',cells:['a','b']}]}]}]}),/column count/);
 assert.throws(()=>bad({sections:[{id:'x',title:'X',blocks:[{id:'x',type:'field',path:'missing'}]}]}),/existing plan text/);
 assert.throws(()=>bad({steps:[{id:'unplaced',title:'Hidden task',dependsOn:[]}]}),/Place steps\/unplaced/);
 assert.throws(()=>bad({sections:[{id:'x',title:'X',blocks:[{id:'x',type:'diagrams',ids:['missing']}]}]}),/Unknown document reference/);
 assert.throws(()=>bad({sections:[{id:'x',title:'X',blocks:[{id:'x',type:'text',text:'One'},{id:'x',type:'text',text:'Two'}]}]}),/Block IDs/);
});
test('authored annotations, patches, workflow context and exact original source survive revisions',async t=>{
 const cwd=await mkdtemp(path.join(os.tmpdir(),'document-store-'));t.after(()=>rm(cwd,{recursive:true,force:true}));const store=new PlanStore(cwd),original='# Original\n\n  Preserve these spaces.\n';const r=await store.save({...bdd,sourceDocument:{name:'original.md',sections:[{id:'source',title:'Original',content:original}]}});const field='sections/ready/blocks/scenario/items/then/detail',quote=planFields(r.plan).get(field);await store.feedback(r.id,{revision:1,action:'annotate',text:'Clarify pickup.',annotation:{kind:'text',field,quote,start:0,end:quote.length}});
 const updated=await store.patch(r.id,1,[{path:field,value:'Show the pickup instructions clearly.'}]);assert.equal(updated.feedback[0].annotation.quote,quote);assert.equal(updated.plan.sourceDocument.sections[0].content,original);assert.equal(planFields(updated.plan).get(field),'Show the pickup instructions clearly.');assert.equal(planTargets(updated.plan).get('block:ready:scenario'),'The order is ready');
 const ctx=compactContext(updated,{annotation:{kind:'text',field,quote},question:'Explain this.'});assert.equal(ctx.workflow.name,'BDD');assert.equal(ctx.related.sections[0].id,'ready');assert.ok(!JSON.stringify(ctx).includes('Preserve these spaces.'));const md=markdown(updated);assert.ok(md.includes(original));assert.ok(md.includes('Clarify pickup.'));
 await assert.rejects(store.patch(r.id,1,[{path:field,value:'Stale'}]),e=>e.status===409);
});
