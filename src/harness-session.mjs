import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {realpath} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {PlanStore} from './plans.mjs';
import {startBoard} from './server.mjs';
import {saveMarkdownPlan,requireMarkdown} from './markdown-plan.mjs';
import {documentCatalog} from './document.mjs';
import {diagramCatalog} from '../web/diagram-spec.js';
import {agentRequest} from './agent-request.mjs';
import {reviewRead} from './review-read.mjs';
import {requestRoute} from './plan-operations.mjs';
import {fastReview,codexFastGenerator} from './fast-review.mjs';

// Complex work stays with the owner. Codex quick tasks use its installed login
// through an isolated Luna process; other hosts receive an explicit route.
export function createHarnessSession({fastGenerate,host=process.env.PLANBOARD_FAST_HOST||'unknown'}={}){
 const projects=new Map(),owner={kind:'mcp',pid:process.pid,sessionId:randomUUID()},abort=new AbortController();let closed=false,hostName=host;
 async function project(cwd){
  if(typeof cwd!=='string'||!path.isAbsolute(cwd))throw new Error('Supply the absolute project cwd. Do not use the MCP installation directory.');
  cwd=await realpath(cwd);
  if(!projects.has(cwd))projects.set(cwd,{cwd,store:new PlanStore(cwd),pending:new Map(),active:null,notify:null});
  return projects.get(cwd);
 }
 async function ensure(p){
  if(p.board)return p.board;
  requireMarkdown(await p.store.current());
  // Cache the promise as well: simultaneous tool calls must not create two boards.
  if(!p.starting)p.starting=p.store.recoverDisconnectedAgents().then(()=>startBoard({cwd:p.cwd,deliveryOwner:owner,onFeedback:async(id,entry)=>{
   if(closed)throw new Error('The owning agent session disconnected.');
   if(requestRoute(entry).tier==='fast'&&(fastGenerate||process.env.PLANBOARD_FAST_HOST==='codex')){
    const handled=await fastReview({store:p.store,id,entry,activity:p.board.activity,model:'gpt-6-luna',generate:fastGenerate||codexFastGenerator({signal:abort.signal})});
    if(handled)return;entry={...entry,routeOverride:'session'};
   }
   p.pending.set(entry.id,{id,entry});p.board.activity.start(id,entry);p.notify?.();
  }})).then(board=>p.board=board).finally(()=>p.starting=null);
  const board=await p.starting;await board.deliver((await p.store.current()).id);return board;
 }
 async function wait(p,args,signal){
  const board=await ensure(p);const id=args.id||(await p.store.current()).id;requireMarkdown(await p.store.read(id));await board.deliver(id);
  if(p.waiting)throw new Error('A review wait is already listening in this session.');
  if(!p.active&&!p.pending.size){
   const seconds=args.timeoutSeconds??45;if(!Number.isFinite(seconds)||seconds<0||seconds>50)throw new Error('timeoutSeconds must be between 0 and 50.');
   p.waiting=true;
   try{await new Promise(resolve=>{let timer;const done=()=>{clearTimeout(timer);signal?.removeEventListener('abort',done);p.notify=null;resolve();};p.notify=done;timer=setTimeout(done,seconds*1000);signal?.addEventListener('abort',done,{once:true});if(closed||signal?.aborted)done();});}finally{p.waiting=false;}
  }
  if(closed||signal?.aborted)return {status:'cancelled'};
  p.active ||= p.pending.values().next().value;
  if(!p.active)return {status:'idle',instruction:'No feedback yet. If the user is still reviewing, call wait again; do not fabricate feedback or implement the plan.'};
  const {id:planId,entry}=p.active;const record=await p.store.read(planId);
  board.activity.update(planId,entry.id,{status:'running',phase:'Reviewing your request'});
  return {status:'request',id:planId,requestId:entry.id,action:entry.action,intent:entry.intent,routing:entry.routeOverride?{tier:'session',reason:'Fast model requested owner context.'}:requestRoute(entry),...(entry.action==='accept'?{approval:record.approval,reviewUrl:board.url+'?plan='+planId}:{}),request:agentRequest(planId,entry,record),instruction:entry.action==='accept'?'Complete this approval receipt, then show the saved path and ask whether the user wants implementation. Do not implement until requested.':'Use answer for a discussion, or include questionId and answer with save/patch for one atomic change-and-reply. For a submitted batch, complete after saving. Continue waiting until approval or a stop request.'};
 }
 function task(p,args){const item=p.pending.get(args.requestId||p.active?.entry.id);if(!item||item.id!==args.id)throw new Error('Read a pending request with wait before reporting progress or completing it.');return item;}
 function done(p,item){p.pending.delete(item.entry.id);if(p.active===item)p.active=null;}
 function finishCommit(p,args,result){const item=p.pending.get(args.questionId);if(item){p.board.activity.update(args.id,item.entry.id,{status:'complete',phase:'Changes saved',savedRevision:result.revision,text:args.answer,editing:false});done(p,item);}}
 async function call(args,{signal}={}){
  if(closed)throw new Error('The owning agent session disconnected.');
  if(args.action==='catalog')return args.catalogKind==='document'?documentCatalog():diagramCatalog({category:args.category,query:args.query});
  const p=await project(args.cwd),store=p.store;
  const tracked=p.active?.id===args.id&&['read','inbox','patch','save','answer'].includes(args.action)?p.active:null;
  const eventId=tracked?randomUUID():null;
  if(tracked)p.board.activity.update(args.id,tracked.entry.id,{status:'running',phase:'Planboard: '+args.action,event:{id:eventId,kind:'tool',label:'plan_board · '+args.action,status:'running'}});
  try {
  if(args.action==='save'){
   const active=p.active?.id===args.id?p.active:null;
   if(active)p.board.activity.update(args.id,active.entry.id,{status:'running',phase:'Saving the plan changes',editing:true,editId:Date.now()+''});
   const result=await saveMarkdownPlan(store,args);
   if(active)p.board.activity.update(args.id,active.entry.id,{editing:false,savedRevision:result.revision,phase:'Changes saved'});
   if(args.questionId)finishCommit(p,args,result);
   return {id:result.id,revision:result.revision,title:result.plan.title,source:result.plan.sourceDocument.name,files:result.files,documentStatus:result.document.status};
  }
  if(args.action==='list')return store.list();
  if(args.action==='read')return reviewRead(await store.read(args.id),args.paths);
  if(args.action==='inbox'){const r=await store.read(args.id);return {id:r.id,revision:r.revision,feedback:r.feedback,submissions:r.submissions,discussions:r.discussions};}
  if(args.action==='open'){
   requireMarkdown(args.id?await store.read(args.id):await store.current());if(args.id)await store.activate(args.id);
   const board=await ensure(p),id=args.id||(await store.current()).id;await board.deliver(id);const url=board.url+'?plan='+id;
   if(args.openBrowser){const command=process.platform==='darwin'?['open',url]:process.platform==='win32'?['rundll32','url.dll,FileProtocolHandler',url]:['xdg-open',url];const child=spawn(command[0],command.slice(1),{detached:true,stdio:'ignore'});child.on('error',()=>{});child.unref();}
   return {url,connection:'Owning MCP host session; call wait to receive browser requests.',instruction:'Keep this agent session listening with wait while the user reviews. Do not end the review loop unless approved or asked to stop.'};
  }
  if(args.action==='wait')return wait(p,args,signal);
  if(args.action==='patch'){
   requireMarkdown(await store.read(args.id));const active=p.active?.id===args.id?p.active:null;
   if(active)p.board.activity.update(args.id,active.entry.id,{status:'running',phase:'Updating the selected text',editing:true,editId:Date.now()+'',editPaths:(args.changes||[]).map(c=>c.path)});
   const r=await store.patch(args.id,args.expectedRevision,args.changes,args);
   if(active)p.board.activity.update(args.id,active.entry.id,{editing:false,savedRevision:r.revision,phase:'Changes saved'});
   if(args.questionId)finishCommit(p,args,r);
   return {id:r.id,revision:r.revision,changed:args.changes.map(c=>c.path),documentStatus:r.document.status,files:r.files};
  }
  if(args.action==='undo'||args.action==='reconcile'){
   if(args.action==='reconcile'&&args.reviewedMarkdown===undefined)throw new Error('Supply the complete reconciled reviewedMarkdown.');
   const r=args.action==='undo'?await store.undo(args.id,args.expectedRevision,args.undoRevision,args):await saveMarkdownPlan(store,{...args,plan:(await store.read(args.id)).plan});
   if(args.questionId)finishCommit(p,args,r);return {id:r.id,revision:r.revision,documentStatus:r.document.status,files:r.files};
  }
  if(args.action==='answer'){
   const result=await store.answer(args.id,args.questionId,args.answer,args.options),item=p.pending.get(args.questionId);
   if(item){if(tracked)p.board.activity.update(args.id,args.questionId,{event:{id:eventId,kind:'tool',label:'plan_board · answer',status:'complete'}});p.board.activity.update(args.id,args.questionId,{status:'complete',phase:'Finished',text:args.answer,editing:false});done(p,item);}return {id:args.id,questionId:result.id,status:result.status};
  }
  if(args.action==='progress'){
   const item=task(p,args);if(typeof args.message!=='string'||!args.message.trim()||args.message.length>2000)throw new Error('Supply a short public progress message, at most 2000 characters.');
   const event=args.toolName?{id:args.toolCallId||randomUUID(),kind:'tool',label:args.toolName,status:args.toolStatus||'running'}:undefined;
   if(event&&(!/^[\w.:-]{1,100}$/.test(event.label)||!['running','complete','error'].includes(event.status)))throw new Error('Use a tool name and running, complete or error status; never raw arguments or results.');
   p.board.activity.update(args.id,item.entry.id,{status:'running',phase:args.message.slice(0,160),text:args.message,event});return {status:'reported'};
  }
  if(args.action==='complete'){
   const item=task(p,args);if(item.entry.action==='ask')throw new Error('A discussion needs an answer saved with action=answer.');
   const record=await store.read(args.id),approved=item.entry.action==='accept'&&record.revision===item.entry.revision&&record.approval?.revision===record.revision;
   await store.reviewCompleted(args.id,item.entry.id);p.board.activity.update(args.id,item.entry.id,{status:'complete',phase:'Finished',editing:false,text:args.message||''});done(p,item);return {status:'complete',approved,...(approved?{approval:record.approval,reviewUrl:p.board.url+'?plan='+record.id,nextAction:'Show the approved Markdown path and ask the user whether to implement this revision. Wait for their answer.'}:{})};
  }
  throw new Error('Unknown planning action.');
  } catch(error) {
   if(tracked)p.board.activity.update(args.id,tracked.entry.id,{editing:false,event:{id:eventId,kind:'tool',label:'plan_board · '+args.action,status:'error'}});
   throw error;
  } finally {
   if(tracked){const current=p.board.activity.snapshot(args.id).find(t=>t.id===tracked.entry.id),event=current?.events?.find(e=>e.id===eventId);if(event?.status==='running')p.board.activity.update(args.id,tracked.entry.id,{event:{id:eventId,kind:'tool',label:'plan_board · '+args.action,status:'complete'}});}
  }
 }
 return {call,setHost(name){if(!process.env.PLANBOARD_FAST_HOST)hostName=name;},async close(){closed=true;abort.abort();for(const p of projects.values()){p.notify?.();if(p.starting)await p.starting.catch(()=>{});for(const {id,entry} of p.pending.values())await p.store.deliveryFailed(id,entry.id,'Agent session disconnected. Reopen the board and retry.').catch(()=>{});await p.board?.close();}}};
}
