import {openReviewDetails,openSection} from './review-helpers.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
import {normalize,review,markdown,PlanStore} from '../src/plans.mjs';
import {startBoard} from '../src/server.mjs';
import {chromium} from 'playwright';
const plan=JSON.parse(await readFile(new URL('../examples/review-suite/plan-2.json',import.meta.url)));
test('technology choices validate references, preserve annotations and export readable dependencies',async t=>{
 const cwd=await mkdtemp(path.join(os.tmpdir(),'technology-'));t.after(()=>rm(cwd,{recursive:true,force:true}));const store=new PlanStore(cwd);
 assert.deepEqual(normalize({title:'Legacy',brief:'Before technology support',kind:'other'}).technologies,[]);
 for(const dependsOn of [['missing'],['identity'],['data','data']]){const invalid=structuredClone(plan);invalid.technologies.find(t=>t.id==='identity').dependsOn=dependsOn;assert.throws(()=>normalize(invalid),/Technology dependencies/);}
 const unverified=structuredClone(plan);unverified.technologies[0].status='confirmed';unverified.technologies[0].source='';assert.ok(review(normalize(unverified)).findings.some(f=>f.message.includes('decision source')));
 const r=await store.save(plan), name=plan.technologies.find(t=>t.id==='identity').name;
 await store.feedback(r.id,{revision:1,action:'annotate',text:'Compare another identity provider.',annotation:{kind:'text',field:'technologies/identity/name',quote:name,start:0,end:name.length}});
 const revised=structuredClone(plan);revised.technologies.find(t=>t.id==='identity').name='Alternative identity provider';const next=await store.save(revised,{id:r.id,expectedRevision:1});
 assert.equal(next.feedback[0].revision,1);assert.equal(next.feedback[0].annotation.quote,name);assert.match(markdown(next),/Tools & technology/);assert.match(markdown(next),/Compare another identity provider/);
 assert.equal(next.plan.technologies.find(t=>t.id==='identity').dependsOn[0],'data');
});
test('technology names and tradeoffs can be annotated, persisted and reviewed on mobile', {timeout:60000},async t=>{
 const cwd=await mkdtemp(path.join(os.tmpdir(),'technology-browser-'));t.after(()=>rm(cwd,{recursive:true,force:true}));const board=await startBoard({cwd});t.after(()=>board.close());const r=await board.store.save(plan);
 const browser=await chromium.launch({channel:process.env.PLANBOARD_BROWSER_CHANNEL,headless:true});t.after(()=>browser.close());const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(board.url);await openReviewDetails(page);assert.equal(await page.locator('#technologies>article').count(),9);
 await page.locator('#annotate-toggle').click();
 for(const key of ['name','tradeoffs']){await page.locator(`[data-field="technologies/identity/${key}"]`).click();await page.getByLabel('Requested change',{exact:true}).fill('Review identity '+key);await page.getByRole('button',{name:'Save for review',exact:true}).click();await page.locator('#ask-dialog').waitFor({state:'hidden'});}
 await page.reload();await openReviewDetails(page);await page.locator('#technologies>article').first().waitFor();const saved=await board.store.read(r.id);assert.deepEqual(saved.feedback.map(f=>f.annotation.field),['technologies/identity/name','technologies/identity/tradeoffs']);
 const exported=await (await fetch(board.url+`api/plans/${r.id}/export`)).json();assert.deepEqual(exported.plan.technologies,saved.plan.technologies);assert.equal(exported.feedback.length,2);
 await page.evaluate(await readFile(new URL('../node_modules/axe-core/axe.min.js',import.meta.url),'utf8'));
 for(const width of [1440,900,390]){await page.setViewportSize({width,height:1000});await page.locator('[data-field="technologies/identity/name"]').scrollIntoViewIfNeeded();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);const results=await page.evaluate(async()=>axe.run('#technology-view',{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}}));assert.deepEqual(results.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[]);}
 assert.deepEqual(errors,[]);
});
