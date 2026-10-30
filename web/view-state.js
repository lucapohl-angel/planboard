// Stable disclosure identities survive text edits and reordered plan items.
function key(details) {
  const owner=details.closest('[data-technology],[data-diagram],.decision-card,.review-section');
  const identity=details.dataset.target||owner?.dataset.technology||owner?.dataset.diagram||owner?.querySelector(':scope>summary [data-field]')?.dataset.field||owner?.id||'plan';
  const summary=details.querySelector(':scope>summary');
  return identity+'|'+(details.classList.contains('section-fold')?'section':summary?.querySelector('[data-field]')?.dataset.field||[details.className,summary?.textContent,details.classList.contains('evidence-fold')?details.querySelector('[data-field]')?.dataset.field:''].join('|'));
}
export function captureView() {
  return {scroll:scrollY,mode:document.documentElement.dataset.reviewMode,
    disclosures:new Map([...document.querySelectorAll('#plan details')].map(d=>[key(d),d.open]))};
}
export function restoreView(saved) {
  for(const d of document.querySelectorAll('#plan details'))if(saved.disclosures.has(key(d)))d.open=saved.disclosures.get(key(d));
  scrollTo({top:saved.scroll,behavior:'instant'});
}
// Measure the actual content at each width; never crop a technology name.
export function setupTechnologySizing() {
  const container=document.querySelector('#plan');let scheduled=false,lastWidth;
  const resize=()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{
    scheduled=false;const cards=[...container.querySelectorAll('.tech-card')];
    container.style.removeProperty('--collapsed-tech-height');
    const closed=cards.filter(c=>!c.closest('[hidden]')&&!c.querySelector(':scope>details').open);
    const height=Math.max(0,...closed.map(c=>c.getBoundingClientRect().height));
    container.style.setProperty('--collapsed-tech-height',height+'px');
  });};
  new ResizeObserver(()=>{const width=container.clientWidth;if(width!==lastWidth){lastWidth=width;resize();}}).observe(container);
  new MutationObserver(resize).observe(container,{childList:true,subtree:true,attributes:true,attributeFilter:['open']});
  return resize;
}
