import {documentSections,workflow,documentMarkdown} from './document.mjs';
import { mkdir, readFile, writeFile, rename, readdir, lstat, realpath, unlink } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { resolveNodeType } from '../web/diagram-spec.js';
import { diagrams } from './diagrams.mjs';
import { planFields, planTargets, mermaidSource } from '../web/plan-content.js';
import {differences,applyOperations,planFingerprint,fingerprint,textFingerprint,same} from './plan-operations.mjs';
import {reviewedDocument,sourceText} from './review-document.mjs';
import {reverseMarkdown,changedFields} from './revision-history.mjs';

export const kinds = ['website', 'webapp', 'software', 'other'];
const fail = message => { throw new Error(message); };
const text = (value, name, max = 6000) => typeof value === 'string' && value.length <= max ? value.trim() : fail(`${name} must be text, at most ${max} characters.`);
const list = (value, name, max = 60) => value === undefined ? [] : Array.isArray(value) && value.length <= max ? value : fail(`${name} must be a list with at most ${max} items.`);
const strings = (value, name) => list(value, name).map(x => text(x, name));
export const validId = id => typeof id === 'string' && /^[a-z0-9][a-z0-9_-]{0,79}$/.test(id);
function unique(items, name) {
  const ids = new Set();
  for (const item of items) { if (!validId(item.id) || ids.has(item.id)) fail(`${name} need unique short lowercase IDs.`); ids.add(item.id); }
}
export function normalize(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('Plan must be an object.');
  if (input.schemaVersion !== undefined && ![1,2].includes(input.schemaVersion)) fail('Unsupported plan schema version.');
  const plan = { schemaVersion: input.schemaVersion??(input.sections?2:1), title: text(input.title, 'Title', 160), kind: input.kind, brief: text(input.brief, 'Brief'), objective: text(input.objective ?? '', 'Objective'), success: strings(input.success, 'Success measures'), scope: { now: strings(input.scope?.now, 'Now scope'), later: strings(input.scope?.later, 'Later scope'), out: strings(input.scope?.out, 'Out of scope') } };
  if (!plan.title || !plan.brief || !kinds.includes(plan.kind)) fail('A title, brief and valid project type are required.');
  plan.context = list(input.context, 'Context').map(x => ({ id: x.id, kind: ['fact', 'assumption', 'unknown'].includes(x.kind) ? x.kind : fail('Context kind must be fact, assumption or unknown.'), detail: text(x.detail, 'Context detail'), source: text(x.source ?? '', 'Source', 2000) }));
  if(input.sourceDocument!==undefined){const source=input.sourceDocument;if(!source||typeof source!=='object')fail('Source document must be an object.');
    plan.sourceDocument={name:text(source.name,'Source filename',160),sections:list(source.sections,'Source sections',60).map(s=>({id:s.id,title:text(s.title,'Source section title',300),content:typeof s.content==='string'&&s.content.length<=40000?s.content:fail('Source section must be text up to 40000 characters.')}))};
    if(source.path!==undefined)plan.sourceDocument.path=text(source.path,'Source path',4000);if(source.sha256!==undefined){if(!/^[a-f0-9]{64}$/.test(source.sha256))fail('Invalid source fingerprint.');plan.sourceDocument.sha256=source.sha256;}
    unique(plan.sourceDocument.sections,'Source sections');if(plan.sourceDocument.sections.reduce((n,s)=>n+s.content.length,0)>200000)fail('Source document is too large.');
  }
  plan.technologies = list(input.technologies, 'Technologies', 30).map(t => ({
    id:t.id, name:text(t.name,'Technology name',160), role:text(t.role,'Technology role',300),
    status:['proposed','confirmed','deferred'].includes(t.status ?? 'proposed') ? t.status ?? 'proposed' : fail('Unknown technology decision status.'),
    rationale:text(t.rationale ?? '', 'Technology rationale'), tradeoffs:text(t.tradeoffs ?? '', 'Technology tradeoffs'),
    alternatives:strings(t.alternatives,'Technology alternatives'), dependsOn:strings(t.dependsOn,'Technology dependencies'),
    impacts:strings(t.impacts,'Affected parts'), checks:strings(t.checks,'Technology checks'),
    source:text(t.source ?? '', 'Technology source',2000), versionPlan:text(t.versionPlan ?? '', 'Version plan',2000),
    fit:['complement','choice','optional','unspecified'].includes(t.fit ?? 'unspecified') ? t.fit ?? 'unspecified' : fail('Unknown technology relationship.'),
    fitDetail:text(t.fitDetail ?? '', 'How technologies fit together'), choiceGroup:text(t.choiceGroup ?? '', 'Alternative group',160)
  }));
  unique(plan.technologies,'Technologies');
  const technologies = new Set(plan.technologies.map(t=>t.id));
  if(plan.technologies.some(t=>!t.name||!t.role))fail('Technology choices need a name and role.');
  if(plan.technologies.some(t=>new Set(t.dependsOn).size!==t.dependsOn.length||t.dependsOn.some(id=>id===t.id||!technologies.has(id))))fail('Technology dependencies must reference other technology choices once each.');
  plan.steps = list(input.steps, 'Steps', 40).map(x => ({ id: x.id, title: text(x.title, 'Step title', 160), summary: text(x.summary ?? '', 'Step summary'), why: text(x.why ?? '', 'Step reason'), deliverable: text(x.deliverable ?? '', 'Deliverable'), acceptance: strings(x.acceptance, 'Step checks'), dependsOn: strings(x.dependsOn, 'Dependencies'), status: ['planned', 'in_progress', 'done', 'blocked'].includes(x.status ?? 'planned') ? x.status ?? 'planned' : fail('Unknown step status.') }));
  plan.questions = list(input.questions, 'Questions', 20).map(x => ({ id: x.id, question: text(x.question, 'Question', 1000), why: text(x.why ?? '', 'Question reason'), recommendation: text(x.recommendation ?? '', 'Recommendation', 2000), options: list(x.options, 'Options', 6).map(o => ({ label: text(o.label, 'Option label', 160), benefit: text(o.benefit ?? '', 'Benefit', 1000), tradeoff: text(o.tradeoff ?? '', 'Tradeoff', 1000) })) }));
  for (const key of ['context', 'steps', 'questions']) unique(plan[key], key);
  unique([...plan.steps, ...plan.questions], 'Steps and questions');
  if (plan.steps.some(s => !s.title) || plan.questions.some(q => !q.question) || plan.context.some(c => !c.detail)) fail('Step titles, questions and context details cannot be empty.');
  const known = new Set(plan.steps.map(x => x.id));
  for (const step of plan.steps) if (new Set(step.dependsOn).size !== step.dependsOn.length || step.dependsOn.some(id => !known.has(id) || id === step.id)) fail('Dependencies must reference other steps once each.');
  levels(plan.steps); // Reject cycles, rather than drawing a misleading order.
  plan.diagrams = diagrams(input.diagrams);
  if(plan.schemaVersion===2)plan.sections=documentSections(input.sections,plan);
  else if(input.sections!==undefined)fail('Authored sections require schemaVersion 2.');
  if(input.workflow!==undefined)plan.workflow=workflow(input.workflow);
  return plan;
}
export function levels(steps) {
  const map = new Map(steps.map(s => [s.id, s])), result = Object.create(null), visiting = new Set();
  function visit(id) {
    if (visiting.has(id)) fail('Circular dependency: steps must have a feasible order.');
    if (result[id] !== undefined) return result[id];
    visiting.add(id);
    const parents = map.get(id).dependsOn;
    result[id] = parents.length ? Math.max(...parents.map(visit)) + 1 : 0;
    visiting.delete(id); return result[id];
  }
  for (const step of steps) visit(step.id);
  return result;
}
export function review(plan) {
  const findings = [];
  if(plan.sections)return {findings,assumptions:plan.context.filter(x=>x.kind==='assumption').length,unknowns:plan.context.filter(x=>x.kind==='unknown').length,questions:plan.questions.length,note:'Document structure and references validated. Workflow compliance and test results are not inferred by the viewer.'};
  const add = (target, message) => findings.push({ target, message });
  if (!plan.objective) add('overview', 'Define the outcome this plan is meant to achieve.');
  if (!plan.success.some(Boolean)) add('overview', 'Describe how you will tell whether the outcome was achieved.');
  if (!plan.scope.now.some(Boolean)) add('scope', 'Identify what belongs in this version.');
  if (!plan.steps.length) add('steps', 'The delivery steps have not been planned yet.');
  for (const step of plan.steps) {
    if (!step.why) add(step.id, `Explain why “${step.title}” is needed.`);
    if (!step.deliverable) add(step.id, `Name the concrete result of “${step.title}”.`);
    if (!step.acceptance.some(Boolean)) add(step.id, `Define how to verify “${step.title}”.`);
    if (step.status === 'done' && step.dependsOn.some(id => plan.steps.find(s => s.id === id).status !== 'done')) add(step.id, `“${step.title}” is done while a prerequisite is unfinished; check the dependency or status.`);
  }
  for (const t of plan.technologies) {
    if(!t.rationale) add('technology:'+t.id, 'Explain why '+t.name+' fits this project.');
    if(!t.tradeoffs) add('technology:'+t.id, 'Record the tradeoffs of '+t.name+'.');
    if(!t.checks.some(Boolean)) add('technology:'+t.id, 'State how to validate '+t.name+' before committing.');
    if(t.status==='confirmed'&&!t.source) add('technology:'+t.id, 'A confirmed technology choice needs its decision source.');
  }
  for (const item of plan.context) if (item.kind === 'fact' && !item.source) add(item.id, 'A stated fact needs a source or should be labeled an assumption.');
  return { findings, assumptions: plan.context.filter(x => x.kind === 'assumption').length, unknowns: plan.context.filter(x => x.kind === 'unknown').length, questions: plan.questions.length, note: 'Structural checks only. An accepted plan is not validated user research or proof of feasibility.' };
}

async function atomic(file, value) {
  const tmp = `${file}.${randomUUID()}.tmp`;
  try { await writeFile(tmp, JSON.stringify(value, null, 2) + '\n', { mode: 0o600, flag: 'wx' }); await rename(tmp, file); }
  finally { await unlink(tmp).catch(() => {}); }
}
export class PlanStore {
  constructor(cwd) { this.cwd = path.resolve(cwd); this.root = path.join(this.cwd, '.pi', 'plans'); }
  async init() {
    const cwd = await realpath(this.cwd);
    let current = cwd;
    for (const part of ['.pi', 'plans']) {
      current = path.join(current, part); await mkdir(current, { mode: 0o700 }).catch(e => { if (e.code !== 'EEXIST') throw e; });
      if (!(await lstat(current)).isDirectory() || (await lstat(current)).isSymbolicLink()) fail('Planning storage cannot use symlink directories.');
    }
    this.root = current;
  }
  file(id) { if (!validId(id)) fail('Invalid plan ID.'); return path.join(this.root, id + '.json'); }
  async current() {
    await this.init();
    try { return await this.read(JSON.parse(await readFile(path.join(this.root, '.active'), 'utf8')).id); }
    catch (e) { if (e.code !== 'ENOENT') throw e; const item = (await this.list()).find(p => !p.error); return item ? this.read(item.id) : null; }
  }
  async activate(id) {
    const record = await this.read(id);
    await atomic(path.join(this.root, '.active'), { id });
    await this.snapshot(record); return record;
  }
  async snapshot(record) {
    const file = path.join(this.root, 'plan.md'), tmp = file + '.' + randomUUID() + '.tmp';
    try { await writeFile(tmp, markdown(record), { mode: 0o600, flag: 'wx' }); await rename(tmp, file); }
    finally { await unlink(tmp).catch(() => {}); }
    if(record.document){await this.writeText(path.join(this.root,record.id+'.reviewed.md'),record.document.content);}
    if(record.plan.sourceDocument){
      const original=path.join(this.root,record.id+'.original.md'),content=sourceText(record.plan);
      try{await writeFile(original,content,{mode:0o600,flag:'wx'});}catch(e){if(e.code!=='EEXIST')throw e;if(await readFile(original,'utf8')!==content)fail('Archived Markdown changed unexpectedly.');}
    }
  }
  async writeText(file,content){const tmp=file+'.'+randomUUID()+'.tmp';try{await writeFile(tmp,content,{mode:0o600,flag:'wx'});await rename(tmp,file);}finally{await unlink(tmp).catch(()=>{});}}
  files(record){return {reviewed:path.join(this.root,record.id+'.reviewed.md'),original:record.plan.sourceDocument?path.join(this.root,record.id+'.original.md'):undefined,reviewExport:path.join(this.root,'plan.md'),approved:record.approval?.path};}
  async approvedMarkdown(record){
    const approval=record.approval;if(!approval||!Number.isSafeInteger(approval.revision))fail('No approved revision.');
    const file=path.join(this.root,record.id+'-r'+approval.revision+'.approved.md');
    if(approval.path!==file||(await lstat(file)).isSymbolicLink())fail('Invalid approved Markdown path.');
    const content=await readFile(file,'utf8');if(textFingerprint(content)!==approval.sha256)fail('Approved Markdown changed on disk.');return content;
  }
  async read(id) {
    await this.init(); const file = this.file(id);
    if ((await lstat(file)).isSymbolicLink()) fail('Plan files cannot be symlinks.');
    const value = JSON.parse(await readFile(file, 'utf8'));
    const plan = normalize(value.plan);
    if (value.id !== id || !Number.isSafeInteger(value.revision) || value.revision < 1 || !Array.isArray(value.feedback)) fail('Invalid saved plan record; original file preserved.');
    return { ...value, plan, files:this.files(value),review: review(plan), levels: levels(plan.steps) };
  }
  async list() {
    await this.init(); const result = [];
    for (const file of await readdir(this.root)) {
      if (!file.endsWith('.json')) continue;
      try { const value = await this.read(file.slice(0, -5)); result.push({ id: value.id, revision: value.revision, title: value.plan.title, kind: value.plan.kind, updatedAt: value.updatedAt }); }
      catch { result.push({ id: file.slice(0, -5), error: 'Unreadable plan; original file preserved.' }); }
    }
    return result.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  }
  async locked(id, fn) {
    await this.init(); const lock = this.file(id) + '.lock';
    try { await mkdir(lock); } catch (e) { if (e.code === 'EEXIST') throw Object.assign(new Error('Plan is being saved elsewhere. Retry shortly.'), { status: 409 }); throw e; }
    try { return await fn(); } finally { const { rmdir } = await import('node:fs/promises'); await rmdir(lock); }
  }
  async save(input, { id = randomUUID(), expectedRevision, ...options } = {}) {
    const plan = normalize(input);
    return this.locked(id, async () => {
      let previous;
      try { previous = await this.read(id); } catch (e) { if (e.code !== 'ENOENT') throw e; }
      if (previous && expectedRevision !== previous.revision) throw Object.assign(new Error('The plan changed. Read the latest revision before saving.'), { status: 409 });
      if(previous?.plan.sourceDocument&&!same(plan.sourceDocument,previous.plan.sourceDocument))fail('The original Markdown archive cannot be changed.');
      const document=reviewedDocument(plan,previous,options,p=>markdown({plan:p,revision:(previous?.revision||0)+1,feedback:[]}));
      const value = { id, revision: (previous?.revision || 0) + 1, createdAt: previous?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString(), plan, document,feedback: previous?.feedback || [], submissions: previous?.submissions || [], discussions: previous?.discussions || [] };
      value.reviewState=previous?.reviewState||{highlightBaseline:previous?Math.max(1,previous.revision-1):1};
      if(previous)value.changeSet={revision:value.revision,operations:differences(previous.plan,plan),questionId:options.questionId,origin:options.origin||(options.undoRevision?'revert':'agent'),...(options.undoRevision?{undoRevision:options.undoRevision}:{})};
      if(options.questionId){
        const question=value.discussions.find(q=>q.id===options.questionId);
        if(!question||question.intent!=='change'||question.status==='answered')fail('Commit needs an unanswered change request.');
        const answer=text(options.answer,'Change explanation',20000);if(!answer)fail('Supply the change explanation with the commit.');
        Object.assign(question,{status:'answered',answer,answeredAt:new Date().toISOString(),resultRevision:value.revision});delete question.error;
      }
      if (previous) {
        const versions = path.join(this.root, id + '-versions');
        await mkdir(versions, { mode: 0o700 }).catch(e => { if (e.code !== 'EEXIST') throw e; });
        if ((await lstat(versions)).isSymbolicLink()) fail('Version directory cannot be a symlink.');
        await atomic(path.join(versions, previous.revision + '.json'), previous);
      }
      await atomic(this.file(id), value); return this.activate(id);
    });
  }
  async patch(id,expectedRevision,changes,options={}){
    const record=await this.read(id);if(record.revision!==expectedRevision)throw Object.assign(new Error('The plan changed. Read the latest revision before saving.'),{status:409});
    const fields=planFields(record.plan);if(!Array.isArray(changes)||!changes.length||changes.length>40)fail('Supply 1–40 text changes.');
    for(const change of changes){
      const path=change.path;if(typeof path!=='string'||path.startsWith('sourceDocument/')||!fields.has(path)||path.split('/').some(k=>['__proto__','constructor','prototype','id','nodeId'].includes(k)))fail('Patch must target an existing editable text field.');
      text(change.value,'Replacement text',40000);let target=record.plan;const parts=path.split('/');
      for(const [index,part]of parts.entries()){
        const key=Array.isArray(target)?target.findIndex((v,i)=>String(v?.id??v?.nodeId??i)===part):part;
        if(index===parts.length-1)target[key]=change.value;else target=target[key];
      }
    }
    return this.save(record.plan,{id,expectedRevision,...options});
  }
  async version(id,revision,current){
    if(revision===current.revision)return current;
    const file=path.join(this.root,id+'-versions',revision+'.json');
    if((await lstat(path.dirname(file))).isSymbolicLink()||(await lstat(file)).isSymbolicLink())fail('Version files cannot be symlinks.');
    const record=JSON.parse(await readFile(file,'utf8'));
    if(record.id!==id||record.revision!==revision)fail('Invalid saved revision.');return record;
  }
  undoPreview(current,before,after){
    const operations=after.changeSet?.operations||differences(before.plan,after.plan);
    if(!operations.length&&(!before.document||!after.document||same(before.document.content,after.document.content)))fail('This revision has no changes to undo.');
    const plan=normalize(operations.length?applyOperations(current.plan,operations,{reverse:true}):current.plan);
    let reviewedMarkdown;
    if(current.plan.sourceDocument){
      if(!current.document||!after.document||!before.document)throw Object.assign(new Error('This older revision has no complete Markdown snapshot to revert safely.'),{status:409});
      if(current.revision===after.revision&&before.document.status==='synced')reviewedMarkdown=before.document.content;
      else{
        if([current,before,after].some(r=>r.document.status!=='synced'))throw Object.assign(new Error('Reconcile the detailed Markdown before reverting this revision.'),{status:409});
        reviewedMarkdown=reverseMarkdown(current.document.content,before.document.content,after.document.content);
      }
    }else if(!operations.length)throw Object.assign(new Error('This older revision has no complete Markdown snapshot to revert safely.'),{status:409});
    return {plan,...(reviewedMarkdown!==undefined?{reviewedMarkdown}:{})};
  }
  async undo(id,expectedRevision,revision=expectedRevision,options={}){
    const current=await this.read(id);if(current.revision!==expectedRevision)throw Object.assign(new Error('Read the latest revision before undo.'),{status:409});
    if(!Number.isSafeInteger(revision)||revision<2||revision>expectedRevision)fail('Choose an existing change revision, starting at 2.');
    const [before,after]=await Promise.all([this.version(id,revision-1,current),this.version(id,revision,current)]);
    const {plan,...document}=this.undoPreview(current,before,after);
    return this.save(plan,{id,expectedRevision,...options,...document,undoRevision:revision});
  }
  async history(id){
    let current=await this.read(id);
    if(!current.reviewState)current=await this.setHighlightBaseline(id,current.revision,Math.max(1,current.revision-1),{initialize:true});
    const baselineRevision=current.reviewState.highlightBaseline;
    if(this.historyCache?.id===id&&this.historyCache.revision===current.revision&&this.historyCache.baseline===baselineRevision)return this.historyCache;
    const entries=[];let previous,baseline;const unavailable=[];
    for(let revision=1;revision<=current.revision;revision++){
      let record;try{record=await this.version(id,revision,current);}catch{unavailable.push(revision);previous=null;continue;}
      if(revision===baselineRevision)baseline=record.plan;
      if(previous){
        const changes=changedFields(previous.plan,record.plan),documentChanged=previous.document?.content!==record.document?.content;
        let conflict='';try{this.undoPreview(current,previous,record);}catch(e){conflict=e.message;}
        entries.push({revision,at:record.updatedAt,origin:record.changeSet?.origin||(record.changeSet?.questionId?'agent':'saved'),undoRevision:record.changeSet?.undoRevision,summary:record.discussions?.find(q=>q.id===record.changeSet?.questionId)?.answer||'',changes,documentChanged,canUndo:!conflict,conflict});
      }
      previous=record;
    }
    const reverted=new Set();for(const entry of entries.toReversed())if(!reverted.has(entry.revision)&&entry.undoRevision)reverted.add(entry.undoRevision);
    for(const entry of entries)if(reverted.has(entry.revision)){entry.reverted=true;entry.canUndo=false;entry.conflict='This change has already been reverted.';}
    const result={id,revision:current.revision,baseline:baseline?baselineRevision:null,unavailable,entries:entries.reverse(),highlights:baseline?changedFields(baseline,current.plan):[]};
    this.historyCache=result;return result;
  }
  async setHighlightBaseline(id,expectedRevision,baseline,{initialize=false}={}){
    return this.locked(id,async()=>{
      const current=await this.read(id);
      if(initialize&&current.reviewState)return current;
      if(current.revision!==expectedRevision)throw Object.assign(new Error('The plan changed. Refresh before changing which revisions are highlighted.'),{status:409});
      if(!Number.isSafeInteger(baseline)||baseline<1||baseline>current.revision)fail('Choose an existing review baseline.');
      await this.version(id,baseline,current);
      const {review,levels,files,...stored}=current;stored.reviewState={highlightBaseline:baseline};
      await atomic(this.file(id),stored);this.historyCache=null;return {...current,reviewState:stored.reviewState};
    });
  }
  async applyPrepared(id,expectedRevision,questionId){
    const current=await this.read(id),question=current.discussions.find(q=>q.id===questionId);
    const offered=current.discussions.find(q=>q.id===question?.selection?.questionId),option=offered?.options.find(o=>o.id===question.selection.optionId);
    if(!option?.prepared)fail('This alternative needs the agent to prepare its changes.');
    if(option.prepared.revision!==expectedRevision||current.revision!==expectedRevision)throw Object.assign(new Error('This alternative is stale. Request fresh alternatives.'),{status:409});
    const plan=applyOperations(current.plan,option.prepared.operations);
    return this.save(plan,{id,expectedRevision,questionId,answer:'Applied '+option.label+'.',sourceEdits:option.prepared.sourceEdits});
  }
  async feedback(id, input) {
    return this.locked(id, async () => {
      const value = await this.read(id);
      if (input.revision !== value.revision) throw Object.assign(new Error('A newer revision is available. Your draft is kept; reload the plan before sending.'), { status: 409 });
      const target = text(input.target ?? '', 'Feedback target', 160);
      if (target && ![...value.plan.steps, ...value.plan.questions].some(x => x.id === target)) fail('Feedback target is not in this plan.');
      const action = ['comment', 'answer', 'accept', 'changes', 'start', 'annotate'].includes(input.action) ? input.action : fail('Unknown feedback action.');
      const body = text(input.text ?? '', 'Feedback', 12000);
      if (action !== 'accept' && !body) fail('Please enter feedback or an answer.');
      const entry = { id: randomUUID(), revision: value.revision, action, target, text: body, createdAt: new Date().toISOString() };
      if (action === 'annotate') {if(input.annotation?.kind==='area')fail('Use Ask for area questions; select a plan element to annotate.');entry.annotation = validateAnnotation(value.plan, input.annotation);}
      value.feedback.push(entry);
      if (value.feedback.length > 500) fail('Feedback limit reached; export this plan and start a new one.');
      const { review: _review, levels: _levels, ...stored } = value;
      await atomic(this.file(id), stored);
      if ((await this.current())?.id === id) await this.snapshot(stored);
      return entry;
    });
  }
  async submit(id, { revision, approve = false }) {
    return this.locked(id, async () => {
      const value = await this.read(id);
      if (revision !== value.revision) throw Object.assign(new Error('A newer revision is available. Review it before submitting.'), { status: 409 });
      if(approve){
        if(value.discussions?.some(q=>q.status!=='answered'))fail('Finish or resolve pending requests before approving.');
        if(value.submissions?.some(s=>s.action!=='accept'&&!s.completedAt))fail('Finish the submitted review before approving.');
        if(!value.document||value.document.status!=='synced'||value.document.planHash!==planFingerprint(value.plan))fail('The detailed Markdown needs reconciliation before approval. Ask the agent to reconcile this revision.');
        const unresolved=value.feedback.filter(f=>['changes','annotate'].includes(f.action)&&!value.submissions?.some(s=>s.completedAt&&s.feedbackIds.includes(f.id)));
        if(unresolved.length)fail('Send and resolve saved change notes before approving.');
        const file=path.join(this.root,id+'-r'+revision+'.approved.md'),content=value.document.content;
        try{await writeFile(file,content,{mode:0o600,flag:'wx'});}catch(e){if(e.code!=='EEXIST')throw e;if(await readFile(file,'utf8')!==content)fail('Approved snapshot differs; do not overwrite it.');}
        value.approval={revision,path:file,sha256:textFingerprint(content),approvedAt:value.approval?.approvedAt||new Date().toISOString(),implementationRequested:false};
      }
      value.submissions ??= [];
      const submitted = new Set(value.submissions.flatMap(s => s.feedbackIds));
      const feedbackIds = value.feedback.filter(f => !submitted.has(f.id) && ['comment','answer','changes','annotate'].includes(f.action)).map(f => f.id);
      const alreadyApproved = value.submissions.some(s => s.action === 'accept' && s.revision === revision);
      if (approve && !alreadyApproved) {
        const entry = { id: randomUUID(), revision, action: 'accept', target: '', text: '', createdAt: new Date().toISOString() };
        value.feedback.push(entry); feedbackIds.push(entry.id);
      }
      if (feedbackIds.length) value.submissions.push({ id: randomUUID(), revision, action: approve ? 'accept' : 'review', feedbackIds, status: 'queued', createdAt: new Date().toISOString() });
      if (!feedbackIds.length && !alreadyApproved && !value.submissions.some(s => s.status === 'queued')) fail('No saved annotations or feedback to send.');
      const { review, levels, ...stored } = value;
      await atomic(this.file(id), stored);
      if ((await this.current())?.id === id) await this.snapshot(stored);
      return value;
    });
  }
  async delivered(id, submissionId, owner) {
    return this.locked(id, async () => {
      const value = await this.read(id), submission = value.submissions?.find(s => s.id === submissionId);
      if (!submission) fail('Review submission no longer exists.');
      if(submission.status!=='queued')return false;
      if(owner)submission.deliveryOwner=owner;else delete submission.deliveryOwner;
      submission.status = 'delivered'; submission.deliveredAt = new Date().toISOString();
      delete submission.error;
      const { review, levels, ...stored } = value;
      await atomic(this.file(id), stored);return true;
    });
  }
  async recoverDisconnectedAgents(){
    for(const item of await this.list()){
      if(item.error)continue;
      const record=await this.read(item.id);
      for(const entry of [...(record.submissions||[]),...(record.discussions||[])]){
        if(entry.status!=='delivered'||entry.completedAt||!['mcp','pi'].includes(entry.deliveryOwner?.kind))continue;
        const pid=entry.deliveryOwner.pid;if(!Number.isSafeInteger(pid)||pid<=0)continue;
        try{process.kill(pid,0);}catch(error){if(error.code==='ESRCH')await this.deliveryFailed(record.id,entry.id,'The previous agent session stopped. Review any saved changes before retrying.');}
      }
    }
  }
  async reviewCompleted(id,submissionId){
    return this.locked(id,async()=>{const value=await this.read(id),item=value.submissions?.find(s=>s.id===submissionId);if(!item||item.status!=='delivered')fail('Submission is not delivered.');item.completedAt=new Date().toISOString();const {review,levels,...stored}=value;await atomic(this.file(id),stored);});
  }
  async ask(id, input) {
    return this.locked(id, async () => {
      const value = await this.read(id);
      if (value.revision !== input.revision) throw Object.assign(new Error('The plan changed. Close this question and select the updated content; your draft is kept.'), {status:409});
      value.discussions ??= [];
      if (value.discussions.length >= 200) fail('Question limit reached for this plan.');
      const question = text(input.question, 'Question', 12000); if (!question) fail('Enter a question.');
      const intent=input.intent ?? 'ask';
      if(!['ask','change','alternatives'].includes(intent))fail('Unknown agent action.');
      if(input.operation&&(!['explanation','dependencies','undo'].includes(input.operation.kind)||input.operation.kind==='undo'&&intent!=='change'||input.operation.kind!=='undo'&&intent!=='ask'||input.operation.revision!==undefined&&!Number.isSafeInteger(input.operation.revision)))fail('Invalid quick action.');
      const annotation = validateAnnotation(value.plan, input.annotation);
      if(annotation.kind==='area'&&intent!=='ask')fail('Area selections are for questions only. Use Annotate to request changes.');
      const previous = input.threadId ? value.discussions.findLast(q => q.threadId === input.threadId) : null;
      const sameTarget=previous&&previous.annotation.kind===annotation.kind&&(
        annotation.kind==='area'?JSON.stringify(previous.annotation)===JSON.stringify(annotation):
        annotation.kind==='text'?previous.annotation.field===annotation.field:
        annotation.kind==='element'?previous.annotation.elementId===annotation.elementId:
        previous.annotation.diagramId===annotation.diagramId&&previous.annotation.nodeId===annotation.nodeId);
      if(input.threadId&&(!sameTarget||(previous.revision===value.revision&&JSON.stringify(previous.annotation)!==JSON.stringify(annotation))))fail('This conversation belongs to a different context or revision.');
      let selection;
      if(input.selection){
        const offered=value.discussions.find(q=>q.id===input.selection.questionId),option=offered?.options?.find(o=>o.id===input.selection.optionId);
        if(intent!=='change'||!option||offered.revision!==value.revision||offered.threadId!==input.threadId||JSON.stringify(offered.annotation)!==JSON.stringify(annotation))fail('This alternative is no longer available for this context. Request fresh alternatives.');
        selection={questionId:offered.id,optionId:option.id,label:option.label};
      }
      const item = {id:randomUUID(), threadId:previous?.threadId || randomUUID(), revision:value.revision, annotation, question, intent,contextHash:planFingerprint(value.plan),...(input.operation?{operation:input.operation}:{}), ...(selection?{selection}:{}), status:'queued', createdAt:new Date().toISOString()};
      value.discussions.push(item);
      const {review, levels, ...stored} = value; await atomic(this.file(id),stored);
      return item;
    });
  }
  async questionDelivered(id, questionId, owner) {
    return this.locked(id, async () => {
      const value = await this.read(id), item = value.discussions?.find(q=>q.id===questionId);
      if (!item) fail('Question not found.');
      if(item.status!=='queued')return false;if(owner)item.deliveryOwner=owner;else delete item.deliveryOwner;item.status='delivered';
      delete item.error;
      const {review,levels,...stored}=value;await atomic(this.file(id),stored);return true;
    });
  }
  async deliveryFailed(id, entryId, message) {
    return this.locked(id, async () => {
      const value=await this.read(id),item=[...(value.discussions||[]),...(value.submissions||[])].find(q=>q.id===entryId);
      if(!item||item.status==='answered')return;
      item.status='queued';item.error=text(message,'Delivery error',1000);
      const {review,levels,...stored}=value;await atomic(this.file(id),stored);
    });
  }
  async answer(id, questionId, body, options = []) {
    return this.locked(id, async () => {
      const value = await this.read(id), item=value.discussions?.find(q=>q.id===questionId);
      if (!item) fail('Question not found. Read the plan discussions first.');
      const answer=text(body,'Explanation',20000);if(!answer)fail('An explanation is required.');
      const choices=list(options,'Alternatives',4).map(o=>{
        const choice={id:o.id,label:text(o.label,'Alternative label',100),description:text(o.description,'Alternative explanation',400),tradeoff:text(o.tradeoff??'','Alternative tradeoff',300)};
        if(o.prepared){if(o.prepared.revision!==value.revision||item.revision!==value.revision)fail('Prepare alternatives against the current revision.');const candidate=normalize(applyOperations(value.plan,o.prepared.operations));reviewedDocument(candidate,value,{sourceEdits:o.prepared.sourceEdits},()=> '');choice.prepared={revision:value.revision,operations:differences(value.plan,candidate),...(o.prepared.sourceEdits?{sourceEdits:o.prepared.sourceEdits}:{})};}
        return choice;
      });
      unique(choices,'Alternatives');
      if(choices.some(o=>!o.label||!o.description))fail('Alternatives need a label and explanation.');
      if(choices.length===1)fail('Offer at least two alternatives or none.');
      item.options=choices;
      item.answer=answer;item.status='answered';item.answeredAt=new Date().toISOString();
      delete item.error;
      const {review,levels,...stored}=value;await atomic(this.file(id),stored);
      return item;
    });
  }
}
function validateAnnotation(plan, input) {
  if(input?.kind==='area'){
    if(!Array.isArray(input.items)||!input.items.length||input.items.length>24||input.items.some(i=>!['text','node','element'].includes(i?.kind)))fail('Select 1–24 plan items for a question.');
    const items=input.items.map(i=>validateAnnotation(plan,i));
    const quote=items.map(i=>i.quote).join('\n\n');if(quote.length>12000)fail('Select a smaller area so the agent can stay focused.');
    return {kind:'area',items,quote};
  }
  if (input?.kind === 'element') {
    const quote = planTargets(plan).get(input.elementId);
    if (quote === undefined) fail('This plan element no longer exists.');
    return { kind: 'element', elementId: input.elementId, quote };
  }
  if (input?.kind === 'text') {
    const field = text(input.field, 'Text location', 1000), quote = text(input.quote, 'Selected text', 4000);
    const source = planFields(plan).get(field), { start, end } = input;
    if (!quote || !Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || typeof source !== 'string' || source.slice(start, end) !== quote) fail('The selected text no longer matches this revision. Select it again; your note is kept.');
    return { kind: 'text', field, quote, start, end, prefix: source.slice(Math.max(0, start - 60), start), suffix: source.slice(end, end + 60) };
  }
  if (input?.kind === 'node') {
    const diagram = plan.diagrams.find(d => d.id === input.diagramId), layer = diagram?.layers.find(l => l.id === input.layerId), node = diagram?.nodes.find(n => n.id === input.nodeId);
    if (!node || !layer) fail('The diagram node or layer no longer exists.');
    return { kind: 'node', diagramId: diagram.id, layerId: layer.id, nodeId: node.id, quote: node.label };
  }
  fail('Choose a text selection or diagram node to annotate.');
}
export function markdown(record) {
  const p = record.plan;
  if(p.sections)return `# ${p.title}\n\nRevision ${record.revision} · ${p.kind}\n\n${p.brief}\n\n`+documentMarkdown(p,{technologyMarkdown,diagramMarkdown})+(p.sourceDocument?'\n\n## Original document\n\n'+p.sourceDocument.sections.map(s=>s.content).join(''):'')+'\n\n## Review feedback\n\n'+record.feedback.map(f=>`- Revision ${f.revision}, ${f.action}: ${f.annotation?'On “'+f.annotation.quote+'”: ':''}${f.text||'Plan accepted for this revision.'}`).join('\n')+'\n';
  return `# ${p.title}\n\nRevision ${record.revision} · ${p.kind}\n\n${p.brief}\n\n## Outcome\n\n${p.objective || 'Not defined yet.'}\n\n${p.success.map(x => '- ' + x).join('\n')}\n\n## Scope\n\n${Object.entries(p.scope).map(([key, values]) => `### ${key}\n\n${values.map(x => '- ' + x).join('\n') || 'Not specified.'}`).join('\n\n')}\n\n## Context\n\n${p.context.map(x => `- [${x.kind}] ${x.detail}${x.source ? ' — Source: ' + x.source : ''}`).join('\n')}\n\n${p.sourceDocument ? "## Original document\n\n"+p.sourceDocument.sections.map(s=>s.content).join("")+"\n\n" : ""}${technologyMarkdown(p.technologies || [])}${diagramMarkdown(p.diagrams || [])}## Steps\n\n${p.steps.map(s => `### ${s.title}\n\n${s.summary}\n\nWhy: ${s.why}\n\nDeliverable: ${s.deliverable}\n\nDepends on: ${s.dependsOn.join(', ') || 'None'}\n\n${s.acceptance.map(x => '- [ ] ' + x).join('\n')}`).join('\n\n')}\n\n## Questions\n\n${p.questions.map(q => `### ${q.question}\n\n${q.why}\n\n${q.options.map(o => `- ${o.label}: ${o.benefit} Tradeoff: ${o.tradeoff}`).join('\n')}\n\nRecommendation: ${q.recommendation || 'Not specified.'}`).join('\n\n')}\n\n## Review feedback\n\n${record.feedback.map(f => `- Revision ${f.revision}, ${f.action}${f.target ? ' (' + f.target + ')' : ''}: ${f.annotation ? 'On “' + f.annotation.quote + '” (' + (f.annotation.field || f.annotation.elementId || f.annotation.diagramId + '/' + f.annotation.layerId + '/' + f.annotation.nodeId) + '): ' : ''}${f.text || 'Plan accepted for this revision.'}`).join('\n')}\n`;
}

function diagramMarkdown(diagrams) {
  if (!diagrams.length) return '';
  return '## How it works\n\n' + diagrams.map(d => `### ${d.title}\n\n${d.description}\n\n${(d.walkthroughs||[]).map(w=>'#### '+w.title+'\n\n'+w.intro+'\n\n'+w.steps.map((s,i)=>(i+1)+'. **'+s.title+'** — '+s.explanation).join('\n')+'\n\nResult: '+w.result+'\n\n').join('')}${diagramTypeLegend(d)}${d.layers.map(l => `#### ${l.title}\n\n${l.description}\n\n\`\`\`mermaid\n${mermaidSource(d, l)}\n\`\`\`\n\n${l.nodes.map(n => `- **${d.nodes.find(x => x.id === n.nodeId).label}**: ${n.summary} ${n.detail}`).join('\n')}\n\n${l.edges.map(e => `- ${d.nodes.find(n => n.id === e.from).label} → ${d.nodes.find(n => n.id === e.to).label}: ${e.label}. ${e.detail}`).join('\n')}`).join('\n\n')}`).join('\n\n') + '\n\n';
}

function diagramTypeLegend(diagram) {
  const types=new Map(diagram.nodes.map(n=>{const spec=resolveNodeType(n);return [spec.label,{label:spec.label,detail:n.customType?.description}];}));
  return 'Node types: '+[...types.values()].map(t=>t.label+(t.detail?' — '+t.detail:'')).join('; ')+'.\n\n';
}

function technologyMarkdown(technologies,all=technologies) {
  if(!technologies.length)return '';
  return '## Tools & technology\n\n'+technologies.map(t=>`### ${t.name} — ${t.status}\n\nRole: ${t.role}\n\nRelationship: ${t.fit}${t.choiceGroup ? " ("+t.choiceGroup+")" : ""} — ${t.fitDetail || "Needs clarification."}\n\nWhy: ${t.rationale}\n\nTradeoffs: ${t.tradeoffs}\n\nAlternatives: ${t.alternatives.join('; ')||'Not recorded.'}\n\nDepends on: ${t.dependsOn.map(id=>all.find(x=>x.id===id).name).join(', ')||'No listed technology prerequisite.'}\n\nAffected parts: ${t.impacts.join('; ')}\n\nVersions: ${t.versionPlan||'Resolve compatible versions before implementation.'}\n\nSource: ${t.source||'Proposal; not verified yet.'}\n\n${t.checks.map(c=>'- [ ] '+c).join('\n')}`).join('\n\n')+'\n\n';
}
