import {textFingerprint,planFingerprint,differences} from './plan-operations.mjs';

export function sourceText(plan){return plan.sourceDocument?.sections.map(s=>s.content).join('')||'';}
export function replaceExact(content,edits){
 if(!Array.isArray(edits)||edits.length>80)throw new Error('Supply at most 80 Markdown replacements.');
 for(const edit of edits){
  if(typeof edit.find!=='string'||!edit.find||typeof edit.replace!=='string'||content.split(edit.find).length!==2)throw new Error('Markdown replacement must match exactly once. Supply a larger unique passage.');
  content=content.replace(edit.find,()=>edit.replace);
  if(content.length>400000)throw new Error('Reviewed Markdown is too large.');
 }
 return content;
}
export function reviewedDocument(plan,previous,options,render){
 const hash=planFingerprint(plan),old=previous?.document;
 if(options.reviewedMarkdown!==undefined){
  const content=options.reviewedMarkdown;
  if(typeof content!=='string'||!content.trim()||content.length>400000)throw new Error('Reviewed Markdown must contain 1–400000 characters.');
  return {content,planHash:hash,sha256:textFingerprint(content),status:'synced',method:'authored-reconciliation',pending:[]};
 }
 if(!plan.sourceDocument){const content=render(plan);return {content,planHash:hash,sha256:textFingerprint(content),status:'synced',method:'generated',pending:[]};}
 let content=old?.content??sourceText(plan),pending=[...(old?.pending||[])];
 if(previous&&!old&&previous.revision>1)pending.push('Legacy review needs reconciliation with the original detailed Markdown.');
 const changes=previous?differences(previous.plan,plan):[];
 if(options.sourceEdits?.length){
  content=replaceExact(content,options.sourceEdits);
  // An explicit source edit is an author assertion that this transaction's
  // plan changes are reconciled. Earlier unresolved changes remain unresolved.
 }else for(const op of changes){
  if(typeof op.before==='string'&&op.before&&typeof op.value==='string'&&content.split(op.before).length===2)content=content.replace(op.before,()=>op.value);
  else pending.push(op.path);
 }
 if(previous&&!old&&previous.revision===1&&!changes.length)pending=[];
 return {content,planHash:hash,sha256:textFingerprint(content),status:pending.length?'needs-reconciliation':'synced',method:options.sourceEdits?.length?'source-edits':'exact-matches',pending:[...new Set(pending)].slice(0,250)};
}
