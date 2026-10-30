import test from 'node:test';import assert from 'node:assert/strict';import {readFile,mkdtemp,rm} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {normalize,PlanStore,markdown} from '../src/plans.mjs';import {requireWalkthroughs} from '../src/diagrams.mjs';import {readingGuide} from '../web/diagram-walkthroughs.js';import {reviewSystemPrompt} from '../src/pi-dispatcher.mjs';
const p=JSON.parse(await readFile(new URL('../examples/products/video-editor.json',import.meta.url)));
test('walkthroughs validate real directed edges while legacy maps remain readable',()=>{
 requireWalkthroughs(p);assert.equal(normalize(p).diagrams.find(d=>d.id==='runtime').walkthroughs.length,3);
 const bad=structuredClone(p),d=bad.diagrams[0];d.walkthroughs[0].steps[0].nodeIds=['unknown'];assert.throws(()=>normalize(bad),/existing nodes/);
 const reverse=structuredClone(p);reverse.diagrams[0].walkthroughs[0].steps[0].edges[0].from='upload';reverse.diagrams[0].walkthroughs[0].steps[0].edges[0].to='library';assert.throws(()=>normalize(reverse),/directed connection/);
 const legacy=structuredClone(p);legacy.diagrams.forEach(d=>delete d.walkthroughs);normalize(legacy);assert.throws(()=>requireWalkthroughs(legacy),/plain-language walkthroughs/);const fallback=readingGuide(legacy.diagrams[0]);assert.equal(fallback.kind,'reading-guide');assert.match(fallback.intro,/not the order/);
 assert.match(reviewSystemPrompt,/numbered steps above the map/);assert.match(reviewSystemPrompt,/Never label readers/);
});
test('walkthrough text patches preserve annotations, references and Markdown explanations',async t=>{
 const cwd=await mkdtemp(path.join(os.tmpdir(),'walkthrough-'));t.after(()=>rm(cwd,{recursive:true,force:true}));const store=new PlanStore(cwd),r=await store.save(p),field='diagrams/runtime/walkthroughs/upload/steps/permission/explanation',d=r.plan.diagrams.find(d=>d.id==='runtime'),quote=d.walkthroughs[0].steps[1].explanation;
 await store.feedback(r.id,{revision:1,action:'annotate',text:'Keep this simple.',annotation:{kind:'text',field,quote,start:0,end:quote.length}});
 const after=await store.patch(r.id,1,[{path:field,value:'The app checks whether you can edit this project.'}]);assert.equal(after.feedback[0].annotation.quote,quote);assert.deepEqual(after.plan.diagrams.find(d=>d.id==='runtime').walkthroughs[0].steps[1].edges,d.walkthroughs[0].steps[1].edges);const md=markdown(after);assert.match(md,/Upload and prepare a video/);assert.match(md,/The app checks whether you can edit this project/);
});
