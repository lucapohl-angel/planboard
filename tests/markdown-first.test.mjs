import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {PlanStore} from '../src/plans.mjs';import {saveMarkdownPlan,readMarkdownPlan} from '../src/markdown-plan.mjs';import {markdownHeadings,sourceTargets} from '../web/source-links.js';
test('Markdown is required, read from disk exactly, and preserved through revisions',async t=>{
 const cwd=await mkdtemp(path.join(os.tmpdir(),'markdown-first-'));t.after(()=>rm(cwd,{recursive:true,force:true}));const store=new PlanStore(cwd),plan={title:'Migration',kind:'software',brief:'Complete A0, then A1.'};
 await assert.rejects(saveMarkdownPlan(store,{plan}),/Markdown|\.md/);assert.deepEqual(await store.list(),[]);
 await assert.rejects(saveMarkdownPlan(store,{plan,markdownPath:'missing.md'}),/ENOENT/);
 const md='# Plan\r\n\r\n## A0. Inventory\r\nRead the code.\r\n\r\n## A1. Migration\r\nKeep the checks.\r\n';await writeFile(path.join(cwd,'plan.md'),md);
 const r=await saveMarkdownPlan(store,{plan:{...plan,sourceDocument:{name:'fake',sections:[]}},markdownPath:'plan.md'});assert.equal(r.plan.sourceDocument.sections.map(s=>s.content).join(''),md);assert.equal(r.plan.sourceDocument.path,path.join(cwd,'plan.md'));assert.equal(await readFile(path.join(cwd,'plan.md'),'utf8'),md);
 await writeFile(path.join(cwd,'plan.md'),'# Changed elsewhere');const next=await saveMarkdownPlan(store,{id:r.id,expectedRevision:1,plan:{...r.plan,brief:'Review A0 and A1.'}});assert.deepEqual(next.plan.sourceDocument,r.plan.sourceDocument);assert.equal(next.revision,2);await assert.rejects(readMarkdownPlan(cwd,'.pi/plans/plan.md'),/viewer-generated/);
 const big='# Long plan\n'+('detail '.repeat(13000));await writeFile(path.join(cwd,'large.md'),big);assert.equal((await readMarkdownPlan(cwd,'large.md')).sections.map(s=>s.content).join(''),big);
});
test('only actual headings become targets; ambiguous codes and fenced examples do not misdirect',()=>{
 const content='# Plan\n\n## A0. First\nText\n```md\n## A1. Example only\n```\n\nA2. A real section\n---\n\n## A0. Second\n';
 const index=sourceTargets({sections:[{id:'part',content}]});assert.equal(index.aliases.get('a0'),null);assert.equal(index.aliases.has('a1'),false);assert.equal(index.aliases.get('a2').title,'A2. A real section');assert.equal(markdownHeadings(content).length,4);
});
