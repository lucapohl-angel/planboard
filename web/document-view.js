import {renderDiagrams} from './diagrams.js';
import {diagramColors} from './diagram-spec.js';
import {planFields} from './plan-content.js';
const node=(tag,text,cls)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;};
export function renderDocument(root,plan,{field,technologies,decisions}){
 root.replaceChildren();const maps=[],fields=planFields(plan),colors=['green','purple','blue','yellow','pink'];
 for(const [index,s]of plan.sections.entries()){
  const section=node('section',undefined,'document-section review-section');section.dataset.target='section:'+s.id;section.id='document-'+s.id;section.style.setProperty('--section-color',diagramColors[colors[index%colors.length]]);
  const fold=node('details',undefined,'section-fold'),summary=node('summary'),label=node('span',undefined,'section-label'),body=node('div',undefined,'section-body');fold.open=!s.collapsed;summary.dataset.reviewControl='true';label.append(field(node('h2',s.title),'sections/'+s.id+'/title'));summary.append(label);fold.append(summary,body);section.append(fold);root.append(section);
  if(s.summary)body.append(field(node('p',s.summary,'document-prose'),'sections/'+s.id+'/summary'));
  for(const b of s.blocks){
   const base='sections/'+s.id+'/blocks/'+b.id,outer=node(b.collapsed?'details':'div',undefined,b.collapsed?'document-block document-detail':'document-block');outer.dataset.target='block:'+s.id+':'+b.id;
   let content=outer;if(b.collapsed){const summary=node('summary');summary.dataset.reviewControl='true';summary.append(field(node('span',b.title),base+'/title'));content=node('div',undefined,'document-detail-body');outer.append(summary,content);}else if(b.title)outer.append(field(node('h3',b.title),base+'/title'));body.append(outer);
   if(b.type==='text')content.append(field(node('p',b.text,'document-prose'),base+'/text'));
   if(b.type==='field'){
    if(fields.has(b.path))content.append(field(node('p',fields.get(b.path),'document-prose'),b.path));
    else{const ul=node('ul',undefined,'document-list');if(b.path.startsWith('scope/'))ul.dataset.target='scope:'+b.path.split('/')[1];b.path.split('/').reduce((v,k)=>v[k],plan).forEach((value,i)=>ul.append(field(node('li',value),b.path+'/'+i)));content.append(ul);}
   }
   if(b.type==='code'){const pre=node('pre',undefined,'document-code');pre.tabIndex=0;pre.append(field(node('code',b.text),base+'/text'));content.append(pre);}
   if(['list','sequence'].includes(b.type)){const list=node(b.type==='sequence'?'ol':'ul',undefined,b.type==='sequence'?'document-sequence':'document-list');for(const i of b.items){const item=node('li');item.append(field(node('strong',i.label),base+'/items/'+i.id+'/label'));if(i.detail)item.append(field(node('p',i.detail),base+'/items/'+i.id+'/detail'));list.append(item);}content.append(list);}
   if(b.type==='table'){
    const wrap=node('div',undefined,'document-table'),table=node('table'),thead=node('thead'),tr=node('tr'),tbody=node('tbody');wrap.tabIndex=0;wrap.setAttribute('role','region');wrap.setAttribute('aria-label',b.title||s.title+' comparison');
    b.columns.forEach((c,i)=>{const th=field(node('th',c),base+'/columns/'+i);th.scope='col';tr.append(th);});thead.append(tr);
    for(const r of b.rows){const row=node('tr');r.cells.forEach((c,i)=>row.append(field(node('td',c),base+'/rows/'+r.id+'/cells/'+i)));tbody.append(row);}table.append(thead,tbody);wrap.append(table);content.append(wrap);
   }
   if(b.type==='diagrams'){const host=node('div');content.append(host);maps.push(renderDiagrams(host,b.ids.map(id=>plan.diagrams.find(d=>d.id===id)),{field}));}
   if(b.type==='technologies'){const host=node('div',undefined,'document-technologies');content.append(host);technologies(host,b.ids.map(id=>plan.technologies.find(t=>t.id===id)));}
   if(b.type==='decisions'){const host=node('div');content.append(host);decisions(host,b.ids.map(id=>plan.questions.find(q=>q.id===id)));}
   if(b.type==='tasks'){
    for(const id of b.ids){const t=plan.steps.find(t=>t.id===id),task=node('details',undefined,'document-task'),heading=node('summary'),taskBody=node('div',undefined,'document-detail-body');task.dataset.target='step:'+id;heading.dataset.reviewControl='true';heading.append(field(node('span',t.title),'steps/'+id+'/title'),field(node('span',t.status.replaceAll('_',' '),'choice-status document-task-status'),'steps/'+id+'/status'));task.append(heading,taskBody);
     for(const key of ['summary','why','deliverable'])if(t[key])taskBody.append(field(node('p',t[key],'document-prose'),'steps/'+id+'/'+key));
     if(t.dependsOn.length){const deps=node('p','Depends on: ');for(const ref of t.dependsOn){const link=node('button',plan.steps.find(s=>s.id===ref).title);link.type='button';link.dataset.reviewControl='true';link.onclick=()=>{const target=root.querySelector('[data-target="step:'+CSS.escape(ref)+'"]');if(target){for(let p=target;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;target.scrollIntoView({block:'center'});target.querySelector('summary')?.focus({preventScroll:true});}};deps.append(link);}taskBody.append(deps);}
     if(t.acceptance.length){taskBody.append(node('h4','Planned checks'));const ul=node('ul',undefined,'document-list');t.acceptance.forEach((check,i)=>ul.append(field(node('li',check),'steps/'+id+'/acceptance/'+i)));taskBody.append(ul);}content.append(task);
    }
   }
  }
 }
 return {draw(){maps.forEach(m=>m.draw());},dispose(){maps.forEach(m=>m.dispose());},snapshot(){return new Map(maps.flatMap(m=>[...(m.snapshot?.()||[])]));},restore(saved){maps.forEach(m=>m.restore?.(saved));},focus(id,layer,item,walk,step){for(const m of maps){const result=m.focus(id,layer,item,walk,step);if(result)return result;}}};
}
