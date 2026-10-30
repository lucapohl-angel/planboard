import {planFields} from './plan-content.js';
let cancelCurrent,cursorPosition,preparingId,prepared=new Set();
export function cancelPreparation(){if(preparingId)cancelPlayback();}
export function prepareEdits(id,paths){if(prepared.has(id))return;prepared.add(id);if(prepared.size>100)prepared.delete(prepared.values().next().value);void playChanges(null,null,{preparing:true,paths});preparingId=id;}
export function cancelPlayback(){cancelCurrent?.();preparingId=null;}
export async function playChanges(before,after,{preparing=false,paths=[]}={}){
  cancelPlayback();if(!preparing&&(!before||!after))return;
  const old=planFields(before||{}),next=planFields(after||{});
  const changes=[...document.querySelectorAll('#plan [data-field]')].filter(el=>!el.children.length&&(preparing?paths.includes(el.dataset.field):old.has(el.dataset.field)&&old.get(el.dataset.field)!==next.get(el.dataset.field)));
  if(!changes.length)return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const banner=document.createElement('aside');banner.className='change-playback';banner.setAttribute('aria-label',preparing?'Live edit activity':'Saved change playback');
  const label=document.createElement('span');label.textContent=`${preparing?'Agent updating':'Saved changes'} · ${changes.length} updated part${changes.length===1?'':'s'}`;
  const skip=document.createElement('button');skip.type='button';skip.textContent='Skip playback';banner.append(label,skip);document.body.append(banner);
  const cursor=document.createElement('div');cursor.className='agent-cursor';cursor.setAttribute('aria-hidden','true');cursor.innerHTML='<svg viewBox="0 0 28 34"><path d="M3 2 24 20 14 21 10 31Z"/></svg><span>Agent · saved change</span>';document.body.append(cursor);if(preparing)cursor.querySelector('span').textContent='Agent · updating this part';
  let cancelled=false,animation,x=cursorPosition?.x??innerWidth*.65,y=cursorPosition?.y??innerHeight*.5;const originals=new Map();
  cursor.style.transform=`translate(${x}px,${y}px)`;
  const stop=()=>{const r=cursor.getBoundingClientRect();cursorPosition={x:r.left,y:r.top};cancelled=true;animation?.cancel();for(const [el,text]of originals)if(el.isConnected)el.textContent=text;document.querySelectorAll('.agent-edited').forEach(el=>el.classList.remove('agent-edited'));banner.remove();cursor.remove();window.removeEventListener('wheel',stop);window.removeEventListener('pointerdown',interact,true);window.removeEventListener('keydown',stop,true);if(cancelCurrent===stop)cancelCurrent=null;};
  const interact=e=>{if(e.target!==skip)stop();};cancelCurrent=stop;skip.onclick=stop;
  window.addEventListener('wheel',stop,{passive:true});window.addEventListener('pointerdown',interact,true);window.addEventListener('keydown',stop,true);
  const pause=ms=>new Promise(r=>setTimeout(r,ms));
  async function center(el){
    const rect=el.getBoundingClientRect(),footer=document.querySelector('#review-footer'),bottom=Math.min(innerHeight-24,footer?.getBoundingClientRect().top-24||innerHeight-24),top=90;
    const destination=Math.max(0,Math.min(document.documentElement.scrollHeight-innerHeight,scrollY+rect.top+Math.min(rect.height,bottom-top)/2-(top+bottom)/2));
    const from=scrollY,distance=destination-from;if(Math.abs(distance)<4)return;
    const start=performance.now(),duration=650;while(!cancelled){const p=Math.min(1,(performance.now()-start)/duration),ease=p<.5?4*p*p*p:1-(-2*p+2)**3/2;scrollTo(0,from+distance*ease);if(p===1)break;await new Promise(requestAnimationFrame);}await pause(120);
  }
  async function move(el){
    const rect=el.getBoundingClientRect(),toX=Math.max(16,Math.min(innerWidth-200,rect.left+Math.min(rect.width*.5,160))),toY=rect.top+Math.min(rect.height*.5,32),distance=Math.hypot(x-toX,y-toY);
    animation=cursor.animate([{transform:`translate(${x}px,${y}px)`},{transform:`translate(${x+(toX-x)*.45+20}px,${y+(toY-y)*.45-24}px)`,offset:.45},{transform:`translate(${toX}px,${toY}px)`}],{duration:Math.min(1500,850+distance*.45),easing:'cubic-bezier(.4,0,.2,1)',fill:'forwards'});
    await animation.finished.catch(()=>{});x=toX;y=toY;await pause(160);
  }
  try{
    if(reduced){cursor.hidden=true;label.textContent=`${changes.length} parts updated. Motion is reduced.`;for(const el of changes)el.classList.add('agent-edited');await pause(1200);return;}
    for(const [index,el]of changes.slice(0,4).entries()){
      if(cancelled||!el.isConnected)break;
      label.textContent=`${preparing?'Agent updating':'Saved change playback'} · ${index+1} of ${Math.min(4,changes.length)}${changes.length>4?' shown ('+changes.length+' updated)':''}`;
      const final=el.textContent,previous=old.get(el.dataset.field);if(!preparing){originals.set(el,final);el.textContent=previous;}
      const closed=[];for(let p=el.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS'&&!p.open)closed.unshift(p);
      for(const accordion of closed){const summary=accordion.querySelector(':scope>summary');await center(summary);if(cancelled)break;await move(summary);if(cancelled)break;cursor.classList.add('agent-click');await pause(180);accordion.open=true;await pause(250);cursor.classList.remove('agent-click');}
      if(cancelled)break;await center(el);if(cancelled)break;await move(el);if(cancelled)break;
      el.classList.add('agent-edited');cursor.classList.add('agent-click');
      await pause(280);if(cancelled)break;cursor.classList.remove('agent-click');
      if(preparing){while(!cancelled)await pause(100);break;}
      // Replay a verified saved text change, never speculative typing or clicks.
      let common=0;while(common<previous.length&&common<final.length&&previous[common]===final[common])common++;
      for(let step=1;step<=12&&!cancelled;step++){el.textContent=final.slice(0,common+Math.ceil((final.length-common)*step/12));await pause(65);}
      if(!cancelled){el.textContent=final;await pause(550);el.classList.remove('agent-edited');}
    }
  }finally{stop();}
}
