// Non-modal, anchored editors: keep the selected content visible and the page usable.
let current;
// Keep the original element as the identity. Closed disclosures only provide
// a temporary visible anchor; reopening restores the exact original target.
export function visibleAnchor(element) {
  if (!element) return {element, side:'right', collapsed:false};
  let visible=element, collapsed=false;
  for(let parent=element.parentElement;parent;parent=parent.parentElement){
    if(parent.tagName!=='DETAILS')continue;
    const summary=parent.querySelector(':scope > summary');
    if(summary&&!parent.open){visible=summary;collapsed=true;}
  }
  return {element:visible,side:'right',collapsed};
}
const sizeObserver=new ResizeObserver(()=>refreshBubble());
const footerTop=()=>document.querySelector('#review-footer')?.getBoundingClientRect().top ?? innerHeight;
function finishClose(dialog){
  if(current?.dialog!==dialog||dialog.open)return;
  const restore=current.restore;sizeObserver.unobserve(dialog);current=null;document.body.classList.remove('bubble-open');
  if(restore?.isConnected)restore.focus({preventScroll:true});
}
export function closeBubble(dialog){if(dialog?.open)dialog.close();finishClose(dialog);}
export function showBubble(dialog, anchor) {
  if(current && current.dialog!==dialog) current.dialog.close();
  const getAnchor=typeof anchor==='function'?anchor:()=>anchor;
  const restore=document.activeElement;
  current={dialog,getAnchor,restore};dialog.classList.add('anchored-bubble');document.body.classList.add('bubble-open');
  if(!dialog.querySelector(':scope > .bubble-content')){const body=document.createElement('div');body.className='bubble-content';body.append(...dialog.childNodes);dialog.append(body);}
  if(!dialog.open)dialog.show();sizeObserver.observe(dialog);
  position(true);
}
function position(){
  if(!current?.dialog.open)return;
  const {dialog,getAnchor}=current,anchor=visibleAnchor(getAnchor()),r=anchor.element?.getBoundingClientRect();
  const margin=16,gap=16,wide=['ask-dialog','edit-dialog'].includes(dialog.id);
  const width=Math.min(wide?640:360,innerWidth-margin*2);
  const bottom=Math.max(margin+120,Math.min(innerHeight-margin,footerTop()-12));
  dialog.style.position='fixed';dialog.style.width=width+'px';
  dialog.style.maxHeight=Math.max(120,bottom-margin)+'px';
  dialog.dataset.collapsed=String(anchor.collapsed);
  const height=dialog.getBoundingClientRect().height;
  let x=innerWidth-width-margin,y=margin,side='detached';
  if(r?.width&&r.height){
    if(r.right+gap+width<=innerWidth-margin){x=r.right+gap;y=r.top;side='right';}
    else if(r.left-gap-width>=margin){x=r.left-gap-width;y=r.top;side='left';}
    else {
      x=r.left+(r.width-width)/2;
      const below=bottom-r.bottom-gap,above=r.top-gap-margin;
      if(below>=height){y=r.bottom+gap;side='bottom';}
      else if(above>=height){y=r.top-gap-height;side='top';}
      else if(Math.max(below,above)>=180){
        // Keep the target uncovered. Only the bubble scrolls when space is tight.
        const useBelow=below>=above;
        dialog.style.maxHeight=Math.max(below,above)+'px';
        y=useBelow?r.bottom+gap:r.top-gap-dialog.getBoundingClientRect().height;
        side=useBelow?'bottom':'top';
      }else{y=r.bottom+gap;}
    }
  }
  x=Math.max(margin,Math.min(x,innerWidth-width-margin));
  y=Math.max(margin,Math.min(y,bottom-dialog.getBoundingClientRect().height));
  dialog.dataset.side=side;dialog.style.left=x+'px';dialog.style.top=y+'px';
  if(r){dialog.style.setProperty('--tail-y',Math.max(20,Math.min(dialog.offsetHeight-24,r.top+r.height/2-y))+'px');dialog.style.setProperty('--tail-x',Math.max(20,Math.min(width-24,r.left+r.width/2-x))+'px');}
}
let scheduled=false;
export function refreshBubble(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;position();});}
document.addEventListener('scroll',refreshBubble,true);document.addEventListener('toggle',refreshBubble,true);window.addEventListener('resize',refreshBubble);document.addEventListener('canvasviewchange',refreshBubble);
document.addEventListener('close',e=>finishClose(e.target),true);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&current?.dialog.open){e.preventDefault();e.stopImmediatePropagation();closeBubble(current.dialog);}},true);
