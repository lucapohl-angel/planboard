import {textDiff} from './text-diff.js';

const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
export function setupChangeHistory({api,getRecord,applyRevision,reveal,showDiagram,onChange}){
  const panel=document.querySelector('#changes-panel'),list=panel.querySelector('#change-list'),status=panel.querySelector('#changes-status'),toggle=document.querySelector('#changes-toggle'),count=document.querySelector('#change-count');
  let data,loadingKey='',sequence=0,scheduled=false,busy=false,clearedBaseline=null;
  const widget=document.querySelector('#changes-widget'),visibility=document.querySelector('#show-change-highlights');
  const setOpen=open=>{panel.hidden=!open;widget.classList.toggle('is-open',open);toggle.setAttribute('aria-expanded',String(open));};
  const close=()=>{setOpen(false);toggle.focus();};
  toggle.onclick=()=>{
    setOpen(panel.hidden);
    if(!panel.hidden){document.querySelector('#comments-panel').hidden=true;document.querySelector('#comments-toggle').setAttribute('aria-expanded','false');void refresh(true);}
  };
  document.querySelector('#comments-toggle').addEventListener('click',()=>setOpen(false));
  for(const mode of ['annotate','ask','edit'])document.querySelector('#'+mode+'-toggle').addEventListener('click',()=>setOpen(false));
  visibility.onchange=()=>{try{localStorage.setItem('planboard:highlights:'+getRecord().id,String(visibility.checked));}catch{}schedule();};
  document.querySelector('#mark-changes-reviewed').onclick=async()=>{
    if(busy||!data)return;busy=true;const button=document.querySelector('#mark-changes-reviewed');button.disabled=true;
    try{const previous=data.baseline;data=await api('plans/'+data.id+'/highlight-baseline',{revision:data.revision,baseline:data.revision});clearedBaseline=previous;getRecord().reviewState={highlightBaseline:data.baseline};render();schedule();status.replaceChildren(document.createTextNode('Highlights cleared. History kept. '));const undo=el('button','Undo'),undoError=el('span',undefined,'highlight-undo-error');undo.type='button';undo.id='undo-clear-highlights';undo.onclick=async()=>{undo.disabled=true;try{data=await api('plans/'+data.id+'/highlight-baseline',{revision:data.revision,baseline:clearedBaseline});getRecord().reviewState={highlightBaseline:data.baseline};clearedBaseline=null;render();schedule();status.textContent='Previous highlights restored.';document.querySelector('#mark-changes-reviewed').focus();}catch(e){undoError.textContent=e.message+' Try Undo again.';undo.disabled=false;undo.focus({preventScroll:true});}};status.append(undo,undoError);undo.focus({preventScroll:true});}catch(e){status.textContent=e.message;}finally{busy=false;button.disabled=data?.baseline===data?.revision;}
  };
  panel.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();close();}});

  function jump(path){
    if(path.startsWith('diagrams/'))showDiagram(path.split('/')[1]);
    const target=[...document.querySelectorAll('#plan [data-field]')].find(n=>n.dataset.field===path);
    if(!target){status.textContent='This part is removed or not shown in this view. Its exact change is listed below.';return;}
    setOpen(false);
    reveal(target);target.scrollIntoView({block:'center',behavior:'instant'});target.tabIndex=-1;target.focus({preventScroll:true});schedule();
  }
  function fieldLabel(path){
    const parts=path.split('/'),p=getRecord().plan;
    const labels={brief:'Plan summary',objective:'Outcome',success:'Success checks',scope:'Scope',now:'In scope',later:'Later',out:'Out of scope',summary:'Summary',detail:'Details',description:'Description',explanation:'Explanation',deliverable:'Deliverable',acceptance:'Checks',why:'Why it matters',recommendation:'Recommendation',question:'Question',role:'Role',rationale:'Reason',tradeoffs:'Tradeoffs',constraints:'Constraints'};
    if(parts.length===1)return labels[path]||path;
    const collection=p[parts[0]],item=Array.isArray(collection)?collection.find(i=>i.id===parts[1]):null;
    const name=item?.name||item?.title||item?.question||labels[parts[0]]||parts[0];
    let key=parts.at(-1);if(/^\d+$/.test(key))key=parts.at(-2);
    if(parts[0]==='diagrams'&&parts.includes('walkthroughs'))return 'Walkthrough · '+(labels[key]||key);
    return name+' · '+(labels[key]||key);
  }
  function render(){
    const panelScroll=panel.scrollTop;
    const open=new Set([...list.querySelectorAll('details[open][data-revision]')].map(n=>n.dataset.revision));
    const fieldOpen=new Set([...list.querySelectorAll('details[open][data-change-key]')].map(n=>n.dataset.changeKey));
    const olderOpen=!!list.querySelector('.older-changes[open]');
    const moreOpen=new Set([...list.querySelectorAll('.revision-change:has(.additional-parts[open])')].map(n=>n.dataset.revision));
    const comparing=new Set([...list.querySelectorAll('.revision-field:has(.compare-text[aria-expanded=true])')].map(n=>n.dataset.changeKey));
    const focused=list.contains(document.activeElement)?document.activeElement.closest('[data-revision]')?.dataset.revision:null;
    const recent=data.entries.filter(item=>item.revision>(data.baseline??data.revision)),visible=new Set(recent.slice(0,3).map(item=>item.revision));
    list.replaceChildren();count.textContent=String(recent.length);toggle.setAttribute('aria-label','Changes, '+recent.length+' new '+(recent.length===1?'revision':'revisions'));
    panel.querySelector('#changes-description').textContent=data.baseline===data.revision?'You’re up to date. History is kept below.':data.baseline?'New edits since revision '+data.baseline:'Comparison unavailable. History is kept below.';
    document.querySelector('#mark-changes-reviewed').disabled=busy||data.baseline===data.revision;
    if(data.unavailable.length)list.append(el('p','Some older snapshots are unavailable. Only verified changes are listed.','muted'));
    if(!data.entries.length)list.append(el('p','Your edits and agent revisions will appear here.','muted'));
    const older=el('details',undefined,'older-changes');older.open=olderOpen;older.append(el('summary','Earlier history · '+(data.entries.length-visible.size)));
    for(const item of data.entries){
      const details=el('details',undefined,'revision-change');details.dataset.revision=item.revision;details.open=open.has(String(item.revision));
      const summary=el('summary'),copy=el('span',undefined,'revision-label'),name=el('strong','Revision '+item.revision),origin=item.reverted?'Reverted':item.undoRevision?'Reverts r'+item.undoRevision:{manual:'Your edit',agent:'Agent edit',saved:'Saved change'}[item.origin]||'Saved change';
      copy.append(name,el('small',origin+' · '+(item.changes.length?item.changes.length+' '+(item.changes.length===1?'part':'parts'):'Checkpoint')));
      const time=el('time',item.at?new Date(item.at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):'');if(item.at){time.dateTime=item.at;time.title=new Date(item.at).toLocaleString();}
      summary.append(copy,time);details.append(summary);
      details.addEventListener('toggle',()=>{if(details.open)for(const other of list.querySelectorAll('.revision-change[open]'))if(other!==details)other.open=false;});
      const body=el('div',undefined,'revision-body'),parts=el('div',undefined,'revision-parts'),more=el('details',undefined,'additional-parts');more.open=moreOpen.has(String(item.revision));more.append(el('summary',(item.changes.length-4)+' more parts'));
      for(const [changeIndex,change]of item.changes.entries()){
        const row=el('details',undefined,'revision-field');row.dataset.changeKey=item.revision+':'+change.path;row.open=fieldOpen.has(row.dataset.changeKey);row.append(el('summary',fieldLabel(change.path)));
        const diff=textDiff(change.before,change.value);
        const compare=el('button',comparing.has(row.dataset.changeKey)?'Hide previous text':'Show previous text');compare.type='button';compare.className='compare-text';compare.setAttribute('aria-expanded',String(comparing.has(row.dataset.changeKey)));
        for(const [label,exclude,kind]of [['After','removed','added'],['Before','added','removed']]){
          const side=el('div',undefined,'diff-side'),text=el('p',undefined,'revision-diff');side.append(el('small',label==='After'?(item.revision===data.revision?'Current text':'Text after revision '+item.revision):'Previous text'));if(label==='Before'){side.hidden=!comparing.has(row.dataset.changeKey);side.classList.add('previous-text');side.id='previous-text-'+item.revision+'-'+changeIndex;compare.setAttribute('aria-controls',side.id);compare.onclick=()=>{side.hidden=!side.hidden;compare.setAttribute('aria-expanded',String(!side.hidden));compare.textContent=side.hidden?'Show previous text':'Hide previous text';};}
          for(const part of diff){if(part.kind===exclude)continue;text.append(part.kind===kind?el(kind==='added'?'mark':'del',part.text):document.createTextNode(part.text));}
          if(!text.textContent)text.append(el('span',label==='After'?'Removed':'Not present','muted'));side.append(text);row.append(side);
        }
        const path=el('button','Show in plan');path.type='button';path.className='change-location';path.onclick=()=>jump(change.path);const actions=el('div',undefined,'field-actions');actions.append(path,compare);row.append(actions);(changeIndex<4?parts:more).append(row);
      }
      if(item.changes.length>4)parts.append(more);
      if(!item.changes.length)parts.append(el('p',item.documentChanged?'Detailed Markdown changed in this revision.':'Only the plan structure changed.'));
      const button=el('button','Revert revision '+item.revision);button.type='button';button.disabled=!item.canUndo||busy;button.dataset.revert=item.revision;
      const confirmation=el('div',undefined,'revert-confirmation');confirmation.hidden=true;
      confirmation.append(el('p','Revert only revision '+item.revision+'? Later unrelated edits stay saved.'));
      const actions=el('div',undefined,'actions'),confirm=el('button','Confirm revert'),cancel=el('button','Cancel');confirm.type=cancel.type='button';confirm.dataset.confirmRevert=item.revision;
      button.onclick=()=>{confirmation.hidden=false;button.hidden=true;confirm.focus();};cancel.onclick=()=>{confirmation.hidden=true;button.hidden=false;button.focus();};
      confirm.onclick=async()=>{
        if(busy)return;busy=true;summary.focus({preventScroll:true});confirm.disabled=cancel.disabled=true;status.textContent='Reverting revision '+item.revision+'…';
        try{const r=getRecord(),result=await api('plans/'+r.id+'/undo',{revision:data.revision,undoRevision:item.revision});applyRevision(result.record,{animate:false});status.textContent='Revision '+item.revision+' reverted. Later unrelated edits are preserved.';onChange(status.textContent);}
        catch(e){status.textContent=e.message+' Nothing was reverted.';}
        finally{busy=false;confirm.disabled=cancel.disabled=false;await refresh(true);}
      };
      actions.append(confirm,cancel);confirmation.append(actions);body.append(button,confirmation);
      if(item.conflict)body.append(el('p',item.conflict,'change-conflict'));
      body.append(parts);details.append(body);(visible.has(item.revision)?list:older).append(details);
    }
    if(data.entries.length>visible.size)list.append(older);
    panel.scrollTop=panelScroll;
    if(focused)list.querySelector('[data-revision="'+focused+'"]>summary')?.focus({preventScroll:true});
  }
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;highlight();});}
  function highlight(){
    const highlightAPI=!!(globalThis.CSS?.highlights&&globalThis.Highlight),ranges=[];
    const changes=new Map((visibility.checked?data?.highlights||[]:[]).filter(c=>!c.removed).map(c=>[c.path,c]));
    for(const node of document.querySelectorAll('#plan [data-field]')){
      const change=changes.get(node.dataset.field),matches=change&&node.textContent===change.value;
      // No DOM wrapping: selection offsets, links and annotation anchors stay intact.
      node.classList.toggle('review-changed-field',!!matches);
      node.classList.toggle('review-change-fallback',!!matches&&(!highlightAPI||!change.ranges.length));
      if(!matches||!highlightAPI)continue;
      const walker=document.createTreeWalker(node,NodeFilter.SHOW_TEXT),texts=[];let text,offset=0;
      while((text=walker.nextNode())){texts.push({text,start:offset,end:offset+text.length});offset+=text.length;}
      for(const span of change.ranges){const first=texts.find(t=>t.end>span.start),last=texts.find(t=>t.end>=span.end);if(!first||!last)continue;const range=new Range();range.setStart(first.text,span.start-first.start);range.setEnd(last.text,span.end-last.start);ranges.push(range);}
    }
    if(highlightAPI)CSS.highlights.set('plan-changes',new Highlight(...ranges));
  }
  const observer=new MutationObserver(schedule);observer.observe(document.querySelector('#plan'),{childList:true,subtree:true,characterData:true});
  async function refresh(force=false){
    const r=getRecord();if(!r)return;
    const key=r.id+':'+r.revision;if(!force&&(loadingKey===key||data?.id===r.id&&data.revision===r.revision)){schedule();return;}
    const request=++sequence;loadingKey=key;
    try{const result=await api('plans/'+r.id+'/history');if(request!==sequence||getRecord()?.revision!==result.revision)return;data=result;try{visibility.checked=localStorage.getItem('planboard:highlights:'+r.id)!=='false';}catch{}render();schedule();}
    catch(e){if(request===sequence){status.textContent='Change history is unavailable. Reconnect Planboard and reopen the review to load it.';}}
    finally{if(request===sequence)loadingKey='';}
  }
  return {refresh};
}
