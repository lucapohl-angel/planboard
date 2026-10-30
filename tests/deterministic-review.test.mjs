import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {PlanStore} from '../src/plans.mjs';import {startBoard} from '../src/server.mjs';
import {saveMarkdownPlan} from '../src/markdown-plan.mjs';
import {differences,applyOperations,requestRoute,chooseFastModel} from '../src/plan-operations.mjs';
import {fastReview} from '../src/fast-review.mjs';import {createActivityHub} from '../src/activity.mjs';
import {createHarnessSession} from '../src/harness-session.mjs';
const plan={title:'Shop',kind:'website',brief:'Sell products',objective:'Buy dog products.'};
const annotation={kind:'text',field:'objective',quote:plan.objective,start:0,end:plan.objective.length};
async function setup(t){const cwd=await mkdtemp(path.join(os.tmpdir(),'planboard-local-'));t.after(()=>rm(cwd,{recursive:true,force:true}));return {cwd,store:new PlanStore(cwd)};}
test('undo reverses one revision, retains unrelated later edits and rejects conflicting edits',async t=>{
 const {store}=await setup(t),r=await store.save(plan);
 await store.patch(r.id,1,[{path:'objective',value:'Buy cat products.'}]);await store.patch(r.id,2,[{path:'brief',value:'A pet shop'}]);
 const undone=await store.undo(r.id,3,2);assert.equal(undone.plan.objective,plan.objective);assert.equal(undone.plan.brief,'A pet shop');
 await assert.rejects(store.undo(r.id,4,2),/changed since/);assert.equal((await store.read(r.id)).revision,4);
 assert.throws(()=>applyOperations(plan,[{path:'__proto__/polluted',value:true}]),/Invalid/);
});
test('prepared alternatives and factual questions finish without any agent; repeats use saved answers',async t=>{
 const {cwd}=await setup(t);let calls=0;const board=await startBoard({cwd,onFeedback:()=>{calls++;}});t.after(()=>board.close());const r=await board.store.save(plan);
 const post=async input=>{const response=await fetch(board.url+'api/plans/'+r.id+'/ask',{method:'POST',headers:{Origin:new URL(board.url).origin,'Content-Type':'application/json'},body:JSON.stringify(input)});assert.equal(response.status,201);const result=await response.json();await board.deliver(r.id);return (await board.store.read(r.id)).discussions.find(q=>q.id===result.question.id);};
 const base={revision:1,annotation,intent:'ask',question:'Show saved explanation',operation:{kind:'explanation'}};
 assert.equal((await post(base)).answer,plan.objective);assert.equal(calls,0);
 const q=await board.store.ask(r.id,{...base,intent:'alternatives',question:'Alternatives',operation:undefined});
 await board.store.answer(r.id,q.id,'Choose an approach.',[{id:'cats',label:'Cats',description:'Cat products',prepared:{revision:1,operations:[{path:'objective',before:plan.objective,value:'Buy cat products.'}]}},{id:'dogs',label:'Dogs',description:'Dog products'}]);
 const changed=await post({...base,intent:'change',question:'Use Cats',operation:undefined,threadId:q.threadId,selection:{questionId:q.id,optionId:'cats'}});
 assert.equal(changed.status,'answered');assert.equal((await board.store.read(r.id)).plan.objective,'Buy cat products.');assert.equal(calls,0);
 const a={...annotation,quote:'Buy cat products.'};const repeated={revision:2,annotation:a,intent:'ask',question:'Explain the purpose'};
 const first=await board.store.ask(r.id,repeated);await board.store.answer(r.id,first.id,'Find suitable cat supplies.');
 assert.equal((await post(repeated)).answer,'Find suitable cat supplies.');assert.equal(calls,0);
});
test('reviewed Markdown stays detailed, source is immutable, and approval returns an immutable revision path',async t=>{
 const {cwd,store}=await setup(t),original='# Shop\nBuy dog products.\n\n## Contract\nGET /api/products must preserve permissions.\n';await writeFile(path.join(cwd,'source.md'),original);
 const r=await saveMarkdownPlan(store,{markdownPath:'source.md',plan});
 const next=await store.patch(r.id,1,[{path:'objective',value:'Buy cat products.'}]);assert.equal(next.document.status,'synced');assert.match(next.document.content,/GET \/api\/products/);assert.match(next.document.content,/Buy cat/);assert.equal(await readFile(path.join(cwd,'source.md'),'utf8'),original);
 const approval=await store.submit(r.id,{revision:2,approve:true});assert.equal(approval.approval.implementationRequested,false);assert.match(approval.approval.path,/-r2\.approved\.md$/);assert.equal(await readFile(approval.approval.path,'utf8'),next.document.content);
 const changed=await store.patch(r.id,2,[{path:'brief',value:'Supply pets'}]);assert.equal(changed.document.status,'needs-reconciliation');await assert.rejects(store.submit(r.id,{revision:3,approve:true}),/reconciliation/);
 const reconciled=await store.save(changed.plan,{id:r.id,expectedRevision:3,reviewedMarkdown:changed.document.content+'\nSupply pets.\n'});assert.equal(reconciled.document.status,'synced');assert.equal(await readFile(approval.approval.path,'utf8'),next.document.content);
});
test('commit validates both changes and reply before writing; pending requests prevent approval',async t=>{
 const {store}=await setup(t),r=await store.save(plan),q=await store.ask(r.id,{revision:1,intent:'change',question:'Change it',annotation});
 await assert.rejects(store.patch(r.id,1,[{path:'objective',value:'Updated'}],{questionId:q.id,answer:''}),/explanation/i);assert.equal((await store.read(r.id)).revision,1);
 await assert.rejects(store.submit(r.id,{revision:1,approve:true}),/pending/);
 const saved=await store.patch(r.id,1,[{path:'objective',value:'Updated'}],{questionId:q.id,answer:'Updated the outcome.'});assert.equal(saved.discussions[0].status,'answered');assert.equal(saved.discussions[0].resultRevision,2);
});
test('router costs no model call, requires fast-family availability and preserves owner routing',()=>{
 assert.equal(requestRoute({action:'ask',intent:'ask',question:'Explain this term'}).tier,'fast');
 assert.equal(requestRoute({action:'ask',intent:'change',question:'Replace the auth provider'}).tier,'session');
 assert.equal(requestRoute({action:'ask',intent:'ask',question:'Is this architecture safe?'}).tier,'session');
 assert.equal(chooseFastModel([{provider:'openai',id:'gpt-6-astra'},{provider:'openai',id:'gpt-6-luna'}]).id,'gpt-6-luna');
 assert.throws(()=>chooseFastModel([{id:'gpt-6-astra'}]),/No fast model/);
});
test('fast responses cannot make changes for asks or change unrelated wording fields',async t=>{
 const {store}=await setup(t),r=await store.save(plan),q=await store.ask(r.id,{revision:1,intent:'ask',question:'Explain this term',annotation});
 const args={store,id:r.id,entry:{...q,action:'ask'},activity:createActivityHub(),model:'gpt-6-luna'};
 await assert.rejects(fastReview({...args,generate:async()=>({answer:'Changed',needsOwner:false,changes:[{path:'brief',value:'Oops'}]})}),/cannot change/);
 assert.equal((await store.read(r.id)).revision,1);
 assert.equal(await fastReview({...args,generate:async()=>({answer:'Needs research',needsOwner:true,changes:[]})}),false);
});
test('MCP quick adapter handles explanations and approval asks owner with saved path',async t=>{
 const {cwd}=await setup(t);await writeFile(path.join(cwd,'source.md'),'# Shop\nBuy dog products.\n');let calls=0;
 const session=createHarnessSession({host:'codex',fastGenerate:async()=>{calls++;return {answer:'Buy products for dogs.',needsOwner:false,changes:[]};}});t.after(()=>session.close());
 const r=await session.call({action:'save',cwd,markdownPath:'source.md',plan});const {url}=await session.call({action:'open',cwd,id:r.id});
 const post=async(action,input)=>{const base=new URL(url);base.search='';const res=await fetch(base+'api/plans/'+r.id+'/'+action,{method:'POST',headers:{Origin:base.origin,'Content-Type':'application/json'},body:JSON.stringify(input)});assert.equal(res.ok,true,await res.clone().text());return res.json();};
 await post('ask',{revision:1,intent:'ask',question:'Explain this term',annotation});await session.call({action:'wait',cwd,id:r.id,timeoutSeconds:0});assert.equal(calls,1);
 await post('approve',{revision:1});const event=await session.call({action:'wait',cwd,id:r.id,timeoutSeconds:0});assert.equal(event.action,'accept');assert.match(event.request,/Would you like me to implement/);assert.match(event.approval.path,/approved.md$/);
 const completed=await session.call({action:'complete',cwd,id:r.id,requestId:event.requestId});assert.equal(completed.approved,true);assert.match(completed.nextAction,/ask the user/);
});
