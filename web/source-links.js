// Source-only indexing: links are created only for actual Markdown headings.
export function markdownHeadings(text){
 const result=[];let offset=0,fence=null,previous=null;
 for(const line of text.match(/[^\n]*\n|[^\n]+$/g)||[]){
  const raw=line.replace(/\r?\n$/,''),marker=raw.match(/^ {0,3}(`{3,}|~{3,})/);
  if(marker){if(!fence)fence=marker[1];else if(marker[1][0]===fence[0]&&marker[1].length>=fence.length&&!raw.slice(marker[0].length).trim())fence=null;previous=null;offset+=line.length;continue;}
  if(!fence){
   const atx=raw.match(/^ {0,3}(#{1,6})[ \t]+(.+?)(?:[ \t]+#+[ \t]*)?$/),setext=previous&&raw.match(/^ {0,3}(=+|-+)[ \t]*$/);
   if(atx)result.push({start:offset,end:offset+raw.length,title:atx[2],level:atx[1].length});
   else if(setext)result.push({start:previous.start,end:offset+raw.length,title:previous.text.trim(),level:setext[1][0]==='='?1:2});
   previous=raw.trim()&&!/^ {4}|^\t/.test(raw)?{start:offset,text:raw}:null;
  }
  offset+=line.length;
 }
 return result;
}
const plain=text=>text.replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/[`*_]/g,'').trim();
export function sourceTargets(source){
 const entries=[];
 for(const section of source?.sections||[]){
  const headings=markdownHeadings(section.content);
  for(const h of headings){
   const title=plain(h.title),code=title.match(/^(?:(?:phase|stage|step|wave|task|milestone|work packet)\s+)?([A-Z]{1,5}[-.]?\d+(?:[.-]\d+)*)(?=[\s.:)–—-]|$)/i)?.[1];
   const readable=code?title.slice(title.indexOf(code)+code.length).replace(/^[\s.:)–—-]+/,''):'';
   entries.push({...h,title,sectionId:section.id,id:'source-heading-'+section.id+'-'+h.start,aliases:[title,...(code?[code]:[]),...(readable.length>=3?[readable]:[])]});
  }
 }
 // Ambiguous shorthand is left as plain text, never sent to an arbitrary section.
 const aliases=new Map();for(const e of entries)for(const alias of new Set(e.aliases)){const key=alias.toLocaleLowerCase();aliases.set(key,aliases.has(key)&&aliases.get(key)!==e?null:e);}
 return {entries,aliases};
}
export function setupSourceLinks(root){
 let targets=sourceTargets(null),frame;
 const observer=new MutationObserver(()=>schedule());
 const observe=()=>observer.observe(root,{subtree:true,childList:true,characterData:true});
 function decorate(){
  observer.disconnect();
  const aliases=[...targets.aliases].filter(([key,value])=>value&&key.length>=2).sort((a,b)=>b[0].length-a[0].length);
  if(aliases.length){
   const escaped=aliases.map(([key])=>key.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
   const pattern=new RegExp('(?<![\\p{L}\\p{N}_])(?:'+escaped.join('|')+')(?![\\p{L}\\p{N}_])','giu');
   // A summary is already an interactive control. Put its source links in the
   // expanded content instead of nesting a link inside the disclosure button.
   for(const summary of root.querySelectorAll('summary')){
    const fields=[...summary.querySelectorAll('[data-field]')].filter(n=>!n.dataset.field.startsWith('sourceDocument/'));
    const matches=fields.flatMap(n=>[...n.textContent.matchAll(pattern)]),references=new Map(matches.map(m=>[targets.aliases.get(m[0].toLocaleLowerCase())?.id,m[0]]).filter(([id])=>id));
    const existing=summary.parentElement.querySelector(':scope>.source-related');
    if(!references.size){existing?.remove();continue;}
    const signature=JSON.stringify([...references]);if(existing?.dataset.references===signature)continue;
    const related=document.createElement('p');related.className='source-related';related.dataset.reviewControl='true';related.dataset.references=signature;related.append('Original Markdown: ');
    for(const [id,label]of references){const a=document.createElement('a');a.className='source-reference';a.href='#'+id;a.dataset.sourceReference=id;a.textContent=label;if(related.childElementCount)related.append(' · ');related.append(a);}
    if(existing)existing.replaceWith(related);else summary.after(related);
   }
   for(const field of root.querySelectorAll('[data-field]')){
    if(field.dataset.field.startsWith('sourceDocument/'))continue;
    const walker=document.createTreeWalker(field,NodeFilter.SHOW_TEXT),nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
    for(const text of nodes){
     if(text.parentElement.closest('a,button,summary,pre,code,textarea,input,[contenteditable]'))continue;
     const matches=[...text.data.matchAll(pattern)];if(!matches.length)continue;
     const fragment=document.createDocumentFragment();let end=0;
     for(const match of matches){const target=targets.aliases.get(match[0].toLocaleLowerCase());if(!target)continue;fragment.append(text.data.slice(end,match.index));const a=document.createElement('a');a.className='source-reference';a.href='#'+target.id;a.dataset.sourceReference=target.id;a.textContent=match[0];a.title='Read in original Markdown: '+target.title;fragment.append(a);end=match.index+match[0].length;}
     fragment.append(text.data.slice(end));text.replaceWith(fragment);
    }
   }
  }
  observe();
 }
 function schedule(){cancelAnimationFrame(frame);frame=requestAnimationFrame(decorate);}
 function jump(id){const target=document.getElementById(id);if(!target)return;for(let parent=target.parentElement;parent;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;target.focus({preventScroll:true});target.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'});}
 root.addEventListener('click',event=>{const a=event.target.closest('a[data-source-reference]');if(!a||event.defaultPrevented||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();event.stopPropagation();history.pushState(null,'','#'+a.dataset.sourceReference);jump(a.dataset.sourceReference);});
 window.addEventListener('hashchange',()=>jump(location.hash.slice(1)));
 observe();
 return {setSource(source){targets=sourceTargets(source);schedule();if(location.hash.startsWith('#source-heading-'))requestAnimationFrame(()=>jump(location.hash.slice(1)));}};
}
