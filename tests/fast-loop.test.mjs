import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
import {PlanStore} from '../src/plans.mjs';
import {startBoard} from '../src/server.mjs';
import {compactContext} from '../src/agent-request.mjs';
const example=JSON.parse(await readFile(new URL('../examples/review-demo/legacy.json',import.meta.url)));
test('diagram requests keep selected detail and adjacent edges without unrelated layers or duplicated full text',()=>{
 const d=example.diagrams[0],layer=d.layers[0],n=layer.nodes[0],field=`diagrams/${d.id}/layers/${layer.id}/nodes/${n.nodeId}/detail`;
 const r={id:'p',revision:1,plan:example,discussions:[]},ctx=compactContext(r,{id:'q',intent:'change',annotation:{kind:'text',field,quote:n.detail}}),focused=ctx.related.diagrams[0];
 assert.equal(ctx.fields[field],n.detail);assert.ok(focused.layers.every(l=>l.nodes.every(x=>x.nodeId===n.nodeId)));assert.ok(focused.layers.every(l=>l.edges.every(e=>e.from===n.nodeId||e.to===n.nodeId)));assert.equal(Object.keys(ctx.fields).filter(k=>k.startsWith('diagrams/')).length,1);assert.ok(ctx.workflow===example.workflow);
 const area=compactContext(r,{intent:'ask',annotation:{kind:'area',items:[{kind:'node',diagramId:d.id,layerId:layer.id,nodeId:n.nodeId,quote:d.nodes.find(x=>x.id===n.nodeId).label}]}});assert.equal(area.selected[0].detail,n.detail);
});
async function setup(t){const cwd=await mkdtemp(path.join(os.tmpdir(),'fast-plan-'));t.after(()=>rm(cwd,{recursive:true,force:true}));return cwd;}
test('HTTP acknowledges persisted requests while dispatch is blocked and drains newer requests', {timeout:10000},async t=>{
 const cwd=await setup(t);let release;const gate=new Promise(r=>release=r),sent=[];
 const board=await startBoard({cwd,onFeedback:async(id,entry)=>{sent.push(entry.id);if(sent.length===1)await gate;}});t.after(async()=>{release();await board.close();});
 const record=await board.store.save(example);
 const post=()=>fetch(board.url+'api/plans/'+record.id+'/ask',{method:'POST',headers:{Origin:new URL(board.url).origin,'Content-Type':'application/json'},body:JSON.stringify({revision:1,intent:'ask',question:'Explain this outcome.',annotation:{kind:'element',elementId:'overview'}})}).then(r=>r.json());
 let timeout;const fail=new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('HTTP waited for agent work')),2000);});
 try{const first=await Promise.race([post(),fail]);assert.ok(first.question.id);while(!sent.length)await new Promise(r=>setTimeout(r,5));const second=await Promise.race([post(),fail]);assert.notEqual(first.question.id,second.question.id);assert.equal((await board.store.read(record.id)).discussions.length,2);assert.equal(sent.length,1);release();await board.deliver(record.id);assert.deepEqual(sent,[first.question.id,second.question.id]);assert.ok((await board.store.read(record.id)).discussions.every(q=>q.status==='delivered'));}finally{clearTimeout(timeout);release();}
});
test('patches preserve source and notes, resolve stable IDs, and reject invalid or stale writes',async t=>{
 const store=new PlanStore(await setup(t));const r=await store.save(example),tech=r.plan.technologies.at(-1);
 await store.feedback(r.id,{revision:1,action:'comment',text:'Keep this note.'});
 const next=await store.patch(r.id,1,[{path:'technologies/'+tech.id+'/rationale',value:'A simpler explanation.'},{path:'success/0',value:'Customers can complete the main task.'}]);
 assert.equal(next.revision,2);assert.equal(next.plan.technologies.at(-1).rationale,'A simpler explanation.');assert.equal(next.plan.success[0],'Customers can complete the main task.');assert.deepEqual(next.plan.sourceDocument,r.plan.sourceDocument);assert.equal(next.feedback[0].text,'Keep this note.');
 for(const field of ['__proto__/polluted','technologies/'+tech.id+'/id','missing','sourceDocument/sections/source-0/content'])await assert.rejects(store.patch(r.id,2,[{path:field,value:'bad'}]),/editable text field/);
 await assert.rejects(store.patch(r.id,1,[{path:'objective',value:'Stale'}]),e=>e.status===409);
 const writes=await Promise.allSettled([store.patch(r.id,2,[{path:'objective',value:'First'}]),store.patch(r.id,2,[{path:'objective',value:'Second'}])]);assert.equal(writes.filter(x=>x.status==='fulfilled').length,1);assert.equal((await store.read(r.id)).revision,3);assert.equal({}.polluted,undefined);
});
test('focused request context retains selected technology and history without archived source',()=>{
 const tech=example.technologies[0],record={id:'sample',revision:7,plan:example,discussions:[{threadId:'one',question:'Earlier question',answer:'Earlier answer'},{threadId:'other',question:'Private unrelated conversation'}]};
 const ctx=compactContext(record,{question:'Explain the choice',threadId:'one',annotation:{kind:'text',field:'technologies/'+tech.id+'/name',quote:tech.name}});
 assert.equal(ctx.expectedRevision,7);assert.equal(ctx.related.technologies[0].id,tech.id);assert.equal(ctx.recentConversation.length,1);assert.ok(ctx.fields['technologies/'+tech.id+'/name']);assert.ok(!JSON.stringify(ctx).includes('sourceDocument'));assert.ok(!JSON.stringify(ctx).includes('Private unrelated conversation'));
});
test('batch context includes each submitted target and omits unsent feedback',()=>{
 const first=example.technologies[0],second=example.technologies[1];
 const record={id:'batch',revision:1,plan:example,discussions:[],feedback:[{id:'a',text:'Clarify this',annotation:{field:'technologies/'+first.id+'/rationale'}},{id:'b',text:'Clarify that',annotation:{elementId:'technology:'+second.id}},{id:'c',text:'Unsent draft',annotation:{field:'objective'}}]};
 const ctx=compactContext(record,{feedbackIds:['a','b']});assert.deepEqual(ctx.feedback.map(f=>f.id),['a','b']);assert.equal(ctx.related.technologies.length,2);assert.ok(ctx.fields['technologies/'+first.id+'/rationale']);assert.ok(ctx.fields['technologies/'+second.id+'/rationale']);assert.ok(!JSON.stringify(ctx).includes('Unsent draft'));
});
