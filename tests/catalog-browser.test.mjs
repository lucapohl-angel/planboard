import {openReviewDetails,openSection} from './review-helpers.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
import {chromium} from 'playwright';
import {startBoard} from '../src/server.mjs';
import {nodeTypes,diagramColors} from '../web/diagram-spec.js';
const example=JSON.parse(await readFile(new URL('../examples/studio-website.json',import.meta.url)));
test('every catalogue type renders; a custom domain survives storage, export and annotation', {timeout:60000},async t=>{
 const cwd=await mkdtemp(path.join(os.tmpdir(),'catalog-browser-'));t.after(()=>rm(cwd,{recursive:true,force:true}));const board=await startBoard({cwd});t.after(()=>board.close());
 const types=Object.keys(nodeTypes),diagrams=[];
 for(let start=0;start<types.length;start+=20){const nodes=types.slice(start,start+20).map((type,i)=>({id:type,label:nodeTypes[type].label,type,column:i%4,row:Math.floor(i/4),...(type==='custom'?{customType:{label:'Build <artifact>',description:'A signed release package.',baseType:'storage'}}:{})}));diagrams.push({id:'catalog-'+start,title:'Catalogue examples '+(start/20+1),description:'Test of visual vocabulary across planning domains.',nodes,layers:[{id:'roles',title:'Responsibilities',description:'All roles in this view.',nodes:nodes.map(n=>({nodeId:n.id,summary:nodeTypes[n.type].label,detail:nodeTypes[n.type].description})),edges:[]}]});}
 const record=await board.store.save({...example,kind:'other',title:'Cross-domain catalogue check',diagrams});const customDiagram=diagrams.at(-1),custom=customDiagram.nodes.find(n=>n.type==='custom');
 const exported=await (await fetch(board.url+`api/plans/${record.id}/export`)).json();assert.deepEqual(exported.plan.diagrams.at(-1).nodes.at(-1).customType,custom.customType);
 const md=await (await fetch(board.url+`api/plans/${record.id}/export?format=md`)).text();assert.match(md,/A signed release package/);
 const browser=await chromium.launch({channel:process.env.PLANBOARD_BROWSER_CHANNEL,headless:true});t.after(()=>browser.close());const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(board.url);await openReviewDetails(page);await page.locator('[data-map="'+customDiagram.id+'"]').click();await page.locator('[data-node=custom]').waitFor();
 const specs=await page.locator('.system-canvas .system-node').evaluateAll(ns=>ns.map(n=>({type:n.dataset.nodeKind,icon:n.querySelector('svg path').getAttribute('d'),color:n.style.getPropertyValue('--node-color')})));
 assert.equal(specs.length,types.length);for(const spec of specs){assert.ok(spec.icon&&spec.icon.length>10,spec.type);const source=spec.type==='custom'?'storage':spec.type;assert.equal(spec.color,diagramColors[nodeTypes[source].color]);}
 await page.locator('[data-node=custom]').click();assert.equal(await page.locator('.system-detail').last().getByText(custom.customType.description,{exact:true}).count(),1);assert.equal(await page.locator('.diagram-legend').last().getByText(custom.customType.label,{exact:true}).count(),1);assert.equal(await page.locator('artifact').count(),0);
 await page.locator('#annotate-toggle').click();await page.locator('[data-node=custom]').click();await page.getByLabel('Requested change',{exact:true}).fill('Explain this package.');await page.getByRole('button',{name:'Save for review',exact:true}).click();await page.locator('#ask-dialog').waitFor({state:'hidden'});assert.equal((await board.store.read(record.id)).feedback[0].annotation.nodeId,'custom');await page.locator('#annotate-toggle').click();
 await page.locator('.system-scroll').nth(3).screenshot({path:new URL('../artifacts/expanded-node-catalog.png',import.meta.url).pathname});
 for(const width of [1440,390]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
 assert.deepEqual(errors,[]);
});
