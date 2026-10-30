import {setupChangeHistory} from './change-history.js';
import {setupSourceLinks} from './source-links.js';
import {renderDocument} from './document-view.js';
import {captureView,restoreView,setupTechnologySizing} from './view-state.js';
import {planFields,planTargets,isManualEditField} from './plan-content.js';
import {playChanges,cancelPlayback,prepareEdits,cancelPreparation} from './change-playback.js';
import {showBubble,refreshBubble} from './anchored-bubble.js';
import {createInspector} from './canvas-inspector.js';
import {setupReviewLayout,reveal,renderSource} from './review-layout.js';
import { setupAnnotations } from './annotations.js';
import { createCanvasView } from './canvas-view.js';
import { renderDiagrams, createNodeIcon } from './diagrams.js';
import { nodeTypes, diagramColors } from './diagram-spec.js';
import { routeEdge, routePath } from './diagram-routing.js';
const $ = selector => document.querySelector(selector);
const state = { record: null, selected: null, diagrams: null, workView: null, selection: null, annotation: null, connected: false, reviewProtocol:0, polling: false, reviewBusy: false, mapId: null, question: null, workInspector: null, activities: [], stream: null };
const node = (tag, value, cls) => { const el = document.createElement(tag); if (value !== undefined) el.textContent = value; if (cls) el.className = cls; return el; };
const clear = el => el.replaceChildren();
const sourceLinks=setupSourceLinks(document.querySelector('#plan'));
const names = { website: 'Website', webapp: 'Web app', software: 'Software', other: 'Other project' };
function message(text, error = false) { const el = $(error ? '#error' : '#notice'); el.textContent = text; el.hidden = false; }
function draft(key, value) { try { if (value === undefined) return localStorage.getItem('planboard:' + key) || ''; localStorage.setItem('planboard:' + key, value); } catch {} return ''; }
function remember(el, key) { el.value = draft(key); el.oninput = () => { draft(key, el.value); resize(el); }; resize(el); }
function resize(el) { if (el.tagName === 'TEXTAREA') { el.rows = Math.min(12, Math.max(4, el.value.split('\n').length + Math.ceil(el.value.length / 90))); } }
const responseCache=new Map();
async function api(route, data) {
  if(data!==undefined&&state.reviewProtocol<2)throw new Error('Reconnect the Planboard MCP server or reload the Pi extension to activate this update. Your draft is kept.');
  const cached=data===undefined?responseCache.get(route):null;
  const response = await fetch('api/' + route, data === undefined ? {headers:cached?{'If-None-Match':cached.etag}:{}} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  if(response.status===304&&cached)return cached.value;
  const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Request failed.');
  if(data===undefined&&response.headers.get('ETag'))responseCache.set(route,{etag:response.headers.get('ETag'),value:result});return result;
}
async function busy(form, fn) {
  const buttons = [...form.querySelectorAll('button')]; buttons.forEach(b => b.disabled = true); $('#error').hidden = true;
  try { await fn(); } catch (e) { message(e.message + ' Your input has been kept.', true); }
  finally { buttons.forEach(b => b.disabled = false); }
}
async function refreshList() {
  const result = await api('current'); state.connected = result.connected;state.reviewProtocol=result.reviewProtocol||0;if(state.reviewProtocol<2)message('Planboard has been updated. Reconnect its MCP server or reload the Pi extension before submitting changes; then reopen this review.',true);
  updateReviewActions();
  return result.record;
}
async function load(id) {
  state.record = await api('plans/' + id); if (!state.record.plan.steps.some(s => s.id === state.selected)) state.selected = null;
  history.replaceState(null, '', '?plan=' + id + location.hash); render(); await refreshList();connectActivity();
}
function connectActivity(){
  state.stream?.close();state.activities=[];
  const stream=new EventSource('api/plans/'+state.record.id+'/activity');state.stream=stream;
  stream.onmessage=e=>{try{const previous=new Map(state.activities.map(t=>[t.id,t.status])),versions=new Map(state.activities.map(t=>[t.id,t.savedRevision]));state.activities=JSON.parse(e.data);for(const task of state.activities){if(task.editPaths?.length&&task.status==='running'&&task.editing)prepareEdits(task.id+':'+task.editId,task.editPaths);if(['complete','error'].includes(task.status)&&previous.get(task.id)!==task.status)cancelPreparation();}renderConversation();updateReviewActions();if(state.activities.some(t=>previous.get(t.id)!==t.status||versions.get(t.id)!==t.savedRevision))poll();}catch{}};
  stream.onopen=()=>{state.activityDisconnected=false;renderActivity();};
  stream.onerror=()=>{state.activityDisconnected=true;renderActivity();};
}
function duration(ms){const seconds=Math.max(0,Math.floor(ms/1000));return seconds<60?seconds+'s':Math.floor(seconds/60)+'m '+seconds%60+'s';}
function renderActivity(){
  const latest=(state.record?.discussions||[]).filter(d=>d.threadId===state.question?.threadId).at(-1);
  const localTask=state.activities.find(t=>t.id===latest?.id),localOpen=$('#ask-dialog').open&&!!state.question;
  const active=runningTasks(),fallback=active.at(-1)||state.activities.at(-1);
  const localRunning=localOpen&&requestRunning();
  $('#agent-progress').hidden=!localRunning;
  $('#global-progress').hidden=!active.length||localRunning;
  for(const [prefix,task,visible]of [['agent',localTask,localRunning],['global',fallback,active.length&&!localRunning]]){
    if(!visible)continue;
    const now=Date.now(),start=task?.startedAt||now,quiet=now-(task?.updatedAt||now);
    $(prefix==='agent'?'#agent-phase':'#global-progress-label').textContent=state.activityDisconnected?'Reconnecting to activity…':task?.phase||'Sending request…';
    $('#'+prefix+'-elapsed').textContent=duration((task?.completedAt||now)-start);
    const stream=$('#'+prefix+'-stream');stream.textContent=task?.text||'';stream.hidden=!task?.text;
    const silence=$('#'+prefix+'-silence');silence.hidden=!state.activityDisconnected&&quiet<20000;
    silence.textContent=state.activityDisconnected?'Activity connection lost. Your request is saved; reconnecting.':'No new agent update for '+duration(quiet)+'. The request is still open.';
    const list=$('#'+prefix+'-events'),events=task?.events||[],signature=JSON.stringify(events);
    if(list.dataset.signature!==signature){list.dataset.signature=signature;list.replaceChildren();for(const event of events){const row=node('li'),time=node('time',duration(event.at-start)),label=node('span',event.label),status=node('small',event.status==='running'?'Running':event.status==='error'?'Failed':'Done');row.dataset.status=event.status;time.dateTime=new Date(event.at).toISOString();row.append(time,label,status);list.append(row);}}
    list.closest('details').hidden=!events.length;
  }
}
function runningTasks(){return state.activities.filter(t=>['queued','running'].includes(t.status));}
function requestRunning(q=state.question){
  if(!q)return false;const last=(state.record.discussions||[]).filter(d=>d.threadId===q.threadId).at(-1);
  return q.busy||!!(last&&(state.activities.some(t=>t.id===last.id&&['queued','running'].includes(t.status))||(!last.error&&last.status!=='answered'&&state.connected)));
}
function refreshQuestionContext(){
  const q=state.question;if(!q)return;const p=state.record.plan,a=q.annotation;
  if(a.kind==='area'){
    // An area keeps its exact scope across revisions; never expand it to replacement content.
    q.contextMissing=a.items.some(i=>i.kind==='text'?planFields(p).get(i.field)?.slice(i.start,i.end)!==i.quote:i.kind==='node'?!p.diagrams.find(d=>d.id===i.diagramId)?.nodes.find(n=>n.id===i.nodeId):!planTargets(p).has(i.elementId));
  }else if(a.kind==='text'){
    const text=planFields(p).get(a.field);q.contextMissing=typeof text!=='string'||!text.length;
    if(!q.contextMissing){const found=text.indexOf(a.quote),start=found>=0?found:0,quote=found>=0?a.quote:text.slice(0,4000).trimEnd();q.annotation={...a,quote,start,end:start+quote.length};}
  }else if(a.kind==='element'){
    const quote=planTargets(p).get(a.elementId);q.contextMissing=quote===undefined;if(!q.contextMissing)q.annotation={...a,quote};
  }else{const d=p.diagrams.find(d=>d.id===a.diagramId),n=d?.nodes.find(n=>n.id===a.nodeId);q.contextMissing=!n;if(n)q.annotation={...a,quote:n.label,layerId:d.layers.some(l=>l.id===a.layerId)?a.layerId:d.layers[0].id};}
  q.revision=state.record.revision;q.nextRecord=null;
  $('#ask-quote').textContent=q.annotation.quote;$('#ask-context-label').textContent=q.annotation.quote.slice(0,100);
}
function applyRevision(next,{animate=true}={}){
  const before=state.record.plan,saved=captureView(),maps=state.diagrams?.snapshot?.(),camera=state.workView?.snapshot?.();
  cancelPlayback();state.record=next;if(!next.plan.steps.some(s=>s.id===state.selected))state.selected=null;
  render();restoreView(saved);state.diagrams?.restore?.(maps);state.workView?.restore?.(camera);
  annotationUI.setMode(saved.mode==='explore'?false:saved.mode);refreshQuestionContext();renderConversation();refreshBubble();
  requestAnimationFrame(()=>{scrollTo({top:saved.scroll,behavior:'instant'});if(animate)void playChanges(before,next.plan);});
}

function field(el, path, value) { if (value !== undefined) el.textContent = value; el.dataset.field = path; return el; }
function list(parent, values, fallback = 'Not specified yet.', path) {
  const ul = node('ul'); values.forEach((x, i) => { if (x) { const li = node('li', x); if (path) field(li, path + '/' + i); ul.append(li); } }); parent.append(ul.childElementCount ? ul : node('p', fallback, 'muted'));
}
function render() {
  const r = state.record, p = r.plan, feedbackForm=$('#feedback-form');sourceLinks.setSource(p.sourceDocument);
  annotationUI.setMode(false);
  $('#start').hidden = true; $('#plan').hidden = false;
  const accepted = r.feedback.some(f => f.revision === r.revision && f.action === 'accept');
  $('#revision').textContent = `${names[p.kind]} · Revision ${r.revision} · ${accepted ? 'Reviewed by you' : 'Draft for review'}`;
  field($('#title'), 'title', p.title); field($('#brief'), 'brief', p.brief);
  state.diagrams?.dispose();
  const adaptive=!!p.sections;$('#legacy-sections').hidden=adaptive;$('#document-sections').hidden=!adaptive;$('#document-support').hidden=!adaptive;
  if(adaptive){
    for(const el of document.querySelectorAll('#legacy-sections [data-field],#legacy-sections [data-target],#legacy-sections [data-step]')){delete el.dataset.field;delete el.dataset.target;delete el.dataset.step;}
    for(const id of ['technologies','questions','diagrams','lanes','step-detail'])clear($('#'+id));
    state.diagrams=renderDocument($('#document-sections'),p,{field,technologies:renderTechnologies,decisions:renderQuestions});
    const support=$('#document-support');clear(support);const source=node('div');renderSource(source,p.sourceDocument,{field});support.append(source);
    const feedback=node('details',undefined,'document-detail'),summary=node('summary','Overall feedback');summary.dataset.reviewControl='true';feedbackForm.dataset.target='feedback:overall';feedback.append(summary,feedbackForm);support.append(feedback);
    void changeHistory.refresh();renderHistory();remember($('#feedback-form textarea'),r.id+':overall');annotationUI.refresh();return;
  }
  $('#questions-view .section-body').append(feedbackForm);clear($('#document-sections'));clear($('#document-support'));setLegacyTargets();
  field($('#objective'), 'objective', p.objective || 'The outcome has not been defined yet.');
  clear($('#success')); p.success.forEach((s, i) => $('#success').append(field(node('li', s), 'success/' + i)));
  clear($('#scope')); for (const [key, title] of [['now', 'In this version'], ['later', 'Later'], ['out', 'Out of scope']]) { const section = node('section'); section.dataset.target = 'scope:' + key; section.append(node('h2', title)); list(section, p.scope[key], 'Not specified yet.', 'scope/' + key); $('#scope').append(section); }
  clear($('#context')); for (const item of p.context) { const row = node('div', undefined, 'context-item'); row.append(node('small', { fact: 'Stated fact', assumption: 'Assumption to validate', unknown: 'Still unknown' }[item.kind]), field(node('p', item.detail), 'context/' + item.id + '/detail')); if(item.source){const evidence=node('details',undefined,'evidence-fold');evidence.append(node('summary','Source'),field(node('small',item.source),'context/'+item.id+'/source'));row.append(evidence);} $('#context').append(row); }
  if (!p.context.length) $('#context').append(node('p', 'No facts, assumptions or unknowns recorded yet.', 'muted'));
  clear($('#quality')); list($('#quality'), r.review.findings.map(f => f.message), 'The structural checks found no missing fields or invalid dependencies. Review the reasoning and scope yourself.');
  $('#quality').append(node('p', `${r.review.assumptions} assumptions · ${r.review.unknowns} unknowns · ${r.review.questions} questions. ${r.review.note}`, 'muted'));
  renderTechnologies(); renderFlow(); renderQuestions(); state.diagrams = renderDiagrams($('#diagrams'), p.diagrams || [], { field }); renderHistory(); remember($('#feedback-form textarea'), r.id + ':overall');
  $('#legacy-sections').append($('#source-document'));renderSource($('#source-document'),p.sourceDocument,{field});renderMapSwitcher();
  for(const[id,value]of Object.entries({'overview-view':p.scope.now.length+' in scope','technology-view':p.technologies.length+' choices','system-view':p.diagrams.length+' maps','flow-view':p.steps.length+' steps','questions-view':p.questions.length+' questions'}))$('#'+id+'-count').textContent=value;
  annotationUI.refresh();void changeHistory.refresh(); requestAnimationFrame(drawEdges);
}
function renderTechnologies(parent=$('#technologies'),choices=state.record.plan.technologies||[]) {
  const allChoices=state.record.plan.technologies||[];clear(parent);
  $('#technology-view').hidden=!choices.length;
  clear($('#technology-guide'));if(state.record.plan.diagrams.length){const link=node('button','See how these tools connect');link.type='button';link.onclick=()=>{layout.open('system-view');$('#system-view').scrollIntoView({behavior:'smooth',block:'start'});};$('#technology-guide').append(link);}
  const fits={complement:'Works together',choice:'Choose one approach',optional:'Optional capability',unspecified:'Relationship needs clarification'};
  for(const t of choices){const base='technologies/'+t.id,article=node('article',undefined,'tech-card');article.dataset.target='technology:'+t.id;article.dataset.technology=t.id;
    const fold=node('details'),summary=node('summary'),heading=node('span',undefined,'tech-heading');
    heading.append(field(node('h3',t.name),base+'/name'),field(node('span',t.role,'tech-role'),base+'/role'));const meta=node('span',undefined,'tech-meta');meta.append(node('span',fits[t.fit||'unspecified'],'tech-fit'),field(node('span',t.status,'choice-status'),base+'/status'));summary.append(heading,meta);fold.append(summary);
    const body=node('div',undefined,'tech-body'),more=node('details',undefined,'technical-detail'),moreTitle=node('summary','Implementation details');moreTitle.dataset.reviewControl='true';more.append(moreTitle);more.append(field(node('p',t.fitDetail||'The plan has not yet explained whether this is a complementary component or an alternative. Ask the agent to clarify.','fit-detail'),base+'/fitDetail'));if(t.choiceGroup)more.append(field(node('p','Decision group: '+t.choiceGroup,'muted'),base+'/choiceGroup'));const reason=node('div',undefined,'technology-details');
    for(const[label,key]of [['Why this choice','rationale'],['Tradeoffs','tradeoffs']]){const group=node('div');group.append(node('h4',label),field(node('p',t[key]||'Needs review.'),base+'/'+key));reason.append(group);}body.append(reason);
    const detail=node('div',undefined,'technology-details');
    for(const[label,key]of [[t.fit==='choice'?'Choose one of these approaches':'Alternatives or fallback approaches','alternatives'],['If changed, revisit','impacts'],['Before committing, check','checks']]){if(!t[key].length)continue;const group=node('div');group.append(node('h4',label));list(group,t[key],'None recorded.',base+'/'+key);detail.append(group);}more.append(detail);
    if(t.versionPlan){const d=node('details',undefined,'review-fold');d.append(node('summary','Version policy & source'),field(node('p',t.versionPlan),base+'/versionPlan'));if(t.source)d.append(field(node('p',t.source,'muted'),base+'/source'));more.append(d);}else if(t.source)more.append(field(node('p',t.source,'muted'),base+'/source'));
    if(t.choiceGroup){const alternatives=allChoices.filter(c=>c.id!==t.id&&c.choiceGroup===t.choiceGroup);if(alternatives.length){const links=node('div',undefined,'dependency-links');links.append(node('span','Competing options for '+t.choiceGroup));for(const c of alternatives)links.append(technologyLink(c));more.append(links);}}
    const used=allChoices.filter(c=>c.dependsOn.includes(t.id));if(used.length){const links=node('div',undefined,'dependency-links');links.append(node('span','Used by'));for(const c of used)links.append(technologyLink(c));more.append(links);}body.append(more);fold.append(body);article.append(fold);
    const deps=node('div',undefined,'dependency-links');deps.append(node('span',t.dependsOn.length?'Depends on →':'No listed prerequisite'));for(const id of t.dependsOn)deps.append(technologyLink(allChoices.find(c=>c.id===id)));if(t.dependsOn.length)article.append(deps);parent.append(article);
  }
}
function technologyLink(t){const b=node('button',t.name);b.type='button';b.dataset.techLink=t.id;b.onclick=()=>{const card=$('[data-technology="'+t.id+'"]');card.querySelector('details').open=true;reveal(card);document.querySelectorAll('.related-technology').forEach(c=>c.classList.remove('related-technology'));card.classList.add('related-technology');card.scrollIntoView({block:'center'});card.querySelector('summary').focus({preventScroll:true});};return b;}
function showDiagram(id){if(state.record.plan.sections){reveal($('#document-sections [data-diagram="'+CSS.escape(id)+'"]'));return;}state.mapId=id;renderMapSwitcher();}
function renderMapSwitcher(){const ds=state.record.plan.diagrams;clear($('#map-switcher'));if(!ds.some(d=>d.id===state.mapId))state.mapId=ds[0]?.id;
  for(const d of ds){const b=node('button',d.title);b.type='button';b.dataset.map=d.id;b.setAttribute('aria-pressed',String(d.id===state.mapId));b.onclick=()=>showDiagram(d.id);$('#map-switcher').append(b);}
  for(const root of document.querySelectorAll('[data-diagram]'))root.hidden=root.dataset.diagram!==state.mapId;requestAnimationFrame(()=>state.diagrams?.draw());
}
function renderFlow() {
  const r = state.record; clear($('#lanes')); clear($('#edges'));
  const levels = [...new Set(Object.values(r.levels))].sort((a, b) => a - b);
  let explanation=$('#legacy-delivery-explanation');if(!explanation){explanation=node('section',undefined,'diagram-walkthrough');explanation.id='legacy-delivery-explanation';$('#flow-view .flow-layout').before(explanation);}clear(explanation);explanation.append(node('h3','How to read the work order'),node('p','Start with work that has no prerequisites. Later work waits for the prerequisites named in its details. Groups show dependencies, not dates or guaranteed parallel staffing.','document-prose'));const order=node('ol',undefined,'document-list');
  for(const [i,level]of levels.entries()){const item=node('li');item.append(node('strong',i===0?'Start with these foundations':'Then work on the next dependency group'));const group=node('ul');for(const step of r.plan.steps.filter(s=>r.levels[s.id]===level))group.append(node('li',step.title+(step.summary?' — '+step.summary:'')));item.append(group);order.append(item);}explanation.append(order);

  for (const level of levels) {
    const lane = node('div', undefined, 'lane'); lane.append(node('p', level === 0 ? 'Can start first' : `After prerequisites · Stage ${level + 1}`));
    for (const step of r.plan.steps.filter(s => r.levels[s.id] === level)) {
      const button = node('button', undefined, 'system-node step');button.dataset.type='task';button.style.setProperty('--node-color',diagramColors[nodeTypes.task.color]); button.type = 'button'; button.dataset.step = step.id; button.setAttribute('aria-pressed', String(state.selected === step.id));
      const copy=node('span',undefined,'node-copy');copy.append(node('strong',step.title),node('span',step.status.replaceAll('_',' '),'node-summary'));button.append(createNodeIcon('task'),copy);button.setAttribute('aria-label',step.title+'. '+step.status.replaceAll('_',' '));
      button.addEventListener('click', () => { state.selected = step.id; renderFlow(); [...document.querySelectorAll('[data-step]')].find(b => b.dataset.step === step.id)?.focus(); requestAnimationFrame(drawEdges); }); lane.append(button);
    }
    $('#lanes').append(lane);
  }
  if (!levels.length) $('#lanes').append(node('p', 'The brief is saved. Ask your agent to turn it into a plan with steps and dependencies.', 'empty'));
  if (!state.workView) {state.workView = createCanvasView($('#graph-scroll'), $('#graph'), 'Order of work');state.workInspector=createInspector($('#graph-scroll'),state.workView,{panel:$('#step-detail'),onClose(){state.selected=null;renderFlow();}});}
  requestAnimationFrame(() => { state.workView.setSize($('#lanes').scrollWidth + 24, $('#lanes').scrollHeight + 24); drawEdges(); });
  clear($('#step-detail')); const step = r.plan.steps.find(s => s.id === state.selected); if (!step) {state.workInspector.close();return;}
  const panel = node('div', undefined, 'step-detail'); const heading=state.workInspector.header(step.title);field(heading.querySelector('h4'),'steps/'+step.id+'/title');panel.append(heading, field(node('p', step.summary), 'steps/' + step.id + '/summary'));
  for (const [title, key] of [['Why this matters', 'why'], ['What you will have', 'deliverable']]) panel.append(node('h4', title), field(node('p', step[key] || 'Needs an explanation.'), 'steps/' + step.id + '/' + key));
  panel.append(node('h4', 'How to verify it')); list(panel, step.acceptance, 'Needs a verification method.', 'steps/' + step.id + '/acceptance');
  panel.append(node('h4', 'Depends on'));
  if (!step.dependsOn.length) panel.append(node('p', 'No prerequisite steps.'));
  for (const id of step.dependsOn) { const target = r.plan.steps.find(s => s.id === id), b = node('button', target.title, 'dep'); b.addEventListener('click', () => { state.selected = id; renderFlow(); [...document.querySelectorAll('[data-step]')].find(b => b.dataset.step === id)?.focus(); requestAnimationFrame(drawEdges); }); panel.append(b); }
  const form = node('form'), label = node('label', 'Feedback on this step'), area = node('textarea'); area.maxLength = 12000; area.rows = 4; label.append(area); const actions = node('div', undefined, 'actions'); actions.append(node('button', 'Save step feedback', 'primary')); form.append(label, actions); form.dataset.target = 'feedback:step:' + step.id; remember(area, r.id + ':step:' + step.id);
  form.addEventListener('submit', e => { e.preventDefault(); busy(form, async () => { await send('comment', area.value, step.id); draft(r.id + ':step:' + step.id, ''); area.value = ''; }); }); panel.append(form); $('#step-detail').append(panel);state.workInspector.open($('[data-step="'+step.id+'"]'),diagramColors[nodeTypes.task.color]);
}
function drawEdges() {
  if ($('#flow-view').hidden || !state.record) return;
  const graph = $('#graph'), svg = $('#edges'); clear(svg); svg.setAttribute('width', graph.offsetWidth); svg.setAttribute('height', graph.offsetHeight);
  const scale = Number(graph.dataset.scale) || 1;
  const bounds = graph.getBoundingClientRect(), buttons = new Map([...document.querySelectorAll('[data-step]')].map(b => [b.dataset.step, b]));
  const boxes=new Map([...buttons].map(([id,button])=>{const r=button.getBoundingClientRect();return [id,{x:(r.left-bounds.left)/scale,y:(r.top-bounds.top)/scale,width:r.width/scale,height:r.height/scale}];}));
  for (const step of state.record.plan.steps) for (const source of step.dependsOn) {
    const a=boxes.get(source),b=boxes.get(step.id);if(!a||!b)continue;
    const points=routeEdge(a,b,[...boxes.values()]),line=document.createElementNS('http://www.w3.org/2000/svg','path');line.setAttribute('d',routePath(points));line.setAttribute('class','connection-line');
    const end=points.at(-1),prev=points.at(-2),angle=Math.atan2(end.y-prev.y,end.x-prev.x),size=9,arrow=document.createElementNS('http://www.w3.org/2000/svg','path');
    arrow.setAttribute('d',`M${end.x} ${end.y} L${end.x-size*Math.cos(angle-.45)} ${end.y-size*Math.sin(angle-.45)} L${end.x-size*Math.cos(angle+.45)} ${end.y-size*Math.sin(angle+.45)} Z`);arrow.setAttribute('class','connection-arrow');svg.append(line,arrow);
  }
}
function renderQuestions(parent=$('#questions'),questions=state.record.plan.questions) {
  clear(parent); const r = state.record;
  for (const q of questions) {
    const form = node('form', undefined, 'question'), fieldset = node('fieldset'), legend = node('legend', q.question, 'sr-only'), why = field(node('p', q.why, 'muted'), 'questions/' + q.id + '/why'); fieldset.append(legend, why); form.dataset.target = 'question:' + q.id;
    q.options.forEach((o, index) => { const label = node('label', undefined, 'option'), input = node('input'), copy = node('span'); input.type = 'radio'; input.name = q.id; input.value = o.label; input.checked = draft(r.id + ':choice:' + q.id) === o.label; input.addEventListener('change', () => draft(r.id + ':choice:' + q.id, o.label)); const base = 'questions/' + q.id + '/options/' + index; const benefit = node('small', 'Benefit: '), tradeoff = node('small', 'Tradeoff: '); benefit.append(field(node('span', o.benefit || 'Not explained.'), base + '/benefit')); tradeoff.append(field(node('span', o.tradeoff || 'Not explained.'), base + '/tradeoff')); copy.append(field(node('strong', o.label), base + '/label'), benefit, tradeoff); label.append(input, copy); fieldset.append(label); });
    form.append(fieldset); if (q.recommendation) form.append(field(node('p', 'Recommendation: '+q.recommendation, 'recommendation'), 'questions/' + q.id + '/recommendation'));
    const label = node('label', 'Your own answer or additional context'), area = node('textarea'); area.maxLength = 12000; area.rows = 4; label.append(area); const actions = node('div', undefined, 'actions'); actions.append(node('button', 'Save answer', 'primary')); const own=node('details',undefined,'own-answer');own.append(node('summary','Add your own answer or context'),label);form.append(own,actions);remember(area,r.id+':answer:'+q.id);if(area.value)own.open=true;
    form.addEventListener('submit', e => { e.preventDefault(); busy(form, async () => { const choice = form.querySelector('input:checked')?.value; await send('answer', [choice, area.value].filter(Boolean).join('\n'), q.id); draft(r.id + ':answer:' + q.id, ''); draft(r.id + ':choice:' + q.id, ''); area.value = ''; form.querySelectorAll('input').forEach(i => i.checked = false); }); }); const fold=node('details',undefined,'decision-card'),summary=node('summary');summary.append(field(node('span',q.question),'questions/'+q.id+'/question'));fold.append(summary,form);parent.append(fold);
  }
  if (!questions.length) parent.append(node('p', 'No questions have been recorded. You can still leave feedback below.', 'muted'));
}
function renderHistory() {
  clear($('#history')); for (const f of [...state.record.feedback].reverse()) {
    const row = node('div', undefined, 'history-item'); row.append(node('small', `Revision ${f.revision} · ${f.action}${f.target ? ' · ' + f.target : ''}`));
    if (f.annotation) {
      row.append(node('blockquote', f.annotation.quote));
      if (f.annotation.kind === 'node') row.append(node('small', `Diagram: ${f.annotation.diagramId} · Layer: ${f.annotation.layerId}`));
      if (f.revision === state.record.revision) { const locate = node('button', 'Show in plan'); locate.type = 'button'; locate.addEventListener('click', () => locateAnnotation(f.annotation)); row.append(locate); }
      else row.append(node('small', 'This annotation belongs to an earlier revision; its original wording is preserved.'));
    }
    row.append(node('p', f.text || 'This revision was accepted for planning.')); $('#history').append(row);
  }
  if (!state.record.feedback.length) $('#history').append(node('p', 'No notes yet. Turn on Annotate and click something in the plan.', 'muted')); annotationUI.refresh(); updateReviewActions();
}

function openAnnotation(annotation, context, element, mode, box) { openQuestion(annotation,element,mode,box); }
function locateAnnotation(a) {
  let root;
  if (a.kind === 'element') root = [...document.querySelectorAll('[data-target]')].find(n => n.dataset.target === a.elementId) || [...document.querySelectorAll('[data-step]')].find(n => 'step:' + n.dataset.step === a.elementId);
  else if (a.kind === 'node') {if(!state.record.plan.sections)layout.open('system-view');showDiagram(a.diagramId);root = state.diagrams.focus(a.diagramId, a.layerId, a.nodeId);}
  else {
    const parts = a.field.split('/');
    if (parts[0] === 'diagrams') {if(!state.record.plan.sections)layout.open('system-view');showDiagram(parts[1]);}
    if (parts[0] === 'diagrams') state.diagrams.focus(parts[1], parts[2] === 'layers' ? parts[3] : undefined, parts[4] === 'nodes' ? parts[5] : parts[2] === 'nodes' ? parts[3] : undefined,parts[2]==='walkthroughs'?parts[3]:undefined,parts[2]==='walkthroughs'&&parts[4]==='steps'?parts[5]:undefined);
    if (parts[0] === 'steps'&&!state.record.plan.sections) { state.selected = parts[1]; renderFlow(); requestAnimationFrame(drawEdges); }
    root = [...document.querySelectorAll('[data-field]')].find(n => n.dataset.field === a.field);
  }
  if (!root) return message('The original text is preserved in the annotation; this location is not currently displayed.');
  document.querySelectorAll('.annotation-target').forEach(n => n.classList.remove('annotation-target'));
  reveal(root);root.classList.add('annotation-target'); root.tabIndex = -1; root.focus({ preventScroll: true }); root.scrollIntoView({ block: 'center' });
}
async function send(action, text, target = '') {
  const r = state.record;
  const result = await api(`plans/${r.id}/feedback`, { revision: r.revision, action, text, target });
  r.feedback.push(result.entry); renderHistory();
  message('Feedback saved. Use Send annotations to agent when you are ready.');
  if (action === 'accept') $('#revision').textContent = `${names[r.plan.kind]} · Revision ${r.revision} · Reviewed by you`;
}

$('#feedback-form').addEventListener('submit', e => { e.preventDefault(); const form = e.currentTarget; busy(form, async () => { await send('comment', form.elements.feedback.value); draft(state.record.id + ':overall', ''); form.elements.feedback.value = ''; }); });

window.addEventListener('resize', () => requestAnimationFrame(() => { drawEdges(); state.diagrams?.draw(); }));
function sameContext(a,b){return a.kind===b.kind && (a.kind==='area'?a.items.length===b.items.length&&a.items.every((item,i)=>sameContext(item,b.items[i])):a.kind==='text'?a.field===b.field&&a.start===b.start&&a.end===b.end:a.kind==='node'?a.diagramId===b.diagramId&&a.nodeId===b.nodeId&&a.layerId===b.layerId:a.elementId===b.elementId);}
const intentCopy={ask:{label:'Your question',button:'Ask agent',placeholder:'What would you like explained?',hint:'Ask for a clear explanation of this part.'},change:{label:'Requested change',button:'Request change',placeholder:'Describe what should change, or what you want to keep.',hint:'Request the change now, or save it with your review notes to send together later.'}};
function openQuestion(annotation,element,mode='annotate',box){
  const r=state.record,previous=(r.discussions||[]).findLast(q=>q.revision===r.revision&&(mode==='ask'?q.intent==='ask':q.intent!=='ask')&&sameContext(q.annotation,annotation));
  const key=`${r.id}:ask:${r.revision}:${JSON.stringify(annotation)}`;
  state.question={annotation,revision:r.revision,threadId:previous?.threadId,key,mode,busy:false,intent:mode==='ask'?'ask':'change',compose:true,messageId:null,selectedOptions:{}};
  if(draft(key)&&!draft(key+':ask')){draft(key+':ask',draft(key));draft(key,'');}
  $('#ask-quote').textContent=annotation.quote;$('#ask-context-label').textContent=annotation.quote.length>100?annotation.quote.slice(0,97)+'…':annotation.quote;
  const legacy=`${r.id}:annotation:${r.revision}:${JSON.stringify(annotation)}`;state.question.legacyKey=legacy;if(draft(legacy)&&!draft(key+':change'))draft(key+':change',draft(legacy));
  setIntent(mode==='ask'?'ask':'change');showBubble($('#ask-dialog'),()=>annotationUI.anchor(state.question.annotation)||element);annotationUI.selectArea(mode==='ask'?annotation:null,box);$('#ask-form textarea').focus({preventScroll:true});
}
function setIntent(intent){
  const q=state.question;if(!q)return;q.intent=intent;q.compose=true;q.error='';const copy=intentCopy[intent];
  $('#ask-title').textContent=q.mode==='ask'?'Ask about this area':'Request change';
  $('#agent-intents').hidden=q.mode==='ask';
  $('#ask-label').textContent=copy.label;$('#ask-send').textContent=copy.button;
  const area=$('#ask-form textarea');area.placeholder=copy.placeholder;area.required=true;remember(area,q.key+':'+intent);renderConversation();
}
$('#write-change').addEventListener('click',()=>{if(!requestRunning())setIntent('change');});
function renderConversation(){
  if(!state.question)return;
  const q=state.question,items=(state.record.discussions||[]).filter(d=>d.threadId===q.threadId),last=items.at(-1),waiting=last&&last.status!=='answered';
  const item=q.sending?null:last;
  const thread=$('#ask-thread');clear(thread);
  if(item){const choosing=!!item.options?.length&&!q.compose;const user=node('div',undefined,'chat-message');user.append(node('small',({ask:'Your question',change:'Your change request',alternatives:'Your alternatives request'})[item.intent||'ask']),node('p',item.question));if(!choosing)thread.append(user);
    if(item.answer&&!choosing){const answer=node('div',undefined,'chat-message agent-answer');answer.append(node('small',item.operation?'Planboard':'Reply'));for(const paragraph of item.answer.split(/\n\n+/))answer.append(node('p',paragraph));thread.append(answer);}
    if(item.options?.length){
      const form=node('form',undefined,'alternative-choices'),group=node('fieldset'),legend=node('legend','Choose an approach');group.append(legend);
      for(const option of item.options){const label=node('label',undefined,'alternative-choice'),input=node('input'),copy=node('span');input.type='radio';input.name='alternative';input.value=option.id;input.checked=q.selectedOptions[item.id]===option.id;input.required=true;input.addEventListener('change',()=>{q.selectedOptions[item.id]=option.id;renderConversation();$('#ask-thread input[value="'+CSS.escape(option.id)+'"]').focus({preventScroll:true});});copy.append(node('strong',option.label));const selected=q.selectedOptions[item.id]===option.id;const description=node('span',option.description,'alternative-description');description.hidden=!selected;copy.append(description);if(option.tradeoff){const tradeoff=node('small','Tradeoff: '+option.tradeoff);tradeoff.hidden=!selected;copy.append(tradeoff);}label.append(input,copy);group.append(label);}
      const actions=node('div',undefined,'actions'),choose=node('button','Use selected alternative','primary');choose.type='submit';choose.disabled=q.busy||!!waiting||!!q.nextRecord||!q.selectedOptions[item.id];actions.append(choose);form.append(group,actions);
      form.addEventListener('submit',e=>{e.preventDefault();const option=item.options.find(o=>o.id===q.selectedOptions[item.id]);if(option)askAgent(false,{intent:'change',question:'Use '+option.label+' for the selected part of the plan.',selection:{questionId:item.id,optionId:option.id}});});thread.append(form);
    }
  }
  $('#ask-dialog').classList.toggle('choosing-alternative',!!item?.options?.length&&!q.compose);
  $('#ask-form').hidden=!q.compose;
  $('#save-review-note').hidden=q.intent!=='change';$('#save-review-note').disabled=requestRunning(q)||!!q.contextMissing;$('#ask-form textarea').disabled=requestRunning(q);
  $('#suggest-alternatives').disabled=requestRunning(q)||!!waiting||!!q.nextRecord||!!q.contextMissing;
  const running=requestRunning(q);
  for(const id of ['annotate-toggle','ask-toggle','edit-toggle','write-change'])$('#'+id).disabled=running;
  $('#write-change').hidden=q.compose;
  $('#agent-intents').setAttribute('aria-busy',String(running));
  const task=state.activities.find(t=>t.id===last?.id);
  $('#agent-progress').hidden=!running;
  $('#agent-phase').textContent=task?.phase||(q.busy?'Sending request…':'Waiting for the agent…');
  $('#agent-stream').textContent=task?.text||'';$('#agent-stream').hidden=!task?.text;
  for(const id of ['saved-explanation','saved-dependencies','undo-change'])$('#'+id).disabled=running||!!q.nextRecord||!!q.contextMissing;
  $('#quick-actions').hidden=state.reviewProtocol<2;$('#undo-change').hidden=state.record.revision<2||q.annotation.kind==='area';
  renderActivity();
  $('#ask-send').disabled=running||!!waiting||!!q.nextRecord||!!q.contextMissing;
  $('#ask-retry').hidden=last?.status!=='queued'||!last?.error||!state.connected;$('#ask-retry').disabled=q.busy||!state.connected;
  $('#show-agent-revision').hidden=!q.nextRecord;$('#show-agent-revision').disabled=running;
  $('#ask-status').hidden=!!item?.options?.length&&!q.compose&&!q.error;
  $('#ask-status').textContent=q.contextMissing?'This part was removed. Your conversation is kept; select another part to continue.':q.error?q.error:last?.error?last.error:q.nextRecord?'The agent saved a new revision. Show the updated plan to continue.':!state.connected?(last?.status==='queued'?'Request queued. Reopen this plan from your agent session to continue.':'No agent connected. Requests are queued; saved annotations stay in your review.'):last?.status==='queued'?(last.error?'Delivery failed. Your request is saved; retry.':'Request saved. Connecting to the agent…'):waiting?'Request sent. Waiting for the agent…':!q.compose?'Choose an agent suggestion, or use Request change to describe your own change.':intentCopy[q.intent].hint;
  refreshBubble();
}
async function askAgent(retry=false,override){
  const q=state.question;if(!q||q.busy||q.contextMissing)return;
  const intent=override?.intent||q.intent,value=override?.question||$('#ask-form textarea').value||'Suggest alternative approaches for this part of the plan, with their tradeoffs.';
  q.busy=true;q.sending=true;q.error='';renderConversation();
  try{
    const last=(state.record.discussions||[]).filter(d=>d.threadId===q.threadId).at(-1);
    const input=retry?{questionId:last.id}:{revision:q.revision,annotation:q.annotation,threadId:q.threadId,intent,question:value,...(override?.selection?{selection:override.selection}:{}),...(override?.operation?{operation:override.operation}:{})};
    const result=await api(`plans/${state.record.id}/ask`,input);
    state.record.discussions=result.discussions;q.threadId=result.question.threadId;q.sending=false;
    if(!retry&&!override){draft(q.key+':'+intent,'');if(intent==='change'&&q.legacyKey)draft(q.legacyKey,'');if(q.intent===intent)$('#ask-form textarea').value='';}
    q.busy=false;if(override?.intent==='change')setIntent('change');else renderConversation();setTimeout(poll,150);
  }catch(error){q.busy=false;q.sending=false;q.error=error.message;renderConversation();}
}
for(const [id,kind,question] of [['saved-explanation','explanation','Show saved explanation'],['saved-dependencies','dependencies','What depends on this?'],['undo-change','undo','Undo last change']])$('#'+id).addEventListener('click',()=>{$('#quick-actions').open=false;askAgent(false,{intent:kind==='undo'?'change':'ask',question,operation:{kind,...(kind==='undo'?{revision:state.record.revision}:{})}});});
$('#suggest-alternatives').addEventListener('click',()=>{state.question.compose=false;askAgent(false,{intent:'alternatives',question:'Suggest alternative approaches for this selected part of the plan, explaining their benefits and tradeoffs. Generate the alternatives yourself from the plan context.'});});
$('#ask-form').addEventListener('submit',e=>{e.preventDefault();askAgent();});
$('#ask-retry').addEventListener('click',()=>askAgent(true));
$('#save-review-note').addEventListener('click',async()=>{
  const q=state.question,area=$('#ask-form textarea');if(q.busy||!area.reportValidity())return;
  const text=area.value;q.busy=true;q.error='';renderConversation();
  try{
    const result=await api(`plans/${state.record.id}/feedback`,{revision:q.revision,action:'annotate',text,annotation:q.annotation});
    state.record.feedback.push(result.entry);renderHistory();draft(q.key+':change','');if(q.legacyKey)draft(q.legacyKey,'');area.value='';$('#ask-dialog').close();
    message('Annotation saved. Use Send annotations to agent when you are ready.');
    if(q.annotation.kind==='text')requestAnimationFrame(()=>locateAnnotation(q.annotation));
  }catch(error){q.error=error.message+' Your annotation draft is kept.';}finally{q.busy=false;renderConversation();}
});
$('#ask-close').addEventListener('click',()=>$('#ask-dialog').close());
$('#ask-dialog').addEventListener('close',()=>renderActivity());
$('#show-agent-revision').addEventListener('click',()=>{const next=state.question?.nextRecord;if(!next)return;applyRevision(next);message('Updated plan loaded.');});
function manualEditTarget(element){
  if(!element||element.closest('button,summary,h1,h2,h3,h4,h5,h6,th,label,input,textarea,select,[role="button"],[data-review-control]'))return null;
  const target=element.closest('[data-field]'),field=target?.dataset.field;
  return target&&state.record&&isManualEditField(field)?{element:target,field}:null;
}
function openManualEdit(element){
  const target=manualEditTarget(element);if(!target)return;
  const {field}=target,value=planFields(state.record.plan).get(field);
  const key=state.record.id+':edit:'+state.record.revision+':'+field;
  state.manualEdit={field,revision:state.record.revision,key,busy:false};
  const area=$('#edit-form textarea');remember(area,key);
  // A saved empty string is also a valid draft.
  try{if(localStorage.getItem('planboard:'+key)===null)area.value=value;}catch{area.value=value;}
  resize(area);$('#edit-status').textContent='';
  showBubble($('#edit-dialog'),()=>annotationUI.resolve({kind:'text',field})||target.element);area.focus({preventScroll:true});
}
for(const id of ['edit-close','edit-cancel'])$('#'+id).onclick=()=>{if(!state.manualEdit?.busy)$('#edit-dialog').close();};
$('#edit-form').addEventListener('submit',async e=>{
  e.preventDefault();const edit=state.manualEdit;if(!edit||edit.busy)return;
  const form=e.currentTarget,value=form.elements.text.value;edit.busy=true;
  for(const b of $('#edit-dialog').querySelectorAll('button,textarea'))b.disabled=true;
  $('#edit-status').textContent='Saving…';
  try{
    const {record}=await api('plans/'+state.record.id+'/edit',{revision:edit.revision,path:edit.field,value});
    draft(edit.key,'');$('#edit-dialog').close();applyRevision(record,{animate:false});message('Text saved to the reviewed plan.');
  }catch(error){$('#edit-status').textContent=error.message+' Your text is kept here; copy it before reloading a newer revision.';}
  finally{edit.busy=false;for(const b of $('#edit-dialog').querySelectorAll('button,textarea'))b.disabled=false;}
});
function renderFiles(){
  const r=state.record,el=$('#plan-files');if(!r)return;const signature=JSON.stringify([r.id,r.revision,r.document?.status,r.approval?.path,state.reviewBusy,runningTasks().length>0,state.connected,state.reviewProtocol]);if(el.dataset.signature===signature)return;el.dataset.signature=signature;clear(el);if(state.reviewProtocol<2){el.append(node('p','Reconnect Planboard to enable the updated review actions and Markdown handoff.'));return;}
  const ready=r.document?.status==='synced',path=r.approval?.path||r.files?.reviewed;
  const label=node('p',r.approval?'Approved Markdown':ready?'Reviewed Markdown':'Detailed Markdown needs reconciliation');el.append(label);
  if(path){const code=node('code',path,'saved-path');el.append(code);}
  if(ready){const link=node('a','Download '+(r.approval?'approved':'reviewed')+' Markdown');link.href='api/plans/'+r.id+'/export?format=md&document='+(r.approval?'approved':'reviewed');link.download='plan-r'+r.revision+'.md';el.append(link);}
  else {const b=node('button','Reconcile Markdown');b.type='button';b.disabled=state.reviewBusy||runningTasks().length>0||!state.connected;b.addEventListener('click',async()=>{b.disabled=true;try{await api('plans/'+r.id+'/ask',{revision:r.revision,intent:'change',question:'Reconcile the complete detailed Markdown with the reviewed plan. Preserve all original requirements except explicit reviewed changes, resolve superseded wording, and save using reconcile with reviewedMarkdown and this questionId plus answer. Do not implement the project.',annotation:{kind:'element',elementId:'overview'}});message('Markdown reconciliation sent to your agent.');await poll();}catch(e){message(e.message);}finally{b.disabled=false;}});el.append(b);}
}
function updateReviewActions() {
  const r = state.record; $('#review-actions').hidden = !r;
  const tasks=runningTasks();const running=state.reviewBusy||tasks.length>0;
  renderActivity();renderFiles();
  $('#review-actions').setAttribute('aria-busy',String(running));
  if (!r) { $('#approve-plan').disabled=true;$('#send-review').disabled=true;$('#footer-status').textContent = 'No plan to review yet.'; return; }
  const submissions = r.submissions || [], submitted = new Set(submissions.flatMap(s => s.feedbackIds));
  const pending = r.feedback.filter(f => !submitted.has(f.id) && ['annotate','comment','answer','changes'].includes(f.action)).length;
  const queued = submissions.filter(s => s.status === 'queued').length;
  const approved = submissions.some(s => s.action === 'accept' && s.revision === r.revision);
  $('#send-review').disabled = state.reviewProtocol<2 || running || (!pending && !(state.connected && queued));
  $('#approve-plan').disabled = state.reviewProtocol<2 || running || approved;
  const status = $('#footer-status'); status.dataset.error = 'false';
  status.textContent = approved ? 'Plan approved and saved. Your agent will ask whether you want implementation. If disconnected, reopen the review from your agent to deliver it.'
    : queued ? (state.connected ? 'Review queued. If delivery failed, use Send annotations to agent to retry.' : 'Review queued locally. Reopen this plan from your agent session to deliver it.')
    : pending ? `${pending} saved ${pending === 1 ? 'note' : 'notes'} ready to send.`
    : submissions.length ? 'Review sent. This page will update when the agent saves a revision.'
    : 'Save annotations or feedback, then send them together when you are ready.';
}
async function submitReview(approve = false) {
  if (state.reviewBusy) return;
  state.reviewBusy = true; updateReviewActions();
  $('#confirm-approval').disabled = true; $('#approval-error').hidden = true;
  try {
    const r = state.record;
    const result = await api(`plans/${r.id}/${approve ? 'approve' : 'submit'}`, { revision: r.revision });
    // Preserve the rendered revision until poll can safely refresh an active editor.
    state.record.feedback = result.record.feedback; state.record.submissions = result.record.submissions;state.record.approval=result.record.approval;state.record.files=result.record.files;
    renderHistory();
    if (approve) {
      $('#approval-dialog').close();
      $('#revision').textContent = `${names[r.plan.kind]} · Revision ${r.revision} · Approved by you`;
      window.close();
    }
  } catch (e) {
    if (approve) { $('#approval-error').textContent = e.message; $('#approval-error').hidden = false; }
    else { $('#footer-status').textContent = e.message + ' Your notes are kept. Try again.'; $('#footer-status').dataset.error = 'true'; }
    return;
  } finally {
    state.reviewBusy = false; $('#confirm-approval').disabled = false;
    const error = $('#footer-status').dataset.error === 'true' ? $('#footer-status').textContent : '';
    updateReviewActions();
    if (error) { $('#footer-status').textContent = error; $('#footer-status').dataset.error = 'true'; }
  }
}
$('#send-review').addEventListener('click', () => submitReview());
$('#approve-plan').addEventListener('click', () => {
  document.querySelectorAll('.anchored-bubble[open]').forEach(d=>d.close());
  $('#approval-description').textContent = `Approve revision ${state.record.revision} of “${state.record.plan.title}”? Saved feedback will be included. Unfinished text drafts stay saved in this browser.`;
  $('#approval-path').textContent=state.record.files?.reviewed?.replace(/\.reviewed\.md$/, '-r'+state.record.revision+'.approved.md')||'The agent will receive the saved path.';
  $('#approval-error').hidden = true; $('#approval-dialog').showModal();
});
$('#cancel-approval').addEventListener('click', () => $('#approval-dialog').close());
$('#confirm-approval').addEventListener('click', () => submitReview(true));
async function poll() {
  if(state.polling){state.pollAgain=true;return;}
  if (!state.record || state.reviewBusy || document.hidden) return; state.polling = true;
  try {
    const next = await api('plans/' + state.record.id);
    if(next===state.record)return;
    if (next.revision !== state.record.revision && (!runningTasks().length||state.activities.some(t=>t.savedRevision>=next.revision))) {
      const completedChange=state.question&&(next.discussions||[]).findLast(d=>d.threadId===state.question.threadId&&d.intent==='change'&&d.status==='answered');
      if($('#ask-dialog').open&&(completedChange||state.activities.some(t=>t.savedRevision>=next.revision))&&!state.question.busy&&!$('#ask-form textarea').value.trim()){
        applyRevision(next,{animate:!state.activities.some(t=>t.local&&t.savedRevision===next.revision)});message(completedChange?.answer||'The agent saved the change.');
      } else if (document.querySelector('dialog[open], textarea:focus, input:focus')) {
        message('A new revision is ready. Finish your current note; the plan will refresh automatically. Your drafts are kept.');
        if($('#ask-dialog').open&&state.question){state.question.nextRecord=next;renderConversation();}
      } else {
        applyRevision(next,{animate:!state.activities.some(t=>t.local&&t.savedRevision===next.revision)});
        message(`Updated the plan to revision ${next.revision}. Your earlier notes and unfinished drafts are kept.`);
      }
    } else if (JSON.stringify(next.feedback) !== JSON.stringify(state.record.feedback) || JSON.stringify(next.submissions) !== JSON.stringify(state.record.submissions)) {
      state.record.feedback = next.feedback; state.record.submissions = next.submissions; renderHistory();
    }
    if(JSON.stringify(next.discussions)!==JSON.stringify(state.record.discussions)){state.record.discussions=next.discussions;renderConversation();}
    if(JSON.stringify(next.reviewState)!==JSON.stringify(state.record.reviewState)){state.record.reviewState=next.reviewState;void changeHistory.refresh(true);}
  } catch { $('#footer-status').textContent = 'Connection lost. Your draft is kept; reopen the board from your agent session to reconnect.'; }
  finally { state.polling = false;if(state.pollAgain){state.pollAgain=false;queueMicrotask(poll);} }
}
new ResizeObserver(()=>{document.documentElement.style.setProperty('--review-bar-height',$('#review-footer').offsetHeight+'px');refreshBubble();}).observe($('#review-footer'));
setupTechnologySizing();
const layout=setupReviewLayout({onOpen:()=>requestAnimationFrame(()=>{drawEdges();state.diagrams?.draw();annotationUI.refresh();})});
const annotationUI = setupAnnotations({ getRecord: () => state.record, open: openAnnotation, edit:openManualEdit, getEditable:manualEditTarget, locked:()=>requestRunning()||!!state.manualEdit?.busy });
const changeHistory=setupChangeHistory({api,getRecord:()=>state.record,applyRevision,reveal,showDiagram,onChange:message});
function setLegacyTargets(){for (const [id, target] of Object.entries({ 'overview-view':'overview', 'technology-view':'technology', 'system-view':'system', 'flow-view':'delivery', 'questions-view':'decisions', quality:'quality', context:'context', 'feedback-form':'feedback:overall' })) $('#' + id).dataset.target = target;}setLegacyTargets();
try { const current = await refreshList(); const id = new URL(location.href).searchParams.get('plan'); if (id || current) await load(id || current.id); if (location.hash) requestAnimationFrame(() => {const target=document.getElementById(location.hash.slice(1));if(target){target.querySelector('.section-fold')?.setAttribute('open','');reveal(target);target.scrollIntoView({block:'start'});}}); } catch (e) { message(e.message + ' Reopen the board from your agent session if it has restarted.', true); }
// SSE carries activity; polling is only a recovery path for external file edits.
setInterval(poll,3000);
setInterval(()=>{if(runningTasks().length)renderActivity();},1000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)poll();});
