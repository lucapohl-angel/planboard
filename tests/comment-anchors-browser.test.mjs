import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,mkdir} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
import {chromium} from 'playwright';
import {startBoard} from '../src/server.mjs';
const plan=JSON.parse(await readFile(new URL('../examples/review-demo/legacy.json',import.meta.url)));
test('offline alternatives queue visibly and comment anchors follow collapsing cards', {timeout:60000},async t=>{
 const cwd=await mkdtemp(path.join(os.tmpdir(),'comment-anchors-'));t.after(()=>rm(cwd,{recursive:true,force:true}));
 const board=await startBoard({cwd});t.after(()=>board.close());const record=await board.store.save(plan);
 const browser=await chromium.launch({channel:process.env.PLANBOARD_BROWSER_CHANNEL,headless:true});t.after(()=>browser.close());const page=await browser.newPage({viewport:{width:1900,height:1100}});page.setDefaultTimeout(10000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(board.url);await page.locator('#plan:not([hidden])').waitFor();
 await page.keyboard.press('a');assert.equal(await page.locator('#annotate-toggle').getAttribute('aria-pressed'),'true');
 await page.keyboard.press('a');assert.equal(await page.locator('#annotate-toggle').getAttribute('aria-pressed'),'false');
 await page.keyboard.press('Control+a');assert.equal(await page.locator('#annotate-toggle').getAttribute('aria-pressed'),'false');
 await page.keyboard.press('a');await page.locator('#objective').click();
 await page.getByLabel('Requested change',{exact:true}).fill('');await page.keyboard.type('a');assert.equal(await page.getByLabel('Requested change',{exact:true}).inputValue(),'a');assert.equal(await page.locator('#annotate-toggle').getAttribute('aria-pressed'),'true');
 await page.keyboard.press('Escape');await page.locator('#ask-dialog').waitFor({state:'hidden'});assert.equal(await page.locator('#annotate-toggle').getAttribute('aria-pressed'),'false');
 await page.keyboard.press('a');await page.locator('#objective').click();assert.equal(await page.getByLabel('Requested change',{exact:true}).inputValue(),'a');assert.equal(await page.locator('#suggest-alternatives').evaluate(n=>getComputedStyle(n).cursor),'pointer');
 await page.locator('#suggest-alternatives').click();await page.locator('#ask-status').filter({hasText:'Request queued.'}).waitFor();
 assert.equal((await board.store.read(record.id)).discussions.length,1);assert.equal(await page.locator('#suggest-alternatives').isDisabled(),true);await page.locator('#ask-close').click();
 // Save notes on opposite sides of the same disclosure.
 for(const key of ['now','out','now']){
   await page.locator(`[data-target="scope:${key}"] h2`).click();await page.getByLabel('Requested change',{exact:true}).fill('Review '+key);await page.locator('#save-review-note').click();await page.locator('#ask-dialog').waitFor({state:'hidden'});
 }
 await page.locator('#annotate-toggle').click();const summary=page.locator('#overview-view>.section-fold>summary');
 await page.locator('[data-target="scope:now"]').scrollIntoViewIfNeeded();await page.locator('.comment-pin').first().waitFor();await page.locator('.comment-pin').first().click();
 await summary.click();await page.waitForTimeout(150);assert.equal(await page.locator('#comment-dialog').getAttribute('data-collapsed'),'true');
 const pins=page.locator('.comment-pin[data-collapsed=true]');assert.equal(await pins.count(),1);assert.equal(await pins.first().textContent(),'3');assert.deepEqual((await pins.evaluateAll(ns=>ns.map(n=>n.dataset.side))).sort(),['right']);
 const bounds=await summary.boundingBox();for(const pin of await pins.all()){const r=await pin.boundingBox(),side=await pin.getAttribute('data-side');assert.ok(Math.abs(r.y+r.height/2-bounds.y-bounds.height/2)<6);assert.ok(Math.abs(r.x+r.width/2-(side==='left'?bounds.x:bounds.x+bounds.width))<20);}
 const dir=new URL('../artifacts/comment-anchors/',import.meta.url);await mkdir(dir,{recursive:true});await page.screenshot({path:new URL('collapsed-desktop.png',dir).pathname});
 await page.locator('#close-comment').click();await pins.first().click();assert.equal(await page.locator('#comment-body>div').count(),3);await page.locator('#close-comment').click();await summary.click();await page.locator('[data-target="scope:now"]').scrollIntoViewIfNeeded();await page.waitForTimeout(150);assert.equal(await page.locator('.comment-pin[data-collapsed=true]').count(),0);assert.equal(await page.locator('.comment-pin').count(),2);
 // Repeated toggles and mobile scrolling keep markers attached to the header.
 await summary.click();await page.setViewportSize({width:390,height:844});await summary.scrollIntoViewIfNeeded();await page.waitForTimeout(150);assert.equal(await pins.count(),1);
 const before=await pins.first().boundingBox();await page.evaluate(()=>scrollBy(0,40));await page.waitForTimeout(150);const after=await pins.first().boundingBox();assert.ok(after.y<before.y);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.screenshot({path:new URL('collapsed-mobile.png',dir).pathname});const footer=await page.locator('#review-footer').evaluate(n=>({border:getComputedStyle(n).borderColor,filter:getComputedStyle(n).backdropFilter}));assert.equal(footer.border,'rgb(255, 107, 120)');assert.match(footer.filter,/blur/);assert.deepEqual(errors,[]);
});
