import {openReviewDetails,openSection} from './review-helpers.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import { startBoard } from '../src/server.mjs';
const example = JSON.parse(await readFile(new URL('../examples/studio-website.json', import.meta.url)));
test('single-plan canvas retains feedback, protects revisions and exports plan.md', {timeout:60000}, async t => {
 const cwd=await mkdtemp(path.join(os.tmpdir(),'canvas-'));t.after(()=>rm(cwd,{recursive:true,force:true}));
 const board=await startBoard({cwd});t.after(()=>board.close());
 await board.store.save({...example,title:'An older plan'});const record=await board.store.save(example);
 const browser=await chromium.launch({channel:process.env.PLANBOARD_BROWSER_CHANNEL,headless:true});t.after(()=>browser.close());const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(10000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(board.url);await openReviewDetails(page);await page.locator('#title').filter({hasText:example.title}).waitFor();
 assert.equal(await page.locator('#new-plan,#plan-list,#import').count(),0);assert.equal(await page.getByText('An older plan',{exact:true}).count(),0);
 assert.equal(await page.evaluate(()=>getComputedStyle(document.body).backgroundColor),'rgb(16, 18, 17)');
 for(const id of ['overview-view','system-view','flow-view','questions-view'])assert.equal(await page.locator('#'+id).isVisible(),true);
 await page.locator('[data-step=build]').click();await page.getByLabel('Feedback on this step',{exact:true}).fill('Reuse our components.');await page.getByRole('button',{name:'Save step feedback',exact:true}).click();
 await page.locator('#notice').filter({hasText:'Feedback saved'}).waitFor();assert.equal((await board.store.read(record.id)).feedback[0].target,'build');
 await page.getByLabel('Your notes',{exact:true}).fill('Keep this draft');await page.reload();await openReviewDetails(page);assert.equal(await page.getByLabel('Your notes',{exact:true}).inputValue(),'Keep this draft');
 await board.store.save({...example,title:'Revised canvas'},{id:record.id,expectedRevision:1});
 await page.getByRole('button',{name:'Save feedback',exact:true}).click();await page.locator('#error').filter({hasText:'newer revision'}).waitFor();assert.equal(await page.getByLabel('Your notes',{exact:true}).inputValue(),'Keep this draft');
 await page.locator('#title').filter({hasText:'Revised canvas'}).waitFor();await openReviewDetails(page);await page.getByRole('button',{name:'Save feedback',exact:true}).click();await page.locator('#comments-toggle').click();await page.locator('#history').filter({hasText:'Keep this draft'}).waitFor();await page.getByRole('button',{name:'Close notes'}).click();
 assert.match(await (await fetch(board.url+`api/plans/${record.id}/export?format=md`)).text(),/Keep this draft/);assert.match(await readFile(path.join(cwd,'.pi/plans/plan.md'),'utf8'),/Keep this draft/);
 const axe=await readFile(new URL('../node_modules/axe-core/axe.min.js',import.meta.url),'utf8');await page.evaluate(axe);
 const artifacts=new URL('../artifacts/',import.meta.url);await mkdir(artifacts,{recursive:true});
 for(const width of [1440,900,390]){
  await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.locator('[data-step=build]').focus();await page.keyboard.press('Enter');
  for(const selector of ['#step-detail form','#feedback-form','.question']){const gap=await page.locator(selector).first().evaluate(f=>{const r=f.querySelector('textarea').getBoundingClientRect(),b=f.querySelector('.actions button').getBoundingClientRect();return b.top-r.bottom});assert.equal(gap,16);}
  const result=await page.evaluate(async()=>axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}}));assert.deepEqual(result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[]);
 }
 await page.setViewportSize({width:1440,height:1000});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:new URL('chalk-desktop.png',artifacts).pathname});
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:new URL('chalk-mobile.png',artifacts).pathname});assert.deepEqual(errors,[]);
});
