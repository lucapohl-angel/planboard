import {planFields,planTargets} from '../web/plan-content.js';
import {planFingerprint,same} from './plan-operations.mjs';
const wording=s=>s.trim().toLowerCase().replace(/\s+/g,' ');
export function localAction(record,entry){
 if(entry.action!=='ask')return null;
 if(entry.selection){const offered=record.discussions.find(q=>q.id===entry.selection.questionId),option=offered?.options?.find(o=>o.id===entry.selection.optionId);if(option?.prepared)return {kind:'alternative'};}
 const q=wording(entry.question),operation=entry.operation;
 if(operation&&!['explanation','dependencies','undo'].includes(operation.kind))throw new Error('Unknown quick action.');
 if(entry.intent==='change'){
  if(operation?.kind==='undo'||/^undo (the )?(last change|revision \d+)[.!]?$/.test(q))return {kind:'undo',revision:operation?.revision??Number(q.match(/revision (\d+)/)?.[1]||record.revision)};
  const exact=entry.question.match(/^replace "([^"\n]+)" with "([^"\n]*)"[.!]?$/i),path=entry.annotation.field;
  if(exact&&path){const value=planFields(record.plan).get(path);if(value?.split(exact[1]).length===2)return {kind:'replace',path,value:value.replace(exact[1],()=>exact[2])};}
  return null;
 }
 if(entry.intent!=='ask')return null;
 const cached=record.discussions.findLast(q=>q.id!==entry.id&&q.intent==='ask'&&q.status==='answered'&&q.contextHash===planFingerprint(record.plan)&&same(q.annotation,entry.annotation)&&wording(q.question)===wording(entry.question)&&!q.options?.length);
 if(cached)return {kind:'answer',answer:cached.answer,via:'cached answer'};
 if(operation?.kind==='explanation'||q==='show saved explanation'||q==='what does this node say?'){
  const a=entry.annotation,p=record.plan;
  if(a.kind==='area')return {kind:'answer',answer:a.items.map(i=>savedExplanation(p,i)).filter(Boolean).join('\n\n')||'No saved explanation exists for this selection.',via:'saved explanation'};
  return {kind:'answer',answer:savedExplanation(p,a)||'No saved explanation exists for this selection. Ask a specific question for a new explanation.',via:'saved explanation'};
 }
 if(operation?.kind==='dependencies'||/^what depends on this\??$/.test(q)){
  const a=entry.annotation,p=record.plan,kind=a.field?.split('/')[0]||(a.elementId?.startsWith('technology:')?'technologies':'steps'),id=a.nodeId||a.field?.split('/')[1]||a.elementId?.split(':')[1],items=p[kind]||[];
  const dependencies=items.filter(x=>x.dependsOn?.includes(id)).map(x=>x.name||x.title||x.id);
  const diagram=p.diagrams.find(d=>d.id===a.diagramId),edges=diagram?.layers.find(l=>l.id===a.layerId)?.edges.filter(e=>e.from===a.nodeId)||[];
  return {kind:'answer',answer:[dependencies.length?'Explicit dependents: '+dependencies.join(', ')+'.':'No dependent tasks or technologies are explicitly recorded for this selection.',edges.length?'Outgoing connections: '+edges.map(e=>(diagram.nodes.find(n=>n.id===e.to)?.label||e.to)+' ('+e.label+')').join('; ')+'. Connections do not necessarily mean implementation dependencies.':''].filter(Boolean).join('\n\n'),via:'dependency lookup'};
 }
 return null;
}
function savedExplanation(p,a){
 if(a.kind==='node'){const d=p.diagrams.find(d=>d.id===a.diagramId),n=d?.layers.find(l=>l.id===a.layerId)?.nodes.find(n=>n.nodeId===a.nodeId);return n?.detail||n?.summary;}
 if(a.field)return planFields(p).get(a.field);
 const [kind,id]=a.elementId?.split(':')||[];const item=kind==='technology'?p.technologies.find(t=>t.id===id):kind==='step'?p.steps.find(t=>t.id===id):null;if(item)return [item.role||item.summary,item.rationale||item.why,item.deliverable].filter(Boolean).join('\n\n');
 return planTargets(p).get(a.elementId);
}
export async function executeLocal(store,id,entry,action){
 if(action.kind==='answer')return store.answer(id,entry.id,action.answer.length>19500?action.answer.slice(0,19500)+'\n\nSelection truncated; choose fewer items for the full saved explanation.':action.answer);
 const current=await store.read(id);
 if(current.revision!==entry.revision)throw Object.assign(new Error('The plan changed. Resubmit against the current revision.'),{status:409});
 if(action.kind==='alternative')return store.applyPrepared(id,current.revision,entry.id);
 if(action.kind==='undo')return store.undo(id,current.revision,action.revision,{questionId:entry.id,answer:'Undid the changes from revision '+action.revision+'.'});
 if(action.kind==='replace')return store.patch(id,current.revision,[{path:action.path,value:action.value}],{questionId:entry.id,answer:'Replaced the selected text.'});
 throw new Error('Unknown local operation.');
}
