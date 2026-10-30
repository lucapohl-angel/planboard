// Public progress only. Never forward thinking deltas, raw tool arguments/results,
// credentials, or the model's private reasoning to the browser.
export function createActivityHub(){
  const plans=new Map(),listeners=new Map();
  const snapshot=id=>[...(plans.get(id)?.values()||[])];
  function update(planId,id,patch){
    if(!plans.has(planId))plans.set(planId,new Map());const tasks=plans.get(planId);
    const now=Date.now(),previous=tasks.get(id)||{id,startedAt:now,text:'',events:[]};
    const {event,...fields}=patch,events=[...(previous.events||[])];
    if(event){
      const index=event.id?events.findIndex(e=>e.id===event.id):-1;
      const clean={id:String(event.id||now),kind:event.kind==='tool'?'tool':'progress',label:String(event.label||'Working').slice(0,160),status:['running','complete','error'].includes(event.status)?event.status:'complete'};
      if(index>=0)events[index]={...events[index],...clean,endedAt:clean.status==='running'?undefined:now};
      else events.push({...clean,at:now});
    }else if(patch.phase&&patch.phase!==previous.phase){events.push({id:'phase-'+now+'-'+events.length,kind:'progress',label:patch.phase,at:now,status:'complete'});}
    const next={...previous,...fields,events:events.slice(-60),updatedAt:now};
    if(patch.status==='running'&&!previous.runningAt)next.runningAt=now;
    if(['complete','error'].includes(patch.status)){
      next.completedAt=now;
      next.events=next.events.map(e=>e.status==='running'?{...e,status:'error',endedAt:now,label:e.label+' (ended without a result)'}:e);
    }
    tasks.set(id,next);
    if(tasks.size>40)for(const [key,t]of tasks){if(['complete','error'].includes(t.status)){tasks.delete(key);break;}}
    for(const fn of listeners.get(planId)||[])fn(snapshot(planId));
  }
  return {snapshot,update,start(planId,entry){update(planId,entry.id,{intent:entry.intent||entry.action,status:'queued',phase:'Waiting for the agent',text:'',startedAt:Date.parse(entry.createdAt)||Date.now()});},subscribe(id,fn){if(!listeners.has(id))listeners.set(id,new Set());listeners.get(id).add(fn);fn(snapshot(id));return()=>listeners.get(id)?.delete(fn);}};
}
const phases={read:'Reading the plan',inbox:'Reading your feedback',catalog:'Checking available plan components',patch:'Updating the selected text',save:'Saving the plan changes',answer:'Writing the reply'};
export function publicProgress(event){
  if(event.type==='tool_execution_start'&&event.toolName==='plan_board')return event.args?.action==='progress'?{phase:'Progress update',text:String(event.args.message||'').slice(0,2000)}:{phase:phases[event.args?.action]||'Working on the plan'};
  if(event.type!=='message_update')return null;
  const update=event.assistantMessageEvent;if(!update||typeof update.type!=='string'||update.type.startsWith('thinking'))return null;
  if(update.type==='text_delta')return {textDelta:update.delta||'',phase:'Writing a response'};
  if(['toolcall_start','toolcall_delta','toolcall_end'].includes(update.type)){
    const call=update.partial?.content?.[update.contentIndex]||update.toolCall;
    if(call?.type!=='toolCall'||call.name!=='plan_board')return null;
    const args=call.arguments||{},patch={phase:args.action==='save'?'Preparing the plan changes':phases[args.action]||'Reviewing the selected content'};
    if(args.action==='answer'&&typeof args.answer==='string')patch.text=args.answer.slice(0,20000);
    return patch;
  }
  return null;
}
export function createProgressReporter(activity,planId,entryId){
  let text='',pending={},timer;const edits=new Set(),tools=new Map();
  const flush=()=>{clearTimeout(timer);timer=undefined;if(Object.keys(pending).length){activity.update(planId,entryId,pending);pending={};}};
  return {event(event){
    if(event.type==='planboard_model'){activity.update(planId,entryId,{model:event.model,phase:'Using '+event.model});return;}
    // Only tool identity and lifecycle are public; never arguments or results.
    if(event.type==='tool_execution_start'){
      const name=typeof event.toolName==='string'&&/^[\w.:-]{1,100}$/.test(event.toolName)?event.toolName:'Tool';
      const id=event.toolCallId||'tool-'+Date.now();tools.set(id,name);
      activity.update(planId,entryId,{status:'running',phase:phases[event.args?.action]&&name==='plan_board'?phases[event.args.action]:'Running '+name,event:{id,kind:'tool',label:name==='plan_board'?'plan_board · '+(phases[event.args?.action]||'Review'):name,status:'running'}});
    }
    if(event.type==='tool_execution_end'&&tools.has(event.toolCallId)){
      const name=tools.get(event.toolCallId);tools.delete(event.toolCallId);
      activity.update(planId,entryId,{status:'running',phase:event.isError?'Tool failed; awaiting next step':'Tool finished; preparing next step',event:{id:event.toolCallId,kind:'tool',label:name,status:event.isError?'error':'complete'}});
    }
    if(event.type==='tool_execution_start'&&event.toolName==='plan_board'&&['patch','save'].includes(event.args?.action)){
      edits.add(event.toolCallId);const paths=event.args.action==='patch'?(event.args.changes||[]).map(c=>c.path).filter(p=>typeof p==='string'&&p.length<1000&&!p.startsWith('sourceDocument/')).slice(0,40):[];
      pending={...pending,status:'running',phase:phases[event.args.action],editPaths:paths,editId:event.toolCallId,editing:true};flush();return;
    }
    if(event.type==='tool_execution_end'&&edits.has(event.toolCallId)){
      edits.delete(event.toolCallId);const result=event.result?.details;
      // Only the revision signal crosses the boundary, never raw tool results.
      if(!event.isError&&result?.id===planId&&Number.isInteger(result.revision)){pending={...pending,status:'running',savedRevision:result.revision,editing:false,phase:'Changes saved'};flush();}return;
    }
    const patch=publicProgress(event);if(!patch)return;if(patch.textDelta!==undefined){text=(text+patch.textDelta).slice(0,20000);delete patch.textDelta;patch.text=text;}else if(patch.text!==undefined)text=patch.text;pending={...pending,...patch,status:'running'};if(!timer)timer=setTimeout(flush,100);},flush};
}
