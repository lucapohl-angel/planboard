import {createHash} from 'node:crypto';

export const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export const fingerprint=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const textFingerprint=value=>createHash('sha256').update(value).digest('hex');
export const planFingerprint=plan=>fingerprint({...plan,sourceDocument:undefined});
const clone=value=>value===undefined?undefined:structuredClone(value);
const keyed=a=>Array.isArray(a)&&a.length>0&&a.every(v=>v&&typeof v==='object'&&typeof(v.id??v.nodeId)==='string');
export function differences(before,after,path=''){
 if(same(before,after))return [];
 if(path==='sourceDocument')return [];
 if(keyed(before)&&keyed(after)&&same(before.map(v=>v.id??v.nodeId),after.map(v=>v.id??v.nodeId)))return before.flatMap((v,i)=>differences(v,after[i],path+'/'+(v.id??v.nodeId)));
 if(Array.isArray(before)&&Array.isArray(after)&&before.length===after.length&&!keyed(before)&&!keyed(after))return before.flatMap((v,i)=>differences(v,after[i],path+'/'+i));
 if(before&&after&&!Array.isArray(before)&&!Array.isArray(after)&&typeof before==='object'&&typeof after==='object')return [...new Set([...Object.keys(before),...Object.keys(after)])].flatMap(k=>differences(before[k],after[k],path?path+'/'+k:k));
 return [{path,before:clone(before),value:clone(after),...(before===undefined?{absentBefore:true}:{}),...(after===undefined?{remove:true}:{})}];
}
export function location(plan,path){
 const parts=typeof path==='string'?path.split('/'):[];
 if(!parts.length||parts.some(k=>!k||['__proto__','prototype','constructor'].includes(k))||parts[0]==='sourceDocument')throw new Error('Invalid editable plan path.');
 let parent=plan;
 for(let i=0;i<parts.length;i++){
  if(!parent||typeof parent!=='object')throw new Error('Unknown plan path: '+path);
  const part=parts[i],key=Array.isArray(parent)?(keyed(parent)?parent.findIndex(v=>(v.id??v.nodeId)===part):/^\d+$/.test(part)?Number(part):-1):part;
  if(key===-1||Array.isArray(parent)&&key>=parent.length)throw new Error('Unknown plan path: '+path);
  if(i===parts.length-1)return {parent,key,value:Object.hasOwn(parent,key)?parent[key]:undefined};
  parent=Object.hasOwn(parent,key)?parent[key]:undefined;
 }
}
export function applyOperations(plan,operations,{reverse=false}={}){
 if(!Array.isArray(operations)||!operations.length||operations.length>250)throw new Error('Supply 1–250 bounded plan changes.');
 const result=structuredClone(plan),paths=operations.map(o=>o.path);
 if(paths.some((p,i)=>paths.some((other,j)=>i!==j&&(p===other||p.startsWith(other+'/')))))throw new Error('Overlapping changes must be combined.');
 for(const op of operations){
  const {parent,key,value}=location(result,op.path),expected=reverse?(op.remove?undefined:op.value):(op.absentBefore?undefined:op.before);
  if(!same(value,expected))throw Object.assign(new Error('This part changed since the operation was prepared: '+op.path),{status:409});
  const remove=reverse?op.absentBefore:op.remove,next=reverse?op.before:op.value;
  if(remove){if(Array.isArray(parent))throw new Error('Replace an array to change its membership.');delete parent[key];}
  else parent[key]=clone(next);
 }
 return result;
}

// Deliberately conservative: unclear intent and architecture stay with the owner.
export function requestRoute(entry){
 if(entry.action==='accept')return {tier:'handoff',reason:'Ask the owner about implementation; never implement automatically.'};
 const q=(entry.question||'').toLowerCase();
 if(entry.intent==='change'&&/sessions|auth|security|permission/i.test(JSON.stringify(entry.annotation||{})))return {tier:'session',reason:'Security-sensitive wording needs the owning session model.'};
 if(entry.intent==='alternatives'||entry.action!=='ask'||/architect|security|auth|migration|replace|database|provider|trade.?off|compare|research|design|implement|reconcile|safe|recommend|should|best|better|choose/.test(q))return {tier:'session',reason:'Decision, research or structural work uses the owning session model.'};
 if(entry.intent==='ask'||entry.intent==='change'&&/^(fix (the )?(typo|spelling|grammar)|shorten|rephrase|simplify (the )?(wording|text))\b/.test(q))return {tier:'fast',model:'gpt-6-luna',reason:'Bounded explanation or wording task; require a configured fast model.'};
 return {tier:'session',reason:'Unclear or structural changes need the owning session model.'};
}
export function chooseFastModel(models,preferred){
 const available=models||[];
 const quick=m=>/(?:^|[\/-])gpt-6-luna(?:$|-)|flash|haiku|(?:^|[-/])mini(?:$|-)|(?:^|[-/])nano(?:$|-)/i.test(m.id);
 const matches=available.filter(quick);
 if(preferred){const found=matches.find(m=>m.id===preferred||m.provider+'/'+m.id===preferred);if(!found)throw new Error('Configured fast model is unavailable or is not a fast-family model.');return found;}
 const model=matches.find(m=>m.id==='gpt-6-luna')||matches.find(m=>/flash/i.test(m.id))||matches[0];
 if(!model)throw new Error('No fast model is available. Configure Luna or a Flash/Haiku/mini model; this quick task will not silently use the expensive session model.');
 return model;
}
