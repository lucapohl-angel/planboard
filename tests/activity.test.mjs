import test from 'node:test';import assert from 'node:assert/strict';
import {createActivityHub,publicProgress,createProgressReporter} from '../src/activity.mjs';
test('tool timeline streams names and outcomes without arguments, output or thinking',()=>{
 const hub=createActivityHub();hub.start('p',{id:'q',intent:'change',createdAt:'2026-10-28T18:38:17.756Z'});
 const reporter=createProgressReporter(hub,'p','q');
 reporter.event({type:'tool_execution_start',toolName:'web_search',toolCallId:'search-1',args:{query:'PRIVATE QUERY'}});
 reporter.event({type:'message_update',assistantMessageEvent:{type:'thinking_delta',delta:'PRIVATE THOUGHT'}});
 reporter.event({type:'tool_execution_end',toolCallId:'search-1',result:{text:'PRIVATE RESULT'}});reporter.flush();
 const task=hub.snapshot('p')[0],event=task.events.find(e=>e.id==='search-1');assert.equal(event.label,'web_search');assert.equal(event.status,'complete');assert.ok(event.endedAt>=event.at);assert.ok(!JSON.stringify(task).includes('PRIVATE'));assert.equal(task.startedAt,Date.parse('2026-10-28T18:38:17.756Z'));
 reporter.event({type:'tool_execution_start',toolName:'exec',toolCallId:'shell'});reporter.event({type:'tool_execution_end',toolCallId:'shell',isError:true,result:'private stderr'});assert.equal(hub.snapshot('p')[0].events.find(e=>e.id==='shell').status,'error');
});
test('public activity excludes thinking, raw tool inputs and private result content',()=>{
 assert.equal(publicProgress({type:'message_update',assistantMessageEvent:{type:'thinking_delta',delta:'private reasoning'}}),null);
 assert.equal(publicProgress({type:'tool_execution_end',result:{secret:'never stream'}}),null);
 assert.deepEqual(publicProgress({type:'tool_execution_start',toolName:'plan_board',args:{action:'read',secret:'do not send'}}),{phase:'Reading the plan'});
 const event={type:'message_update',assistantMessageEvent:{type:'toolcall_delta',contentIndex:0,partial:{content:[{type:'toolCall',name:'plan_board',arguments:{action:'answer',answer:'A public explanation',private:'secret'}}]}}};assert.deepEqual(publicProgress(event),{phase:'Writing the reply',text:'A public explanation'});
});
test('stream snapshots reconnect, isolate plans and retain completed status',()=>{
 const hub=createActivityHub(),seen=[];hub.start('one',{id:'a',intent:'ask'});const off=hub.subscribe('one',tasks=>seen.push(structuredClone(tasks)));hub.start('two',{id:'b',intent:'change'});
 const reporter=createProgressReporter(hub,'one','a');reporter.event({type:'message_update',assistantMessageEvent:{type:'text_delta',delta:'Hello'}});reporter.flush();hub.update('one','a',{status:'complete',phase:'Finished'});assert.equal(seen.at(-1)[0].text,'Hello');assert.equal(seen.at(-1)[0].status,'complete');assert.equal(seen.at(-1).length,1);off();
});
test('edit activity signals targeted fields and committed revisions before turn completion',()=>{
 const hub=createActivityHub();hub.start('plan',{id:'request',intent:'change'});const reporter=createProgressReporter(hub,'plan','request');
 reporter.event({type:'tool_execution_start',toolName:'plan_board',toolCallId:'patch-1',args:{action:'patch',changes:[{path:'objective',value:'Private until saved'}]}});
 assert.deepEqual(hub.snapshot('plan')[0].editPaths,['objective']);assert.ok(!JSON.stringify(hub.snapshot('plan')).includes('Private until saved'));
 reporter.event({type:'tool_execution_end',toolCallId:'patch-1',result:{details:{id:'plan',revision:2,secret:'never expose'}}});
 const task=hub.snapshot('plan')[0];assert.equal(task.savedRevision,2);assert.equal(task.status,'running');assert.ok(!JSON.stringify(task).includes('never expose'));
 reporter.event({type:'tool_execution_start',toolName:'plan_board',toolCallId:'patch-2',args:{action:'patch',changes:[]}});
 reporter.event({type:'tool_execution_end',toolCallId:'patch-2',isError:true,result:{details:{id:'plan',revision:3}}});assert.equal(hub.snapshot('plan')[0].savedRevision,2);
});
