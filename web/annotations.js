import {collectArea,createAreaHighlight} from './area-selection.js';
import {showBubble,visibleAnchor} from './anchored-bubble.js';
import { planFields, planTargets } from './plan-content.js';

export function setupAnnotations({ getRecord, open, edit, getEditable, locked = () => false }) {
  const $ = s => document.querySelector(s), plan = $('#plan');
  let enabled = false, hover, scheduled = false;
  const previousTabIndex = new Map();
  const isControl=element=>element.closest('[data-review-control]')&&!element.closest('[data-field]');
  const target = element => enabled==='edit'?getEditable(element)?.element:element?.closest('[data-node], [data-step], [data-field], [data-target]');
  const selectionHighlight=createAreaHighlight({resolve});
  function clearHover() { hover?.classList.remove('annotation-hover'); hover = null; }
  function markKeyboardTargets() {
    for (const element of plan.querySelectorAll('[data-field], [data-target]')) {
      const editable=getEditable(element)?.element===element;element.toggleAttribute('data-manual-editable',editable);
      if (!enabled||(enabled==='edit'&&!editable)) continue;
      if (!previousTabIndex.has(element)) previousTabIndex.set(element, element.getAttribute('tabindex'));
      if (!element.matches('button,a,input,textarea,select')) element.tabIndex = 0;
    }
  }
  function setMode(next) {
    enabled = next === true ? 'annotate' : next; document.documentElement.dataset.reviewMode = enabled || 'explore';
    for(const [id,mode] of [['annotate','annotate'],['ask','ask'],['edit','edit']])$('#'+id+'-toggle').setAttribute('aria-pressed',String(enabled===mode));
    $('#mode-hint').textContent = enabled==='ask'?'Drag an area · Esc to exit':enabled==='edit'?'Select text to edit · Esc to exit':enabled?'Select to review · Esc to exit':'A annotate · Q ask · E edit'; clearHover();
    for (const [el,value] of previousTabIndex){if(value===null)el.removeAttribute('tabindex');else el.setAttribute('tabindex',value);}previousTabIndex.clear();
    markKeyboardTargets();
  }
  function select(el,clicked=el) {
    const record = getRecord(); if (!record || !el) return;
    if(enabled==='edit'){clearHover();edit(clicked);return;}
    let annotation;
    if (el.dataset.node) {
      const diagram = el.closest('[data-diagram]');
      annotation = { kind: 'node', diagramId: diagram.dataset.diagram, nodeId: el.dataset.node, layerId: el.dataset.annotationLayer || diagram.dataset.activeLayer, quote: el.querySelector('strong')?.textContent || el.textContent };
    } else if (el.dataset.field) {
      const text = planFields(record.plan).get(el.dataset.field); if (!text) return;
      const quote = text.slice(0, 4000).trimEnd(); annotation = { kind: 'text', field: el.dataset.field, quote, start: 0, end: quote.length };
    } else {
      const id = el.dataset.step ? 'step:' + el.dataset.step : el.dataset.target;
      const quote = planTargets(record.plan).get(id); if (quote === undefined) return;
      annotation = { kind: 'element', elementId: id, quote };
    }
    if(enabled==='ask')annotation={kind:'area',items:[annotation],quote:annotation.quote};
    clearHover(); open(annotation, 'Selected plan element', el, enabled);
  }
  for(const mode of ['annotate','ask','edit'])$('#'+mode+'-toggle').addEventListener('click',()=>{if(!locked())setMode(enabled===mode?false:mode);});
  $('#comments-toggle').addEventListener('click', () => {
    const panel = $('#comments-panel'); panel.hidden = !panel.hidden; $('#comments-toggle').setAttribute('aria-expanded', String(!panel.hidden));
  });
  $('#close-comments').addEventListener('click', () => { $('#comments-panel').hidden = true; $('#comments-toggle').setAttribute('aria-expanded', 'false'); $('#comments-toggle').focus(); });
  plan.addEventListener('pointerover', e => { if (!enabled||enabled==='ask'||isControl(e.target)) return; const next = target(e.target); if (hover !== next) { clearHover(); hover = next; hover?.classList.add('annotation-hover'); } });
  plan.addEventListener('pointerleave', clearHover);
  plan.addEventListener('pointerdown', e => { if (enabled && enabled!=='ask' && !isControl(e.target) && target(e.target)) e.preventDefault(); }, true);
  plan.addEventListener('click', e => { if (!enabled||locked()||enabled==='ask'||isControl(e.target)) return; const el = target(e.target); if (!el) return; e.preventDefault(); e.stopImmediatePropagation(); select(el,e.target); }, true);
  plan.addEventListener('keydown', e => { if (!enabled || locked() || isControl(e.target) || !['Enter', ' '].includes(e.key)) return; const el = target(e.target); if (!el) return; e.preventDefault(); e.stopImmediatePropagation(); select(el,e.target); }, true);
  window.addEventListener('keydown', e => {
    if(e.isComposing||e.repeat)return;
    // Exit before a bubble consumes Escape; its existing handler still closes
    // the bubble and preserves the draft.
    if(e.key==='Escape'){cancelDrag();selectionHighlight.clear();setMode(false);return;}
    if(e.defaultPrevented||e.ctrlKey||e.metaKey||e.altKey||!['a','q','e'].includes(e.key.toLowerCase()))return;
    if(e.target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]')||document.querySelector('dialog[open]'))return;
    if(plan.hidden)return;
    if(locked())return;const mode={a:'annotate',q:'ask',e:'edit'}[e.key.toLowerCase()];e.preventDefault();setMode(enabled===mode?false:mode);
  },true);
  let drag,rectangle,suppressClick=false;
  function cancelDrag(){if(drag&&plan.hasPointerCapture(drag.id))plan.releasePointerCapture(drag.id);drag=null;rectangle?.remove();rectangle=null;}
  plan.addEventListener('pointerdown',e=>{
    if(enabled!=='ask'||locked()||e.button!==0||isControl(e.target))return;
    e.preventDefault();e.stopImmediatePropagation();clearHover();drag={id:e.pointerId,x:e.clientX,y:e.clientY};
    rectangle=document.createElement('div');rectangle.className='area-selection';rectangle.setAttribute('aria-hidden','true');document.body.append(rectangle);plan.setPointerCapture(e.pointerId);
  },true);
  const boxAt=e=>({left:Math.min(drag.x,e.clientX),right:Math.max(drag.x,e.clientX),top:Math.min(drag.y,e.clientY),bottom:Math.max(drag.y,e.clientY)});
  plan.addEventListener('pointermove',e=>{if(!drag)return;const b=boxAt(e);Object.assign(rectangle.style,{left:b.left+'px',top:b.top+'px',width:(b.right-b.left)+'px',height:(b.bottom-b.top)+'px'});},true);
  plan.addEventListener('pointerup',e=>{
    if(!drag)return;e.preventDefault();e.stopImmediatePropagation();const box=boxAt(e);cancelDrag();suppressClick=true;setTimeout(()=>{suppressClick=false;},0);
    try{const a=collectArea(plan,getRecord().plan,box);open(a,'Selected area',resolve(a), 'ask',box);}
    catch(error){const notice=$('#notice');notice.textContent=error.message;notice.hidden=false;}
  },true);
  plan.addEventListener('pointercancel',cancelDrag,true);
  plan.addEventListener('click',e=>{if(suppressClick||enabled==='ask'){e.preventDefault();e.stopImmediatePropagation();}},true);
  function anchor(a){
    if(a.kind!=='area')return resolve(a);
    const elements=a.items.map(resolve).filter(Boolean).map(el=>visibleAnchor(el).element);
    return {getBoundingClientRect(){
      const rects=elements.filter(el=>el.isConnected&&el.checkVisibility({checkVisibilityCSS:true})).map(el=>el.getBoundingClientRect());
      if(!rects.length)return new DOMRect();
      const left=Math.min(...rects.map(r=>r.left)),top=Math.min(...rects.map(r=>r.top));
      return new DOMRect(left,top,Math.max(...rects.map(r=>r.right))-left,Math.max(...rects.map(r=>r.bottom))-top);
    }};
  }
  function resolve(a) {
    if(a.kind==='area')return a.items.map(resolve).find(el=>el?.checkVisibility({checkVisibilityCSS:true}));
    if (a.kind === 'node') return [...plan.querySelectorAll('[data-node]')].find(el => el.dataset.node === a.nodeId && el.closest('[data-diagram]')?.dataset.diagram === a.diagramId);
    if (a.kind === 'text') return [...plan.querySelectorAll('[data-field]')].find(el => el.dataset.field === a.field);
    if (a.elementId?.startsWith('step:')) return [...plan.querySelectorAll('[data-step]')].find(el => 'step:' + el.dataset.step === a.elementId);
    return [...plan.querySelectorAll('[data-target]')].find(el => el.dataset.target === a.elementId);
  }
  function showComment(notes) {
    $('#comment-quote').textContent = notes[0].annotation.quote;
    $('#comment-body').replaceChildren();
    for (const note of notes) {
      const item = document.createElement('div'), meta = document.createElement('small'), p = document.createElement('p');
      meta.textContent = note.annotation.layerId ? 'Layer: ' + note.annotation.layerId : 'Plan annotation'; p.textContent = note.text; item.append(meta); if(note.annotation.quote!==notes[0].annotation.quote){const quote=document.createElement('blockquote');quote.textContent=note.annotation.quote;item.append(quote);}item.append(p); $('#comment-body').append(item);
    }
    $('#comment-meta').textContent = `Revision ${notes[0].revision} · Saved with this plan`;
    showBubble($('#comment-dialog'),()=>resolve(notes[0].annotation));
  }
  $('#close-comment').addEventListener('click', () => $('#comment-dialog').close());
  function refresh() {
    scheduled = false; markKeyboardTargets();
    const record = getRecord(), pins = $('#comment-pins'); pins.replaceChildren(); if (!record) return;
    const notes = record.feedback.filter(f => f.action === 'annotate'); $('#comment-count').textContent = notes.length;
    const groups = new Map();
    for (const note of notes.filter(n => n.revision === record.revision)) {
      const original=resolve(note.annotation);if(!original)continue;
      const anchor=visibleAnchor(original),el=anchor.element;
      if(!groups.has(el))groups.set(el,{anchor,items:[]});
      groups.get(el).items.push(note);
    }
    const occupied = [];
    for (const {anchor,items} of groups.values()) {
      const el=anchor.element;
      const r = el.getBoundingClientRect(); let clip = { left: 0, right: innerWidth, top: 70, bottom: innerHeight - 12 };
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const style = getComputedStyle(p); if (['auto','scroll','hidden','clip'].some(v => style.overflowX === v || style.overflowY === v)) { const c = p.getBoundingClientRect(); clip = { left: Math.max(clip.left,c.left), right: Math.min(clip.right,c.right), top: Math.max(clip.top,c.top), bottom: Math.min(clip.bottom,c.bottom) }; } }
      if (!r.width || !r.height || r.bottom <= clip.top || r.top >= clip.bottom || r.right <= clip.left || r.left >= clip.right) continue;
      let x = anchor.collapsed ? Math.max(clip.left+4,Math.min(r.right-14,clip.right-32)) : Math.min(r.right - 8, clip.right - 32), y = Math.min(Math.max(anchor.collapsed?r.top+r.height/2-14:r.top-10, clip.top + 4), clip.bottom - 30);
      while (occupied.some(p => Math.abs(p.x-x)<30 && Math.abs(p.y-y)<30)) y += 30;
      if (y > clip.bottom - 30) continue; occupied.push({x,y});
      const pin = document.createElement('button'); pin.type = 'button'; pin.className = 'comment-pin'; pin.textContent = String(items.length); pin.setAttribute('aria-label', `${items.length} comment${items.length===1?'':'s'} on ${items[0].annotation.quote.slice(0,80)}`);
      if(anchor.collapsed)pin.setAttribute('aria-label',`${items.length} comments in ${el.querySelector('h2,h3')?.textContent||el.textContent.trim()}`);
      pin.dataset.collapsed=String(anchor.collapsed);pin.dataset.side=anchor.side;
      pin.style.left = x + 'px'; pin.style.top = y + 'px'; pin.addEventListener('click', () => showComment(items)); pins.append(pin);
    }
  }
  const schedule = () => { if (!scheduled) { scheduled = true; requestAnimationFrame(refresh); } };
  document.addEventListener('scroll', schedule, true); document.addEventListener('toggle', schedule, true); document.addEventListener('canvasviewchange',schedule); window.addEventListener('resize', schedule);
  new MutationObserver(schedule).observe(plan, { subtree: true, childList: true });
  return { refresh: schedule, setMode, resolve, anchor, selectArea:selectionHighlight.show };
}
