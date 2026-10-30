import {planFields} from './plan-content.js';
const intersects=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
function visibleRect(el){
  if(!el.checkVisibility({checkVisibilityCSS:true}))return null;
  let r=el.getBoundingClientRect();
  for(let p=el.parentElement;p;p=p.parentElement){
    const style=getComputedStyle(p);
    if(/hidden|clip|auto|scroll/.test(style.overflowX+' '+style.overflowY)){
      const c=p.getBoundingClientRect();r={left:Math.max(r.left,c.left),right:Math.min(r.right,c.right),top:Math.max(r.top,c.top),bottom:Math.min(r.bottom,c.bottom)};
    }
  }
  return r.right>r.left&&r.bottom>r.top?r:null;
}
export function collectArea(root,plan,box){
  const fields=planFields(plan),items=[],seen=new Set();
  for(const el of root.querySelectorAll('[data-field],[data-node],[data-step]')){
    const rect=visibleRect(el);if(!rect||!intersects(rect,box))continue;
    if(el.dataset.node){
      const d=el.closest('[data-diagram]');if(!d)continue;
      const item={kind:'node',diagramId:d.dataset.diagram,nodeId:el.dataset.node,layerId:el.dataset.annotationLayer||d.dataset.activeLayer};
      item.quote=plan.diagrams.find(x=>x.id===item.diagramId)?.nodes.find(x=>x.id===item.nodeId)?.label;
      const key=JSON.stringify(item);if(item.quote&&!seen.has(key)){items.push(item);seen.add(key);}continue;
    }
    // Work packets are selectable as whole items, even when rendered as buttons.
    const field=el.dataset.field||(el.dataset.step?'steps/'+el.dataset.step+'/title':null),source=fields.get(field);
    if(!source||el.closest('[data-node]'))continue;
    if(el.dataset.step&&!el.dataset.field){if(!seen.has(field)){items.push({kind:'element',elementId:'step:'+el.dataset.step,quote:source});seen.add(field);}continue;}
    if(el.textContent!==source)continue;
    const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let offset=0,text;const runs=[];
    while((text=walker.nextNode())){
      for(const match of text.data.matchAll(/\S+/g)){
        const range=document.createRange();range.setStart(text,match.index);range.setEnd(text,match.index+match[0].length);
        if([...range.getClientRects()].some(r=>intersects(r,box)&&intersects(r,rect))){const start=offset+match.index,end=start+match[0].length,previous=runs.at(-1);if(previous&&!source.slice(previous.end,start).trim())previous.end=end;else runs.push({start,end});}
      }offset+=text.length;
    }
    for(const {start,end} of runs){const key=field+':'+start+':'+end;if(!seen.has(key)){items.push({kind:'text',field,start,end,quote:source.slice(start,end)});seen.add(key);}}
  }
  if(items.length>24||items.some(i=>i.quote.length>4000)||items.reduce((n,i)=>n+i.quote.length,0)>12000)throw new Error('Select a smaller area so the agent can stay focused.');
  if(!items.length)throw new Error('Drag over plan text or diagram nodes to select an area.');
  return {kind:'area',items,quote:items.map(i=>i.quote).join('\n\n')};
}

// Paint exact text ranges without inserting spans into authored plan content.
// Recompute their geometry after scrolling, map panning and responsive reflow.
export function createAreaHighlight({resolve}){
  let annotation,overlay,padding,scheduled=false;
  function clear(){annotation=null;overlay?.remove();overlay=null;padding=null;}
  function ranges(item,el){
    if(item.kind!=='text')return [el.getBoundingClientRect()];
    if(el.textContent.slice(item.start,item.end)!==item.quote)return [];
    const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT),range=document.createRange();let text,offset=0,started=false;
    while((text=walker.nextNode())){
      if(!started&&item.start<offset+text.length){range.setStart(text,item.start-offset);started=true;}
      if(started&&item.end<=offset+text.length){range.setEnd(text,item.end-offset);return [...range.getClientRects()];}offset+=text.length;
    }return [];
  }
  const bounds=rects=>{const left=Math.min(...rects.map(r=>r.left)),top=Math.min(...rects.map(r=>r.top));return {left,top,right:Math.max(...rects.map(r=>r.right)),bottom:Math.max(...rects.map(r=>r.bottom))};};
  function rects(){return annotation.items.flatMap((item,index)=>{
    const el=resolve(item);if(!el)return [];const visible=visibleRect(el);if(!visible)return [];
    return ranges(item,el).flatMap(r=>{const clipped={left:Math.max(r.left,visible.left),right:Math.min(r.right,visible.right),top:Math.max(r.top,visible.top),bottom:Math.min(r.bottom,visible.bottom),kind:item.kind,index};return clipped.right>clipped.left&&clipped.bottom>clipped.top?[clipped]:[];});
  });}
  function box(el,r){Object.assign(el.style,{left:r.left+'px',top:r.top+'px',width:(r.right-r.left)+'px',height:(r.bottom-r.top)+'px'});}
  function paint(){
    scheduled=false;if(!annotation||!overlay)return;const selected=rects();overlay.hidden=!selected.length;if(!selected.length)return;
    const b=bounds(selected),area=overlay.firstElementChild||document.createElement('div');area.className='ask-selected-area';box(area,{left:Math.max(0,b.left-padding.left),top:b.top-padding.top,right:Math.min(innerWidth,b.right+padding.right),bottom:b.bottom+padding.bottom});if(!area.parentElement)overlay.append(area);
    selected.forEach((r,index)=>{const item=overlay.children[index+1]||document.createElement('div');item.className='ask-selected-item';item.dataset.kind=r.kind;item.dataset.item=r.index;box(item,r);if(!item.parentElement)overlay.append(item);});
    while(overlay.children.length>selected.length+1)overlay.lastElementChild.remove();
  }
  function show(next,originalBox){
    clear();if(next?.kind!=='area')return;annotation=next;
    overlay=document.createElement('div');overlay.id='ask-selection';overlay.setAttribute('aria-hidden','true');document.body.append(overlay);
    const selected=rects(),b=selected.length?bounds(selected):originalBox;
    padding=originalBox&&b?{left:Math.max(0,b.left-originalBox.left),top:Math.max(0,b.top-originalBox.top),right:Math.max(0,originalBox.right-b.right),bottom:Math.max(0,originalBox.bottom-b.bottom)}:{left:4,top:4,right:4,bottom:4};paint();
  }
  function refresh(){if(!annotation||scheduled)return;scheduled=true;requestAnimationFrame(paint);}
  for(const name of ['scroll','toggle','canvasviewchange'])document.addEventListener(name,refresh,true);
  window.addEventListener('resize',refresh);
  new MutationObserver(refresh).observe(document.querySelector('#plan'),{subtree:true,childList:true,characterData:true});
  document.querySelector('#ask-dialog').addEventListener('close',event=>{if(!event.target.open)clear();});
  return {show,clear,refresh};
}
