import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {chooseFastModel} from './plan-operations.mjs';
// Keep Pi loaded between requests, but reset its conversation so contexts cannot
// bleed between plans. Only public events reach the activity reporter.
export function createPiWorker({cwd,args,command='pi',spawnProcess=spawn,timeoutMs=240000}){
 let child,ready,buffer='',active,closed=false,ownerState;const commands=new Map();
 function stop(error=new Error('Pi stopped. Retry the request.')){const c=child;child=null;ready=null;buffer='';for(const task of commands.values()){clearTimeout(task.timer);task.reject(error);}commands.clear();active?.reject(error);active=null;if(c){c.stdin?.end();try{process.kill(-c.pid,'SIGTERM');}catch{c.kill?.('SIGTERM');}}}
 function commandRequest(type,extra={}){return new Promise((resolve,reject)=>{const id=randomUUID(),timer=setTimeout(()=>{commands.delete(id);reject(new Error('Pi did not acknowledge the request. Retry.'));},15000);commands.set(id,{resolve,reject,timer});child.stdin.write(JSON.stringify({id,type,...extra})+'\n');});}
 function ensure(){if(closed)throw new Error('Planning agent has stopped.');if(ready)return ready;
  child=spawnProcess(command,args,{cwd,stdio:['pipe','pipe','ignore'],detached:true});const spawned=child;
  spawned.stdout.setEncoding?.('utf8');spawned.stdout.on('data',chunk=>{buffer+=chunk;let end;while((end=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,end);buffer=buffer.slice(end+1);if(line.length>4000000)continue;let event;try{event=JSON.parse(line);}catch{continue;}
    if(event.type==='response'){const task=commands.get(event.id);if(task){commands.delete(event.id);clearTimeout(task.timer);event.success?task.resolve(event.data):task.reject(new Error('Pi rejected '+event.command+'. Check Pi sign-in or retry.'));}}
    else if(event.type==='agent_settled'&&active){const current=active;active=null;current.resolve();}
    else active?.onEvent(event);
  }});
  spawned.once('error',()=>{if(child===spawned)stop(new Error('Could not start Pi. Check the installation, then retry.'));});spawned.once('exit',()=>{if(child===spawned)stop(new Error('Pi exited before finishing. Check Pi sign-in, then retry.'));});
  ready=commandRequest('get_state').then(state=>{ownerState=state;return state;}).catch(error=>{stop(error);throw error;});return ready;
 }
 return {warm:ensure,async run(message,onEvent,route={tier:'session'}){await ensure();const reset=await commandRequest('new_session');if(reset?.cancelled)throw new Error('Pi cancelled the fresh request. Retry.');
    if(route.tier==='fast'){
      const available=await commandRequest('get_available_models'),model=chooseFastModel(available?.models,process.env.PLANBOARD_FAST_MODEL);
      await commandRequest('set_model',{provider:model.provider,modelId:model.id});await commandRequest('set_thinking_level',{level:'low'});onEvent({type:'planboard_model',model:model.id});
    }else if(ownerState?.model){await commandRequest('set_model',{provider:ownerState.model.provider,modelId:ownerState.model.id});if(ownerState.thinkingLevel)await commandRequest('set_thinking_level',{level:ownerState.thinkingLevel});onEvent({type:'planboard_model',model:ownerState.model.id});}
    return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>stop(new Error('Pi took too long. Your request is saved; retry when ready.')),timeoutMs);
    active={onEvent,resolve:()=>{clearTimeout(timer);resolve();},reject:error=>{clearTimeout(timer);reject(error);}};
    commandRequest('prompt',{message}).then(data=>{if(data?.disposition==='handled'&&active){const current=active;active=null;current.resolve();}}).catch(error=>stop(error));
  });},close(){closed=true;stop();}};
}
