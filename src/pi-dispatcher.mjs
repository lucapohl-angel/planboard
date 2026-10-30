import {explanationRules} from './explanation-contract.mjs';
import {createPiWorker} from './pi-rpc.mjs';
import {createActivityHub,createProgressReporter} from './activity.mjs';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {PlanStore} from './plans.mjs';
import {agentRequest} from './agent-request.mjs';
import {requestRoute} from './plan-operations.mjs';

export const reviewSystemPrompt='You serve the planning review browser. Use only plan_board. Do not open another board or implement project code. Use supplied context, reading more only when needed. Process exactly the requested discussion or submission, and save discussion replies with action=answer. Annotation batches have no discussion questionId: finish them after saving the revision, with a short final message. Preserve the plan workflow, constraints and authored section structure; do not impose a different methodology. Reconcile any earlier partial attempt before applying changes.'+' ' + explanationRules;

// A standalone board uses the installed Pi login/model only when the user sends
// a request. One task runs at a time; the agent can access only plan_board.
export function createPiDispatcher({cwd,command='pi',spawnProcess=spawn,timeoutMs=240000,activity=createActivityHub()}={}) {
  const store=new PlanStore(cwd),jobs=new Map();let tail=Promise.resolve(),closed=false;
  const args=['--mode','rpc','--no-session','--no-extensions','--extension',fileURLToPath(new URL('./extension.ts',import.meta.url)),
    '--tools','plan_board','--no-mcp','--no-skills','--skill',fileURLToPath(new URL('../skills/planboard',import.meta.url)),
    '--no-prompt-templates','--approve','--append-system-prompt',
    reviewSystemPrompt];
  const worker=createPiWorker({cwd,args,command,spawnProcess,timeoutMs});
  async function run(id,entry){const reporter=createProgressReporter(activity,id,entry.id);try{const record=await store.read(id);await worker.run(agentRequest(id,entry,record),event=>reporter.event(event),requestRoute(entry));}finally{reporter.flush();}}
  async function dispatch(id,entry){
    if(closed)throw new Error('Planning agent has stopped.');
    const key=id+':'+entry.id;if(jobs.has(key))return;
    // Delivery is already persisted by the server. Keep model work off the
    // HTTP request path so the browser can show progress immediately.
    activity.start(id,entry);
    const job=tail.then(()=>new Promise(resolve=>setImmediate(resolve))).then(async()=>{
      if(closed)throw new Error('Planning agent stopped. Your request is saved; retry after reopening.');
      activity.update(id,entry.id,{status:'running',phase:'Reviewing the request'});
      await run(id,entry);
      if(entry.action==='ask'){
        const record=await store.read(id);
        if(record.discussions.find(q=>q.id===entry.id)?.status!=='answered')throw new Error('Pi finished without saving a browser reply. Your request is saved; retry.');
      }
      else await store.reviewCompleted(id,entry.id);
      activity.update(id,entry.id,{status:'complete',phase:'Finished'});
    }).catch(async error=>{await store.deliveryFailed(id,entry.id,error.message);activity.update(id,entry.id,{status:'error',phase:error.message});}).finally(()=>jobs.delete(key));
    jobs.set(key,job);tail=job.catch(()=>{});
  }
  return {activity,dispatch,warm:()=>worker.warm(),async idle(){await tail;},async close(){closed=true;worker.close();await tail;}};
}
