import {textDiff,addedRanges} from '../web/text-diff.js';
import {planFields} from '../web/plan-content.js';

export function reverseMarkdown(current,before,after){
  if(current===after)return before;
  const parts=textDiff(before,after,{lines:true}),edits=[];
  for(let i=0;i<parts.length;i++){
    if(parts[i].kind==='same')continue;
    const left=parts[i-1]?.kind==='same'?parts[i-1].text.slice(-120):'';
    let old='',next='';
    while(i<parts.length&&parts[i].kind!=='same'){if(parts[i].kind==='removed')old+=parts[i].text;else next+=parts[i].text;i++;}
    const right=parts[i]?.kind==='same'?parts[i].text.slice(0,120):'';
    // Keep context for insertions/deletions and duplicate passages. Ambiguity is
    // a conflict, not permission to guess or restore a whole old document.
    let find=next,replace=old;
    if(!find||current.split(find).length!==2){find=left+next+right;replace=left+old+right;}
    if(!find||current.split(find).length!==2)throw Object.assign(new Error('The Markdown for this change was edited later or is ambiguous. Review the conflicting text before reverting.'),{status:409});
    edits.push({find,replace});i--;
  }
  for(const edit of edits){if(current.split(edit.find).length!==2)throw Object.assign(new Error('Overlapping Markdown changes cannot be reverted automatically.'),{status:409});current=current.replace(edit.find,()=>edit.replace);}
  return current;
}

export function changedFields(before,after){
  const a=planFields(before),b=planFields(after),fields=[];
  for(const field of new Set([...a.keys(),...b.keys()])){
    if(field.startsWith('sourceDocument/')||/(^|\/)(id|nodeId)$/.test(field))continue;
    const old=a.get(field),value=b.get(field);if(old===value)continue;
    fields.push({path:field,before:old??'',value:value??'',removed:value===undefined,added:old===undefined,ranges:addedRanges(old??'',value??'')});
  }
  return fields;
}
