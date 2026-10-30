// Focused reads keep the archived source and historical discussions off the
// model's context unless explicitly requested. Storage remains unchanged.
export function reviewRead(record,paths){
 if(paths===undefined)return record;
 if(!Array.isArray(paths)||!paths.length||paths.length>32)throw new Error('paths must contain 1–32 plan paths.');
 const parts={};
 for(const path of paths){
  if(typeof path!=='string'||path.length>1000)throw new Error('Invalid plan path.');
  if(path==='document'){parts.document=record.document||{status:'needs-reconciliation',content:record.plan.sourceDocument?.sections.map(s=>s.content).join('')||''};continue;}
  if(path==='files'){parts.files=record.files;continue;}
  if(path==='plan'){const {sourceDocument,...plan}=record.plan;parts.plan=plan;continue;}
  let value=record.plan;
  for(const key of path.split('/')){
   if(!key||['__proto__','prototype','constructor'].includes(key))throw new Error('Invalid plan path.');
   value=Array.isArray(value)?value.find(v=>v?.id===key||v?.nodeId===key)??(/^\d+$/.test(key)?value[Number(key)]:undefined):value&&Object.hasOwn(value,key)?value[key]:undefined;
   if(value===undefined)throw new Error('Unknown plan path: '+path);
  }
  parts[path]=value;
 }
 return {id:record.id,revision:record.revision,parts,sourcePreserved:true};
}
