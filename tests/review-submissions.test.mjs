import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
import {startBoard} from '../src/server.mjs';
const plan={title:'Review workflow',kind:'software',brief:'Review before building',objective:'A clear plan'};
async function setup(t,onFeedback){const cwd=await mkdtemp(path.join(os.tmpdir(),'review-send-'));t.after(()=>rm(cwd,{recursive:true,force:true}));const board=await startBoard({cwd,onFeedback});t.after(()=>board.close());const record=await board.store.save(plan);const post=async(action,data={revision:1})=>{const r=await fetch(board.url+`api/plans/${record.id}/${action}`,{method:'POST',headers:{Origin:new URL(board.url).origin,'Content-Type':'application/json'},body:JSON.stringify(data)});const result=await r.json();if(r.ok&&['submit','approve'].includes(action)){await board.deliver(record.id);result.record=await board.store.read(record.id);result.delivered=!result.record.submissions.some(s=>s.status==='queued');}return {status:r.status,...result};};return {board,record,post,cwd};}
test('save notes quietly, submit once, preserve delivery across revisions and reject stale approval',async t=>{
 const sent=[];const {board,record,post}=await setup(t,async(id,batch)=>sent.push(batch));
 for(const text of ['Explain the data model','Reuse our components'])await post('feedback',{revision:1,action:'comment',text});
 assert.equal(sent.length,0);const result=await post('submit');assert.equal(result.delivered,true);assert.deepEqual(sent[0].feedback.map(f=>f.text),['Explain the data model','Reuse our components']);
 assert.equal((await post('submit')).status,400);assert.equal(sent.length,1);
 const next=await board.store.save({...plan,objective:'Revised after feedback'},{id:record.id,expectedRevision:1});assert.equal(next.submissions[0].status,'delivered');
 assert.equal((await post('approve')).status,409);assert.equal(sent.length,1);
 await board.store.reviewCompleted(record.id,sent[0].id);const approval=await post('approve',{revision:2});assert.equal(approval.delivered,true);assert.equal(sent.at(-1).action,'accept');
 await post('approve',{revision:2});assert.equal(sent.length,2);assert.equal((await board.store.read(record.id)).feedback.filter(f=>f.action==='accept').length,1);
});
test('failed delivery retries the same persisted batch without dropping newer notes',async t=>{
 let fail=true;const sent=[];const {board,record,post}=await setup(t,async(id,b)=>{if(fail)throw Error('offline');sent.push(b);});
 await post('feedback',{revision:1,action:'comment',text:'First note'});assert.equal((await post('submit')).delivered,false);
 const id=(await board.store.read(record.id)).submissions[0].id;
 await post('feedback',{revision:1,action:'comment',text:'Second note'});fail=false;
 assert.equal((await post('submit')).delivered,true);assert.equal(sent[0].id,id);assert.deepEqual(sent.flatMap(s=>s.feedback.map(f=>f.text)),['First note','Second note']);
});
test('standalone queued review is delivered on reconnection but unsent drafts are not',async t=>{
 const {board,record,post,cwd}=await setup(t);
 await post('feedback',{revision:1,action:'comment',text:'Ready for agent'});assert.equal((await post('submit')).delivered,false);
 await post('feedback',{revision:1,action:'comment',text:'Not ready yet'});
 const sent=[],connected=await startBoard({cwd,onFeedback:async(id,b)=>sent.push(b)});t.after(()=>connected.close());await connected.deliver(record.id);await connected.deliver(record.id);
 assert.equal(sent.length,1);assert.equal(sent[0].feedback[0].text,'Ready for agent');assert.equal(sent[0].feedback.length,1);
});
test('simultaneous retries do not dispatch the same batch twice',async t=>{
 let release;const gate=new Promise(r=>release=r);let sent=0;
 const {board,record,post}=await setup(t,async()=>{sent++;await gate;});
 await post('feedback',{revision:1,action:'comment',text:'One batch'});await board.store.submit(record.id,{revision:1});
 const a=board.deliver(record.id),b=board.deliver(record.id);release();await Promise.all([a,b]);assert.equal(sent,1);
});
