export function createCanvasView(viewport, scene, label) {
  viewport.classList.add('canvas-viewport'); viewport.tabIndex = 0;
  viewport.setAttribute('aria-label', label + '. Drag to pan, Ctrl+scroll or plus/minus to zoom, arrow keys to pan, Home to fit.');
  const toolbar = document.createElement('div'); toolbar.className = 'canvas-tools'; toolbar.setAttribute('role','group'); toolbar.setAttribute('aria-label',label + ' view controls');
  const status = document.createElement('span'); status.className = 'canvas-zoom'; status.setAttribute('aria-live','polite');
  let width = 1, height = 1, scale = 1, x = 0, y = 0, fitting = true, moved = false;
  const points = new Map(); let gesture, insets={right:0,bottom:0};
  const available=()=>({width:Math.max(80,viewport.clientWidth-insets.right),height:Math.max(80,viewport.clientHeight-insets.bottom)});
  function apply() {
    scene.style.transform = `translate(${x}px, ${y}px) scale(${scale})`; scene.dataset.scale = String(scale);
    scene.dataset.panX = String(x); scene.dataset.panY = String(y); status.textContent = Math.round(scale * 100) + '%';
    viewport.dispatchEvent(new CustomEvent('canvasviewchange',{bubbles:true}));
  }
  function fit() { fitting = true; scale = Math.min(1,(available().width-40)/width,(available().height-40)/height); scale = Math.max(.08,scale); x=(available().width-width*scale)/2; y=(available().height-height*scale)/2; apply(); }
  function zoom(next, cx=available().width/2, cy=available().height/2) { fitting=false; next=Math.max(.08,Math.min(3,next)); const ratio=next/scale; x=cx-(cx-x)*ratio; y=cy-(cy-y)*ratio;scale=next;apply(); }
  for (const [name, text, action] of [['Zoom out','−',()=>zoom(scale/1.2)],['Zoom in','+',()=>zoom(scale*1.2)],['Fit map','Fit map',fit],['Actual size','100%',()=>zoom(1)]]) {
    const b=document.createElement('button');b.type='button';b.textContent=text;b.setAttribute('aria-label',name);b.addEventListener('click',action);toolbar.append(b);
  }
  toolbar.append(status); const hint=document.createElement('span');hint.className='canvas-hint';hint.textContent='Drag to pan · Ctrl+scroll to zoom';toolbar.append(hint);
  viewport.before(toolbar);
  viewport.addEventListener('wheel', e=>{if(!e.ctrlKey||e.target.closest('.canvas-inspector'))return;e.preventDefault();const r=viewport.getBoundingClientRect();zoom(scale*Math.exp(-e.deltaY*.0015),e.clientX-r.left,e.clientY-r.top);},{passive:false});
  function startGesture(){const ps=[...points.values()];gesture={x,y,scale,center:{x:ps.reduce((a,p)=>a+p.x,0)/ps.length,y:ps.reduce((a,p)=>a+p.y,0)/ps.length},distance:ps.length>1?Math.hypot(ps[0].x-ps[1].x,ps[0].y-ps[1].y):0};}
  viewport.addEventListener('pointerdown',e=>{
    if(e.target.closest('.canvas-inspector')||['annotate','ask','edit'].includes(document.documentElement.dataset.reviewMode)||e.button!==0||(e.pointerType!=='touch'&&e.target.closest('button')))return;
    points.set(e.pointerId,{x:e.clientX,y:e.clientY});moved=false;startGesture();
    if(e.pointerType!=='touch'){viewport.setPointerCapture(e.pointerId);e.preventDefault();viewport.focus({preventScroll:true});}
  });
  viewport.addEventListener('pointermove',e=>{
    if(!points.has(e.pointerId))return;points.set(e.pointerId,{x:e.clientX,y:e.clientY});const ps=[...points.values()];
    const center={x:ps.reduce((a,p)=>a+p.x,0)/ps.length,y:ps.reduce((a,p)=>a+p.y,0)/ps.length};
    if(!moved&&ps.length===1&&Math.hypot(center.x-gesture.center.x,center.y-gesture.center.y)<4)return;
    moved=true;fitting=false;viewport.classList.add('is-panning');if(!viewport.hasPointerCapture(e.pointerId))viewport.setPointerCapture(e.pointerId);
    if(ps.length>1&&gesture.distance){const r=viewport.getBoundingClientRect(),ratio=Math.hypot(ps[0].x-ps[1].x,ps[0].y-ps[1].y)/gesture.distance;scale=Math.max(.08,Math.min(3,gesture.scale*ratio));x=center.x-r.left-(gesture.center.x-r.left-gesture.x)*scale/gesture.scale;y=center.y-r.top-(gesture.center.y-r.top-gesture.y)*scale/gesture.scale;}
    else{x=gesture.x+center.x-gesture.center.x;y=gesture.y+center.y-gesture.center.y;}apply();e.preventDefault();
  });
  function end(e){points.delete(e.pointerId);if(viewport.hasPointerCapture(e.pointerId))viewport.releasePointerCapture(e.pointerId);if(points.size)startGesture();else viewport.classList.remove('is-panning');}
  viewport.addEventListener('pointerup',end);viewport.addEventListener('pointercancel',end);
  viewport.addEventListener('click',e=>{if(moved){e.preventDefault();e.stopImmediatePropagation();moved=false;}},true);
  viewport.addEventListener('keydown',e=>{if(e.target!==viewport)return;let used=true; if(e.key==='Home')fit();else if(['+','='].includes(e.key))zoom(scale*1.2);else if(e.key==='-')zoom(scale/1.2);else if(e.key.startsWith('Arrow')){fitting=false;x+=e.key==='ArrowLeft'?60:e.key==='ArrowRight'?-60:0;y+=e.key==='ArrowUp'?60:e.key==='ArrowDown'?-60:0;apply();}else used=false;if(used)e.preventDefault();});
  function reveal(element){
    if(!scene.contains(element))return;
    viewport.scrollLeft=0;viewport.scrollTop=0;
    let a=element.getBoundingClientRect();const r=viewport.getBoundingClientRect(),space=available();
    if(a.width>space.width-24 || a.height>space.height-24){const ratio=Math.min((space.width-24)/a.width,(space.height-24)/a.height);zoom(scale*ratio,space.width/2,space.height/2);a=element.getBoundingClientRect();}
    if(a.left<r.left+12||a.right>r.left+space.width-12||a.top<r.top+12||a.bottom>r.top+space.height-12){x+=r.left+space.width/2-a.left-a.width/2;y+=r.top+space.height/2-a.top-a.height/2;fitting=false;apply();}viewport.scrollLeft=0;viewport.scrollTop=0;
  }
  viewport.addEventListener('focusin',e=>{if(scene.contains(e.target))reveal(e.target);});
  viewport.addEventListener('revealcontext',e=>{const original=insets;insets={...insets,bottom:Math.max(insets.bottom,e.detail.bottom)};reveal(e.detail.element);insets=original;});
  const observer=new ResizeObserver(()=>{if(fitting)fit();});observer.observe(viewport);
  return { snapshot(){return {x,y,scale};},restore(saved){if(!saved)return;({x,y,scale}=saved);fitting=false;apply();},setInsets(next){if(insets.right!==next.right||insets.bottom!==next.bottom){insets=next;fitting=false;}},setSize(w,h){width=w;height=h;scene.style.width=w+'px';scene.style.height=h+'px';if(fitting)requestAnimationFrame(()=>{if(fitting)fit();});},fit,reveal,dispose(){observer.disconnect();toolbar.remove();} };
}
