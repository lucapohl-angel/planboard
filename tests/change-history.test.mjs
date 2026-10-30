import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile,readFile} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {PlanStore} from '../src/plans.mjs';import {saveMarkdownPlan} from '../src/markdown-plan.mjs';
import {textDiff,addedRanges} from '../web/text-diff.js';import {reverseMarkdown} from '../src/revision-history.mjs';
const plan={title:'Pet shop',kind:'website',brief:'A small pet shop',objective:'Buy dog products.',scope:{now:['Search products.','Save favorites.'],later:[],out:[]}};
async function setup(t){const cwd=await mkdtemp(path.join(os.tmpdir(),'planboard-history-'));t.after(()=>rm(cwd,{recursive:true,force:true}));const store=new PlanStore(cwd);return {store,cwd};}
test('text diff preserves exact content, highlights changed words and bounds large rewrites',()=>{
 for(const [a,b]of [['Buy dog products.','Buy cat products.'],['a a b','a b a'],['','Added'],['Remove',''],['你好 👋','你好 🌍'],['word '.repeat(5000),'new '.repeat(5000)]]){
  const parts=textDiff(a,b);assert.equal(parts.filter(p=>p.kind!=='added').map(p=>p.text).join(''),a);assert.equal(parts.filter(p=>p.kind!=='removed').map(p=>p.text).join(''),b);
 }
 assert.deepEqual(addedRanges('Buy dog products.','Buy cat products.'),[{start:4,end:7}]);
});
test('revision 5 reverts alone from 10; reverts are recoverable and history survives restart',async t=>{
 const {store,cwd}=await setup(t);let r=await store.save(plan);
 for(let n=2;n<=10;n++)r=await store.patch(r.id,r.revision,[{path:n===5?'objective':'brief',value:n===5?'Buy cat products.':'Shop revision '+n}],{origin:n===5?'manual':'agent'});
 const history=await store.history(r.id);assert.equal(history.entries.find(e=>e.revision===5).canUndo,true);assert.equal(history.entries.find(e=>e.revision===5).origin,'manual');
 r=await store.undo(r.id,10,5);assert.equal(r.revision,11);assert.equal(r.plan.objective,plan.objective);assert.equal(r.plan.brief,'Shop revision 10');assert.equal(r.changeSet.undoRevision,5);
 const fresh=new PlanStore(cwd),next=await fresh.history(r.id);assert.equal(next.entries.find(e=>e.revision===5).reverted,true);assert.equal(next.highlights.some(c=>c.path==='objective'),false);
 r=await fresh.undo(r.id,11,11);assert.equal(r.plan.objective,'Buy cat products.');assert.equal((await fresh.history(r.id)).entries.find(e=>e.revision===5).reverted,undefined);
});
test('separate list entries can be reverted; later edits to the same field conflict without saving',async t=>{
 const {store}=await setup(t);let r=await store.save(plan);
 r=await store.patch(r.id,1,[{path:'scope/now/0',value:'Search cat products.'}]);r=await store.patch(r.id,2,[{path:'scope/now/1',value:'Save a wishlist.'}]);
 r=await store.undo(r.id,3,2);assert.deepEqual(r.plan.scope.now,['Search products.','Save a wishlist.']);
 r=await store.patch(r.id,4,[{path:'scope/now/1',value:'Save several wishlists.'}]);
 assert.equal((await store.history(r.id)).entries.find(e=>e.revision===3).canUndo,false);
 await assert.rejects(store.undo(r.id,5,3),/changed since/);assert.equal((await store.read(r.id)).revision,5);
});
test('out-of-order undo preserves detailed Markdown changes made later',async t=>{
 const {store,cwd}=await setup(t),source='# Pet shop\n\nBuy dog products.\n\nA small pet shop\n\nKeep this contract intact.\n';await writeFile(path.join(cwd,'source.md'),source);
 let r=await saveMarkdownPlan(store,{markdownPath:'source.md',plan});r=await store.patch(r.id,1,[{path:'objective',value:'Buy cat products.'}]);r=await store.patch(r.id,2,[{path:'brief',value:'A shop for cats'}]);
 r=await store.undo(r.id,3,2);assert.equal(r.document.status,'synced');assert.match(r.document.content,/Buy dog products/);assert.match(r.document.content,/A shop for cats/);assert.match(r.document.content,/Keep this contract intact/);
 assert.throws(()=>reverseMarkdown('A changed later\n','A old\n','A new\n'),/Markdown/);
 const before='A\n\nB\n',after='A\n\nInserted\n\nB\n';assert.equal(reverseMarkdown(after+'Later\n',before,after),before+'Later\n');
});
test('undoing the latest unmapped edit restores the reconciled Markdown without a model',async t=>{
 const {store,cwd}=await setup(t);await writeFile(path.join(cwd,'source.md'),'# Shop\nBuy dog products.\n');
 let r=await saveMarkdownPlan(store,{markdownPath:'source.md',plan});r=await store.patch(r.id,1,[{path:'brief',value:'An unmapped summary'}],{origin:'manual'});
 assert.equal(r.document.status,'needs-reconciliation');assert.equal((await store.history(r.id)).entries[0].canUndo,true);
 r=await store.undo(r.id,2,2);assert.equal(r.document.status,'synced');assert.equal(r.plan.brief,plan.brief);assert.equal(r.document.content,'# Shop\nBuy dog products.\n');
});
test('legacy reviews start at the latest edit; marking reviewed persists without changing plan revisions',async t=>{
 const {store,cwd}=await setup(t);let r=await store.save(plan);r=await store.patch(r.id,1,[{path:'brief',value:'An old layout summary'}]);r=await store.patch(r.id,2,[{path:'objective',value:'Buy cat products.'}]);
 const file=store.file(r.id),legacy=JSON.parse(await readFile(file,'utf8'));delete legacy.reviewState;await writeFile(file,JSON.stringify(legacy));
 let history=await store.history(r.id);assert.equal(history.baseline,2);assert.deepEqual(history.highlights.map(c=>c.path),['objective']);
 await store.setHighlightBaseline(r.id,3,3);history=await new PlanStore(cwd).history(r.id);assert.equal(history.baseline,3);assert.deepEqual(history.highlights,[]);assert.equal((await store.read(r.id)).revision,3);
 r=await store.patch(r.id,3,[{path:'brief',value:'A new summary'}]);history=await store.history(r.id);assert.equal(history.baseline,3);assert.deepEqual(history.highlights.map(c=>c.path),['brief']);assert.equal(history.entries.length,3);
 await assert.rejects(store.setHighlightBaseline(r.id,3,3),/plan changed/);await assert.rejects(store.setHighlightBaseline(r.id,4,5),/existing review baseline/);
});
