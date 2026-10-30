import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,rm} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {startBoard} from '../src/server.mjs';
const plan={title:'Explain this system',kind:'webapp',brief:'A simple app',objective:'Help the user understand'};
const annotation={kind:'text',field:'objective',start:0,end:28,quote:'Help the user understand'};
async function setup(t,connected=true){const cwd=await mkdtemp(path.join(os.tmpdir(),'plan-talk-'));t.after(()=>rm(cwd,{recursive:true,force:true}));const messages=[];const board=await startBoard({cwd,...(connected?{onFeedback:async(id,q)=>messages.push(q)}:{})});t.after(()=>board.close());const r=await board.store.save(plan);const post=async(data)=>{const response=await fetch(board.url+`api/plans/${r.id}/ask`,{method:'POST',headers:{Origin:new URL(board.url).origin,'Content-Type':'application/json'},body:JSON.stringify(data)});const result=await response.json();if(response.ok){await board.deliver(r.id);const latest=await board.store.read(r.id);result.question=latest.discussions.find(q=>q.id===result.question.id);result.discussions=latest.discussions;}return {status:response.status,...result};};return {board,r,post,messages,cwd};}
test('direct questions and follow-ups preserve context and stay separate from review submissions',async t=>{
 const {board,r,post,messages}=await setup(t);const a={...annotation,end:plan.objective.length};const first=await post({revision:1,annotation:a,question:'What does a database do?'});assert.equal(first.status,201);assert.equal(messages[0].action,'ask');assert.equal(first.question.status,'delivered');
 await board.store.answer(r.id,first.question.id,'It stores records so the application can find them later.');
 const second=await post({revision:1,annotation:a,threadId:first.question.threadId,question:'Is that the same as the API?'});assert.equal(second.question.threadId,first.question.threadId);
 let record=await board.store.read(r.id);assert.equal(record.feedback.length,0);assert.equal(record.submissions.length,0);assert.equal(record.revision,1);assert.equal(record.discussions[0].answer,'It stores records so the application can find them later.');
 await board.store.save({...plan,title:'Revised system'},{id:r.id,expectedRevision:1});record=await board.store.read(r.id);assert.equal(record.discussions.length,2);assert.equal(record.discussions[0].revision,1);
 assert.equal((await post({revision:1,annotation:a,question:'A stale question'})).status,409);
 await assert.rejects(board.store.answer(r.id,'missing','Answer'),/Question not found/);
});
test('standalone requests persist and deliver exactly once when Pi connects',async t=>{
 const {post,board,r,messages,cwd}=await setup(t,false);
 const result=await post({revision:1,annotation:{...annotation,end:plan.objective.length},intent:'alternatives',question:'Suggest alternatives'});
 assert.equal(result.status,201);assert.equal(result.question.status,'queued');assert.equal(result.question.answer,undefined);assert.equal(messages.length,0);
 const stored=await board.store.read(r.id);assert.equal(stored.discussions.length,1);
 await post({questionId:result.question.id});assert.equal((await board.store.read(r.id)).discussions.length,1);
 const received=[];const connected=await startBoard({cwd,onFeedback:async(id,q)=>received.push(q)});t.after(()=>connected.close());
 await connected.deliver(r.id);await connected.deliver(r.id);
 assert.equal(received.length,1);assert.equal(received[0].intent,'alternatives');assert.equal((await connected.store.read(r.id)).discussions[0].status,'delivered');
});
test('agent alternatives are structured and only an explicit valid selection requests a change',async t=>{
 const {board,r,post,messages}=await setup(t);const a={...annotation,end:plan.objective.length};
 const result=await post({revision:1,annotation:a,intent:'alternatives',question:'Suggest simpler approaches.'});
 const options=[{id:'reuse',label:'Reuse the existing service',description:'Keep the current integration.',tradeoff:'Retains existing limitations.'},{id:'replace',label:'Replace the service',description:'Adopt a compatible alternative.',tradeoff:'Requires a migration.'}];
 await board.store.answer(r.id,result.question.id,'These are competing approaches.',options);
 assert.equal((await board.store.read(r.id)).revision,1);assert.equal(messages.length,1);
 const base={revision:1,annotation:a,threadId:result.question.threadId,intent:'change',question:'Use the existing service.'};
 assert.equal((await post({...base,selection:{questionId:result.question.id,optionId:'missing'}})).status,400);
 assert.equal((await post({...base,intent:'ask',selection:{questionId:result.question.id,optionId:'reuse'}})).status,400);
 const chosen=await post({...base,selection:{questionId:result.question.id,optionId:'reuse'}});assert.equal(chosen.question.intent,'change');assert.equal(chosen.question.selection.label,options[0].label);assert.equal(messages.length,2);
 await assert.rejects(board.store.answer(r.id,result.question.id,'Bad options',[options[0]]),/at least two/);
 await board.store.save({...plan,title:'New revision'},{id:r.id,expectedRevision:1});assert.equal((await post({...base,revision:2,selection:{questionId:result.question.id,optionId:'reuse'}})).status,400);
});
test('a conversation follows its stable target across revisions without accepting stale selections',async t=>{
 const {board,r,post}=await setup(t);const a={...annotation,end:plan.objective.length};const first=await post({revision:1,annotation:a,question:'Explain this outcome.'});await board.store.answer(r.id,first.question.id,'The desired result.');
 const objective='An outcome with simpler wording';await board.store.patch(r.id,1,[{path:'objective',value:objective}]);
 const next=await post({revision:2,threadId:first.question.threadId,annotation:{kind:'text',field:'objective',quote:objective,start:0,end:objective.length},question:'Explain the revised wording.'});assert.equal(next.status,201);assert.equal(next.question.threadId,first.question.threadId);assert.equal(next.discussions[0].annotation.quote,a.quote);
 assert.equal((await post({revision:2,threadId:first.question.threadId,annotation:{kind:'text',field:'title',quote:plan.title,start:0,end:plan.title.length},question:'Change context silently'})).status,400);
 assert.equal((await post({revision:2,threadId:first.question.threadId,annotation:a,question:'Use stale quote'})).status,400);
});
