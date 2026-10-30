export function createInspector(viewport,view,{panel,onClose}){
  panel.classList.add('canvas-inspector');panel.hidden=true;
  // Keep explanations annotatable and outside the canvas clipping/transform context.
  delete panel.dataset.reviewControl;
  const host=viewport.parentElement;host.classList.add('inspector-host');host.append(panel);
  let selected,frame;
  const clamp=(value,min,max)=>Math.max(min,Math.min(value,max));
  function position(){
    if(panel.hidden||!selected?.isConnected||!viewport.getClientRects().length)return;
    const anchor=selected.getBoundingClientRect(),bounds=host.getBoundingClientRect(),canvas=viewport.getBoundingClientRect();
    const visible=canvas.bottom>0&&canvas.top<innerHeight&&anchor.bottom>canvas.top&&anchor.top<canvas.bottom&&anchor.right>canvas.left&&anchor.left<canvas.right;
    panel.style.visibility=visible?'visible':'hidden';if(!visible)return;
    const width=panel.getBoundingClientRect().width,gap=16;
    const left=Math.max(bounds.left,16),right=Math.min(bounds.right,innerWidth-16);
    let x,y=anchor.top,side;
    if(anchor.right+gap+width<=right){x=anchor.right+gap;side='right';}
    else if(anchor.left-gap-width>=left){x=anchor.left-gap-width;side='left';}
    else{x=clamp(anchor.left,left,right-width);y=anchor.bottom+gap;side='bottom';}
    const footer=document.querySelector('#review-footer')?.getBoundingClientRect();
    let bottom=footer&&x<footer.right&&x+width>footer.left?Math.min(innerHeight,footer.top):innerHeight;
    const tools=document.querySelector('.review-tools')?.getBoundingClientRect();
    if(tools&&x<tools.right&&x+width>tools.left&&tools.top>innerHeight/2)bottom=Math.min(bottom,tools.top);
    const maxHeight=Math.min(650,innerHeight*.7);
    panel.style.maxHeight=(side==='bottom'?Math.max(160,Math.min(maxHeight,bottom-y-16)):maxHeight)+'px';
    if(side!=='bottom')y=clamp(y,Math.max(bounds.top,16),Math.max(bounds.top,bottom-panel.offsetHeight-16));
    panel.dataset.position=side;
    panel.style.left='clamp(0px,'+(x-bounds.left)+'px,max(0px,100% - 420px))';panel.style.top=(y-bounds.top)+'px';
  }
  function schedule(){cancelAnimationFrame(frame);frame=requestAnimationFrame(position);}
  const observer=new ResizeObserver(schedule);observer.observe(viewport);observer.observe(panel);
  viewport.addEventListener('canvasviewchange',schedule);
  window.addEventListener('resize',schedule);window.addEventListener('scroll',schedule,true);
  function escape(e){if(e.key==='Escape'&&!panel.hidden){e.stopPropagation();onClose();selected?.focus({preventScroll:true});}}
  panel.addEventListener('keydown',escape);viewport.addEventListener('keydown',escape);
  return {
    open(element,color){selected=element;panel.hidden=false;panel.style.setProperty('--inspector-color',color);view.reveal(selected);position();},
    close(){panel.hidden=true;},
    header(title){const header=document.createElement('div');header.className='inspector-heading';const h=document.createElement('h4');h.textContent=title;const b=document.createElement('button');b.type='button';b.textContent='×';b.setAttribute('aria-label','Close node explanation');b.dataset.reviewControl='true';b.onclick=()=>{onClose();selected?.focus({preventScroll:true});};header.append(h,b);return header;},
    dispose(){observer.disconnect();cancelAnimationFrame(frame);viewport.removeEventListener('canvasviewchange',schedule);viewport.removeEventListener('keydown',escape);panel.removeEventListener('keydown',escape);window.removeEventListener('resize',schedule);window.removeEventListener('scroll',schedule,true);}
  };
}
