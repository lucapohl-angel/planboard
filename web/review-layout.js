import {sourceTargets} from './source-links.js';
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
export function reveal(element){if(!element)return;for(let p=element.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;}
export function scrollOpened(element){
 const rect=element.getBoundingClientRect(),footer=document.querySelector('#review-footer'),bottom=Math.min(innerHeight-24,footer?.getBoundingClientRect().top-24||innerHeight-24),available=bottom-90;
 if(rect.bottom<=bottom&&rect.top>=90)return;
 const top=rect.height<available?rect.top+scrollY-(90+(available-rect.height)/2):rect.top+scrollY-90;
 scrollTo({top:Math.max(0,top),behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'});
}
export function setupReviewLayout({onOpen}){
 document.querySelector('#plan').addEventListener('click',event=>{const summary=event.target.closest('summary');if(!summary||summary.parentElement.open||event.defaultPrevented)return;requestAnimationFrame(()=>scrollOpened(summary.parentElement));});
 const sections=[['overview-view','Goal, scope and assumptions'],['technology-view','Choices, tradeoffs and dependencies'],['system-view','Explore the system one map at a time'],['flow-view','Prerequisites, deliverables and checks'],['questions-view','Open decisions and your feedback']];
 for(const[id,description]of sections){const section=document.getElementById(id),heading=section.querySelector('h2'),fold=el('details',undefined,'section-fold'),summary=el('summary'),copy=el('span',undefined,'section-label'),meta=el('span',undefined,'section-count'),body=el('div',undefined,'section-body');summary.dataset.reviewControl='true';copy.append(heading,el('span',description,'muted'));meta.id=id+'-count';summary.append(copy,meta);body.append(...section.childNodes);fold.append(summary,body);fold.open=id==='overview-view';section.append(fold);section.classList.add('review-section');fold.addEventListener('toggle',()=>{if(fold.open)onOpen();});}
 for(const[id,label]of [['context','Facts, assumptions & unknowns'],['quality','Structural checks']]){const target=document.getElementById(id),heading=target.previousElementSibling;const fold=el('details',undefined,'review-fold'),summary=el('summary',label);summary.dataset.reviewControl='true';heading.replaceWith(fold);fold.append(summary,target);}
 const success=document.getElementById('success'),fold=el('details',undefined,'review-fold'),summary=el('summary','Success checks');summary.dataset.reviewControl='true';success.before(fold);fold.append(summary,success);
 return {open(id){const section=document.getElementById(id);if(section)section.querySelector('details').open=true;}};
}
export function renderSource(container,source,{field}){
 container.replaceChildren();container.hidden=!source;if(!source)return;
 const targets=sourceTargets(source).entries;const outer=el('details',undefined,'review-fold'),summary=el('summary',`Original document · ${source.sections.length} parts`);summary.dataset.reviewControl='true';outer.append(summary,el('p','The complete supplied document is preserved below. Displaying it does not verify its claims or mark its checks as passed.','muted'));
 const download=el('button','Download original Markdown');download.type='button';download.onclick=()=>{const url=URL.createObjectURL(new Blob([source.sections.map(s=>s.content).join('')],{type:'text/markdown'})),a=el('a');a.href=url;a.download=source.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};outer.append(download);
 for(const s of source.sections){const d=el('details',undefined,'review-fold source-part'),heading=el('summary'),pre=el('pre',s.content,'source-text');heading.append(field(el('span',s.title),'sourceDocument/sections/'+s.id+'/title'));field(pre,'sourceDocument/sections/'+s.id+'/content');pre.replaceChildren();let offset=0;for(const target of targets.filter(t=>t.sectionId===s.id)){pre.append(s.content.slice(offset,target.start));const anchor=el('span',s.content.slice(target.start,target.end),'source-heading');anchor.id=target.id;anchor.tabIndex=-1;pre.append(anchor);offset=target.end;}pre.append(s.content.slice(offset));d.append(heading,pre);outer.append(d);}container.append(outer);
}
