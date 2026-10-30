import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,rm,mkdir} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {chromium} from 'playwright';
import {startBoard} from '../src/server.mjs';import {openReviewDetails} from './review-helpers.mjs';
test('quick actions work offline, undo is immediate, and Markdown paths fit desktop/mobile',{timeout:60000},async t=>{
 const cwd=await mkdtemp(path.join(os.tmpdir(),'planboard-local-browser-'));t.after(()=>rm(cwd,{recursive:true,force:true}));
 const board=await startBoard({cwd});t.after(()=>board.close());const r=await board.store.save({title:'Pet shop',kind:'website',brief:'A small pet shop',objective:'Buy dog products.'});
 const browser=await chromium.launch({channel:process.env.PLANBOARD_BROWSER_CHANNEL,headless:true});t.after(()=>browser.close());const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(board.url);await openReviewDetails(page);await page.locator('#plan-files a').waitFor();assert.match(await page.locator('#plan-files code').textContent(),/\.reviewed\.md$/);
 await page.locator('#annotate-toggle').click();await page.locator('#objective').click();await page.locator('#quick-actions summary').click();await page.locator('#saved-explanation').click();await page.locator('#ask-thread .agent-answer').filter({hasText:'Buy dog products.'}).waitFor();assert.equal((await board.store.read(r.id)).discussions.at(-1).status,'answered');
 await page.keyboard.press('Escape');await board.store.patch(r.id,1,[{path:'objective',value:'Buy cat products.'}]);await page.locator('#objective').filter({hasText:'Buy cat products.'}).waitFor();
 await page.locator('#annotate-toggle').click();await page.locator('#objective').click();if(!await page.locator('#quick-actions').evaluate(e=>e.open))await page.locator('#quick-actions summary').click();await page.locator('#undo-change').click();await page.locator('#ask-thread .agent-answer').filter({hasText:'Undid the changes'}).waitFor();assert.equal((await board.store.read(r.id)).plan.objective,'Buy dog products.');
 const dir=new URL('../artifacts/deterministic/',import.meta.url);await mkdir(dir,{recursive:true});
 for(const width of [1440,390]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:new URL('quick-'+width+'.png',dir).pathname});}
 await page.keyboard.press('Escape');await page.locator('#approve-plan').click();assert.match(await page.locator('#approval-path').textContent(),/-r3\.approved\.md$/);
 await page.route('**/api/current',async route=>{const response=await route.fetch();const body=await response.json();delete body.reviewProtocol;await route.fulfill({response,json:body});});await page.reload();await page.locator('#error').filter({hasText:'Reconnect'}).waitFor();assert.equal(await page.locator('#approve-plan').isDisabled(),true);assert.equal(await page.locator('#plan-files a').count(),0);assert.deepEqual(errors,[]);
});
