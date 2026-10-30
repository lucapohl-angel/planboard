import {planboardCommandRequest} from './planboard-command.mjs';
import {toolSchema} from './tool-schema.mjs';
import {saveMarkdownPlan,requireMarkdown} from './markdown-plan.mjs';
import { Type } from '@earendil-works/pi-ai';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { spawn } from 'node:child_process';
import {createProgressReporter} from './activity.mjs';
import { agentRequest } from './agent-request.mjs';
import {reviewRead} from './review-read.mjs';
import {requestRoute,chooseFastModel} from './plan-operations.mjs';
import {fastReview} from './fast-review.mjs';
import {documentCatalog} from './document.mjs';
import { PlanStore } from './plans.mjs';
import { startBoard } from './server.mjs';
import { diagramCatalog } from '../web/diagram-spec.js';

function openURL(url: string) {
  const command = process.platform === 'darwin' ? ['open', url] : process.platform === 'win32' ? ['rundll32', 'url.dll,FileProtocolHandler', url] : ['xdg-open', url];
  const child = spawn(command[0], command.slice(1), { detached: true, stdio: 'ignore' });
  child.on('error', () => {}); child.unref();
}
export default function planning(pi: ExtensionAPI) {
  let board: any, owner: string, active: any;
  const pending=new Map<string,any>();
  async function close() { if (board) { const previous = board; board = undefined; active?.reporter?.flush();active=undefined;const unfinished=[...pending.values()];pending.clear();for(const task of unfinished)await previous.store.deliveryFailed(task.id,task.entry.id,'Agent session disconnected. Reopen the plan to resume.').catch(()=>{});await previous.close(); } }
  async function ensure(ctx: any) {
    if (!ctx.isProjectTrusted()) throw new Error('Open planning from a trusted project folder.');
    const key = ctx.cwd + ':' + ctx.sessionManager.getSessionId();
    if (board && owner !== key) await close();
    if (!board) {
      owner = key;
      await new PlanStore(ctx.cwd).recoverDisconnectedAgents();
      board = await startBoard({ cwd: ctx.cwd, deliveryOwner:{kind:'pi',pid:process.pid,sessionId:ctx.sessionManager.getSessionId()}, onFeedback: async (id: string, entry: any) => {
        if(requestRoute(entry).tier==='fast'){
          const model=chooseFastModel(ctx.modelRegistry.getAvailable(),process.env.PLANBOARD_FAST_MODEL);
          const handled=await fastReview({store:board.store,id,entry,activity:board.activity,model:model.id,generate:async(prompt:string)=>{
            const stream=ctx.modelRegistry.streamSimple(model,{messages:[{role:'user',content:prompt,timestamp:Date.now()}]},{reasoning:'low',maxTokens:3000,signal:AbortSignal.timeout(90000)});
            const result=await stream.result();if(result.stopReason==='error'||result.stopReason==='aborted')throw new Error('Fast model failed. Retry; no larger model was substituted.');
            return JSON.parse(result.content.filter((c:any)=>c.type==='text').map((c:any)=>c.text).join('').replace(/^```(?:json)?\s*|\s*```$/g,''));
          }});
          if(handled)return;entry={...entry,routeOverride:'session'};
        }
        board.activity.start(id,entry);pending.set(entry.id,{id,entry});
        await pi.sendUserMessage(agentRequest(id, entry,await board.store.read(id))+(entry.action==='accept'?' Review URL: '+board.url+'?plan='+id:''), {deliverAs:'followUp',expandPromptTemplates:false});
      } });
    }
    const current = await board.store.current();
    if (current) await board.deliver(current.id);
    return board;
  }
  pi.on('message_start', async (event: any) => {
    if(!board||event.message?.role!=='user')return;
    const content=typeof event.message.content==='string'?event.message.content:JSON.stringify(event.message.content);
    const match=[...pending.values()].find(task=>content.includes(task.entry.id));
    if(!match)return;
    await finishActivity();
    active={...match,reporter:createProgressReporter(board.activity,match.id,match.entry.id)};
    board.activity.update(match.id,match.entry.id,{status:'running',phase:'Reviewing the request'});
  });
  for(const name of ['message_update','tool_execution_start','tool_execution_end'] as const)pi.on(name,async(event:any)=>active?.reporter.event(event));
  async function finishActivity(){
    if(!active||!board)return;const task=active;active=undefined;task.reporter.flush();
    const record=await board.store.read(task.id),question=record.discussions.find((q:any)=>q.id===task.entry.id);
    const failed=task.entry.action==='ask'&&question?.status!=='answered';
    const phase=failed?'The agent finished without a browser reply. Retry the request.':'Finished';
    if(failed)await board.store.deliveryFailed(task.id,task.entry.id,phase);
    if(task.entry.action!=='ask')await board.store.reviewCompleted(task.id,task.entry.id);
    board.activity.update(task.id,task.entry.id,{status:failed?'error':'complete',phase});pending.delete(task.entry.id);
  }
  pi.on('agent_end',finishActivity);
  pi.registerTool({
    name: 'plan_board', label: 'Planning board',
    description: 'Use only after explicit /planboard invocation or for feedback in an already requested review. Never auto-open when a plan is drafted or plan mode starts. Display and revise an existing Markdown development plan from any chosen workflow. Write the .md file first; new saves require markdownPath. The original is read from disk and archived exactly; never fabricate sourceDocument. For new plans use schemaVersion:2, workflow metadata and authored sections containing readable blocks; use catalog with catalogKind:document for the composition contract. Section order and planning methodology belong to the author, not the viewer. Every saved diagram requires authored plain-language walkthroughs with numbered steps linked to real nodes and directed edges; use the document catalog for the contract. Explain unfamiliar terms and separate distinct user journeys. Legacy records remain readable. Legacy schemaVersion:1 plans remain supported. Read the planboard skill. save accepts structured plan data, with the sourceDocument loaded from markdownPath and technologies with rationale, alternatives, dependencies, tradeoffs and validation checks, plus diagrams with typed stable-position nodes, labeled regions, solid/dashed connections and agent-authored focus layers. catalog returns node categories and a compact index; filter with category and/or query for detailed type guidance. Custom domain nodes reuse a built-in baseType. Use catalog before designing maps. Retains history and anchored text/node annotations; updates require id and expectedRevision from read. list/read/inbox retrieve existing work. answer uses id, questionId, answer and optional structured options to reply in the contextual Agent bubble. Requests distinguish ask, change and alternatives; only change requests authorize revising the plan. open starts the browser board on demand; optional openBrowser launches it. patch updates existing text fields by stable path with expectedRevision, preserving all other content. No code execution from plan content, no background model or automatic implementation.',
    parameters: Type.Unsafe<any>(toolSchema),
    async execute(_id, args, _signal, _update, ctx) {
      if (!ctx.isProjectTrusted()) throw new Error('Planning requires a trusted project folder.');
      const store = new PlanStore(ctx.cwd);
      let result;
      if(args.action==='progress'){
        if(typeof args.message!=='string'||!args.message.trim()||args.message.length>2000)throw new Error('Supply a short public progress message, at most 2000 characters.');
        if(active&&active.id!==args.id)throw new Error('Progress belongs to another active plan.');
        if(active)board.activity.update(args.id,active.entry.id,{status:'running',phase:args.message.slice(0,160),text:args.message});
        // An explicit standalone Pi worker emits progress to its parent RPC
        // dispatcher; it must not start a second browser or model service.
        result={status:active?'reported':'emitted'};
      }
      else if (args.action === 'catalog') result = args.catalogKind==='document'?documentCatalog():diagramCatalog({category:args.category,query:args.query});
      else if (args.action === 'save') {
        result = await saveMarkdownPlan(store,args);
        pi.appendEntry('planning-plan', { id: result.id, revision: result.revision, title: result.plan.title });
        result={id:result.id,revision:result.revision,title:result.plan.title,documentStatus:result.document.status,files:result.files};
      } else if(args.action==='patch'){requireMarkdown(await store.read(args.id));const saved=await store.patch(args.id,args.expectedRevision,args.changes,args);result={id:saved.id,revision:saved.revision,changed:args.changes.map(c=>c.path),documentStatus:saved.document.status,files:saved.files};}
      else if(args.action==='undo'){const saved=await store.undo(args.id,args.expectedRevision,args.undoRevision,args);result={id:saved.id,revision:saved.revision,documentStatus:saved.document.status,files:saved.files};}
      else if(args.action==='reconcile'){if(typeof args.reviewedMarkdown!=='string')throw new Error('Supply reconciled reviewedMarkdown.');const saved=await saveMarkdownPlan(store,{...args,plan:(await store.read(args.id)).plan});result={id:saved.id,revision:saved.revision,documentStatus:saved.document.status,files:saved.files};}
      else if (args.action === 'read') result = reviewRead(await store.read(args.id),args.paths);
      else if (args.action === 'list') result = await store.list();
      else if (args.action === 'answer') {const reply=await store.answer(args.id,args.questionId,args.answer,args.options);result={id:args.id,questionId:reply.id,status:reply.status};}
      else if (args.action === 'inbox') {
        if (!args.id) throw new Error('Select a plan ID using list first.');
        const record = await store.read(args.id); result = { id: record.id, revision: record.revision, feedback: record.feedback, submissions: record.submissions || [], discussions: record.discussions || [] };
      } else {
        requireMarkdown(args.id?await store.read(args.id):await store.current());if (args.id) await store.activate(args.id);
        const server = await ensure(ctx); const url = server.url + (args.id ? '?plan=' + args.id : '');
        if (args.openBrowser) openURL(url);
        result = { url, browserLaunchRequested: !!args.openBrowser, note: 'Notes are saved locally. Send annotations to agent submits a batch to this Pi session; approval requires confirmation. Closing Pi stops the server; plans remain on disk.' };
      }
      return { content: [{ type: 'text', text: JSON.stringify(result) }], details: result };
    }
  });
  pi.registerCommand('planboard', { description: 'Review a plan: optional Markdown path or saved ID; otherwise use the conversation draft.', handler: async (args, ctx) => {
    if(!ctx.isProjectTrusted())throw new Error('Planning requires a trusted project folder.');
    const argument=args.trim(),store=new PlanStore(ctx.cwd);
    // Explicit saved IDs retain the quick reopen path; all other inputs go to
    // the owning agent, which can see the current public conversation/plan.
    if(argument&&/^[a-z0-9][a-z0-9_-]{0,79}$/.test(argument)){
      let record;try{record=await store.read(argument);}catch(error){if(error.code!=='ENOENT')throw error;}
      if(record){requireMarkdown(record);await store.activate(record.id);const server=await ensure(ctx);const url=server.url+'?plan='+record.id;openURL(url);ctx.ui.notify(url,'info');return;}
    }
    await pi.sendUserMessage(await planboardCommandRequest(argument),{deliverAs:'followUp',expandPromptTemplates:false});
  } });
  pi.on('session_shutdown', close);
  pi.on('session_start', close);
}
